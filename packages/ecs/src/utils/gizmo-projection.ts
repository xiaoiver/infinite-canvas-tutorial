import type { Mesh3DPickScene } from './ray-casting';
import { projectWorldToClipLinkedPerspective } from './ray-casting';

const Z_SCREEN_DIR_NDC: [number, number] = [0.5, -0.55];

function ndcXY(clip: [number, number, number, number]): [number, number] {
  const w = clip[3];
  if (Math.abs(w) < 1e-10) {
    return [clip[0], clip[1]];
  }
  return [clip[0] / w, clip[1] / w];
}

function ndcDistance(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

function normalize2d(v: [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1]);
  if (len < 1e-10) {
    return [1, 0];
  }
  return [v[0] / len, v[1] / len];
}

/**
 * Per-unit-world-Z clip bias so the depth axis matches the X axis screen length
 * on linked perspective canvases (see gizmo3d-display vertex shader).
 */
export function computeLinkedPerspectiveZGizmoScreenBias(
  anchor: [number, number, number],
  gizmoWorldExtent: number,
  scene: Extract<Mesh3DPickScene, { mode: 'linkedPerspective' }>,
): [number, number] {
  if (gizmoWorldExtent < 1e-8) {
    return [0, 0];
  }

  const { canvasViewProjection, viewMatrix, projMatrix } = scene;

  const center = projectWorldToClipLinkedPerspective(
    anchor,
    anchor,
    canvasViewProjection,
    viewMatrix,
    projMatrix,
  );
  const xTip = projectWorldToClipLinkedPerspective(
    [anchor[0] + gizmoWorldExtent, anchor[1], anchor[2]],
    anchor,
    canvasViewProjection,
    viewMatrix,
    projMatrix,
  );
  const zTip = projectWorldToClipLinkedPerspective(
    [anchor[0], anchor[1], anchor[2] + gizmoWorldExtent],
    anchor,
    canvasViewProjection,
    viewMatrix,
    projMatrix,
  );

  const ndcCenter = ndcXY(center.clip);
  const xLen = ndcDistance(ndcCenter, ndcXY(xTip.clip));
  const zLen = ndcDistance(ndcCenter, ndcXY(zTip.clip));

  if (zLen >= xLen * 0.35) {
    return [0, 0];
  }

  const targetLen = Math.max(xLen, 1e-4);
  const dir = normalize2d(Z_SCREEN_DIR_NDC);
  return [
    (dir[0] * targetLen) / gizmoWorldExtent,
    (dir[1] * targetLen) / gizmoWorldExtent,
  ];
}
