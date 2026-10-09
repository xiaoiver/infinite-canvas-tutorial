import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import { Canvas } from '../components/Canvas';

/** Canvas ownership is stable even when Becsy returns a different entity wrapper. */
const draggingCanvases = new Set<API>();

// Retain the exported legacy API for integrations that do not supply a canvas.
let legacyDragging = false;
export function set3DGizmoDragging(api: API, active: boolean): void;
/** @deprecated Pass the owning API and active state for multi-canvas isolation. */
export function set3DGizmoDragging(active: boolean): void;
export function set3DGizmoDragging(api: API | boolean, active?: boolean): void {
  if (typeof api === 'boolean') legacyDragging = api;
  else if (active) draggingCanvases.add(api);
  else draggingCanvases.delete(api);
}

export function is3DGizmoDragging(canvas?: Entity): boolean {
  return (
    legacyDragging ||
    (canvas
      ? draggingCanvases.has(canvas.read(Canvas).api)
      : draggingCanvases.size > 0)
  );
}

/** Per-canvas 3D gizmo mesh selection (avoids RenderTransformer reading Selected3D). */
const meshGizmoSelectedByCanvas = new WeakMap<API, boolean>();
const dirtyTransformerCanvases = new WeakSet<API>();

export function set3DMeshGizmoSelectedForCanvas(
  canvas: Entity,
  hasSelection: boolean,
): void {
  meshGizmoSelectedByCanvas.set(canvas.read(Canvas).api, hasSelection);
  requestTransformerRefreshForCanvas(canvas);
}

export function has3DMeshGizmoSelectedForCanvas(canvas: Entity): boolean {
  return meshGizmoSelectedByCanvas.get(canvas.read(Canvas).api) ?? false;
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
