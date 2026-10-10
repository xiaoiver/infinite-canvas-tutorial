import { mat4, vec3 } from 'gl-matrix';
import type {
  GizmoAxis,
  GizmoPartKind,
} from '../../components/geometry3d/Selected3D';
import type { Transform3D } from '../../components/geometry3d/Transform3D';
import {
  angleOnRotationPlane,
  intersectRayWithPlane,
  isRotateGizmoAxis,
  rotationPlaneNormal,
  unwrapAngleDelta,
} from '../../utils/gizmo-interaction';
import type { Ray } from '../../utils/ray-casting';

type Vec3 = [number, number, number];
export type GizmoPose = Pick<Transform3D, 'translation' | 'rotation' | 'scale'>;

export function copyGizmoPose(pose: GizmoPose): GizmoPose {
  return {
    translation: [...pose.translation],
    rotation: [...pose.rotation],
    scale: [...pose.scale],
  };
}

export function sameGizmoPose(a: GizmoPose, b: GizmoPose): boolean {
  return (['translation', 'rotation', 'scale'] as const).every((key) =>
    a[key].every((value, i) => Math.abs(value - b[key][i]) < 1e-7),
  );
}

/** A fixed constraint and initial pose, independent of ECS and document history. */
export interface GizmoGesture {
  axis: Exclude<GizmoAxis, 'none'>;
  kind: GizmoPartKind;
  initial: GizmoPose;
  normal: Vec3;
  hit: Vec3;
  lastAngle: number;
  angle: number;
}

export function beginGizmoGesture(
  pose: GizmoPose,
  axis: GizmoAxis,
  kind: GizmoPartKind,
  ray: Ray,
): GizmoGesture | undefined {
  if (axis === 'none') return;
  let normal: Vec3;
  if (kind === 'rotate') {
    if (!isRotateGizmoAxis(axis)) return;
    normal = rotationPlaneNormal(pose.rotation, axis);
  } else if (isRotateGizmoAxis(axis)) {
    // Face the initial ray while containing the axis. A fixed XZ plane makes
    // the X arrow impossible to drag with a front-facing orthographic camera.
    normal = [...ray.direction];
    normal[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] = 0;
    if (vec3.length(normal) < 1e-8) return;
    vec3.normalize(normal, normal);
  } else {
    normal = axis === 'xy' ? [0, 0, 1] : axis === 'xz' ? [0, 1, 0] : [1, 0, 0];
  }
  const hit = intersectRayWithPlane(ray, pose.translation, normal);
  if (!hit) return;
  return beginGizmoGestureAtPoint(pose, axis, kind, hit, normal);
}

export function beginGizmoGestureAtPoint(
  pose: GizmoPose,
  axis: GizmoAxis,
  kind: GizmoPartKind,
  hit: Vec3,
  normal: Vec3 = [0, 0, 1],
): GizmoGesture | undefined {
  if (axis === 'none' || (kind === 'rotate' && !isRotateGizmoAxis(axis)))
    return;
  const angle =
    kind === 'rotate' && isRotateGizmoAxis(axis)
      ? angleOnRotationPlane(hit, pose.translation, axis, pose.rotation)
      : 0;
  return {
    axis,
    kind,
    initial: copyGizmoPose(pose),
    normal,
    hit,
    lastAngle: angle,
    angle: 0,
  };
}

export function updateGizmoGesture(
  gesture: GizmoGesture,
  ray: Ray,
): GizmoPose | undefined {
  const { initial, normal } = gesture;
  const hit = intersectRayWithPlane(ray, initial.translation, normal);
  if (!hit) return;
  return updateGizmoGestureAtPoint(gesture, hit);
}

export function updateGizmoGestureAtPoint(
  gesture: GizmoGesture,
  hit: Vec3,
): GizmoPose {
  const { initial, axis } = gesture;
  const pose = copyGizmoPose(initial);
  if (gesture.kind === 'translate') {
    for (let i = 0; i < 3; i++) {
      if (axis.includes('xyz'[i]))
        pose.translation[i] += hit[i] - gesture.hit[i];
    }
  } else if (isRotateGizmoAxis(axis)) {
    const angle = angleOnRotationPlane(
      hit,
      initial.translation,
      axis,
      initial.rotation,
    );
    gesture.angle += unwrapAngleDelta(angle - gesture.lastAngle);
    gesture.lastAngle = angle;
    // The existing XZ tangent basis has the opposite orientation for Y.
    const delta = gesture.angle * (axis === 'y' ? -1 : 1);
    if (Math.abs(delta) < 1e-10) return pose;
    const m = mat4.create();
    mat4.rotateX(m, m, initial.rotation[0]);
    mat4.rotateY(m, m, initial.rotation[1]);
    mat4.rotateZ(m, m, initial.rotation[2]);
    // Rings follow the object's local axes: compose rotations, rather than
    // adding to one Euler component (which uses a different axis after rotation).
    if (axis === 'x') mat4.rotateX(m, m, delta);
    if (axis === 'y') mat4.rotateY(m, m, delta);
    if (axis === 'z') mat4.rotateZ(m, m, delta);
    const y = Math.asin(Math.max(-1, Math.min(1, m[8])));
    pose.rotation =
      Math.abs(m[8]) < 0.9999999
        ? [Math.atan2(-m[9], m[10]), y, Math.atan2(-m[4], m[0])]
        : [Math.atan2(m[6], m[5]), y, 0];
  }
  return pose;
}
