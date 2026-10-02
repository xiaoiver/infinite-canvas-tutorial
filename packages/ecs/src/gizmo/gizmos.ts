/**
 * Per-mode gizmo shape assemblers, mirroring PlayCanvas' Translate / Rotate /
 * Scale gizmo classes. Each function returns the list of {@link GizmoShape}s
 * that make up a gizmo; the render and pick systems consume these uniformly.
 *
 * The `transform` assembler reproduces this repo's existing Spline-style
 * combined translate + rotate gizmo so behavior is preserved.
 */
import {
  GIZMO_COLOR_XYZ,
  GIZMO_PLANE_ALPHA,
  axisColor,
  withAlpha,
} from './color';
import { GIZMO_AXES, GIZMO_PLANES } from './constants';
import { ArrowShape } from './shape/arrow-shape';
import { BoxShape } from './shape/box-shape';
import { PlaneShape } from './shape/plane-shape';
import { SphereShape } from './shape/sphere-shape';
import { TorusShape } from './shape/torus-shape';
import type { GizmoShape } from './shape/shape';

/** Translate arrow length in local gizmo units (shaft + cone). */
export const GIZMO_AXIS_ARROW_LENGTH = 0.9;

/** Rotate ring radius in local gizmo units. */
export const GIZMO_ROTATE_RING_RADIUS = 0.85;

/** The axis whose color a plane handle uses (its normal axis). */
const PLANE_NORMAL_AXIS: Record<'xy' | 'xz' | 'yz', 'x' | 'y' | 'z'> = {
  xy: 'z',
  xz: 'y',
  yz: 'x',
};

/** Translate arrows (per axis) plus translucent plane-drag handles. */
export function createTranslateShapes(): GizmoShape[] {
  const shapes: GizmoShape[] = [];
  for (const axis of GIZMO_AXES) {
    shapes.push(
      new ArrowShape({ axis, kind: 'translate', defaultColor: axisColor(axis) }),
    );
  }
  for (const plane of GIZMO_PLANES) {
    const color = withAlpha(axisColor(PLANE_NORMAL_AXIS[plane]), GIZMO_PLANE_ALPHA);
    shapes.push(new PlaneShape({ axis: plane, kind: 'translate', defaultColor: color }));
  }
  return shapes;
}

/** Rotation rings (per axis). */
export function createRotateShapes(): GizmoShape[] {
  return GIZMO_AXES.map(
    (axis) =>
      new TorusShape({ axis, kind: 'rotate', defaultColor: axisColor(axis) }),
  );
}

/** Per-axis scale boxes plus a center uniform-scale sphere. */
export function createScaleShapes(): GizmoShape[] {
  const shapes: GizmoShape[] = GIZMO_AXES.map(
    (axis) =>
      new BoxShape({ axis, kind: 'scale', defaultColor: axisColor(axis) }),
  );
  shapes.push(
    new SphereShape({ axis: 'xyz', kind: 'scale', defaultColor: [...GIZMO_COLOR_XYZ] }),
  );
  return shapes;
}

/** Combined translate + rotate gizmo (the default `transform` mode). */
export function createTransformShapes(): GizmoShape[] {
  return [...createTranslateShapes(), ...createRotateShapes()];
}
