import type { Entity } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import type { API } from '../../API';
import {
  AnchorName,
  Circle,
  GlobalTransform,
  Line,
  Mat3,
  OBB,
  Polyline,
  Transformable,
  TransformableStatus,
} from '../../components';
import type { SerializedNode } from '../../types/serialized-node';
import { snapResizingElements } from '../../utils';
import {
  resizeOBB,
  resizePointToLocal,
  resizePointToWorld,
} from '../../utils/transformer-resize';
import { showLabel } from '../DrawRect';
import { updateComputedPoints } from '../ComputePoints';
import { updateGlobalTransform } from '../Transform';

export interface ResizeSelection {
  obb: OBB;
  resizingAnchorName: AnchorName;
  sin: number;
  cos: number;
  label: HTMLDivElement;
}

/** Select owns document updates, binding hover and the shared snap overlay. */
interface ResizeEffects {
  fit(obb: OBB, textResizeOrigin: { x: number; y: number }): void;
  snapLines(lines: { type: string; points: [number, number][] }[]): void;
  rebindEndpoint(
    entity: Entity,
    node: SerializedNode,
    x: number,
    y: number,
  ): void;
}

export function updateResizeGesture(
  api: API,
  canvasX: number,
  canvasY: number,
  lockAspectRatio: boolean,
  centeredScaling: boolean,
  selection: ResizeSelection,
  effects: ResizeEffects,
) {
  const camera = api.getCamera();
  const { resizingAnchorName, label } = selection;

  // Use the lock aspect ratio of the selected node if there is only one
  const { layersSelected, flipEnabled } = api.getAppState();
  if (layersSelected.length === 1) {
    const node = api.getNodeById(layersSelected[0]);
    lockAspectRatio = node.lockAspectRatio ?? lockAspectRatio;
  }

  [canvasX, canvasY] = snapResizePointer(
    api,
    selection,
    effects,
    canvasX,
    canvasY,
    lockAspectRatio,
    centeredScaling,
  );

  camera.write(Transformable).status = TransformableStatus.RESIZING;

  if (
    resizingAnchorName === AnchorName.X1Y1 ||
    resizingAnchorName === AnchorName.X2Y2
  ) {
    const node = api.getNodeById(layersSelected[0]);
    if (!node) {
      return;
    }
    const selected = api.getEntity(node);
    if (!selected?.has(GlobalTransform)) {
      return;
    }

    effects.rebindEndpoint(selected, node, canvasX, canvasY);

    const isX1Y1 = resizingAnchorName === AnchorName.X1Y1;

    const inv = mat3.invert(
      mat3.create(),
      Mat3.toGLMat3(selected.read(GlobalTransform).matrix),
    );
    if (!inv) {
      return;
    }
    const local = vec2.transformMat3(vec2.create(), [canvasX, canvasY], inv);

    if (node.type === 'line' || node.type === 'rough-line') {
      if (!selected.has(Line)) {
        return;
      }
      const line = selected.read(Line);
      let x1 = line.x1;
      let y1 = line.y1;
      let x2 = line.x2;
      let y2 = line.y2;
      if (isX1Y1) {
        x1 = local[0];
        y1 = local[1];
      } else {
        x2 = local[0];
        y2 = local[1];
      }
      api.updateNode(node, { x1, y1, x2, y2 });
    } else if (selected.has(Polyline)) {
      const { points } = selected.read(Polyline);
      const next = points.map((p) => [p[0], p[1]] as [number, number]);
      if (isX1Y1) {
        next[0] = [local[0], local[1]];
      } else {
        next[next.length - 1] = [local[0], local[1]];
      }
      api.updateNode(node, {
        points: next.map((p) => p.join(',')).join(' '),
      });
    } else {
      return;
    }

    updateGlobalTransform(selected);
    updateComputedPoints(selected);

    {
      const m = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      let fixedLocalX: number;
      let fixedLocalY: number;
      if (node.type === 'line' || node.type === 'rough-line') {
        const ln = selected.read(Line);
        fixedLocalX = isX1Y1 ? ln.x2 : ln.x1;
        fixedLocalY = isX1Y1 ? ln.y2 : ln.y1;
      } else {
        const { points } = selected.read(Polyline);
        const fp = isX1Y1 ? points[points.length - 1] : points[0];
        fixedLocalX = fp[0];
        fixedLocalY = fp[1];
      }
      const otherCanvas = vec2.transformMat3(
        vec2.create(),
        [fixedLocalX, fixedLocalY],
        m,
      );
      const width = canvasX - otherCanvas[0];
      const height = canvasY - otherCanvas[1];
      showLabel(label, api, {
        x: otherCanvas[0],
        y: otherCanvas[1],
        width,
        height,
        rotate: true,
      });
    }
  } else {
    const resized = resizeOBB(
      selection.obb,
      resizingAnchorName,
      { x: canvasX, y: canvasY },
      { flipEnabled, lockAspectRatio, centeredScaling },
    );
    if (!resized) return;
    const left = [
      AnchorName.TOP_LEFT,
      AnchorName.BOTTOM_LEFT,
      AnchorName.MIDDLE_LEFT,
    ].includes(resizingAnchorName);
    const right = [
      AnchorName.TOP_RIGHT,
      AnchorName.BOTTOM_RIGHT,
      AnchorName.MIDDLE_RIGHT,
    ].includes(resizingAnchorName);
    const top = [
      AnchorName.TOP_LEFT,
      AnchorName.TOP_RIGHT,
      AnchorName.TOP_CENTER,
    ].includes(resizingAnchorName);
    const bottom = [
      AnchorName.BOTTOM_LEFT,
      AnchorName.BOTTOM_RIGHT,
      AnchorName.BOTTOM_CENTER,
    ].includes(resizingAnchorName);
    effects.fit(resized, {
      x: centeredScaling ? 0.5 : left ? 1 : right ? 0 : 0.5,
      y: centeredScaling ? 0.5 : top ? 1 : bottom ? 0 : 0.5,
    });
    showLabel(label, api, resized);
  }
}

function snapResizePointer(
  api: API,
  selection: ResizeSelection,
  effects: ResizeEffects,
  canvasX: number,
  canvasY: number,
  lockAspectRatio: boolean,
  centeredScaling: boolean,
): [number, number] {
  if (!api.getAppState().snapToObjectsEnabled) {
    effects.snapLines([]);
    return [canvasX, canvasY];
  }
  const anchor = selection.resizingAnchorName;
  let point: [number, number] = [canvasX, canvasY];
  let direction: [number, number];
  if (anchor !== AnchorName.X1Y1 && anchor !== AnchorName.X2Y2) {
    const obb = selection.obb;
    const tlX = 0;
    const tlY = 0;
    const brX = obb.width;
    const brY = obb.height;
    const local = resizePointToLocal(obb, { x: canvasX, y: canvasY });
    let localDirection: [number, number];
    if (
      anchor === AnchorName.TOP_CENTER ||
      anchor === AnchorName.BOTTOM_CENTER
    ) {
      local.x = (tlX + brX) / 2;
      localDirection = [0, 1];
    } else if (
      anchor === AnchorName.MIDDLE_LEFT ||
      anchor === AnchorName.MIDDLE_RIGHT
    ) {
      local.y = (tlY + brY) / 2;
      localDirection = [1, 0];
    } else if (lockAspectRatio) {
      // Project the raw pointer onto the same aspect-ratio ray used by resize.
      // Snapping then moves along this ray, instead of breaking the constraint.
      const right =
        anchor === AnchorName.TOP_RIGHT || anchor === AnchorName.BOTTOM_RIGHT;
      const bottom =
        anchor === AnchorName.BOTTOM_LEFT || anchor === AnchorName.BOTTOM_RIGHT;
      const fixedX = centeredScaling
        ? selection.obb.width / 2
        : right
        ? tlX
        : brX;
      const fixedY = centeredScaling
        ? selection.obb.height / 2
        : bottom
        ? tlY
        : brY;
      const length = Math.hypot(local.x - fixedX, local.y - fixedY);
      localDirection = [
        (Math.sign(local.x - fixedX) || (right ? 1 : -1)) * selection.cos,
        (Math.sign(local.y - fixedY) || (bottom ? 1 : -1)) * selection.sin,
      ];
      local.x = fixedX + localDirection[0] * length;
      local.y = fixedY + localDirection[1] * length;
    }
    const world = resizePointToWorld(obb, local);
    point = [world.x, world.y];
    if (localDirection) {
      const end = resizePointToWorld(obb, {
        x: local.x + localDirection[0],
        y: local.y + localDirection[1],
      });
      direction = [end.x - world.x, end.y - world.y];
    }
  }
  const { snapOffset, snapLines } = snapResizingElements(api, point, direction);
  effects.snapLines(snapLines);
  return [point[0] + snapOffset[0], point[1] + snapOffset[1]];
}

export function getResizePointerOffset(
  api: API,
  anchor: AnchorName,
  x: number,
  y: number,
): [number, number] {
  const tf = api.getCamera().read(Transformable);
  let mask = tf.mask;
  let hx: number;
  let hy: number;
  if (anchor === AnchorName.X1Y1 || anchor === AnchorName.X2Y2) {
    const endpoint = anchor === AnchorName.X1Y1 ? tf.x1y1Anchor : tf.x2y2Anchor;
    const { cx, cy } = endpoint.read(Circle);
    hx = cx;
    hy = cy;
    mask = tf.lineMask;
  } else {
    const { cx: left, cy: top } = tf.tlAnchor.read(Circle);
    const { cx: right, cy: bottom } = tf.brAnchor.read(Circle);
    hx =
      anchor === AnchorName.TOP_LEFT ||
      anchor === AnchorName.BOTTOM_LEFT ||
      anchor === AnchorName.MIDDLE_LEFT
        ? left
        : anchor === AnchorName.TOP_RIGHT ||
          anchor === AnchorName.BOTTOM_RIGHT ||
          anchor === AnchorName.MIDDLE_RIGHT
        ? right
        : (left + right) / 2;
    hy =
      anchor === AnchorName.TOP_LEFT ||
      anchor === AnchorName.TOP_RIGHT ||
      anchor === AnchorName.TOP_CENTER
        ? top
        : anchor === AnchorName.BOTTOM_LEFT ||
          anchor === AnchorName.BOTTOM_RIGHT ||
          anchor === AnchorName.BOTTOM_CENTER
        ? bottom
        : (top + bottom) / 2;
  }
  const handle = api.transformer2Canvas({ x: hx, y: hy }, mask);
  const pointer = api.viewport2Canvas({ x, y });
  return [pointer.x - handle.x, pointer.y - handle.y];
}
