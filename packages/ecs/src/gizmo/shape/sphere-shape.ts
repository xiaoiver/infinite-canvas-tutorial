import { GizmoShape, type GizmoShapeArgs } from './shape';
import { createSphere } from './primitives';

/** Options for a {@link SphereShape}. */
export interface SphereShapeArgs extends GizmoShapeArgs {
  radius?: number;
  segments?: number;
}

/**
 * A center sphere used as the uniform-scale / center handle (axis `xyz`).
 * Mirrors PlayCanvas' `SphereShape`.
 */
export class SphereShape extends GizmoShape {
  constructor(args: SphereShapeArgs) {
    const { radius = 0.1, segments = 16 } = args;
    super(args, createSphere(radius, segments));
  }
}
