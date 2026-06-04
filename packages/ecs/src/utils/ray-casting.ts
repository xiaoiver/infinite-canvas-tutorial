import { mat4 as glMat4, vec3 as glVec3, vec4 as glVec4 } from 'gl-matrix';

/**
 * A ray defined by an origin and a normalized direction in world space.
 */
export interface Ray {
  origin: [number, number, number];
  direction: [number, number, number];
}

/**
 * Result of a ray-mesh intersection test.
 */
export interface RayHitResult {
  /** Distance along the ray to the hit point. */
  t: number;
  /** Hit point in world space. */
  point: [number, number, number];
  /** Triangle index that was hit (face index). */
  triangleIndex: number;
}

/**
 * Axis-aligned bounding box.
 */
export interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Generate a picking ray from viewport (pixel) coordinates.
 *
 * @param viewportX - X in viewport pixels (0 = left)
 * @param viewportY - Y in viewport pixels (0 = top)
 * @param viewportWidth - Viewport width in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param invViewProjection - Inverse of the combined view-projection matrix (column-major Float32Array or number[])
 */
export function screenToRay(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  invViewProjection: Float32Array | number[],
): Ray {
  // Convert viewport to NDC [-1, 1]
  const ndcX = (2 * viewportX) / viewportWidth - 1;
  const ndcY = 1 - (2 * viewportY) / viewportHeight; // flip Y

  // Near point in NDC (z = -1 in OpenGL convention)
  const nearNDC = glVec4.fromValues(ndcX, ndcY, -1, 1);
  // Far point in NDC (z = 1)
  const farNDC = glVec4.fromValues(ndcX, ndcY, 1, 1);

  const invVP = invViewProjection as unknown as glMat4;

  // Unproject near
  const nearWorld = glVec4.create();
  glVec4.transformMat4(nearWorld, nearNDC, invVP);
  if (Math.abs(nearWorld[3]) > 1e-10) {
    nearWorld[0] /= nearWorld[3];
    nearWorld[1] /= nearWorld[3];
    nearWorld[2] /= nearWorld[3];
  }

  // Unproject far
  const farWorld = glVec4.create();
  glVec4.transformMat4(farWorld, farNDC, invVP);
  if (Math.abs(farWorld[3]) > 1e-10) {
    farWorld[0] /= farWorld[3];
    farWorld[1] /= farWorld[3];
    farWorld[2] /= farWorld[3];
  }

  const origin: [number, number, number] = [
    nearWorld[0],
    nearWorld[1],
    nearWorld[2],
  ];
  const dir = glVec3.create();
  glVec3.subtract(
    dir,
    [farWorld[0], farWorld[1], farWorld[2]],
    origin,
  );
  glVec3.normalize(dir, dir);

  return {
    origin,
    direction: [dir[0], dir[1], dir[2]],
  };
}

/**
 * Compute the AABB of a set of positions (interleaved xyz) after applying a
 * model matrix transform.
 */
export function computeTransformedAABB(
  positions: Float32Array,
  modelMatrix: Float32Array | number[],
): AABB {
  const mat = modelMatrix as unknown as glMat4;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  const v = glVec3.create();
  for (let i = 0; i < positions.length; i += 3) {
    glVec3.set(v, positions[i], positions[i + 1], positions[i + 2]);
    glVec3.transformMat4(v, v, mat);
    if (v[0] < min[0]) min[0] = v[0];
    if (v[1] < min[1]) min[1] = v[1];
    if (v[2] < min[2]) min[2] = v[2];
    if (v[0] > max[0]) max[0] = v[0];
    if (v[1] > max[1]) max[1] = v[1];
    if (v[2] > max[2]) max[2] = v[2];
  }

  return { min, max };
}

/**
 * Test a ray against an AABB (slab method).
 * Returns true if the ray intersects the box.
 */
export function rayIntersectsAABB(ray: Ray, aabb: AABB): boolean {
  let tmin = -Infinity;
  let tmax = Infinity;

  for (let i = 0; i < 3; i++) {
    const invD = 1 / ray.direction[i];
    let t0 = (aabb.min[i] - ray.origin[i]) * invD;
    let t1 = (aabb.max[i] - ray.origin[i]) * invD;
    if (invD < 0) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) return false;
  }

  return tmax >= 0;
}

/**
 * Möller–Trumbore ray-triangle intersection algorithm.
 * Returns the distance `t` along the ray, or -1 if no intersection.
 */
export function rayTriangleIntersection(
  ray: Ray,
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number],
): number {
  const EPSILON = 1e-7;

  const edge1 = glVec3.create();
  const edge2 = glVec3.create();
  glVec3.subtract(edge1, v1, v0);
  glVec3.subtract(edge2, v2, v0);

  const h = glVec3.create();
  glVec3.cross(h, ray.direction, edge2);
  const a = glVec3.dot(edge1, h);

  if (a > -EPSILON && a < EPSILON) {
    return -1; // Ray is parallel to triangle
  }

  const f = 1 / a;
  const s = glVec3.create();
  glVec3.subtract(s, ray.origin, v0);
  const u = f * glVec3.dot(s, h);
  if (u < 0 || u > 1) return -1;

  const q = glVec3.create();
  glVec3.cross(q, s, edge1);
  const v = f * glVec3.dot(ray.direction, q);
  if (v < 0 || u + v > 1) return -1;

  const t = f * glVec3.dot(edge2, q);
  if (t > EPSILON) return t;

  return -1;
}

/**
 * Test a ray against a mesh (positions + optional indices) with a model matrix.
 * Uses AABB culling first, then per-triangle Möller–Trumbore.
 *
 * @returns The closest hit result, or null if no intersection.
 */
export function rayMeshIntersection(
  ray: Ray,
  positions: Float32Array,
  indices: Uint32Array | null,
  modelMatrix: Float32Array | number[],
): RayHitResult | null {
  const mat = modelMatrix as unknown as glMat4;

  // AABB broad-phase
  const aabb = computeTransformedAABB(positions, modelMatrix);
  if (!rayIntersectsAABB(ray, aabb)) {
    return null;
  }

  // Narrow phase: per-triangle test
  let closestT = Infinity;
  let closestTriangleIdx = -1;

  const v0 = glVec3.create();
  const v1 = glVec3.create();
  const v2 = glVec3.create();

  const triangleCount = indices
    ? indices.length / 3
    : positions.length / 9;

  for (let tri = 0; tri < triangleCount; tri++) {
    let i0: number, i1: number, i2: number;
    if (indices) {
      i0 = indices[tri * 3] * 3;
      i1 = indices[tri * 3 + 1] * 3;
      i2 = indices[tri * 3 + 2] * 3;
    } else {
      i0 = tri * 9;
      i1 = tri * 9 + 3;
      i2 = tri * 9 + 6;
    }

    // Transform vertices by model matrix
    glVec3.set(v0, positions[i0], positions[i0 + 1], positions[i0 + 2]);
    glVec3.transformMat4(v0, v0, mat);
    glVec3.set(v1, positions[i1], positions[i1 + 1], positions[i1 + 2]);
    glVec3.transformMat4(v1, v1, mat);
    glVec3.set(v2, positions[i2], positions[i2 + 1], positions[i2 + 2]);
    glVec3.transformMat4(v2, v2, mat);

    const t = rayTriangleIntersection(
      ray,
      v0 as unknown as [number, number, number],
      v1 as unknown as [number, number, number],
      v2 as unknown as [number, number, number],
    );

    if (t >= 0 && t < closestT) {
      closestT = t;
      closestTriangleIdx = tri;
    }
  }

  if (closestTriangleIdx < 0) {
    return null;
  }

  const point: [number, number, number] = [
    ray.origin[0] + ray.direction[0] * closestT,
    ray.origin[1] + ray.direction[1] * closestT,
    ray.origin[2] + ray.direction[2] * closestT,
  ];

  return { t: closestT, point, triangleIndex: closestTriangleIdx };
}

/**
 * Compute the model matrix from Transform3D fields.
 */
export function computeModelMatrix(
  translation: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
): Float32Array {
  const m = glMat4.create();
  glMat4.translate(m, m, translation);
  glMat4.rotateX(m, m, rotation[0]);
  glMat4.rotateY(m, m, rotation[1]);
  glMat4.rotateZ(m, m, rotation[2]);
  glMat4.scale(m, m, scale);
  return m as unknown as Float32Array;
}

/** Scene matrices for 3D picking (must match {@link mesh3d} shader paths). */
export type Mesh3DPickScene =
  | {
      mode: 'standard';
      projMatrix: Float32Array;
      viewMatrix: Float32Array;
    }
  | {
      mode: 'orthographic2d';
      projMatrix: Float32Array;
      viewMatrix: Float32Array;
    }
  | {
      mode: 'linkedPerspective';
      projMatrix: Float32Array;
      viewMatrix: Float32Array;
      canvasViewProjection: Float32Array;
    };

/**
 * Project a world-space point to clip space using the linked-perspective path in
 * {@link mesh3d} (per-object canvas anchor).
 */
export function projectWorldToClipLinkedPerspective(
  world: [number, number, number],
  anchor: [number, number, number],
  canvasViewProjection: Float32Array | number[],
  viewMatrix: Float32Array | number[],
  projMatrix: Float32Array | number[],
  /** Matches gizmo display shader (sceneParams.xy) for linked-canvas Z handles. */
  zScreenBias?: [number, number],
): { clip: [number, number, number, number]; pickDepth: number } {
  const canvasVP = canvasViewProjection as unknown as glMat4;
  const view = viewMatrix as unknown as glMat4;
  const proj = projMatrix as unknown as glMat4;

  const clip2d = glVec4.create();
  glVec4.transformMat4(clip2d, glVec4.fromValues(world[0], world[1], 0, 1), canvasVP);

  const anchor2d = glVec4.create();
  glVec4.transformMat4(
    anchor2d,
    glVec4.fromValues(anchor[0], anchor[1], 0, 1),
    canvasVP,
  );

  const viewPos = glVec4.create();
  glVec4.transformMat4(
    viewPos,
    glVec4.fromValues(world[0], world[1], world[2], 1),
    view,
  );

  const clipP = glVec4.create();
  glVec4.transformMat4(clipP, viewPos, proj);

  const viewRef = glVec4.create();
  glVec4.transformMat4(
    viewRef,
    glVec4.fromValues(world[0], world[1], anchor[2], 1),
    view,
  );

  const clipPwRef = glVec4.create();
  glVec4.transformMat4(clipPwRef, viewRef, proj);

  let pw = clipP[3];
  if (Math.abs(pw) < 1e-6) {
    pw = pw >= 0 ? 1e-6 : -1e-6;
  }
  const scale = clipPwRef[3] / pw;

  let clipX = anchor2d[0] + (clip2d[0] - anchor2d[0]) * scale;
  let clipY = anchor2d[1] + (clip2d[1] - anchor2d[1]) * scale;
  const clipZ = (clipP[2] * clip2d[3]) / pw;
  const clipW = clip2d[3];
  if (zScreenBias) {
    const zDelta = world[2] - anchor[2];
    clipX += zScreenBias[0] * zDelta * clipW;
    clipY += zScreenBias[1] * zDelta * clipW;
  }

  return {
    clip: [clipX, clipY, clipZ, clipW],
    // Nearer faces have larger clipP.w (see mesh3d vertex shader).
    pickDepth: clipP[3] / clipPwRef[3],
  };
}

function clipToViewport(
  clip: [number, number, number, number],
  viewportWidth: number,
  viewportHeight: number,
): [number, number] {
  const w = clip[3];
  const ndcX = Math.abs(w) > 1e-10 ? clip[0] / w : clip[0];
  const ndcY = Math.abs(w) > 1e-10 ? clip[1] / w : clip[1];
  return [
    ((ndcX + 1) * viewportWidth) / 2,
    ((1 - ndcY) * viewportHeight) / 2,
  ];
}

function pointInTriangle2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): { inside: boolean; u: number; v: number; w: number } {
  const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denom) < 1e-10) {
    return { inside: false, u: 0, v: 0, w: 0 };
  }
  const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
  const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
  const w = 1 - u - v;
  return { inside: u >= 0 && v >= 0 && w >= 0, u, v, w };
}

/**
 * Screen-space mesh pick for linked perspective (matches mesh3d vertex shader).
 */
export function pickMeshLinkedPerspective(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  positions: Float32Array,
  indices: Uint32Array | null,
  modelMatrix: Float32Array | number[],
  anchor: [number, number, number],
  scene: Extract<Mesh3DPickScene, { mode: 'linkedPerspective' }>,
  zScreenBias?: [number, number],
): RayHitResult | null {
  const mat = modelMatrix as unknown as glMat4;
  const v0 = glVec3.create();
  const v1 = glVec3.create();
  const v2 = glVec3.create();
  const world0: [number, number, number] = [0, 0, 0];
  const world1: [number, number, number] = [0, 0, 0];
  const world2: [number, number, number] = [0, 0, 0];

  let closestDepth = -Infinity;
  let closestTriangleIdx = -1;
  let closestPoint: [number, number, number] | null = null;

  const triangleCount = indices
    ? indices.length / 3
    : positions.length / 9;

  for (let tri = 0; tri < triangleCount; tri++) {
    let i0: number, i1: number, i2: number;
    if (indices) {
      i0 = indices[tri * 3] * 3;
      i1 = indices[tri * 3 + 1] * 3;
      i2 = indices[tri * 3 + 2] * 3;
    } else {
      i0 = tri * 9;
      i1 = tri * 9 + 3;
      i2 = tri * 9 + 6;
    }

    glVec3.set(v0, positions[i0], positions[i0 + 1], positions[i0 + 2]);
    glVec3.transformMat4(v0, v0, mat);
    glVec3.set(v1, positions[i1], positions[i1 + 1], positions[i1 + 2]);
    glVec3.transformMat4(v1, v1, mat);
    glVec3.set(v2, positions[i2], positions[i2 + 1], positions[i2 + 2]);
    glVec3.transformMat4(v2, v2, mat);

    world0[0] = v0[0];
    world0[1] = v0[1];
    world0[2] = v0[2];
    world1[0] = v1[0];
    world1[1] = v1[1];
    world1[2] = v1[2];
    world2[0] = v2[0];
    world2[1] = v2[1];
    world2[2] = v2[2];

    const proj0 = projectWorldToClipLinkedPerspective(
      world0,
      anchor,
      scene.canvasViewProjection,
      scene.viewMatrix,
      scene.projMatrix,
      zScreenBias,
    );
    const proj1 = projectWorldToClipLinkedPerspective(
      world1,
      anchor,
      scene.canvasViewProjection,
      scene.viewMatrix,
      scene.projMatrix,
      zScreenBias,
    );
    const proj2 = projectWorldToClipLinkedPerspective(
      world2,
      anchor,
      scene.canvasViewProjection,
      scene.viewMatrix,
      scene.projMatrix,
      zScreenBias,
    );

    const p0 = clipToViewport(proj0.clip, viewportWidth, viewportHeight);
    const p1 = clipToViewport(proj1.clip, viewportWidth, viewportHeight);
    const p2 = clipToViewport(proj2.clip, viewportWidth, viewportHeight);

    const bc = pointInTriangle2D(
      viewportX,
      viewportY,
      p0[0],
      p0[1],
      p1[0],
      p1[1],
      p2[0],
      p2[1],
    );
    if (!bc.inside) continue;

    const depth =
      bc.u * proj0.pickDepth + bc.v * proj1.pickDepth + bc.w * proj2.pickDepth;
    if (depth > closestDepth) {
      closestDepth = depth;
      closestTriangleIdx = tri;
      closestPoint = [
        bc.u * world0[0] + bc.v * world1[0] + bc.w * world2[0],
        bc.u * world0[1] + bc.v * world1[1] + bc.w * world2[1],
        bc.u * world0[2] + bc.v * world1[2] + bc.w * world2[2],
      ];
    }
  }

  if (closestTriangleIdx < 0 || !closestPoint) {
    return null;
  }

  return {
    // Negate so callers can use `hit.t < closest.t` (same as ray distance).
    t: -closestDepth,
    point: closestPoint,
    triangleIndex: closestTriangleIdx,
  };
}

/**
 * Pick a mesh at viewport coordinates using the same projection as rendering.
 */
export function pickMeshAtViewport(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  positions: Float32Array,
  indices: Uint32Array | null,
  modelMatrix: Float32Array | number[],
  anchor: [number, number, number],
  scene: Mesh3DPickScene,
  zScreenBias?: [number, number],
): RayHitResult | null {
  if (scene.mode === 'linkedPerspective') {
    return pickMeshLinkedPerspective(
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
      positions,
      indices,
      modelMatrix,
      anchor,
      scene,
      zScreenBias,
    );
  }

  const invVP = computeInvViewProjection(
    scene.projMatrix,
    scene.viewMatrix,
  );

  const ray = screenToRay(
    viewportX,
    viewportY,
    viewportWidth,
    viewportHeight,
    invVP,
  );
  return rayMeshIntersection(ray, positions, indices, modelMatrix);
}

/**
 * Compute the inverse view-projection matrix from separate proj and view matrices.
 */
export function computeInvViewProjection(
  projMatrix: Float32Array | number[],
  viewMatrix: Float32Array | number[],
): Float32Array {
  const vp = glMat4.create();
  glMat4.multiply(
    vp,
    projMatrix as unknown as glMat4,
    viewMatrix as unknown as glMat4,
  );
  const inv = glMat4.create();
  glMat4.invert(inv, vp);
  return inv as unknown as Float32Array;
}
