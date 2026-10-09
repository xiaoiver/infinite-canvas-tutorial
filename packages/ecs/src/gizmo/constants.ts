/**
 * Shared constants for the 3D transform gizmo, mirroring the structure of
 * PlayCanvas' `extras/gizmo/constants.js` while staying within this repo's
 * canvas (Y-down) world convention used by the 3D mesh pipeline.
 */

/** The three primary world axes a gizmo can manipulate. */
export const GIZMO_AXES = ['x', 'y', 'z'] as const;

/** A single world axis. */
export type GizmoSingleAxis = (typeof GIZMO_AXES)[number];

/** The three axis-aligned planes used by plane-drag handles. */
export const GIZMO_PLANES = ['xy', 'xz', 'yz'] as const;

/** A plane spanned by two world axes. */
export type GizmoPlane = (typeof GIZMO_PLANES)[number];

/**
 * Coordinate space a gizmo operates in.
 * - `world`: handles stay aligned with the world axes.
 * - `local`: handles follow the manipulated object's orientation.
 */
export type GizmoSpace = 'world' | 'local';

/**
 * How the non-active handles behave while dragging another handle.
 * - `show`: keep every handle visible.
 * - `hide`: hide all handles.
 * - `selected`: keep only the active handle visible.
 */
export type GizmoDragMode = 'show' | 'hide' | 'selected';

/** The kind of manipulation a gizmo handle performs. */
export type GizmoShapeKind = 'translate' | 'rotate' | 'scale';
