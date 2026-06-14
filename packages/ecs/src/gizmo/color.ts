/**
 * Gizmo color helpers, mirroring PlayCanvas' `extras/gizmo/color.js`.
 *
 * The axis base colors are kept identical to the previous gizmo implementation
 * so the rendered output (and WebGL snapshots) does not change. Hover/disabled
 * colors and the lerp helpers follow PlayCanvas conventions (hover = lerp the
 * base color toward white) and are used to drive handle highlighting.
 */

/** RGBA color in the 0..1 range. */
export type GizmoColor = [number, number, number, number];

/** Red — the X axis. */
export const GIZMO_COLOR_X: GizmoColor = [1, 0.15, 0.15, 1];
/** Green — the Y axis. */
export const GIZMO_COLOR_Y: GizmoColor = [0.15, 1, 0.15, 1];
/** Blue — the Z (depth) axis. */
export const GIZMO_COLOR_Z: GizmoColor = [0.2, 0.45, 1, 1];
/** Light gray — uniform / center (xyz) handles. */
export const GIZMO_COLOR_XYZ: GizmoColor = [0.8, 0.8, 0.8, 1];
/** Gray — disabled handles. */
export const GIZMO_COLOR_GRAY: GizmoColor = [0.5, 0.5, 0.5, 1];
/** White — the hover target color. */
export const GIZMO_COLOR_WHITE: GizmoColor = [1, 1, 1, 1];

/** Default opacity used by translucent plane-drag handles. */
export const GIZMO_PLANE_ALPHA = 0.35;

/** Base color for a single world axis. */
export function axisColor(axis: 'x' | 'y' | 'z'): GizmoColor {
  if (axis === 'x') return [...GIZMO_COLOR_X];
  if (axis === 'y') return [...GIZMO_COLOR_Y];
  return [...GIZMO_COLOR_Z];
}

/** Linearly interpolate between two colors (component-wise). */
export function colorLerp(a: GizmoColor, b: GizmoColor, t: number): GizmoColor {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

/**
 * Hover color for a base color: lerp its RGB toward white by `t` (PlayCanvas
 * uses 0.75) while preserving the original alpha so translucent plane handles
 * stay translucent.
 */
export function hoverColor(color: GizmoColor, t = 0.75): GizmoColor {
  const lerped = colorLerp(color, GIZMO_COLOR_WHITE, t);
  lerped[3] = color[3];
  return lerped;
}

/** Return a copy of `color` with its alpha replaced. */
export function withAlpha(color: GizmoColor, alpha: number): GizmoColor {
  return [color[0], color[1], color[2], alpha];
}
