/** True while a 3D gizmo axis drag is in progress (suppresses 2D brush selection). */
let gizmoDragging = false;

export function set3DGizmoDragging(active: boolean): void {
  gizmoDragging = active;
}

export function is3DGizmoDragging(): boolean {
  return gizmoDragging;
}
