import { GizmoShape, type GizmoShapeArgs } from './shape';
import {
  createConeAlongAxis,
  createCylinderAlongAxis,
  mergeGeometry,
} from './primitives';

/** Options for an {@link ArrowShape}. */
export interface ArrowShapeArgs extends GizmoShapeArgs {
  axis: 'x' | 'y' | 'z';
  shaftLength?: number;
  shaftRadius?: number;
  coneHeight?: number;
  coneRadius?: number;
  segments?: number;
}

/**
 * A single-axis translate arrow: a cylinder shaft capped by a cone tip.
 * Equivalent to the per-axis arrow previously built in `createTranslateGizmo`.
 */
export class ArrowShape extends GizmoShape {
  constructor(args: ArrowShapeArgs) {
    const {
      axis,
      shaftLength = 0.7,
      shaftRadius = 0.02,
      coneHeight = 0.2,
      coneRadius = 0.06,
      segments = 12,
    } = args;

    const shaft = createCylinderAlongAxis(axis, shaftRadius, shaftLength, segments);
    const cone = createConeAlongAxis(axis, coneRadius, coneHeight, shaftLength, segments);

    super(args, mergeGeometry(shaft, cone));
  }
}
