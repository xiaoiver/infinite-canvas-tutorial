import { mat4, vec4 } from 'gl-matrix';
import type { Camera3D } from '../components';
import { buildCamera3DSceneUniforms } from './mesh3d-scene';
import { screenToRay, type Ray } from './ray-casting';

export type ViewportPoint = readonly [number, number];

/** The free axonometric view is navigated independently of the 2D editor camera. */
export function isNavigableCamera3D(camera: Camera3D): boolean {
  return (
    !camera.linked &&
    camera.projection === 'orthographic' &&
    camera.orthographicHeight > 0
  );
}

/** Intersect the same view-projection ray used for mesh picking with an edit plane. */
export function camera3DPlanePoint(
  camera: Camera3D,
  viewport: ViewportPoint,
  width: number,
  height: number,
  planeZ = 0,
): [number, number, number] | null {
  if (!Number.isFinite(planeZ)) return null;
  const hit = camera3DPlaneHit(
    camera,
    viewport,
    width,
    height,
    [0, 0, planeZ],
    [0, 0, 1],
  );
  return hit && [hit[0], hit[1], planeZ];
}

/** A free 3D view's unprojected picking ray in world space. */
export function camera3DViewportRay(
  camera: Camera3D,
  viewport: ViewportPoint,
  width: number,
  height: number,
): Ray | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(viewport[0]) ||
    !Number.isFinite(viewport[1])
  )
    return null;
  const { projMatrix, viewMatrix, reverseDepth } = buildCamera3DSceneUniforms(
    camera,
    width / height,
  );
  const viewProjection = mat4.multiply(
    mat4.create(),
    projMatrix.toFloat32Array(),
    viewMatrix.toFloat32Array(),
  );
  const inverse = mat4.invert(mat4.create(), viewProjection);
  if (!inverse) return null;
  const ray = screenToRay(
    viewport[0],
    viewport[1],
    width,
    height,
    inverse,
    reverseDepth,
  );
  return [...ray.origin, ...ray.direction].every(Number.isFinite) ? ray : null;
}

/** Intersect a viewport ray with an arbitrary world-space edit plane. */
export function camera3DPlaneHit(
  camera: Camera3D,
  viewport: ViewportPoint,
  width: number,
  height: number,
  planePoint: readonly [number, number, number],
  planeNormal: readonly [number, number, number],
): [number, number, number] | null {
  if (
    !Number.isFinite(planePoint[0]) ||
    !Number.isFinite(planePoint[1]) ||
    !Number.isFinite(planePoint[2]) ||
    !Number.isFinite(planeNormal[0]) ||
    !Number.isFinite(planeNormal[1]) ||
    !Number.isFinite(planeNormal[2])
  )
    return null;
  const ray = camera3DViewportRay(camera, viewport, width, height);
  if (!ray) return null;
  const denominator =
    ray.direction[0] * planeNormal[0] +
    ray.direction[1] * planeNormal[1] +
    ray.direction[2] * planeNormal[2];
  if (Math.abs(denominator) < 1e-6) return null;
  const t =
    ((planePoint[0] - ray.origin[0]) * planeNormal[0] +
      (planePoint[1] - ray.origin[1]) * planeNormal[1] +
      (planePoint[2] - ray.origin[2]) * planeNormal[2]) /
    denominator;
  if (!Number.isFinite(t) || t < 0) return null;
  return [
    ray.origin[0] + ray.direction[0] * t,
    ray.origin[1] + ray.direction[1] * t,
    ray.origin[2] + ray.direction[2] * t,
  ];
}

/** Project a world point with the same matrix used by the free 3D render pass. */
export function camera3DViewportPoint(
  camera: Camera3D,
  point: readonly [number, number, number],
  width: number,
  height: number,
): [number, number] | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(point[0]) ||
    !Number.isFinite(point[1]) ||
    !Number.isFinite(point[2])
  )
    return null;
  const { projMatrix, viewMatrix } = buildCamera3DSceneUniforms(
    camera,
    width / height,
  );
  const clip = vec4.fromValues(...point, 1);
  vec4.transformMat4(clip, clip, viewMatrix.toFloat32Array());
  vec4.transformMat4(clip, clip, projMatrix.toFloat32Array());
  if (clip[3] <= 1e-8) return null;
  const projected: [number, number] = [
    ((clip[0] / clip[3] + 1) * width) / 2,
    ((1 - clip[1] / clip[3]) * height) / 2,
  ];
  return projected.every(Number.isFinite) ? projected : null;
}

/** Keep the ground point under the pointer while panning the camera. */
export function panCamera3D(
  camera: Camera3D,
  from: ViewportPoint,
  to: ViewportPoint,
  width: number,
  height: number,
): boolean {
  const start = camera3DPlanePoint(camera, from, width, height);
  const end = camera3DPlanePoint(camera, to, width, height);
  if (!start || !end) return false;
  const dx = start[0] - end[0];
  const dy = start[1] - end[1];
  camera.eye = [camera.eye[0] + dx, camera.eye[1] + dy, camera.eye[2]];
  camera.center = [
    camera.center[0] + dx,
    camera.center[1] + dy,
    camera.center[2],
  ];
  return true;
}

/** Zoom around a ground point rather than the center of the viewport. */
export function zoomCamera3D(
  camera: Camera3D,
  pointer: ViewportPoint,
  delta: number,
  width: number,
  height: number,
  zoomFactor: number,
): boolean {
  const anchor = camera3DPlanePoint(camera, pointer, width, height);
  if (!anchor) return false;
  const nextHeight = Math.max(
    10,
    Math.min(
      10000,
      camera.orthographicHeight * Math.pow(2, delta * zoomFactor),
    ),
  );
  if (!Number.isFinite(nextHeight)) return false;
  camera.orthographicHeight = nextHeight;
  const shifted = camera3DPlanePoint(camera, pointer, width, height);
  if (!shifted) return false;
  const dx = anchor[0] - shifted[0];
  const dy = anchor[1] - shifted[1];
  camera.eye = [camera.eye[0] + dx, camera.eye[1] + dy, camera.eye[2]];
  camera.center = [
    camera.center[0] + dx,
    camera.center[1] + dy,
    camera.center[2],
  ];
  return true;
}

/** Orbit around the current target; clamp elevation to keep ground picking usable. */
export function orbitCamera3D(
  camera: Camera3D,
  deltaX: number,
  deltaY: number,
): void {
  const [cx, cy, cz] = camera.center;
  const [x, y, z] = camera.eye.map(
    (value, index) => value - camera.center[index],
  );
  const radius = Math.hypot(x, y, z);
  if (radius < 1e-6) return;
  const azimuth = Math.atan2(y, x) - deltaX * 0.005;
  const elevation = Math.max(
    Math.PI / 36,
    Math.min((17 * Math.PI) / 36, Math.asin(z / radius) + deltaY * 0.005),
  );
  const horizontal = radius * Math.cos(elevation);
  camera.eye = [
    cx + horizontal * Math.cos(azimuth),
    cy + horizontal * Math.sin(azimuth),
    cz + radius * Math.sin(elevation),
  ];
}
