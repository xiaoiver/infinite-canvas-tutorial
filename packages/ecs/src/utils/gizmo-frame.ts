import { vec4 } from 'gl-matrix';
import {
  projectWorldToClipLinkedPerspective,
  type Mesh3DPickScene,
} from './ray-casting';
import { computeLinkedPerspectiveZGizmoScreenBias } from './gizmo-projection';
import {
  GIZMO_AXIS_ARROW_LENGTH,
  GIZMO_ROTATE_RING_RADIUS,
} from './gizmo-geometry';

export type GizmoPoint = [number, number, number];
export type GizmoViewportPoint = [number, number];

/** One object's display projection, in CSS pixels (never drawing-buffer pixels). */
export interface GizmoFrame {
  scene: Mesh3DPickScene;
  anchor: GizmoPoint;
  width: number;
  height: number;
  scale: number;
  zBias?: GizmoViewportPoint;
}

export function projectGizmoPoint(
  frame: GizmoFrame,
  point: GizmoPoint,
  applyZBias = false,
): GizmoViewportPoint | undefined {
  const { scene, anchor, width, height } = frame;
  let clip: ArrayLike<number>;
  if (scene.mode === 'linkedPerspective') {
    clip = projectWorldToClipLinkedPerspective(
      point,
      anchor,
      scene.canvasViewProjection,
      scene.viewMatrix,
      scene.projMatrix,
      applyZBias ? frame.zBias : undefined,
    ).clip;
  } else {
    const p = vec4.fromValues(...point, 1);
    vec4.transformMat4(p, p, scene.viewMatrix);
    vec4.transformMat4(p, p, scene.projMatrix);
    clip = p;
  }
  if (clip[3] <= 1e-8) return;
  const result: GizmoViewportPoint = [
    ((clip[0] / clip[3] + 1) * width) / 2,
    ((1 - clip[1] / clip[3]) * height) / 2,
  ];
  return result.every(Number.isFinite) ? result : undefined;
}

/** Shared by display, picking and the coordinate frame captured on pointer-down. */
export function createGizmoFrame(
  scene: Mesh3DPickScene,
  anchor: GizmoPoint,
  width: number,
  height: number,
): GizmoFrame | undefined {
  if (!(width > 0 && height > 0)) return;
  const frame: GizmoFrame = {
    scene,
    anchor: [...anchor],
    width,
    height,
    scale: 1,
  };
  const center = projectGizmoPoint(frame, anchor);
  // Camera-right stays at the anchor's view depth, including tilted cameras.
  const right =
    scene.mode === 'standard'
      ? [scene.viewMatrix[0], scene.viewMatrix[4], scene.viewMatrix[8]]
      : [1, 0, 0];
  const step = projectGizmoPoint(frame, [
    anchor[0] + right[0],
    anchor[1] + right[1],
    anchor[2] + right[2],
  ]);
  if (!center || !step) return;
  const pixelsPerUnit = Math.hypot(step[0] - center[0], step[1] - center[1]);
  if (pixelsPerUnit < 1e-6) return;
  // Preserve the linked gizmo's original default size, independent of depth/FOV.
  const pixels = scene.mode === 'standard' ? 150 : 150 * Math.tan(Math.PI / 8);
  frame.scale = pixels / pixelsPerUnit;
  if (scene.mode === 'linkedPerspective') {
    frame.zBias = computeLinkedPerspectiveZGizmoScreenBias(
      frame.anchor,
      frame.scale *
        Math.max(GIZMO_AXIS_ARROW_LENGTH, GIZMO_ROTATE_RING_RADIUS * 2),
      scene,
      width,
      height,
    );
  }
  return frame;
}
