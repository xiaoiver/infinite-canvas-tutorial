import { mat4, vec3 } from 'gl-matrix';

export const SHADOW_MAP_SIZE = 1024;
export const POINT_SHADOW_FACE_SIZE = 512;
export const POINT_SHADOW_COLUMNS = 3;
export const POINT_SHADOW_ROWS = 2;

export interface ShadowCasterBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  model: Float32Array;
}

function worldCorners(meshes: readonly ShadowCasterBounds[]): vec3[] {
  const points: vec3[] = [];
  for (const { min, max, model } of meshes) {
    for (let i = 0; i < 8; i++) {
      const p = vec3.fromValues(
        i & 1 ? max[0] : min[0],
        i & 2 ? max[1] : min[1],
        i & 4 ? max[2] : min[2],
      );
      vec3.transformMat4(p, p, model);
      if (p.every(Number.isFinite)) points.push(p);
    }
  }
  return points;
}

/** Fit one orthographic directional shadow camera around the current meshes. */
export function fitDirectionalShadow(
  direction: readonly number[],
  meshes: readonly ShadowCasterBounds[],
): Float32Array | null {
  const length = Math.hypot(...direction);
  if (!meshes.length || !Number.isFinite(length) || length < 1e-8) return null;
  const points = worldCorners(meshes);
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
  const projection = mat4.create();
  mat4.ortho(
    projection,
    min[0] - pad,
    max[0] + pad,
    min[1] - pad,
    max[1] + pad,
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
  const points = worldCorners(meshes);
  if (!points.length) return null;
  const eye = vec3.fromValues(position[0], position[1], position[2]);
  const ray = vec3.fromValues(
    direction[0] / length,
    direction[1] / length,
    direction[2] / length,
  );
  let minDepth = Infinity;
  let maxDepth = 0;
  for (const point of points) {
    const depth = vec3.dot(vec3.subtract(vec3.create(), point, eye), ray);
    if (depth > 0) {
      minDepth = Math.min(minDepth, depth);
      maxDepth = Math.max(maxDepth, depth);
    }
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
  const points = worldCorners(meshes);
  if (!points.length) return null;
  const eye = vec3.fromValues(position[0], position[1], position[2]);
  const far = Math.max(...points.map((point) => vec3.distance(eye, point)));
  const limit =
    Number.isFinite(range) && range > 0 ? Math.min(range, far) : far;
  if (!Number.isFinite(limit) || limit <= 0.1) return null;
  // A tiny near plane compresses perspective depth differences enough for
  // receiver bias to erase shadows at ordinary canvas distances.
  const near = Math.max(0.1, Math.min(5, limit * 0.02));
  const projection = mat4.perspective(
    mat4.create(),
    Math.PI / 2,
    1,
    near,
    limit + 1,
  );
  const faces: [vec3, vec3][] = [
    [
      [1, 0, 0],
      [0, -1, 0],
    ],
    [
      [-1, 0, 0],
      [0, -1, 0],
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [0, -1, 0],
      [0, 0, -1],
    ],
    [
      [0, 0, 1],
      [0, -1, 0],
    ],
    [
      [0, 0, -1],
      [0, -1, 0],
    ],
  ];
  return faces.map(([direction, up]) => {
    const target = vec3.add(vec3.create(), eye, direction);
    const view = mat4.lookAt(mat4.create(), eye, target, up);
    return new Float32Array(mat4.multiply(mat4.create(), projection, view));
  });
}
