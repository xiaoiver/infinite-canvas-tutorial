import type { OBB } from '../components/math/OBB';
import { AnchorName } from '../components/pen/Anchor';

type Point = { x: number; y: number };

/** Coordinates in the pointer-down frame, never the changing rendered mask. */
export function resizePointToLocal(obb: OBB, point: Point): Point {
  const dx = point.x - obb.x;
  const dy = point.y - obb.y;
  const c = Math.cos(obb.rotation);
  const s = Math.sin(obb.rotation);
  return {
    x: (dx * c + dy * s) / obb.scaleX,
    y: (-dx * s + dy * c) / obb.scaleY,
  };
}

export function resizePointToWorld(obb: OBB, point: Point): Point {
  const x = point.x * obb.scaleX;
  const y = point.y * obb.scaleY;
  const c = Math.cos(obb.rotation);
  const s = Math.sin(obb.rotation);
  return { x: obb.x + x * c - y * s, y: obb.y + x * s + y * c };
}

/** Keep the opposite handle (or center) fixed and preserve crossing signs. */
export function resizeOBB(
  obb: OBB,
  anchor: AnchorName,
  pointer: Point,
  options: {
    flipEnabled: boolean;
    lockAspectRatio: boolean;
    centeredScaling: boolean;
  },
): OBB | undefined {
  if (obb.width <= 0 || obb.height <= 0 || !obb.scaleX || !obb.scaleY) return;
  const local = resizePointToLocal(obb, pointer);
  if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return;
  const left = [
    AnchorName.TOP_LEFT,
    AnchorName.BOTTOM_LEFT,
    AnchorName.MIDDLE_LEFT,
  ].includes(anchor);
  const right = [
    AnchorName.TOP_RIGHT,
    AnchorName.BOTTOM_RIGHT,
    AnchorName.MIDDLE_RIGHT,
  ].includes(anchor);
  const top = [
    AnchorName.TOP_LEFT,
    AnchorName.TOP_RIGHT,
    AnchorName.TOP_CENTER,
  ].includes(anchor);
  const bottom = [
    AnchorName.BOTTOM_LEFT,
    AnchorName.BOTTOM_RIGHT,
    AnchorName.BOTTOM_CENTER,
  ].includes(anchor);
  if (!left && !right && !top && !bottom) return;
  const horizontal = left || right;
  const vertical = top || bottom;
  const { flipEnabled, lockAspectRatio, centeredScaling } = options;
  const fixedX = centeredScaling ? obb.width / 2 : left ? obb.width : 0;
  const fixedY = centeredScaling ? obb.height / 2 : top ? obb.height : 0;
  const factor = centeredScaling ? 2 : 1;
  let width = horizontal
    ? (local.x - fixedX) * (left ? -factor : factor)
    : obb.width;
  let height = vertical
    ? (local.y - fixedY) * (top ? -factor : factor)
    : obb.height;
  // Keep matrices invertible at the crossing, without rebasing the gesture on
  // this tiny rendered frame. The next sample can cross or reverse normally.
  const dimension = (value: number) =>
    flipEnabled
      ? (Math.sign(value) || 1) * Math.max(Math.abs(value), 0.01)
      : Math.max(value, 0.01);
  width = dimension(width);
  height = dimension(height);
  if (lockAspectRatio) {
    if (horizontal && vertical) {
      const ratio =
        Math.hypot(width, height) / Math.hypot(obb.width, obb.height);
      width = Math.sign(width) * obb.width * ratio;
      height = Math.sign(height) * obb.height * ratio;
    } else if (horizontal) {
      height = (Math.abs(width) * obb.height) / obb.width;
    } else {
      width = (Math.abs(height) * obb.width) / obb.height;
    }
  }
  const x =
    centeredScaling || !horizontal
      ? (obb.width - width) / 2
      : left
      ? obb.width - width
      : 0;
  const y =
    centeredScaling || !vertical
      ? (obb.height - height) / 2
      : top
      ? obb.height - height
      : 0;
  return { ...obb, ...resizePointToWorld(obb, { x, y }), width, height };
}
