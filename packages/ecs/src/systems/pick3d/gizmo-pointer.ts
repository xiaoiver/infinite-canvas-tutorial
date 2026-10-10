import { mat4, vec3 } from 'gl-matrix';
import type {
  GizmoAxis,
  GizmoPartKind,
} from '../../components/geometry3d/Selected3D';
import {
  buildGizmoModelMatrix,
  gizmoPartUsesLinkedZScreenBias,
  isRotateGizmoAxis,
} from '../../utils/gizmo-interaction';
import {
  projectGizmoPoint,
  type GizmoFrame,
  type GizmoPoint,
  type GizmoViewportPoint,
} from '../../utils/gizmo-frame';
import { screenToRay } from '../../utils/ray-casting';
import {
  beginGizmoGesture,
  beginGizmoGestureAtPoint,
  updateGizmoGesture,
  updateGizmoGestureAtPoint,
  type GizmoPose,
} from './gizmo-gesture';

export interface GizmoPointerGesture {
  initial: GizmoPose;
  axis: Exclude<GizmoAxis, 'none'>;
  kind: GizmoPartKind;
  update(pointer: GizmoViewportPoint): GizmoPose | undefined;
}

/** Capture the display frame once: previews must not feed back into drag sensitivity. */
export function beginGizmoPointerGesture(
  pose: GizmoPose,
  axis: GizmoAxis,
  kind: GizmoPartKind,
  frame: GizmoFrame,
  pointer: GizmoViewportPoint,
  hit: GizmoPoint,
): GizmoPointerGesture | undefined {
  if (axis === 'none' || (kind === 'rotate' && !isRotateGizmoAxis(axis)))
    return;
  if (frame.scene.mode !== 'linkedPerspective') {
    const vp = mat4.multiply(
      mat4.create(),
      frame.scene.projMatrix,
      frame.scene.viewMatrix,
    );
    const inverse = mat4.invert(mat4.create(), vp);
    if (!inverse) return;
    const ray = (p: GizmoViewportPoint) =>
      screenToRay(...p, frame.width, frame.height, inverse as Float32Array);
    const gesture = beginGizmoGesture(pose, axis, kind, ray(pointer));
    if (!gesture) return;
    return { ...gesture, update: (p) => updateGizmoGesture(gesture, ray(p)) };
  }

  const applyBias = gizmoPartUsesLinkedZScreenBias(kind, axis);
  const project = (p: GizmoPoint) => projectGizmoPoint(frame, p, applyBias);
  if (kind === 'translate' && isRotateGizmoAxis(axis)) {
    const index = 'xyz'.indexOf(axis);
    const tip: GizmoPoint = [...frame.anchor];
    tip[index] += frame.scale;
    const a = project(frame.anchor);
    const b = project(tip);
    if (!a || !b) return;
    const x = b[0] - a[0];
    const y = b[1] - a[1];
    const lengthSquared = x * x + y * y;
    if (lengthSquared < 1e-8) return;
    const gesture = beginGizmoGestureAtPoint(pose, axis, kind, frame.anchor)!;
    return {
      ...gesture,
      update(p) {
        const point: GizmoPoint = [...frame.anchor];
        point[index] +=
          (((p[0] - pointer[0]) * x + (p[1] - pointer[1]) * y) * frame.scale) /
          lengthSquared;
        return updateGizmoGestureAtPoint(gesture, point);
      },
    };
  }

  let u: GizmoPoint;
  let v: GizmoPoint;
  if (kind === 'rotate') {
    const m = buildGizmoModelMatrix([0, 0, 0], pose.rotation, 1, kind);
    const first = axis === 'x' ? 4 : 0;
    const second = axis === 'z' ? 4 : 8;
    u = [m[first], m[first + 1], m[first + 2]];
    v = [m[second], m[second + 1], m[second + 2]];
  } else {
    u = axis === 'yz' ? [0, 1, 0] : [1, 0, 0];
    v = axis === 'xy' ? [0, 1, 0] : [0, 0, 1];
  }
  // Linked perspective is anchor-dependent and nonlinear. It has no single
  // camera ray; invert the displayed projection on the active constraint plane.
  const relative = vec3.subtract(vec3.create(), hit, frame.anchor);
  let coordinates: GizmoViewportPoint =
    kind === 'rotate' ? [vec3.dot(relative, u), vec3.dot(relative, v)] : [0, 0];
  const origin = kind === 'rotate' ? pointer : project(frame.anchor);
  if (!origin) return;
  const pointAt = (s: number, t: number): GizmoPoint =>
    frame.anchor.map((value, i) => value + u[i] * s + v[i] * t) as GizmoPoint;
  const solve = (target: GizmoViewportPoint): GizmoPoint | undefined => {
    let [s, t] = coordinates;
    const epsilon = Math.max(frame.scale * 0.01, 0.001);
    for (let iteration = 0; iteration < 16; iteration++) {
      const p = project(pointAt(s, t));
      const pu = project(pointAt(s + epsilon, t));
      const mu = project(pointAt(s - epsilon, t));
      const pv = project(pointAt(s, t + epsilon));
      const mv = project(pointAt(s, t - epsilon));
      if (!p || !pu || !mu || !pv || !mv) return;
      const a = (pu[0] - mu[0]) / (2 * epsilon);
      const b = (pv[0] - mv[0]) / (2 * epsilon);
      const c = (pu[1] - mu[1]) / (2 * epsilon);
      const d = (pv[1] - mv[1]) / (2 * epsilon);
      const determinant = a * d - b * c;
      if (
        Math.abs(determinant) < 1e-6 * Math.hypot(a, c) * Math.hypot(b, d) ||
        !determinant
      )
        return;
      const x = target[0] - p[0];
      const y = target[1] - p[1];
      if (Math.hypot(x, y) < 1e-4) {
        coordinates = [s, t];
        return pointAt(s, t);
      }
      const ds = (d * x - b * y) / determinant;
      const dt = (a * y - c * x) / determinant;
      let weight = Math.min(
        1,
        (frame.scale * 4) / Math.max(Math.abs(ds), Math.abs(dt)),
      );
      let improved = false;
      for (let trial = 0; trial < 8; trial++, weight *= 0.5) {
        const next = project(pointAt(s + ds * weight, t + dt * weight));
        if (
          next &&
          Math.hypot(target[0] - next[0], target[1] - next[1]) <
            Math.hypot(x, y)
        ) {
          s += ds * weight;
          t += dt * weight;
          improved = true;
          break;
        }
      }
      if (!improved) return;
    }
  };
  const start = solve(origin);
  if (!start) return;
  const gesture = beginGizmoGestureAtPoint(pose, axis, kind, start)!;
  return {
    ...gesture,
    update(p) {
      const point = solve(
        kind === 'rotate'
          ? p
          : [origin[0] + p[0] - pointer[0], origin[1] + p[1] - pointer[1]],
      );
      return point && updateGizmoGestureAtPoint(gesture, point);
    },
  };
}
