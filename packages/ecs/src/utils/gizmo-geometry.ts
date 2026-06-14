/**
 * Public gizmo geometry API.
 *
 * Geometry generation now lives in the PlayCanvas-style `gizmo/` module as a
 * `GizmoShape` class hierarchy. This file adapts those shapes into the flat
 * `GizmoMeshData[]` consumed by `RenderGizmo3D` / `Pick3D`, and keeps the
 * screen-size scaling helper. The exported surface is unchanged so existing
 * call sites keep working.
 */
import {
  createRotateShapes,
  createScaleShapes,
  createTransformShapes,
  createTranslateShapes,
  GIZMO_AXIS_ARROW_LENGTH,
  GIZMO_ROTATE_RING_RADIUS,
  type GizmoShape,
} from '../gizmo';

export { GIZMO_AXIS_ARROW_LENGTH, GIZMO_ROTATE_RING_RADIUS };

/** Translate arrow/plane vs rotation ring (combined gizmo uses both). */
export type GizmoPartKind = 'translate' | 'rotate';

export interface GizmoMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Color for this gizmo part [r, g, b, a]. */
  color: [number, number, number, number];
  /** Which axis or plane this part represents. */
  axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';
  kind: GizmoPartKind;
}

/** Adapt a {@link GizmoShape} into the flat {@link GizmoMeshData} structure. */
function shapeToMeshData(shape: GizmoShape): GizmoMeshData {
  return {
    positions: shape.positions,
    normals: shape.normals,
    indices: shape.indices,
    color: shape.getColor(),
    axis: shape.axis as GizmoMeshData['axis'],
    kind: shape.kind as GizmoPartKind,
  };
}

/** Translate handles + rotation rings (Spline-style combined gizmo). */
export function createCombinedTransformGizmo(): GizmoMeshData[] {
  return createTransformShapes().map(shapeToMeshData);
}

/** Translate arrows + plane handles. */
export function createTranslateGizmo(): GizmoMeshData[] {
  return createTranslateShapes().map(shapeToMeshData);
}

/** Rotation rings. */
export function createRotateGizmo(): GizmoMeshData[] {
  return createRotateShapes().map(shapeToMeshData);
}

/** Scale boxes + center uniform handle (geometry only; drag is a later stage). */
export function createScaleGizmo(): GizmoMeshData[] {
  return createScaleShapes().map(shapeToMeshData);
}

/**
 * Compute gizmo scale factor to maintain constant screen size.
 * @param eyePosition - Camera eye in world space.
 * @param objectPosition - Gizmo center (object translation) in world space.
 * @param referenceFov - Camera fov in radians (for perspective).
 * @param viewportHeight - Viewport height in pixels.
 * @param desiredPixelSize - Desired gizmo size in pixels.
 */
export function computeGizmoScale(
  eyePosition: [number, number, number],
  objectPosition: [number, number, number],
  referenceFov: number,
  viewportHeight: number,
  desiredPixelSize = 150,
  /**
   * Linked 2D canvas: eye.xy 跟随平移，屏幕尺寸只随深度 (eye.z − object.z) 变化，
   * 不应随物体在画布 XY 上移动而变。
   */
  linked = false,
): number {
  let distance: number;
  if (linked) {
    distance = Math.abs(eyePosition[2] - objectPosition[2]);
    if (distance < 1e-4) {
      distance = 1e-4;
    }
  } else {
    const dx = eyePosition[0] - objectPosition[0];
    const dy = eyePosition[1] - objectPosition[1];
    const dz = eyePosition[2] - objectPosition[2];
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const worldPerPixel =
    (2 * distance * Math.tan(referenceFov / 2)) / viewportHeight;

  return worldPerPixel * desiredPixelSize;
}
