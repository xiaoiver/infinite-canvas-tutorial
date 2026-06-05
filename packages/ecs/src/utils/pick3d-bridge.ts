import type { Entity } from '@lastolivegames/becsy';

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
const dirtyTransformerCanvases = new WeakSet<Entity>();

export function set3DMeshGizmoSelectedForCanvas(
  canvas: Entity,
  hasSelection: boolean,
): void {
  meshGizmoSelectedByCanvas.set(canvas, hasSelection);
  dirtyTransformerCanvases.add(canvas);
}

export function has3DMeshGizmoSelectedForCanvas(canvas: Entity): boolean {
  return meshGizmoSelectedByCanvas.get(canvas) ?? false;
}

export function consumeTransformerRefreshForCanvas(canvas: Entity): boolean {
  if (dirtyTransformerCanvases.has(canvas)) {
    dirtyTransformerCanvases.delete(canvas);
    return true;
  }
  return false;
}
