import { mat4 as glMat4, vec3 as glVec3 } from 'gl-matrix';
import type { GizmoAxis } from '../components/geometry3d/Selected3D';
import {
  createCombinedTransformGizmo,
  type GizmoMeshData,
  type GizmoPartKind,
} from './gizmo-geometry';
import type { Ray } from './ray-casting';

const combinedParts = createCombinedTransformGizmo();

export function getGizmoMeshParts(): readonly GizmoMeshData[] {
  return combinedParts;
}

export function isRotateGizmoAxis(axis: GizmoAxis): axis is 'x' | 'y' | 'z' {
  return axis === 'x' || axis === 'y' || axis === 'z';
}

/** Linked canvas: Z screen bias only for the blue translate arrow (not rotation rings). */
export function gizmoPartUsesLinkedZScreenBias(
  partKind: GizmoPartKind,
  axis: string,
): boolean {
  return partKind === 'translate' && axis === 'z';
}

/** Translate handles stay world-aligned; rotate rings follow object euler. */
export function buildGizmoModelMatrix(
  translation: [number, number, number],
  rotation: [number, number, number],
  uniformScale: number,
  partKind: GizmoPartKind,
): glMat4 {
  const m = glMat4.create();
  glMat4.translate(m, m, translation);
  if (partKind === 'rotate') {
    glMat4.rotateX(m, m, rotation[0]);
    glMat4.rotateY(m, m, rotation[1]);
    glMat4.rotateZ(m, m, rotation[2]);
  }
  glMat4.scale(m, m, [uniformScale, uniformScale, uniformScale]);
  return m;
}

/** World-space normal of the local rotation plane (perpendicular to dragged ring). */
export function rotationPlaneNormal(
  rotation: [number, number, number],
  axis: 'x' | 'y' | 'z',
): [number, number, number] {
  const m = glMat4.create();
  glMat4.rotateX(m, m, rotation[0]);
  glMat4.rotateY(m, m, rotation[1]);
  glMat4.rotateZ(m, m, rotation[2]);
  const local =
    axis === 'x' ? glVec3.fromValues(1, 0, 0) : axis === 'y' ? glVec3.fromValues(0, 1, 0) : glVec3.fromValues(0, 0, 1);
  const out = glVec3.create();
  glVec3.transformMat4(out, local, m);
  glVec3.normalize(out, out);
  return [out[0], out[1], out[2]];
}

/** Angle in radians on the rotation plane through center (local tangent basis). */
export function angleOnRotationPlane(
  point: [number, number, number],
  center: [number, number, number],
  axis: 'x' | 'y' | 'z',
  rotation: [number, number, number],
): number {
  const m = glMat4.create();
  glMat4.rotateX(m, m, rotation[0]);
  glMat4.rotateY(m, m, rotation[1]);
  glMat4.rotateZ(m, m, rotation[2]);

  const uLocal =
    axis === 'x'
      ? glVec3.fromValues(0, 1, 0)
      : axis === 'y'
        ? glVec3.fromValues(1, 0, 0)
        : glVec3.fromValues(1, 0, 0);
  const vLocal =
    axis === 'x'
      ? glVec3.fromValues(0, 0, 1)
      : axis === 'y'
        ? glVec3.fromValues(0, 0, 1)
        : glVec3.fromValues(0, 1, 0);

  const u = glVec3.create();
  const v = glVec3.create();
  glVec3.transformMat4(u, uLocal, m);
  glVec3.transformMat4(v, vLocal, m);
  glVec3.normalize(u, u);
  glVec3.normalize(v, v);

  const rel = glVec3.fromValues(
    point[0] - center[0],
    point[1] - center[1],
    point[2] - center[2],
  );
  return Math.atan2(glVec3.dot(rel, v), glVec3.dot(rel, u));
}

export function unwrapAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function intersectRayWithPlane(
  ray: Ray,
  planePoint: [number, number, number],
  planeNormal: [number, number, number],
): [number, number, number] | null {
  const denom =
    ray.direction[0] * planeNormal[0] +
    ray.direction[1] * planeNormal[1] +
    ray.direction[2] * planeNormal[2];

  if (Math.abs(denom) < 1e-8) return null;

  const diff: [number, number, number] = [
    planePoint[0] - ray.origin[0],
    planePoint[1] - ray.origin[1],
    planePoint[2] - ray.origin[2],
  ];
  const t =
    (diff[0] * planeNormal[0] +
      diff[1] * planeNormal[1] +
      diff[2] * planeNormal[2]) /
    denom;

  if (t < 0) return null;

  return [
    ray.origin[0] + ray.direction[0] * t,
    ray.origin[1] + ray.direction[1] * t,
    ray.origin[2] + ray.direction[2] * t,
  ];
}
