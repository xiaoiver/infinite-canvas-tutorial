import type { API } from '../../API';
import {
  Circle,
  Highlighted,
  OBB,
  Transformable,
  TransformableStatus,
} from '../../components';
import { resizePointToWorld } from '../../utils/transformer-resize';
import { requestTransformerRefreshForCanvas } from '../../utils/pick3d-bridge';
import { getOBB } from '../RenderTransformer';
import { updateGlobalTransform } from '../Transform';

type Point = { x: number; y: number };

/** Pointer-down geometry and pivots remain fixed while the rendered mask moves. */
export interface RotateGesture {
  obb: OBB;
  pivotWorld: [number, number];
  pivotLocal: [number, number];
  lastPointerAngle: number;
  accumulated: number;
}

interface RotateSelection {
  obb: OBB;
  rotateGesture?: RotateGesture;
}

export function getRotatePivotWorld(
  api: API,
  selection: RotateSelection,
): [number, number] {
  if (selection.rotateGesture) return selection.rotateGesture.pivotWorld;
  const { mask, rotatePivotX, rotatePivotY } = api
    .getCamera()
    .read(Transformable);
  const { x, y } =
    !Number.isNaN(rotatePivotX) && !Number.isNaN(rotatePivotY) && mask
      ? api.transformer2Canvas({ x: rotatePivotX, y: rotatePivotY }, mask)
      : resizePointToWorld(selection.obb, {
          x: selection.obb.width / 2,
          y: selection.obb.height / 2,
        });
  return [x, y];
}

export function resetRotateGesture(api: API, selection: RotateSelection) {
  delete selection.rotateGesture;
  api.getCamera().write(Transformable).transformerObbFrozenDuringRotate = false;
}

export function beginRotateGesture(
  api: API,
  selection: RotateSelection,
  pointer: Point,
) {
  resetRotateGesture(api, selection);
  const pivotWorld = getRotatePivotWorld(api, selection);
  const tf = api.getCamera().write(Transformable);
  const obb = { ...selection.obb };
  selection.rotateGesture = {
    obb,
    pivotWorld,
    pivotLocal: [
      Number.isNaN(tf.rotatePivotX) ? obb.width / 2 : tf.rotatePivotX,
      Number.isNaN(tf.rotatePivotY) ? obb.height / 2 : tf.rotatePivotY,
    ],
    lastPointerAngle: Math.atan2(
      pointer.y - pivotWorld[1],
      pointer.x - pivotWorld[0],
    ),
    accumulated: 0,
  };
  if (api.getAppState().layersSelected.length > 1) {
    tf.transformerObbFrozenDuringRotate = true;
    Object.assign(tf.gestureFrozenSelectionOBB, obb);
  }
}

/** Unwrap incremental angles so crossing ±π or making full turns is continuous. */
export function rotateGestureOBB(gesture: RotateGesture, pointer: Point): OBB {
  const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
  } = gesture;
  const angle = Math.atan2(pointer.y - py, pointer.x - px);
  const delta = angle - gesture.lastPointerAngle;
  gesture.accumulated += Math.atan2(Math.sin(delta), Math.cos(delta));
  gesture.lastPointerAngle = angle;
  const rotation = obb.rotation + gesture.accumulated;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
  };
}

export function updateRotateGesture(
  api: API,
  selection: RotateSelection,
  pointer: Point,
  fit: (obb: OBB) => void,
) {
  if (!selection.rotateGesture) return;
  const camera = api.getCamera();
  camera.write(Transformable).status = TransformableStatus.ROTATING;
  camera.read(Transformable).selecteds.forEach((selected) => {
    if (selected.has(Highlighted)) selected.remove(Highlighted);
  });
  const obb = rotateGestureOBB(selection.rotateGesture, pointer);
  fit(obb);
  const tf = camera.write(Transformable);
  if (tf.transformerObbFrozenDuringRotate) {
    Object.assign(tf.gestureFrozenSelectionOBB, obb);
    requestTransformerRefreshForCanvas(api.getCanvas());
  }
}

export function finishRotateGesture(api: API, selection: RotateSelection) {
  const camera = api.getCamera();
  const tf = camera.write(Transformable);
  tf.status = TransformableStatus.ROTATED;
  tf.transformerObbFrozenDuringRotate = false;
  if (
    tf.selecteds.length > 1 &&
    tf.rotatePivotPinned &&
    selection.rotateGesture
  ) {
    // The released multi-selection returns to its axis-aligned union. Keep a
    // pinned pivot at the same world point by rebasing it into that new frame.
    const { x, y } = getOBB(camera);
    const pivot = selection.rotateGesture.pivotWorld;
    const next = camera.write(Transformable);
    next.rotatePivotX = pivot[0] - x;
    next.rotatePivotY = pivot[1] - y;
  }
  resetRotateGesture(api, selection);
}

export function moveRotatePivot(api: API, pointer: Point) {
  const camera = api.getCamera();
  const { mask, centerAnchor } = camera.read(Transformable);
  if (!mask) return;
  const { x, y } = api.canvas2Transformer(pointer, mask);
  const tf = camera.write(Transformable);
  tf.rotatePivotX = x;
  tf.rotatePivotY = y;
  tf.rotatePivotPinned = true;
  if (centerAnchor?.has(Circle)) {
    Object.assign(centerAnchor.write(Circle), { cx: x, cy: y });
    updateGlobalTransform(centerAnchor);
  }
}
