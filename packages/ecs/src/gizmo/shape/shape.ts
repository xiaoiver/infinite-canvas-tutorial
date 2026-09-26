/**
 * Base class for gizmo shapes, mirroring the role of PlayCanvas'
 * `extras/gizmo/shape/shape.js`.
 *
 * Unlike PlayCanvas (which builds a scene-graph `Entity` + `MeshInstance` per
 * shape), a shape here is a lightweight, renderer-agnostic container: it owns
 * its triangle mesh (positions / normals / indices) plus the per-state colors
 * and hover / disabled / visible flags. The render system reads this data to
 * build GPU buffers, and the pick system uses the same triangle data for CPU
 * ray intersection — so geometry is authored once, per shape.
 */
import type { GizmoColor } from '../color';
import { GIZMO_COLOR_GRAY, hoverColor } from '../color';
import type { GizmoShapeKind } from '../constants';
import type { RawGeometry } from './primitives';

/** Which axis (or plane) a shape represents. */
export type GizmoShapeAxis = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' | 'f';

/** Options shared by all gizmo shapes. */
export interface GizmoShapeArgs {
  /** The axis or plane this shape manipulates. */
  axis: GizmoShapeAxis;
  /** What kind of manipulation the shape performs. */
  kind: GizmoShapeKind;
  /** Base color when idle. */
  defaultColor: GizmoColor;
  /** Color when hovered. Defaults to {@link hoverColor}(defaultColor). */
  hoverColor?: GizmoColor;
  /** Color when disabled. Defaults to gray. */
  disabledColor?: GizmoColor;
}

/** A single, renderer-agnostic gizmo handle. */
export abstract class GizmoShape {
  /** The axis or plane this shape manipulates. */
  readonly axis: GizmoShapeAxis;

  /** What kind of manipulation the shape performs. */
  readonly kind: GizmoShapeKind;

  /** Base color when idle. */
  defaultColor: GizmoColor;

  /** Color when hovered. */
  hoverColor: GizmoColor;

  /** Color when disabled. */
  disabledColor: GizmoColor;

  /** Whether the shape is currently hovered. */
  hover = false;

  /** Whether the shape is disabled (non-interactive, dimmed). */
  disabled = false;

  /** Whether the shape is currently rendered. */
  visible = true;

  /** Vertex positions (x, y, z) in local gizmo units. */
  readonly positions: Float32Array;

  /** Per-vertex normals. */
  readonly normals: Float32Array;

  /** Triangle indices. */
  readonly indices: Uint32Array;

  protected constructor(args: GizmoShapeArgs, geometry: RawGeometry) {
    this.axis = args.axis;
    this.kind = args.kind;
    this.defaultColor = args.defaultColor;
    this.hoverColor = args.hoverColor ?? hoverColor(args.defaultColor);
    this.disabledColor = args.disabledColor ?? [...GIZMO_COLOR_GRAY];
    this.positions = new Float32Array(geometry.positions);
    this.normals = new Float32Array(geometry.normals);
    this.indices = new Uint32Array(geometry.indices);
  }

  /** The color to render with, based on the current state. */
  getColor(): GizmoColor {
    if (this.disabled) return this.disabledColor;
    if (this.hover) return this.hoverColor;
    return this.defaultColor;
  }
}
