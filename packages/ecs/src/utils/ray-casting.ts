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
