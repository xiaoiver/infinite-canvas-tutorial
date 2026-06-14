import { GizmoShape, type GizmoShapeArgs } from './shape';
import { createRotationRing } from './primitives';

/** Options for a {@link TorusShape}. */
export interface TorusShapeArgs extends GizmoShapeArgs {
  axis: 'x' | 'y' | 'z';
  radius?: number;
  tube?: number;
  segments?: number;
}

/**
 * A rotation ring (flat torus strip) in the plane perpendicular to `axis`.
 * Equivalent to the rings previously built in `createRotateGizmo`. Named
 * `TorusShape` to mirror PlayCanvas' ring/torus shape naming.
 */
export class TorusShape extends GizmoShape {
  constructor(args: TorusShapeArgs) {
    const { axis, radius = 0.85, tube = 0.05, segments = 48 } = args;
    super(args, createRotationRing(axis, radius, tube, segments));
  }
}
