import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import { Canvas } from '../components/Canvas';

/** True while a 3D gizmo axis drag is in progress (suppresses 2D brush selection). */
let gizmoDragging = false;

export function set3DGizmoDragging(active: boolean): void {
  gizmoDragging = active;
}

export function is3DGizmoDragging(): boolean {
  return gizmoDragging;
}

/** Per-canvas 3D gizmo mesh selection (avoids RenderTransformer reading Selected3D). */
const meshGizmoSelectedByCanvas = new WeakMap<Entity, boolean>();
const dirtyTransformerCanvases = new WeakSet<API>();

export function set3DMeshGizmoSelectedForCanvas(
  canvas: Entity,
  hasSelection: boolean,
): void {
  meshGizmoSelectedByCanvas.set(canvas, hasSelection);
  requestTransformerRefreshForCanvas(canvas);
}

export function has3DMeshGizmoSelectedForCanvas(canvas: Entity): boolean {
  return meshGizmoSelectedByCanvas.get(canvas) ?? false;
}

export function requestTransformerRefreshForCanvas(canvas: Entity): void {
  // Entity wrappers differ between API calls and ECS component references.
  // The canvas API is stable in both checked and unchecked Becsy builds.
  dirtyTransformerCanvases.add(canvas.read(Canvas).api);
}

export function consumeTransformerRefreshForCanvas(canvas: Entity): boolean {
  const api = canvas.read(Canvas).api;
  if (dirtyTransformerCanvases.has(api)) {
    dirtyTransformerCanvases.delete(api);
    return true;
  }
  return false;
}
