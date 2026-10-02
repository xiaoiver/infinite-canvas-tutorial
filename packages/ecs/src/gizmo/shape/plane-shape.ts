import { GizmoShape, type GizmoShapeArgs } from './shape';
import { createPlaneQuad } from './primitives';

/** Options for a {@link PlaneShape}. */
export interface PlaneShapeArgs extends GizmoShapeArgs {
  axis: 'xy' | 'xz' | 'yz';
  size?: number;
  offset?: number;
}

/**
 * A translucent square plane-drag handle that moves two components at once.
 * Equivalent to the plane quads previously built in `createTranslateGizmo`.
 */
export class PlaneShape extends GizmoShape {
  constructor(args: PlaneShapeArgs) {
    const { axis, size = 0.15, offset = 0.25 } = args;
    super(args, createPlaneQuad(axis, size, offset));
  }
}
