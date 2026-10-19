import { mat4, vec3 } from 'gl-matrix';

export const SHADOW_MAP_SIZE = 1024;

export interface ShadowCasterBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  model: Float32Array;
}

/** Fit one orthographic directional shadow camera around the current meshes. */
export function fitDirectionalShadow(
  direction: readonly number[],
  meshes: readonly ShadowCasterBounds[],
): Float32Array | null {
  const length = Math.hypot(...direction);
  if (!meshes.length || !Number.isFinite(length) || length < 1e-8) return null;
  const points: vec3[] = [];
  const worldMin = vec3.fromValues(Infinity, Infinity, Infinity);
  const worldMax = vec3.fromValues(-Infinity, -Infinity, -Infinity);
  for (const { min, max, model } of meshes) {
    for (let i = 0; i < 8; i++) {
      const p = vec3.fromValues(
        i & 1 ? max[0] : min[0],
        i & 2 ? max[1] : min[1],
        i & 4 ? max[2] : min[2],
      );
      vec3.transformMat4(p, p, model);
      if (!p.every(Number.isFinite)) continue;
      points.push(p);
      vec3.min(worldMin, worldMin, p);
      vec3.max(worldMax, worldMax, p);
    }
  }
  if (!points.length) return null;
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
  const up: [number, number, number] = Math.abs(ray[1]) > 0.95
    ? [0, 0, 1]
    : [0, 1, 0];
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
