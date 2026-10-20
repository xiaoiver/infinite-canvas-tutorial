import { mat4, vec3, vec4 } from 'gl-matrix';
import { POINT_SHADOW_FACES } from '../../utils/geometry3d/point-shadow-faces';

export const SHADOW_MAP_SIZE = 1024;
export const POINT_SHADOW_FACE_SIZE = 512;
export const POINT_SHADOW_COLUMNS = 3;
export const POINT_SHADOW_ROWS = 2;

export interface ShadowCasterBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  model: Float32Array;
  /** Optional world-space corners computed once for this render frame. */
  corners?: readonly vec3[];
}

export function meshWorldCorners({
  min,
  max,
  model,
}: ShadowCasterBounds): vec3[] {
  const points: vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const p = vec3.fromValues(
      i & 1 ? max[0] : min[0],
      i & 2 ? max[1] : min[1],
      i & 4 ? max[2] : min[2],
    );
    vec3.transformMat4(p, p, model);
    if (p.every(Number.isFinite)) points.push(p);
  }
  return points;
}

/** Keep a caster unless one shadow clip plane excludes all transformed bounds. */
export function intersectsShadowFrustum(
  corners: readonly vec3[],
  viewProjection: Float32Array,
): boolean {
  if (corners.length !== 8) return true;
  const outside = [true, true, true, true, true, true];
  const clip = vec4.create();
  for (const corner of corners) {
    vec4.set(clip, corner[0], corner[1], corner[2], 1);
    vec4.transformMat4(clip, clip, viewProjection);
    const [x, y, z, w] = clip;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      !Number.isFinite(w)
    )
      return true;
    const epsilon = 1e-4 * Math.max(1, Math.abs(w));
    if (x >= -w - epsilon) outside[0] = false;
    if (x <= w + epsilon) outside[1] = false;
    if (y >= -w - epsilon) outside[2] = false;
    if (y <= w + epsilon) outside[3] = false;
    if (z >= -w - epsilon) outside[4] = false;
    if (z <= w + epsilon) outside[5] = false;
    if (outside.every((value) => !value)) return true;
  }
  return !outside.some(Boolean);
}

function meshCorners(mesh: ShadowCasterBounds): readonly vec3[] {
  return mesh.corners ?? meshWorldCorners(mesh);
}

function sceneWorldCorners(meshes: readonly ShadowCasterBounds[]): vec3[] {
  return meshes.flatMap((mesh) => meshCorners(mesh));
}

function snapDirectionalAxis(
  min: number,
  max: number,
  pad: number,
  viewTranslation: number,
): [number, number] {
  const halfSpan = (max - min) * 0.5 + pad;
  const texelSize = (halfSpan * 2) / SHADOW_MAP_SIZE;
  // Remove the view translation before snapping so the texel grid stays
  // anchored in world space even when the fitted light camera follows a mesh.
  const worldCenter = (min + max) * 0.5 - viewTranslation;
  const center =
    Math.round(worldCenter / texelSize) * texelSize + viewTranslation;
  return [center - halfSpan, center + halfSpan];
}

/** Fit one orthographic directional shadow camera around the current meshes. */
export function fitDirectionalShadow(
  direction: readonly number[],
  meshes: readonly ShadowCasterBounds[],
): Float32Array | null {
  const length = Math.hypot(...direction);
  if (!meshes.length || !Number.isFinite(length) || length < 1e-8) return null;
  const points = sceneWorldCorners(meshes);
  if (!points.length) return null;
  const worldMin = vec3.fromValues(Infinity, Infinity, Infinity);
  const worldMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  for (const p of points) {
    vec3.min(worldMin, worldMin, p);
    vec3.max(worldMax, worldMax, p);
  }
  const center = vec3.create();
  vec3.add(center, worldMin, worldMax);
  vec3.scale(center, center, 0.5);
  const radius = Math.max(1, vec3.distance(worldMin, worldMax) * 0.5);
  const ray = vec3.fromValues(
    direction[0] / length,
    direction[1] / length,
    direction[2] / length,
  );
  const eye = vec3.create();
  vec3.scaleAndAdd(eye, center, ray, -radius * 3);
  const up: [number, number, number] =
    Math.abs(ray[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  const view = mat4.create();
  mat4.lookAt(view, eye, center, up);
  const min = vec3.fromValues(Infinity, Infinity, Infinity);
  const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  const viewPoint = vec3.create();
  for (const point of points) {
    vec3.transformMat4(viewPoint, point, view);
    vec3.min(min, min, viewPoint);
    vec3.max(max, max, viewPoint);
  }
  const pad = Math.max(1, radius * 0.05);
  const [left, right] = snapDirectionalAxis(min[0], max[0], pad, view[12]);
  const [bottom, top] = snapDirectionalAxis(min[1], max[1], pad, view[13]);
  const projection = mat4.create();
  mat4.ortho(
    projection,
    left,
    right,
    bottom,
    top,
    Math.max(0.01, -max[2] - pad),
    -min[2] + pad,
  );
  const vp = mat4.create();
  mat4.multiply(vp, projection, view);
  return new Float32Array(vp);
}

/** Perspective shadow camera using the spotlight cone and finite scene depth. */
export function fitSpotShadow(
  position: readonly number[],
  direction: readonly number[],
  outerConeAngle: number,
  range: number,
  meshes: readonly ShadowCasterBounds[],
): Float32Array | null {
  const length = Math.hypot(...direction);
  if (
    position.length !== 3 ||
    !position.every(Number.isFinite) ||
    !Number.isFinite(length) ||
    length < 1e-8 ||
    !Number.isFinite(outerConeAngle) ||
    outerConeAngle <= 0 ||
    outerConeAngle >= (85 * Math.PI) / 180
  )
    return null;
  const eye = vec3.fromValues(position[0], position[1], position[2]);
  const ray = vec3.fromValues(
    direction[0] / length,
    direction[1] / length,
    direction[2] / length,
  );
  let minDepth = Infinity;
  let maxDepth = 0;
  for (const mesh of meshes) {
    let meshMinDepth = Infinity;
    let meshMaxDepth = -Infinity;
    for (const point of meshCorners(mesh)) {
      const depth = vec3.dot(vec3.subtract(vec3.create(), point, eye), ray);
      meshMinDepth = Math.min(meshMinDepth, depth);
      meshMaxDepth = Math.max(meshMaxDepth, depth);
      if (depth > 0) minDepth = Math.min(minDepth, depth);
    }
    if (meshMinDepth <= 0 && meshMaxDepth > 0) minDepth = 0;
    maxDepth = Math.max(maxDepth, meshMaxDepth);
  }
  if (!Number.isFinite(minDepth)) return null;
  const near = Math.max(0.1, minDepth * 0.5);
  const far =
    Number.isFinite(range) && range > 0
      ? Math.min(range, maxDepth + Math.max(1, maxDepth * 0.05))
      : maxDepth + Math.max(1, maxDepth * 0.05);
  if (far <= near + 0.01) return null;
  const target = vec3.add(vec3.create(), eye, ray);
  const up: [number, number, number] =
    Math.abs(ray[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  const view = mat4.lookAt(mat4.create(), eye, target, up);
  const projection = mat4.perspective(
    mat4.create(),
    outerConeAngle * 2,
    1,
    near,
    far,
  );
  return new Float32Array(mat4.multiply(mat4.create(), projection, view));
}

/** Six 90° cameras ordered +X, -X, +Y, -Y, +Z, -Z. */
export function fitPointShadow(
  position: readonly number[],
  range: number,
  meshes: readonly ShadowCasterBounds[],
): Float32Array[] | null {
  if (position.length !== 3 || !position.every(Number.isFinite)) return null;
  const eye = vec3.fromValues(position[0], position[1], position[2]);
  let far = 0;
  let nearestBounds = Infinity;
  for (const mesh of meshes) {
    const points = meshCorners(mesh);
    if (!points.length) continue;
    const min = vec3.fromValues(Infinity, Infinity, Infinity);
    const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    for (const point of points) {
      far = Math.max(far, vec3.distance(eye, point));
      vec3.min(min, min, point);
      vec3.max(max, max, point);
    }
    const dx = Math.max(min[0] - eye[0], 0, eye[0] - max[0]);
    const dy = Math.max(min[1] - eye[1], 0, eye[1] - max[1]);
    const dz = Math.max(min[2] - eye[2], 0, eye[2] - max[2]);
    nearestBounds = Math.min(nearestBounds, Math.hypot(dx, dy, dz));
  }
  const limit =
    Number.isFinite(range) && range > 0 ? Math.min(range, far) : far;
  if (!Number.isFinite(limit) || limit <= 0.1) return null;
  // Keep the depth-friendly near plane unless a mesh reaches closer to the
  // light. Its world AABB gives a conservative lower bound even when rotated.
  const near = Math.max(0.1, Math.min(5, limit * 0.02, nearestBounds * 0.5));
  const projection = mat4.perspective(
    mat4.create(),
    Math.PI / 2,
    1,
    near,
    limit + 1,
  );
  return POINT_SHADOW_FACES.map(({ direction, up }) => {
    const target = vec3.add(vec3.create(), eye, direction);
    const view = mat4.lookAt(mat4.create(), eye, target, up);
    return new Float32Array(mat4.multiply(mat4.create(), projection, view));
  });
}
