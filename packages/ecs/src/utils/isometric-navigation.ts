import { mat4 } from 'gl-matrix';
import type { Camera3D } from '../components';
import { buildCamera3DSceneUniforms } from './mesh3d-scene';
import { screenToRay } from './ray-casting';

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
  if (width <= 0 || height <= 0) return null;
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
  if (Math.abs(ray.direction[2]) < 1e-6) return null;
  const t = (planeZ - ray.origin[2]) / ray.direction[2];
  if (!Number.isFinite(t)) return null;
  return [
    ray.origin[0] + ray.direction[0] * t,
    ray.origin[1] + ray.direction[1] * t,
    planeZ,
  ];
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
