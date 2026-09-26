import { GizmoShape, type GizmoShapeArgs } from './shape';
import { createBoxAlongAxis } from './primitives';

/** Options for a {@link BoxShape}. */
export interface BoxShapeArgs extends GizmoShapeArgs {
  axis: 'x' | 'y' | 'z';
  size?: number;
  offset?: number;
}

/**
 * A small axis box used as a single-axis scale handle, offset along its axis.
 * Mirrors PlayCanvas' `BoxShape` used by the scale gizmo.
 */
export class BoxShape extends GizmoShape {
  constructor(args: BoxShapeArgs) {
    const { axis, size = 0.12, offset = 0.8 } = args;
    super(args, createBoxAlongAxis(axis, size, offset));
  }
}
