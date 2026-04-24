import { Entity, System } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import {
  Camera,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  Ellipse,
  FillSolid,
  FractionalIndex,
  GlobalTransform,
  Group,
  Highlighted,
  Input,
  InputPoint,
  OBB,
  Opacity,
  Parent,
  Path,
  Pen,
  Polyline,
  RBush,
  Rect,
  Renderable,
  Selected,
  Stroke,
  StrokeAttenuation,
  Text,
  Transform,
  Transformable,
  TransformableStatus,
  UI,
  Visibility,
  ZIndex,
  AnchorName,
  VectorNetwork,
  ComputedCameraControl,
  ComputedPoints,
  DropShadow,
  Culled,
  ToBeDeleted,
  Brush,
  HTML,
  Embed,
  Editable,
  Locked,
  Line,
  ClipMode,
  MaterialDirty,
  FillGradient,
  FillImage,
  FillPattern,
  Binding,
  Binded,
  PartialBinding,
  hasFullOrPartialEdgeBinding,
  GeometryDirty,
  Rough,
  Marker,
  Mat3,
  ComputedTextMetrics,
  Theme,
  Flex,
  FlexLayoutDirty,
  DEFAULT_THEME_COLORS,
} from '../components';
import { Commands } from '../commands/Commands';
import {
  calculateOffset,
  createSVGElement,
  decompose,
  distanceBetweenPoints,
  GapSnapLine,
  getCursor,
  getGridPoint,
  hasTerminalPoint,
  isBrowser,
  snapDraggedElements,
  snapToGrid,
} from '../utils';
import { API } from '../API';
import { getOBB, hitTest } from './RenderTransformer';
import { updateGlobalTransform } from './Transform';
import { safeAddComponent } from '../history';
import { updateComputedPoints } from './ComputePoints';
import { DOMAdapter } from '../environment';
import { hideLabel, initLabel, showLabel } from '..';
import type { EdgeSerializedNode, SerializedNode } from '../types/serialized-node';
import { constraintAttrsFromCanvasPoint } from '../utils/binding/constraint-from-point';
import {
  collectPathControlHandles,
  PathControlHandleMeta,
  PathCommand,
  setPathHandlePoint,
  toPathData,
} from '../utils/path-edit';
import { rebasePolylinePathGeometryToLocalOrigin } from '../utils/rebase-edge-geometry';

const LASSO_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAABUFJREFUeAHtVltIXFcUPU6c0VGTWqdqRqtVTFrU+GFimgYpTUibQmm/JDZEKMF3rFjFigjFBi2I9ccPq6CIitEIvlFREYrioxYVK7UqPgk+2mh9j46jM/d07evVTjVpjTMN/eiGzT2ve/Y6+7HOYew/JLIjfQv2EuSMkXGhqqrq84iICG87O7vN/v7+VQnESwHCysrK4paXl3l1dTUnmZqaqiovL38PU3Jpyb8KRlZZWfmwra2No82dnZ0NsbGxfHR0lLAszszM1N69e9fjyD9mBWMbEBDgr9frdTY2NiIISQWA4S0tLYJWqyUwv9TV1cXcv3/fwwiEWYDYQM+vr6/PJCYmHgKQyWTcwsLioG/w9/cXAEYM0fT0dF1FRYW39L+MmSiUjA5JSUkPJicnRYNGho+BoRAhJHxjY4MjcT9iZhJ7KyurCzjcjpeX1zHjxn1ra2vBz8+Pz8/P89LS0ofMTGFQQB3b29sfZ2dnHzUuXL16lefk5FB1iCHY3NycbW5ufow5J6gtM4NQHM/FxMREUcLBsOHg5NeuXSObWwDXER0dnebu7h6M8UDoBagz+9MDJufCWejriO1UYGDgYczp5F1dXa1oU9L5IVRvKZVKV7Tl8fHx9ijf9Nra2gfmAGEJtS8sLMzr6+s7DAPxQUpKSjzaLtBXyHBoaOjZsbGxQvJMXl4en52d5SCzsOfse+IcoYWvent7v2PECQL5HzzxNtp2tCYyMlKNodXBwUGxEi5evMhHRkYoPwaRG492dnZ+wvzPILCSO3fueEp7n9gzSqiaOCEsLIxTtu/u7j7B2Hmau337ti0Zv3fvHlepVAYuiU6nM+Tn5/OgoCBuMBg4VVJubq4Ifnx8/NsXASFyQlxcXKRGoxFLDTHOI8/QJDZ7BHDkEcPe3h6Hp/Stra20TvDx8eGNjY0ioN7eXg7G5Lhf9LQPyjWIvUAoKM5eGRkZ35SUlJShTW5U4fRutDliTSfXwzNbICKdq6urnsbX1taeZGVllQYHB3+N5MwENk1RUZHg4eEhwCvr+Fqf1AuWuJKpvt3YfuKpoXKcIqqpqYm7ubnxpaWlaScnpxB4QQND2vDw8AysCZTL5f74kgZ4enp+QsTm4uIiIDc4wL1/zNBzAJDbVtg+OZHsQekUlxcWFlhmZiYDkL7FxcURlOMHMGqBuQ2Upxa5sEb/Q5VIwo25ublJqC9Kmq2srKglDwj/BIBJm+iN+jIQkOrmzZtiJyEhYRSfX3F6GZSGtNAtCSxVzw5Uh9M7Qxl4gqnVajkzQSyHh4frk5OTeUFBAe/u7i6XDnBGOpVxgonXdHp6+sfIE65QKMRquX79OoVGyU4pVnB9UmdnJ0cycdD1iGT8aGaLfXCFO2xqGhoaDIIg8IGBgR8wrIJas1PK2StXrlzGZrvFxcXiiUA+3z1rIZL1Bt1XUVFR3NHRkdbqfH19P8TUa8wEqibkKroBybi9vb0eScbBek9Rql9Aw9PS0j7b3t4eWF1d5UhQISQkxEAhwCPnK7ZfSSbdmjKpNL2GhoZ+hGvFVxLKkdfU1PCenh6RgFJTU8Xx+vp6YkE9CO1L9N9k++43+bZU4DHyBr4+uKy+P6Bheh0h08ULqaOjg94KHF6YvXTp0qeScQL+zIo7zUtGCRDOcL0tciLg1q1b7+KUNxwcHJQTExO/gZKf4oXdAwZsBi9oUAG/A9A6+2tJmwSAhPKB6Pqc1LaxtLSU6/cJgepfK32XodvMiHjMBYCESlAhAVBIfTK0C9VJXwLE/24TczwmLYy+B8Y4+19OKH8AGG0Nxm0lh+0AAAAASUVORK5CYII=") 0 4, pointer';

export enum SelectionMode {
  IDLE = 'IDLE',
  READY_TO_BRUSH = 'READY_TO_BRUSH',
  BRUSH = 'BRUSH',
  READY_TO_SELECT = 'READY_TO_SELECT',
  SELECT = 'SELECT',
  READY_TO_MOVE = 'READY_TO_MOVE',
  MOVE = 'MOVE',
  READY_TO_RESIZE = 'READY_TO_RESIZE',
  RESIZE = 'RESIZE',
  READY_TO_ROTATE = 'READY_TO_ROTATE',
  ROTATE = 'ROTATE',
  READY_TO_MOVE_PIVOT = 'READY_TO_MOVE_PIVOT',
  MOVE_PIVOT = 'MOVE_PIVOT',
  READY_TO_MOVE_CONTROL_POINT = 'READY_TO_MOVE_CONTROL_POINT',
  MOVE_CONTROL_POINT = 'MOVE_CONTROL_POINT',
  EDITING = 'EDITING',
  LASSOING = 'LASSOING',
}

export interface SelectOBB {
  mode: SelectionMode;
  resizingAnchorName: AnchorName;
  activeControlPointIndex?: number;
  activeSegmentMidpointIndex?: number;
  nodes: SerializedNode[];

  /** 与 `ComputedBounds.selectionOBB` 一致，供变换器 / resize 数学使用 */
  obb: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  sin: number;
  cos: number;

  pointerMoveViewportX: number;
  pointerMoveViewportY: number;

  brushContainer: SVGSVGElement;
  snapContainer: SVGSVGElement;
  label: HTMLDivElement;

  editing: Entity;

  /** Previous snap offset during drag; used to avoid jitter when multiple snaps are equally close. */
  lastSnapOffset?: [number, number];

  /** Pointer angle (rad) vs. {@link SelectOBB.obb} center on last rotate sample; for incremental drag. */
  rotateLastPointerAngle?: number;
  /** Total rotation applied during current rotate gesture (rad), relative to saved {@link SelectOBB.obb}. */
  rotateAccumulated?: number;
  /** 旋转手势开始时锁定的枢轴（画布坐标）；避免拖拽中 mask 每帧更新导致 `transformer2Canvas(pivot, mask)` 漂移。 */
  rotatePivotWorldFixed?: [number, number];
  /** 与 {@link SelectOBB.obb} 手势快照一致的局部枢轴；避免 `updateRectMask` 每帧按新 union 宽高重写 rotatePivot。 */
  rotatePivotLocalFixed?: [number, number];
  selectedNodeIds?: string[];

  /** 绑定边重接时最后一次指针位置（画布坐标） */
  bindingRebindLastCanvas?: { x: number; y: number };
}

function isEdgeBindingRebindCandidate(
  edgeEntity: Entity | undefined,
  edgeNode: EdgeSerializedNode | undefined,
): boolean {
  if (!edgeEntity || !edgeNode) {
    return false;
  }
  if (hasFullOrPartialEdgeBinding(edgeEntity)) {
    return true;
  }
  return (
    !!edgeNode.fromId ||
    !!edgeNode.toId ||
    hasTerminalPoint(edgeNode.sourcePoint) ||
    hasTerminalPoint(edgeNode.targetPoint)
  );
}

/**
 * 控制点拖拽结束时：仅当拖的是边的起点/终点（非贝塞尔中间柄）才应对应 X1Y1/X2Y2 做绑定重接。
 * 否则误用旧的 {@link SelectOBB.resizingAnchorName} 会把端点写到控制柄位置上。
 */
function getEdgeRebindAnchorForControlPointDrag(
  edgeNode: SerializedNode,
  activeControlPointIndex: number | undefined,
  pathCommands: PathCommand[] | undefined,
  polylinePointCount: number | undefined,
): AnchorName.X1Y1 | AnchorName.X2Y2 | null {
  if (activeControlPointIndex === undefined || activeControlPointIndex < 0) {
    return null;
  }
  const t = edgeNode.type;
  if (t === 'polyline' || t === 'rough-polyline') {
    if (polylinePointCount == null || polylinePointCount < 2) {
      return null;
    }
    if (activeControlPointIndex === 0) {
      return AnchorName.X1Y1;
    }
    if (activeControlPointIndex === polylinePointCount - 1) {
      return AnchorName.X2Y2;
    }
    return null;
  }
  if (t === 'path' || t === 'rough-path') {
    if (!pathCommands?.length) {
      return null;
    }
    const handles = collectPathControlHandles(pathCommands);
    if (handles.length < 2) {
      return null;
    }
    if (activeControlPointIndex === 0) {
      return AnchorName.X1Y1;
    }
    if (activeControlPointIndex === handles.length - 1) {
      return AnchorName.X2Y2;
    }
    return null;
  }
  return null;
}

/**
 * * Click to select individual object. Hold `Shift` and click on another object to select multiple objects.
 * * Brush(marquee) to select multiple objects.
 * @see https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
 */
export class Select extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<number, SelectOBB>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            Canvas,
            Camera,
            ComputedCameraControl,
            Culled,
            Brush,
            Input,
            Locked,
            FillSolid,
            FillGradient,
            FillImage,
            FillPattern,
            Stroke,
            Rough,
            ComputedTextMetrics,
            Flex,
          )
          .read.update.and.using(
            GlobalTransform,
            InputPoint,
            Cursor,
            UI,
            Selected,
            Highlighted,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Group,
            HTML,
            Embed,
            Rect,
            Circle,
            Ellipse,
            Text,
            Path,
            Polyline,
            Line,
            Binding,
            Binded,
            PartialBinding,
            Brush,
            Visibility,
            ZIndex,
            StrokeAttenuation,
            Transformable,
            VectorNetwork,
            ComputedBounds,
            ComputedPoints,
            DropShadow,
            ToBeDeleted,
            Editable,
            ClipMode,
            MaterialDirty,
            GeometryDirty,
            FlexLayoutDirty,
            Locked,
            Marker,
            Theme,
          ).write,
    );
    this.query((q) => q.using(ComputedCamera, FractionalIndex, RBush).read);
  }

  private getTopmostEntity(
    api: API,
    x: number,
    y: number,
    selector: (e: Entity) => boolean,
  ) {
    const { x: wx, y: wy } = api.viewport2Canvas({
      x,
      y,
    });
    const entities = api.elementsFromPoint({ x: wx, y: wy });

    return entities.find(selector);
  }

  /**
   * Hover hit targets are often leaves; for hierarchy, highlight the outermost group
   * (last ancestor with {@link Parent} before the camera) instead of the leaf.
   */
  private resolveHighlightEntityFromHit(hit: Entity, camera: Entity): Entity {
    let outermostGroup: Entity | undefined;
    let current = hit;
    for (; ;) {
      if (!current.has(Children)) {
        break;
      }
      const parent = current.read(Children).parent;
      if (parent === camera || parent.has(Camera)) {
        break;
      }
      if (parent.has(Parent)) {
        outermostGroup = parent;
      }
      current = parent;
    }
    return outermostGroup ?? hit;
  }

  private handleSelectedMoving(
    api: API,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
  ) {
    const { snapToPixelGridSize, snapToPixelGridEnabled } = api.getAppState();
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.MOVING;

    const selection = this.selections.get(camera.__id);

    let offset: [number, number] = [0, 0];
    if (snapToPixelGridEnabled) {
      const [gridSx, gridSy] = getGridPoint(sx, sy, snapToPixelGridSize);
      const [gridEx, gridEy] = getGridPoint(ex, ey, snapToPixelGridSize);

      const dragOffset: [number, number] = [gridEx - gridSx, gridEy - gridSy];

      const { snapOffset, snapLines } = snapDraggedElements(
        api,
        dragOffset,
        selection.lastSnapOffset,
      );
      selection.lastSnapOffset = snapOffset;

      const obb = getOBB(camera);
      offset = calculateOffset(
        [obb.x, obb.y],
        dragOffset,
        snapOffset,
        snapToPixelGridSize,
      );

      if (isBrowser) {
        this.renderSnapLines(selection, snapLines, api);
      }
    } else {
      offset = [ex - sx, ey - sy];
    }

    const { selecteds, mask } = camera.read(Transformable);

    selecteds.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
      const node = api.getNodeByEntity(selected);
      const { x, y } = selected.read(Transform).translation;
      api.updateNodeOBB(node, {
        x: x + offset[0],
        y: y + offset[1],
      });
      updateGlobalTransform(selected);
      updateComputedPoints(selected);
    });

    updateGlobalTransform(mask);

    // showLabel(selection.label, api, {
    //   x: .x,
    //   y: obb.y,
    //   width: obb.width,
    //   height: obb.height,
    // });
  }

  private handleSelectedMoved(api: API, selection: SelectOBB) {
    const camera = api.getCamera();

    delete selection.lastSnapOffset;

    api.setNodes(api.getNodes());

    if (api.getAppState().layersCropping.length === 0) {
      api.record();
    }

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    camera.write(Transformable).status = TransformableStatus.MOVED;

    this.saveSelectedOBB(api, selection);
  }

  /** 选区 OBB 在画布坐标系下的几何中心（与 mask 的 Transform × Rect 一致）。 */
  private obbWorldCenter(obb: SelectOBB['obb']): [number, number] {
    const { x, y, width, height, rotation, scaleX, scaleY } = obb;
    const lx = width / 2;
    const ly = height / 2;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    return [
      x + lx * scaleX * c - ly * scaleY * s,
      y + lx * scaleX * s + ly * scaleY * c,
    ];
  }

  /** 保持任意本地 pivot 的世界坐标不动，仅改变旋转角时，反推新的 OBB 原点 (x, y)。 */
  private alignObbOriginToFixedPivot(
    obb: SelectOBB['obb'],
    pivotLocalX: number,
    pivotLocalY: number,
    centerX: number,
    centerY: number,
    newRotation: number,
  ) {
    const c = Math.cos(newRotation);
    const s = Math.sin(newRotation);
    const { scaleX, scaleY, width, height } = obb;
    return {
      x: centerX - pivotLocalX * scaleX * c + pivotLocalY * scaleY * s,
      y: centerY - pivotLocalX * scaleX * s - pivotLocalY * scaleY * c,
      width,
      height,
      rotation: newRotation,
      scaleX,
      scaleY,
    };
  }

  private getRotatePivotWorld(api: API, selection: SelectOBB): [number, number] {
    const camera = api.getCamera();
    const { mask, rotatePivotX, rotatePivotY } = camera.read(Transformable);
    if (!Number.isNaN(rotatePivotX) && !Number.isNaN(rotatePivotY) && mask) {
      const { x, y } = api.transformer2Canvas({ x: rotatePivotX, y: rotatePivotY }, mask);
      return [x, y];
    }
    return this.obbWorldCenter(selection.obb);
  }

  /** 旋转拖拽全程使用指针按下时锁定的世界枢轴（见 {@link SelectOBB.rotatePivotWorldFixed}）。 */
  private getRotatePivotWorldStable(api: API, selection: SelectOBB): [number, number] {
    if (selection.rotatePivotWorldFixed) {
      return selection.rotatePivotWorldFixed;
    }
    return this.getRotatePivotWorld(api, selection);
  }

  private handleRotatePivotMoving(api: API, canvasX: number, canvasY: number) {
    const camera = api.getCamera();
    const { mask, centerAnchor } = camera.read(Transformable);
    if (!mask) {
      return;
    }
    const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
    const tf = camera.write(Transformable);
    tf.rotatePivotX = x;
    tf.rotatePivotY = y;
    tf.rotatePivotPinned = true;
    if (centerAnchor?.has(Circle)) {
      Object.assign(centerAnchor.write(Circle), { cx: x, cy: y });
      updateGlobalTransform(centerAnchor);
    }
  }

  private handleSelectedRotating(
    api: API,
    canvasX: number,
    canvasY: number,
  ) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);
    if (selection.rotateLastPointerAngle === undefined) {
      return;
    }
    if (selection.rotateAccumulated === undefined) {
      selection.rotateAccumulated = 0;
    }

    camera.write(Transformable).status = TransformableStatus.ROTATING;

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
    });

    const [px, py] = this.getRotatePivotWorldStable(api, selection);
    const cameraTf = camera.read(Transformable);
    const pivotLocalX = selection.rotatePivotLocalFixed
      ? selection.rotatePivotLocalFixed[0]
      : Number.isNaN(cameraTf.rotatePivotX)
        ? selection.obb.width / 2
        : cameraTf.rotatePivotX;
    const pivotLocalY = selection.rotatePivotLocalFixed
      ? selection.rotatePivotLocalFixed[1]
      : Number.isNaN(cameraTf.rotatePivotY)
        ? selection.obb.height / 2
        : cameraTf.rotatePivotY;
    const cur = Math.atan2(canvasY - py, canvasX - px);
    let delta = cur - selection.rotateLastPointerAngle;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    selection.rotateLastPointerAngle = cur;
    selection.rotateAccumulated += delta;

    const newRotation = selection.obb.rotation + selection.rotateAccumulated;
    const newAttrs = this.alignObbOriginToFixedPivot(
      selection.obb,
      pivotLocalX,
      pivotLocalY,
      px,
      py,
      newRotation,
    );
    this.fitSelected(api, newAttrs, selection);
  }

  private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
    selection: SelectOBB,
  ) {
    const camera = api.getCamera();
    const { resizingAnchorName, obb, cos, sin, label } = selection;
    const { rotation, scaleX, scaleY } = obb;

    // Use the lock aspect ratio of the selected node if there is only one
    const { layersSelected, flipEnabled } = api.getAppState();
    if (layersSelected.length === 1) {
      const node = api.getNodeById(layersSelected[0]);
      lockAspectRatio = node.lockAspectRatio ?? lockAspectRatio;
    }

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

      const edgeNode = node;
      const edgeEntity = selected;
      if (isEdgeBindingRebindCandidate(edgeEntity, edgeNode as EdgeSerializedNode)) {
        selection.bindingRebindLastCanvas = { x: canvasX, y: canvasY };
        this.applyBindingRebindHover(api, canvasX, canvasY);
      }

      const isX1Y1 = resizingAnchorName === AnchorName.X1Y1;

      const inv = mat3.invert(
        mat3.create(),
        Mat3.toGLMat3(selected.read(GlobalTransform).matrix),
      );
      if (!inv) {
        return;
      }
      const local = vec2.transformMat3(
        vec2.create(),
        [canvasX, canvasY],
        inv,
      );

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
      const { tlAnchor, trAnchor, blAnchor, brAnchor, mask } =
        camera.read(Transformable);
      const prevTlAnchorX = tlAnchor.read(Circle).cx;
      const prevTlAnchorY = tlAnchor.read(Circle).cy;
      const prevBrAnchorX = brAnchor.read(Circle).cx;
      const prevBrAnchorY = brAnchor.read(Circle).cy;
      const { x, y } = api.canvas2Transformer(
        {
          x: canvasX,
          y: canvasY,
        },
        mask,
      );

      let anchor: Entity;
      let anchorName = resizingAnchorName;
      if (anchorName === AnchorName.TOP_LEFT) {
        anchor = tlAnchor;
      } else if (anchorName === AnchorName.TOP_RIGHT) {
        anchor = trAnchor;
      } else if (anchorName === AnchorName.BOTTOM_LEFT) {
        anchor = blAnchor;
      } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
        anchor = brAnchor;
      }

      if (anchor) {
        if (!flipEnabled) {
          if (anchor === tlAnchor) {
            Object.assign(anchor.write(Circle), {
              cx: Math.min(x, trAnchor.read(Circle).cx),
              cy: Math.min(y, blAnchor.read(Circle).cy),
            });
          } else if (anchor === trAnchor) {
            Object.assign(anchor.write(Circle), {
              cx: Math.max(x, tlAnchor.read(Circle).cx),
              cy: Math.min(y, blAnchor.read(Circle).cy),
            });
          } else if (anchor === blAnchor) {
            Object.assign(anchor.write(Circle), {
              cx: Math.min(x, trAnchor.read(Circle).cx),
              cy: Math.max(y, tlAnchor.read(Circle).cy),
            });
          } else if (anchor === brAnchor) {
            Object.assign(anchor.write(Circle), {
              cx: Math.max(x, tlAnchor.read(Circle).cx),
              cy: Math.max(y, tlAnchor.read(Circle).cy),
            });
          }
        } else {
          Object.assign(anchor.write(Circle), {
            cx: x,
            cy: y,
          });
        }
      }

      let newHypotenuse: number;

      if (anchorName === AnchorName.TOP_LEFT) {
        if (flipEnabled && !lockAspectRatio) {
          const { cx: oppositeX, cy: oppositeY } = brAnchor.read(Circle);
          if (x > oppositeX && y <= oppositeY) {
            anchorName = AnchorName.TOP_RIGHT;
            selection.resizingAnchorName = AnchorName.TOP_RIGHT;
          } else if (x <= oppositeX && y > oppositeY) {
            anchorName = AnchorName.BOTTOM_LEFT;
            selection.resizingAnchorName = AnchorName.BOTTOM_LEFT;
          } else if (x > oppositeX && y > oppositeY) {
            anchorName = AnchorName.BOTTOM_RIGHT;
            selection.resizingAnchorName = AnchorName.BOTTOM_RIGHT;
          }
        }
        if (lockAspectRatio) {
          const comparePoint = centeredScaling
            ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
            : {
              x: brAnchor.read(Circle).cx,
              y: brAnchor.read(Circle).cy,
            };
          newHypotenuse = Math.sqrt(
            Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
          );

          const { cx, cy } = tlAnchor.read(Circle);
          const reverseX = cx > comparePoint.x ? -1 : 1;
          const reverseY = cy > comparePoint.y ? -1 : 1;

          Object.assign(tlAnchor.write(Circle), {
            cx: comparePoint.x - newHypotenuse * cos * reverseX,
            cy: comparePoint.y - newHypotenuse * sin * reverseY,
          });
        }
      } else if (anchorName === AnchorName.TOP_RIGHT) {
        if (flipEnabled && !lockAspectRatio) {
          const { cx: oppositeX, cy: oppositeY } = blAnchor.read(Circle);
          if (x < oppositeX && y <= oppositeY) {
            anchorName = AnchorName.TOP_LEFT;
            selection.resizingAnchorName = AnchorName.TOP_LEFT;
          } else if (x >= oppositeX && y > oppositeY) {
            anchorName = AnchorName.BOTTOM_RIGHT;
            selection.resizingAnchorName = AnchorName.BOTTOM_RIGHT;
          } else if (x < oppositeX && y > oppositeY) {
            anchorName = AnchorName.BOTTOM_LEFT;
            selection.resizingAnchorName = AnchorName.BOTTOM_LEFT;
          }
        }
        if (lockAspectRatio) {
          const comparePoint = centeredScaling
            ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
            : {
              x: blAnchor.read(Circle).cx,
              y: blAnchor.read(Circle).cy,
            };

          newHypotenuse = Math.sqrt(
            Math.pow(x - comparePoint.x, 2) + Math.pow(comparePoint.y - y, 2),
          );

          const { cx, cy } = trAnchor.read(Circle);
          const reverseX = cx < comparePoint.x ? -1 : 1;
          const reverseY = cy > comparePoint.y ? -1 : 1;

          Object.assign(trAnchor.write(Circle), {
            cx: comparePoint.x + newHypotenuse * cos * reverseX,
            cy: comparePoint.y - newHypotenuse * sin * reverseY,
          });
        }

        tlAnchor.write(Circle).cy = trAnchor.read(Circle).cy;
        brAnchor.write(Circle).cx = trAnchor.read(Circle).cx;
      } else if (anchorName === AnchorName.BOTTOM_LEFT) {
        if (flipEnabled && !lockAspectRatio) {
          const { cx: oppositeX, cy: oppositeY } = trAnchor.read(Circle);
          if (x <= oppositeX && y < oppositeY) {
            anchorName = AnchorName.TOP_LEFT;
            selection.resizingAnchorName = AnchorName.TOP_LEFT;
          } else if (x > oppositeX && y >= oppositeY) {
            anchorName = AnchorName.BOTTOM_RIGHT;
            selection.resizingAnchorName = AnchorName.BOTTOM_RIGHT;
          } else if (x > oppositeX && y < oppositeY) {
            anchorName = AnchorName.TOP_RIGHT;
            selection.resizingAnchorName = AnchorName.TOP_RIGHT;
          }
        }
        if (lockAspectRatio) {
          const comparePoint = centeredScaling
            ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
            : {
              x: trAnchor.read(Circle).cx,
              y: trAnchor.read(Circle).cy,
            };

          newHypotenuse = Math.sqrt(
            Math.pow(comparePoint.x - x, 2) + Math.pow(y - comparePoint.y, 2),
          );

          const reverseX = comparePoint.x < x ? -1 : 1;
          const reverseY = y < comparePoint.y ? -1 : 1;

          Object.assign(blAnchor.write(Circle), {
            cx: comparePoint.x - newHypotenuse * cos * reverseX,
            cy: comparePoint.y + newHypotenuse * sin * reverseY,
          });
        }

        tlAnchor.write(Circle).cx = blAnchor.read(Circle).cx;
        brAnchor.write(Circle).cy = blAnchor.read(Circle).cy;
      } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
        if (flipEnabled && !lockAspectRatio) {
          const { cx: oppositeX, cy: oppositeY } = tlAnchor.read(Circle);
          if (x < oppositeX && y >= oppositeY) {
            anchorName = AnchorName.BOTTOM_LEFT;
            selection.resizingAnchorName = AnchorName.BOTTOM_LEFT;
          } else if (x >= oppositeX && y < oppositeY) {
            anchorName = AnchorName.TOP_RIGHT;
            selection.resizingAnchorName = AnchorName.TOP_RIGHT;
          } else if (x < oppositeX && y < oppositeY) {
            anchorName = AnchorName.TOP_LEFT;
            selection.resizingAnchorName = AnchorName.TOP_LEFT;
          }
        }
        if (lockAspectRatio) {
          const comparePoint = centeredScaling
            ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
            : {
              x: tlAnchor.read(Circle).cx,
              y: tlAnchor.read(Circle).cy,
            };

          newHypotenuse = Math.sqrt(
            Math.pow(x - comparePoint.x, 2) + Math.pow(y - comparePoint.y, 2),
          );

          const reverseX = brAnchor.read(Circle).cx < comparePoint.x ? -1 : 1;
          const reverseY = brAnchor.read(Circle).cy < comparePoint.y ? -1 : 1;
          Object.assign(brAnchor.write(Circle), {
            cx: comparePoint.x + newHypotenuse * cos * reverseX,
            cy: comparePoint.y + newHypotenuse * sin * reverseY,
          });
        }
      } else if (anchorName === AnchorName.TOP_CENTER) {
        if (!flipEnabled) {
          tlAnchor.write(Circle).cy = Math.min(y, brAnchor.read(Circle).cy);
        } else {
          const prevBrY = brAnchor.read(Circle).cy;
          tlAnchor.write(Circle).cy = y;
          if (y > prevBrY) {
            // Crossing over: dragged edge becomes bottom edge.
            tlAnchor.write(Circle).cy = prevBrY;
            brAnchor.write(Circle).cy = y;
            anchorName = AnchorName.BOTTOM_CENTER;
            selection.resizingAnchorName = AnchorName.BOTTOM_CENTER;
          }
        }
      } else if (anchorName === AnchorName.BOTTOM_CENTER) {
        if (!flipEnabled) {
          brAnchor.write(Circle).cy = Math.max(y, tlAnchor.read(Circle).cy);
        } else {
          const prevTlY = tlAnchor.read(Circle).cy;
          brAnchor.write(Circle).cy = y;
          if (y < prevTlY) {
            // Crossing over: dragged edge becomes top edge.
            brAnchor.write(Circle).cy = prevTlY;
            tlAnchor.write(Circle).cy = y;
            anchorName = AnchorName.TOP_CENTER;
            selection.resizingAnchorName = AnchorName.TOP_CENTER;
          }
        }
      } else if (anchorName === AnchorName.MIDDLE_LEFT) {
        if (!flipEnabled) {
          tlAnchor.write(Circle).cx = Math.min(x, brAnchor.read(Circle).cx);
        } else {
          const prevBrX = brAnchor.read(Circle).cx;
          tlAnchor.write(Circle).cx = x;
          if (x > prevBrX) {
            // Crossing over: dragged edge becomes right edge.
            tlAnchor.write(Circle).cx = prevBrX;
            brAnchor.write(Circle).cx = x;
            anchorName = AnchorName.MIDDLE_RIGHT;
            selection.resizingAnchorName = AnchorName.MIDDLE_RIGHT;
          }
        }
      } else if (anchorName === AnchorName.MIDDLE_RIGHT) {
        if (!flipEnabled) {
          brAnchor.write(Circle).cx = Math.max(x, tlAnchor.read(Circle).cx);
        } else {
          const prevTlX = tlAnchor.read(Circle).cx;
          brAnchor.write(Circle).cx = x;
          if (x < prevTlX) {
            // Crossing over: dragged edge becomes left edge.
            brAnchor.write(Circle).cx = prevTlX;
            tlAnchor.write(Circle).cx = x;
            anchorName = AnchorName.MIDDLE_LEFT;
            selection.resizingAnchorName = AnchorName.MIDDLE_LEFT;
          }
        }
      }

      if (lockAspectRatio) {
        if (
          anchorName === AnchorName.MIDDLE_LEFT ||
          anchorName === AnchorName.MIDDLE_RIGHT
        ) {
          const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
          const tan = sin / cos;
          const newHeight = newWidth * tan;
          const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
          brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
          tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
        } else if (
          anchorName === AnchorName.TOP_CENTER ||
          anchorName === AnchorName.BOTTOM_CENTER
        ) {
          const newHeight = brAnchor.read(Circle).cy - tlAnchor.read(Circle).cy;
          const tan = sin / cos;
          const newWidth = newHeight / tan;
          const deltaX = newWidth - (prevBrAnchorX - prevTlAnchorX);
          brAnchor.write(Circle).cx = brAnchor.read(Circle).cx + deltaX / 2;
          tlAnchor.write(Circle).cx = tlAnchor.read(Circle).cx - deltaX / 2;
        }
      }

      if (centeredScaling) {
        const topOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
        const topOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;

        const bottomOffsetX = brAnchor.read(Circle).cx - prevBrAnchorX;
        const bottomOffsetY = brAnchor.read(Circle).cy - prevBrAnchorY;

        Object.assign(brAnchor.write(Circle), {
          cx: brAnchor.read(Circle).cx - topOffsetX,
          cy: brAnchor.read(Circle).cy - topOffsetY,
        });

        Object.assign(tlAnchor.write(Circle), {
          cx: tlAnchor.read(Circle).cx - bottomOffsetX,
          cy: tlAnchor.read(Circle).cy - bottomOffsetY,
        });
      }

      const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
      const { cx: brCx, cy: brCy } = brAnchor.read(Circle);

      {
        const width = brCx - tlCx;
        const height = brCy - tlCy;

        if (!flipEnabled && (width <= 0 || height <= 0)) {
          return;
        }

        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy }, mask);

        this.fitSelected(
          api,
          {
            x,
            y,
            width,
            height,
            rotation,
            scaleX,
            scaleY,
          },
          selection,
        );

        showLabel(label, api, { x, y, width, height });
      }
    }
  }

  private handleControlPointMoving(
    api: API,
    canvasX: number,
    canvasY: number,
    selection: SelectOBB,
  ) {
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.MOVING;

    const activeControlPointIndex = selection.activeControlPointIndex;
    if (activeControlPointIndex === undefined || activeControlPointIndex < 0) {
      return;
    }

    const layersSelected = api.getAppState().layersSelected;
    if (layersSelected.length !== 1) {
      return;
    }

    const node = api.getNodeById(layersSelected[0]);
    if (
      !node ||
      (node.type !== 'polyline' &&
        node.type !== 'rough-polyline' &&
        node.type !== 'path' &&
        node.type !== 'rough-path')
    ) {
      return;
    }

    const selected = api.getEntity(node);
    if (!selected?.hasSomeOf(Polyline, Path)) {
      return;
    }

    const inverse = mat3.invert(
      mat3.create(),
      selected.read(GlobalTransform).matrix as unknown as mat3,
    );
    if (!inverse) {
      return;
    }

    const local = vec2.transformMat3(
      vec2.create(),
      [canvasX, canvasY],
      inverse,
    );
    const nextX = local[0];
    const nextY = local[1];

    if (selected.has(Polyline)) {
      const { points } = selected.read(Polyline);
      if (activeControlPointIndex >= points.length) {
        return;
      }
      const [prevX, prevY] = points[activeControlPointIndex];
      if (prevX === nextX && prevY === nextY) {
        return;
      }
      points[activeControlPointIndex] = [nextX, nextY];
      api.updateNode(node, {
        points: points.map((point) => point.join(',')).join(' '),
      });
      updateGlobalTransform(selected);
      updateComputedPoints(selected);
      if (isEdgeBindingRebindCandidate(selected, node as EdgeSerializedNode)) {
        selection.bindingRebindLastCanvas = { x: canvasX, y: canvasY };
        this.applyBindingRebindHover(api, canvasX, canvasY);
      }
      return;
    }

    const { controlPointMeta, pathControlCommands } = camera.read(Transformable);
    const meta = (controlPointMeta?.[activeControlPointIndex] ??
      null) as PathControlHandleMeta | null;
    if (!meta || !pathControlCommands?.length) {
      return;
    }
    const nextCommands = pathControlCommands.map(
      (command) => [...command] as PathCommand,
    );
    setPathHandlePoint(nextCommands, meta, nextX, nextY);
    api.updateNode(node, {
      d: toPathData(nextCommands),
    });

    camera.write(Transformable).pathControlCommands =
      nextCommands as unknown as (string | number)[][];

    if (isEdgeBindingRebindCandidate(selected, node as EdgeSerializedNode)) {
      selection.bindingRebindLastCanvas = { x: canvasX, y: canvasY };
      this.applyBindingRebindHover(api, canvasX, canvasY);
    }
  }

  private handleControlPointMoved(api: API, selection: SelectOBB) {
    const { layersSelected } = api.getAppState();
    if (
      layersSelected.length === 1 &&
      selection.bindingRebindLastCanvas
    ) {
      const edgeNode = api.getNodeById(layersSelected[0]);
      const entity = edgeNode ? api.getEntity(edgeNode) : undefined;
      const pt = selection.bindingRebindLastCanvas;
      delete selection.bindingRebindLastCanvas;

      if (
        edgeNode &&
        isEdgeBindingRebindCandidate(entity, edgeNode as EdgeSerializedNode)
      ) {
        const camera = api.getCamera();
        const { pathControlCommands } = camera.read(Transformable);
        let polylinePointCount: number | undefined;
        if (entity?.has(Polyline)) {
          polylinePointCount = entity.read(Polyline).points.length;
        }
        const rebindAnchor = getEdgeRebindAnchorForControlPointDrag(
          edgeNode,
          selection.activeControlPointIndex,
          pathControlCommands as PathCommand[] | undefined,
          polylinePointCount,
        );
        if (rebindAnchor != null) {
          this.applyBindingRebindAt(
            api,
            edgeNode as EdgeSerializedNode,
            rebindAnchor,
            pt,
          );
        }
      }
    }

    const camera = api.getCamera();

    api.setNodes(api.getNodes());
    api.record();

    const { layersSelected: movedLayers } = api.getAppState();
    if (movedLayers.length === 1) {
      const movedNode = api.getNodeById(movedLayers[0]);
      const movedEntity = movedNode ? api.getEntity(movedNode) : undefined;
      if (movedNode && movedEntity) {
        updateGlobalTransform(movedEntity);
        updateComputedPoints(movedEntity);
        rebasePolylinePathGeometryToLocalOrigin(api, movedNode);
      }
    }

    camera.write(Transformable).status = TransformableStatus.MOVED;
    this.saveSelectedOBB(api, selection);
  }

  private insertControlPointFromMidpoint(
    api: API,
    canvasX: number,
    canvasY: number,
    selection: SelectOBB,
  ) {
    const activeSegmentMidpointIndex = selection.activeSegmentMidpointIndex;
    if (
      activeSegmentMidpointIndex === undefined ||
      activeSegmentMidpointIndex < 0
    ) {
      return;
    }

    const layersSelected = api.getAppState().layersSelected;
    if (layersSelected.length !== 1) {
      return;
    }

    const node = api.getNodeById(layersSelected[0]);
    if (!node || (node.type !== 'polyline' && node.type !== 'rough-polyline')) {
      return;
    }

    const selected = api.getEntity(node);
    if (!selected?.has(Polyline)) {
      return;
    }

    const { points } = selected.read(Polyline);
    if (activeSegmentMidpointIndex >= points.length - 1) {
      return;
    }

    const inverse = mat3.invert(
      mat3.create(),
      selected.read(GlobalTransform).matrix as unknown as mat3,
    );
    if (!inverse) {
      return;
    }

    const local = vec2.transformMat3(
      vec2.create(),
      [canvasX, canvasY],
      inverse,
    );
    const nextPoints = [...points];
    const insertIndex = activeSegmentMidpointIndex + 1;
    nextPoints.splice(insertIndex, 0, [local[0], local[1]]);

    api.updateNode(node, {
      points: nextPoints.map((point) => point.join(',')).join(' '),
    });
    updateGlobalTransform(selected);
    updateComputedPoints(selected);

    selection.activeControlPointIndex = insertIndex;
    selection.activeSegmentMidpointIndex = undefined;
  }

  private deleteActiveControlPoint(api: API, input: Input, selection: SelectOBB) {
    const activeControlPointIndex = selection.activeControlPointIndex;
    if (activeControlPointIndex === undefined || activeControlPointIndex < 0) {
      return;
    }

    const layersSelected = api.getAppState().layersSelected;
    if (layersSelected.length !== 1) {
      return;
    }

    const node = api.getNodeById(layersSelected[0]);
    if (!node || (node.type !== 'polyline' && node.type !== 'rough-polyline')) {
      return;
    }

    const selected = api.getEntity(node);
    if (!selected?.has(Polyline)) {
      return;
    }

    const { points } = selected.read(Polyline);
    if (points.length <= 2 || activeControlPointIndex >= points.length) {
      return;
    }

    input.event.stopPropagation();

    const nextPoints = [...points];
    nextPoints.splice(activeControlPointIndex, 1);

    api.updateNode(node, {
      points: nextPoints.map((point) => point.join(',')).join(' '),
    });
    updateGlobalTransform(selected);
    updateComputedPoints(selected);
    rebasePolylinePathGeometryToLocalOrigin(api, api.getNodeById(node.id)!);
    api.record();

    selection.activeControlPointIndex = Math.min(
      activeControlPointIndex,
      nextPoints.length - 1,
    );
    selection.activeSegmentMidpointIndex = undefined;
    if (selection.mode === SelectionMode.MOVE_CONTROL_POINT) {
      selection.mode = SelectionMode.READY_TO_MOVE_CONTROL_POINT;
    }
  }

  private applyBindingRebindHover(api: API, canvasX: number, canvasY: number) {
    const hits = api.elementsFromPoint({ x: canvasX, y: canvasY });
    for (const entity of hits) {
      if (entity.has(UI)) {
        continue;
      }
      if (!entity.has(Rect) && !entity.has(Ellipse)) {
        continue;
      }
      const node = api.getNodeByEntity(entity);
      if (!node) {
        continue;
      }
      const t = node.type;
      if (
        t === 'rect' ||
        t === 'ellipse' ||
        t === 'rough-rect' ||
        t === 'rough-ellipse'
      ) {
        api.highlightNodes([node]);
        return;
      }
    }

    api.highlightNodes([]);
  }

  private handleSelectedResized(api: API, selection: SelectOBB) {
    const { layersSelected } = api.getAppState();
    if (
      layersSelected.length === 1 &&
      selection.bindingRebindLastCanvas &&
      (selection.resizingAnchorName === AnchorName.X1Y1 ||
        selection.resizingAnchorName === AnchorName.X2Y2)
    ) {
      const edgeNode = api.getNodeById(layersSelected[0]);
      const entity = edgeNode ? api.getEntity(edgeNode) : undefined;
      if (
        edgeNode &&
        isEdgeBindingRebindCandidate(entity, edgeNode as EdgeSerializedNode)
      ) {
        const pt = selection.bindingRebindLastCanvas;
        delete selection.bindingRebindLastCanvas;
        this.applyBindingRebindAt(
          api,
          edgeNode as EdgeSerializedNode,
          selection.resizingAnchorName,
          pt,
        );
      }
    }

    const camera = api.getCamera();
    const tfDone = camera.write(Transformable);
    tfDone.status = TransformableStatus.RESIZED;
    tfDone.resizeWidth = -1;
    tfDone.resizeHeight = -1;

    api.setNodes(api.getNodes());
    api.record();

    if (
      layersSelected.length === 1 &&
      (selection.resizingAnchorName === AnchorName.X1Y1 ||
        selection.resizingAnchorName === AnchorName.X2Y2)
    ) {
      const lineNode = api.getNodeById(layersSelected[0]);
      if (lineNode?.type === 'line' || lineNode?.type === 'rough-line') {
        rebasePolylinePathGeometryToLocalOrigin(api, lineNode);
      }
    }

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedOBB(api, selection);
  }

  private applyBindingRebindAt(
    api: API,
    edgeNode: EdgeSerializedNode,
    anchor: AnchorName,
    canvas: { x: number; y: number },
  ) {
    const hits = api.elementsFromPoint({ x: canvas.x, y: canvas.y });
    let targetNode: SerializedNode | undefined;
    for (const entity of hits) {
      if (entity.has(UI)) {
        continue;
      }
      if (!entity.has(Rect) && !entity.has(Ellipse)) {
        continue;
      }
      const n = api.getNodeByEntity(entity);
      if (!n) {
        continue;
      }
      const t = n.type;
      if (
        t === 'rect' ||
        t === 'ellipse' ||
        t === 'rough-rect' ||
        t === 'rough-ellipse'
      ) {
        targetNode = n;
        break;
      }
    }
    if (!targetNode) {
      // 未命中图元：端点改为画布上的浮动点（与 sourcePoint / targetPoint 一致）
      if (anchor === AnchorName.X1Y1) {
        api.updateNode(edgeNode as SerializedNode, {
          fromId: undefined,
          sourcePoint: { x: canvas.x, y: canvas.y },
          exitX: undefined,
          exitY: undefined,
          exitPerimeter: undefined,
          exitDx: undefined,
          exitDy: undefined,
        });
      } else {
        api.updateNode(edgeNode as SerializedNode, {
          toId: undefined,
          targetPoint: { x: canvas.x, y: canvas.y },
          entryX: undefined,
          entryY: undefined,
          entryPerimeter: undefined,
          entryDx: undefined,
          entryDy: undefined,
        });
      }
      return;
    }

    const c = constraintAttrsFromCanvasPoint(targetNode, canvas.x, canvas.y);
    if (anchor === AnchorName.X1Y1) {
      api.updateNode(edgeNode as SerializedNode, {
        fromId: targetNode.id,
        sourcePoint: undefined,
        exitX: c.x,
        exitY: c.y,
        exitPerimeter: c.perimeter,
        exitDx: c.dx,
        exitDy: c.dy,
      });
    } else {
      api.updateNode(edgeNode as SerializedNode, {
        toId: targetNode.id,
        targetPoint: undefined,
        entryX: c.x,
        entryY: c.y,
        entryPerimeter: c.perimeter,
        entryDx: c.dx,
        entryDy: c.dy,
      });
    }
  }

  private handleSelectedRotated(api: API, selection: SelectOBB) {
    const camera = api.getCamera();
    const tfDone = camera.write(Transformable);
    tfDone.status = TransformableStatus.ROTATED;
    tfDone.transformerObbFrozenDuringRotate = false;

    delete selection.rotateLastPointerAngle;
    delete selection.rotateAccumulated;
    delete selection.rotatePivotWorldFixed;
    delete selection.rotatePivotLocalFixed;

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedOBB(api, selection);
  }

  private handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);

    const { pointerDownViewportX, pointerDownViewportY } = camera.read(
      ComputedCameraControl,
    );

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
      distanceBetweenPoints(
        viewportX,
        viewportY,
        pointerDownViewportX,
        pointerDownViewportY,
      ) > 10;

    if (shouldShowSelectionBrush) {
      this.renderBrush(
        api,
        selection,
        // <rect> attribute height: A negative value is not valid. So we need to use the absolute value.
        Math.min(pointerDownViewportX, viewportX),
        Math.min(pointerDownViewportY, viewportY),
        Math.abs(viewportX - pointerDownViewportX),
        Math.abs(viewportY - pointerDownViewportY),
      );

      // Select elements in the brush
      this.applyBrushSelection(api, selection, false);
    }
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const { inputPoints, api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;

      const input = canvas.read(Input);

      if (pen !== Pen.SELECT) {
        // Clear selection
        if (pen !== Pen.VECTOR_NETWORK && pen !== Pen.ERASER) {
          api.selectNodes([]);
        }

        if (pen !== Pen.VECTOR_NETWORK) {
          if (this.selections.has(camera.__id)) {
            this.saveSelectedOBB(api, this.selections.get(camera.__id)!);
          }
          return;
        }
      }

      const { layersCropping, layersLassoing } = api.getAppState();
      layersCropping.forEach((id) => {
        const node = api.getNodeById(id);
        if (node && node.clipMode !== 'soft') {
          api.updateNode(node, { clipMode: 'soft', locked: true });
          api.deselectNodes([node]);
          api.selectNodes([api.getNodeByEntity(api.getChildren(node)[0])]);
        }
      });

      const cursor = canvas.write(Cursor);

      safeAddComponent(camera, Transformable);

      if (!this.selections.has(camera.__id)) {
        const selection = {
          mode: SelectionMode.IDLE,
          resizingAnchorName: AnchorName.INSIDE,
          activeControlPointIndex: undefined,
          activeSegmentMidpointIndex: undefined,
          controlPointDirty: false,
          nodes: api.getNodes().map((node) => ({
            ...node,
            ...api.getAbsoluteTransformAndSize(node),
          })),
          obb: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          sin: 0,
          cos: 0,
          pointerMoveViewportX: 0,
          pointerMoveViewportY: 0,
          brushContainer: createSVGElement('svg') as SVGSVGElement,
          snapContainer: createSVGElement('svg') as SVGSVGElement,
          label: DOMAdapter.get().getDocument().createElement('div'),
          editing: undefined,
        };
        this.selections.set(camera.__id, selection);

        if (isBrowser) {
          selection.brushContainer.style.overflow = 'visible';
          selection.brushContainer.style.position = 'absolute';
          selection.snapContainer.style.overflow = 'visible';
          selection.snapContainer.style.position = 'absolute';

          const $svgLayer = api.getSvgLayer();
          if ($svgLayer) {
            $svgLayer.appendChild(selection.brushContainer);
            $svgLayer.appendChild(selection.snapContainer);

            const { label } = selection;
            initLabel(label);
            $svgLayer.appendChild(selection.label);
          }
        }
      }

      // if (input.doubleClickTrigger) {
      //   // FIXME: Only support Polyline for now
      //   const { selecteds } = camera.read(Transformable);
      //   if (selecteds.length === 1) {
      //     const selected = selecteds[0];

      //     const selection = this.selections.get(camera.__id);
      //     selection.mode = SelectionMode.EDITING;

      //     // Enter edit mode
      //     api.updateNode(api.getNodeByEntity(selected), { isEditing: true });
      //     selection.editing = selected;

      //     if (selected.has(Polyline)) {
      //       const vectorNetwork = VectorNetwork.fromEntity(selected);
      //       safeRemoveComponent(selected, Polyline);

      //       api.runAtNextTick(() => {
      //         safeAddComponent(selected, VectorNetwork, vectorNetwork);
      //       });

      //       // Enter VectorNetwork edit mode
      //       api.setAppState({
      //         penbarSelected: Pen.VECTOR_NETWORK,
      //       });
      //     }

      //     return;
      //   }
      // }

      const selection = this.selections.get(camera.__id);

      if (input.doubleClickTrigger && pen === Pen.SELECT) {
        const { selecteds } = camera.read(Transformable);
        if (selecteds.length === 1) {
          const selected = selecteds[0];
          if (!selected.has(Locked)) {
            const node = api.getNodeByEntity(selected);
            if (
              node &&
              selected.hasSomeOf(Polyline, Path) &&
              !(
                hasFullOrPartialEdgeBinding(selected) &&
                selected.has(Polyline)
              )
            ) {
              const t = node.type;
              if (
                t === 'polyline' ||
                t === 'rough-polyline' ||
                t === 'path' ||
                t === 'rough-path'
              ) {
                safeAddComponent(selected, Editable);
                selected.write(Editable).isEditing = true;
                api.updateNode(node, { isEditing: true });
                selection.editing = selected;
                return;
              }
            }
          }
        }
      }

      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;

        if (selection.editing) {
          if (selection.mode === SelectionMode.IDLE) {
            safeAddComponent(selection.editing, Editable);
            selection.editing.write(Editable).isEditing = false;
            api.updateNode(api.getNodeByEntity(selection.editing), { isEditing: false });

            selection.editing = undefined;
            selection.mode = SelectionMode.SELECT;
            api.setAppState({
              editingPoints: [],
            });
            return;
          }
          if (selection.mode === SelectionMode.READY_TO_MOVE) {
            api.setAppState({
              editingPoints: [[x, y]],
            });
            return;
          }
          // 编辑态下仍需允许控制点 / 缩放 / 旋转等 transformer 手势，勿在此处统一 return
        }

        if (selection.mode === SelectionMode.IDLE) {
          selection.mode = SelectionMode.READY_TO_BRUSH;
          api.selectNodes([]);

          if (layersCropping.length > 0) {
            api.applyCrop();
          }
          // if (layersLassoing.length > 0) {
          //   api.cancelLasso();
          // }
        } else if (selection.mode === SelectionMode.READY_TO_SELECT) {
          selection.mode = SelectionMode.SELECT;
        } else if (selection.mode === SelectionMode.READY_TO_MOVE) {
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          const targetNode = toSelect ? api.getNodeByEntity(toSelect) : undefined;
          const selectedIds = api.getAppState().layersSelected;
          const hitUnselectedTarget =
            !!targetNode && !selectedIds.includes(targetNode.id);

          // Prioritize tap-to-select when clicking another shape.
          if (hitUnselectedTarget || input.shiftKey) {
            selection.mode = SelectionMode.SELECT;
          } else {
            if (layersCropping.length > 0) {
              cursor.value = 'move';
            } else {
              cursor.value = 'grab';
            }
            selection.mode = SelectionMode.MOVE;
          }
        } else if (
          selection.mode === SelectionMode.READY_TO_RESIZE ||
          selection.mode === SelectionMode.READY_TO_ROTATE
        ) {
          this.saveSelectedOBB(api, selection);
          if (selection.mode === SelectionMode.READY_TO_RESIZE) {
            delete selection.rotateLastPointerAngle;
            delete selection.rotateAccumulated;
            delete selection.rotatePivotWorldFixed;
            delete selection.rotatePivotLocalFixed;
            camera.write(Transformable).transformerObbFrozenDuringRotate = false;
            selection.mode = SelectionMode.RESIZE;
          } else if (selection.mode === SelectionMode.READY_TO_ROTATE) {
            const [px, py] = this.getRotatePivotWorld(api, selection);
            selection.rotatePivotWorldFixed = [px, py];
            const cameraTfAtDown = camera.read(Transformable);
            const plx = Number.isNaN(cameraTfAtDown.rotatePivotX)
              ? selection.obb.width / 2
              : cameraTfAtDown.rotatePivotX;
            const ply = Number.isNaN(cameraTfAtDown.rotatePivotY)
              ? selection.obb.height / 2
              : cameraTfAtDown.rotatePivotY;
            selection.rotatePivotLocalFixed = [plx, ply];

            if (api.getAppState().layersSelected.length > 1) {
              const tf = camera.write(Transformable);
              tf.transformerObbFrozenDuringRotate = true;
              const g = tf.gestureFrozenSelectionOBB;
              const obb = selection.obb;
              g.x = obb.x;
              g.y = obb.y;
              g.width = obb.width;
              g.height = obb.height;
              g.rotation = obb.rotation;
              g.scaleX = obb.scaleX;
              g.scaleY = obb.scaleY;
            }

            let { x: cx, y: cy } = api.viewport2Canvas({ x, y });
            const { snapToPixelGridEnabled, snapToPixelGridSize } =
              api.getAppState();
            if (snapToPixelGridEnabled) {
              cx = snapToGrid(cx, snapToPixelGridSize);
              cy = snapToGrid(cy, snapToPixelGridSize);
            }
            selection.rotateLastPointerAngle = Math.atan2(cy - py, cx - px);
            selection.rotateAccumulated = 0;
            selection.mode = SelectionMode.ROTATE;
          }
        } else if (selection.mode === SelectionMode.READY_TO_MOVE_PIVOT) {
          selection.mode = SelectionMode.MOVE_PIVOT;
        } else if (
          selection.mode === SelectionMode.READY_TO_MOVE_CONTROL_POINT
        ) {
          const { x: canvasX, y: canvasY } = api.viewport2Canvas({ x, y });
          this.insertControlPointFromMidpoint(api, canvasX, canvasY, selection);
          selection.mode = SelectionMode.MOVE_CONTROL_POINT;
        }

        if (
          selection.mode === SelectionMode.SELECT ||
          selection.mode === SelectionMode.READY_TO_BRUSH
        ) {
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (toSelect) {
            const selected = api.getNodeByEntity(toSelect);
            if (selected) {
              if (
                api.getAppState().layersSelected.length > 1 &&
                api.getAppState().layersSelected.includes(selected.id)
              ) {
                // deselect if already selected in a group
                api.deselectNodes([selected]);
              } else {
                api.selectNodes([selected], input.shiftKey); // single or multi select
              }
            }
            // Touch devices do not have hover, so keep click-to-select working
            // by promoting READY_TO_BRUSH to SELECT when a hit target exists.
            if (selection.mode === SelectionMode.READY_TO_BRUSH) {
              selection.mode = SelectionMode.SELECT;
            }
          }

          if (api.getAppState().layersSelected.length > 0) {
            selection.mode = SelectionMode.MOVE;
          }
        }

        // 点击/框选等改变 layersSelected 时同步 OBB，并重置旋转枢轴（与上一选中项的 origin 脱钩）
        this.saveSelectedOBB(api, selection);
      }

      let toHighlight: Entity | undefined;
      if (camera.has(ComputedCamera) && inputPoints.length === 0) {
        const [x, y] = input.pointerViewport;
        if (
          selection.pointerMoveViewportX !== x &&
          selection.pointerMoveViewportY !== y
        ) {
          selection.pointerMoveViewportX = x;
          selection.pointerMoveViewportY = y;

          // Highlight the topmost non-ui element (prefer its parent group if any)
          toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (toHighlight) {
            toHighlight = this.resolveHighlightEntityFromHit(toHighlight, camera);
            if (
              selection.mode !== SelectionMode.BRUSH &&
              selection.mode !== SelectionMode.MOVE &&
              selection.mode !== SelectionMode.ROTATE &&
              selection.mode !== SelectionMode.RESIZE &&
              selection.mode !== SelectionMode.MOVE_PIVOT &&
              selection.mode !== SelectionMode.MOVE_CONTROL_POINT
            ) {
              selection.mode = SelectionMode.READY_TO_SELECT;
            }
          } else if (
            selection.mode !== SelectionMode.BRUSH &&
            selection.mode !== SelectionMode.ROTATE &&
            selection.mode !== SelectionMode.RESIZE &&
            selection.mode !== SelectionMode.MOVE_PIVOT &&
            selection.mode !== SelectionMode.MOVE_CONTROL_POINT
          ) {
            selection.mode = SelectionMode.IDLE;
          }
          const { mask, selecteds } = camera.read(Transformable);

          cursor.value = 'default';

          // Hit test with transformer
          if (selecteds.length >= 1) {
            const {
              anchor,
              cursor: cursorName,
              index,
            } = hitTest(api, {
              x,
              y,
            }) || {};

            if (selection.mode !== SelectionMode.BRUSH) {
              if (anchor) {
                if (anchor === AnchorName.CONTROL) {
                  cursor.value = 'crosshair';
                  selection.activeControlPointIndex = index;
                  selection.activeSegmentMidpointIndex = undefined;
                  selection.mode = SelectionMode.READY_TO_MOVE_CONTROL_POINT;
                  toHighlight = undefined;
                } else if (anchor === AnchorName.CENTER) {
                  cursor.value = 'move';
                  selection.activeControlPointIndex = undefined;
                  selection.activeSegmentMidpointIndex = undefined;
                  selection.mode = SelectionMode.READY_TO_MOVE_PIVOT;
                  toHighlight = undefined;
                } else if (anchor === AnchorName.SEGMENT_MIDPOINT) {
                  cursor.value = 'crosshair';
                  selection.activeControlPointIndex = undefined;
                  selection.activeSegmentMidpointIndex = index;
                  selection.mode = SelectionMode.READY_TO_MOVE_CONTROL_POINT;
                  toHighlight = undefined;
                } else {
                  selection.activeControlPointIndex = undefined;
                  selection.activeSegmentMidpointIndex = undefined;
                  if (layersLassoing.length > 0) {
                    if (anchor === AnchorName.INSIDE) {
                      cursor.value = LASSO_CURSOR;
                      selection.mode = SelectionMode.LASSOING;
                    }
                  } else {
                    const { rotation, scale } = mask.read(Transform);
                    cursor.value =
                      getCursor(
                        cursorName,
                        rotation,
                        '',
                        Math.sign(scale[0] * scale[1]) < 0,
                      ) ?? cursorName;
                    selection.resizingAnchorName = anchor;

                    if (cursorName.includes('rotate')) {
                      if (selection.mode !== SelectionMode.ROTATE) {
                        selection.mode = SelectionMode.READY_TO_ROTATE;
                      }
                      toHighlight = undefined;
                    } else if (
                      cursorName.includes('resize') ||
                      anchor === AnchorName.X1Y1 ||
                      anchor === AnchorName.X2Y2
                    ) {
                      if (selection.mode !== SelectionMode.RESIZE) {
                        selection.mode = SelectionMode.READY_TO_RESIZE;
                      }
                      toHighlight = undefined;
                    } else if (anchor === AnchorName.INSIDE) {
                      // Only in single transformer, we can select other objects.
                      if (
                        toHighlight &&
                        toHighlight !== selecteds[0] &&
                        selecteds.length === 1
                      ) {
                        selection.mode = SelectionMode.READY_TO_SELECT;
                      } else {
                        // In group can toggle selection.
                        if (input.shiftKey) {
                          selection.mode = SelectionMode.READY_TO_SELECT;
                        } else {
                          if (
                            // selection.mode !== SelectionMode.BRUSH &&
                            selection.mode !== SelectionMode.MOVE &&
                            selection.mode !== SelectionMode.ROTATE &&
                            selection.mode !== SelectionMode.RESIZE
                          ) {
                            selection.mode = SelectionMode.READY_TO_MOVE;
                          }
                        }
                      }
                    } else if (
                      toHighlight &&
                      selection.mode !== SelectionMode.ROTATE &&
                      selection.mode !== SelectionMode.RESIZE
                    ) {
                      selection.mode = SelectionMode.READY_TO_SELECT;
                    }

                    if (layersCropping.length > 0) {
                      if (anchor === AnchorName.INSIDE) {
                        cursor.value = 'move';
                      }
                    }
                  }
                }
              }
            }
          }

          if (toHighlight) {
            const node = api.getNodeByEntity(toHighlight);
            if (node) {
              api.highlightNodes([node]);
            }
          } else {
            api.highlightNodes([]);
          }
        }
      }

      // Dragging
      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = input.pointerViewport;
        if (prevX === x && prevY === y) {
          return;
        }

        let { x: sx, y: sy } = api.viewport2Canvas({
          x: prevX,
          y: prevY,
        });
        let { x: ex, y: ey } = api.viewport2Canvas({
          x,
          y,
        });

        const { snapToPixelGridEnabled, snapToPixelGridSize } =
          api.getAppState();
        if (snapToPixelGridEnabled) {
          sx = snapToGrid(sx, snapToPixelGridSize);
          sy = snapToGrid(sy, snapToPixelGridSize);
          ex = snapToGrid(ex, snapToPixelGridSize);
          ey = snapToGrid(ey, snapToPixelGridSize);
        }

        if (
          selection.mode === SelectionMode.READY_TO_BRUSH ||
          selection.mode === SelectionMode.BRUSH
        ) {
          this.handleBrushing(api, x, y);
          selection.mode = SelectionMode.BRUSH;
        } else if (selection.mode === SelectionMode.MOVE) {
          if (layersCropping.length > 0) {
            cursor.value = 'move';
          } else {
            cursor.value = 'grabbing';
          }
          this.handleSelectedMoving(api, sx, sy, ex, ey);
        } else if (selection.mode === SelectionMode.RESIZE) {
          this.handleSelectedResizing(
            api,
            ex,
            ey,
            input.shiftKey,
            input.altKey,
            selection,
          );
        } else if (selection.mode === SelectionMode.ROTATE) {
          this.handleSelectedRotating(api, ex, ey);
        } else if (selection.mode === SelectionMode.MOVE_PIVOT) {
          this.handleRotatePivotMoving(api, ex, ey);
        } else if (selection.mode === SelectionMode.MOVE_CONTROL_POINT) {
          this.handleControlPointMoving(api, ex, ey, selection);
        }
      });

      if (input.key === 'Escape') {
        if (selection.editing) {
          const editingNode = api.getNodeByEntity(selection.editing);
          safeAddComponent(selection.editing, Editable);
          selection.editing.write(Editable).isEditing = false;
          if (editingNode) {
            api.updateNode(editingNode, { isEditing: false });
          }
          selection.editing = undefined;
          api.setAppState({ editingPoints: [] });
        }
        api.selectNodes([]);
        api.highlightNodes([]);
        this.saveSelectedOBB(api, selection);
        if (selection.mode === SelectionMode.BRUSH) {
          this.hideBrush(selection);
        }

        if (
          selection.mode === SelectionMode.ROTATE ||
          selection.mode === SelectionMode.READY_TO_ROTATE
        ) {
          delete selection.rotateLastPointerAngle;
          delete selection.rotateAccumulated;
          delete selection.rotatePivotWorldFixed;
          delete selection.rotatePivotLocalFixed;
          camera.write(Transformable).transformerObbFrozenDuringRotate = false;
        }

        if (api.getAppState().layersCropping.length > 0) {
          api.cancelCrop();
        }
      } else if (input.key === 'Backspace' || input.key === 'Delete') {
        this.deleteActiveControlPoint(api, input, selection);
      }

      if (input.pointerUpTrigger) {
        hideLabel(selection.label);

        if (selection.mode === SelectionMode.BRUSH) {
          this.hideBrush(selection);
          this.applyBrushSelection(api, selection, false);
        } else if (selection.mode === SelectionMode.MOVE) {
          this.handleSelectedMoved(api, selection);
          selection.mode = SelectionMode.READY_TO_MOVE;
        } else if (
          selection.mode === SelectionMode.RESIZE ||
          selection.mode === SelectionMode.READY_TO_RESIZE
        ) {
          this.handleSelectedResized(api, selection);
          selection.mode = SelectionMode.READY_TO_RESIZE;
        } else if (selection.mode === SelectionMode.ROTATE) {
          this.handleSelectedRotated(api, selection);
          selection.mode = SelectionMode.READY_TO_ROTATE;
        } else if (
          selection.mode === SelectionMode.MOVE_PIVOT ||
          selection.mode === SelectionMode.READY_TO_MOVE_PIVOT
        ) {
          selection.mode = SelectionMode.READY_TO_MOVE_PIVOT;
        } else if (
          selection.mode === SelectionMode.MOVE_CONTROL_POINT ||
          selection.mode === SelectionMode.READY_TO_MOVE_CONTROL_POINT
        ) {
          this.handleControlPointMoved(api, selection);
          selection.mode = SelectionMode.READY_TO_MOVE_CONTROL_POINT;
        }

        cursor.value = 'default';

        if (isBrowser) {
          this.clearSnapLines(selection);
        }
      }
    });
  }

  finalize(): void {
    this.selections.forEach(({ brushContainer, snapContainer, label }) => {
      brushContainer.remove();
      snapContainer.remove();
      label.remove();
    });
    this.selections.clear();
  }

  private applyBrushSelection(
    api: API,
    selection: SelectOBB,
    needHighlight: boolean,
  ) {
    if (selection.brushContainer) {
      const brush = selection.brushContainer.firstChild as SVGRectElement;
      if (!brush) {
        return;
      }
      const x = parseFloat(brush.getAttribute('x') || '0');
      const y = parseFloat(brush.getAttribute('y') || '0');
      const width = parseFloat(brush.getAttribute('width') || '0');
      const height = parseFloat(brush.getAttribute('height') || '0');
      const { x: minX, y: minY } = api.viewport2Canvas({
        x,
        y,
      });
      const { x: maxX, y: maxY } = api.viewport2Canvas({
        x: x + width,
        y: y + height,
      });
      const selecteds = api
        // locked layers should not be selected
        .elementsFromBBox(minX, minY, maxX, maxY)
        // Only select direct children of the camera
        .filter((e) => !e.has(UI) && e.has(Children) && e.read(Children).parent.has(Camera))
        .map((e) => api.getNodeByEntity(e));
      api.selectNodes(selecteds);
      if (needHighlight) {
        api.highlightNodes(selecteds);
      }
      this.saveSelectedOBB(api, selection);
    }
  }

  private saveSelectedOBB(api: API, selection: SelectOBB) {
    const camera = api.getCamera();
    const selectedNodeIds = [...api.getAppState().layersSelected].sort();
    const prevSelectedNodeIds = [...(selection.selectedNodeIds ?? [])].sort();
    const selectedChanged =
      selectedNodeIds.length !== prevSelectedNodeIds.length ||
      selectedNodeIds.some((id, i) => id !== prevSelectedNodeIds[i]);
    if (selectedChanged) {
      const tf = camera.write(Transformable);
      tf.rotatePivotPinned = false;
      tf.rotatePivotX = NaN;
      tf.rotatePivotY = NaN;

      if (selection.editing) {
        const editingNode = api.getNodeByEntity(selection.editing);
        const editingId = editingNode?.id;
        const stillSame =
          selectedNodeIds.length === 1 && selectedNodeIds[0] === editingId;
        if (!stillSame) {
          safeAddComponent(selection.editing, Editable);
          selection.editing.write(Editable).isEditing = false;
          if (editingNode) {
            api.updateNode(editingNode, { isEditing: false });
          }
          selection.editing = undefined;
          api.setAppState({ editingPoints: [] });
        }
      }
    }
    const obb = getOBB(camera);
    selection.obb = {
      x: obb.x,
      y: obb.y,
      width: obb.width,
      height: obb.height,
      rotation: obb.rotation,
      scaleX: obb.scaleX,
      scaleY: obb.scaleY,
    };
    const { width, height } = selection.obb;
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
    selection.sin = Math.abs(height / hypotenuse);
    selection.cos = Math.abs(width / hypotenuse);
    selection.nodes = [
      ...api.getNodes().map((node) => ({
        ...node,
        ...api.getAbsoluteTransformAndSize(node),
      })),
    ];
    selection.selectedNodeIds = selectedNodeIds;
  }

  private fitSelected(api: API, newAttrs: OBB, selection: SelectOBB) {
    const camera = api.getCamera();
    const { selecteds } = camera.read(Transformable);
    const { width, height } = newAttrs;
    const epsilon = 0.01;
    const oldAttrs = {
      x: selection.obb.x,
      y: selection.obb.y,
      width: selection.obb.width,
      height: selection.obb.height,
      rotation: selection.obb.rotation,
      scaleX: selection.obb.scaleX,
      scaleY: selection.obb.scaleY,
    };

    const tfStatus = camera.read(Transformable).status;
    /** 多选时选区 OBB 是子项世界包络的轴对齐框，与各节点局部变换不在同一「虚拟框」坐标系；Konva 式 delta 对框成立，但不能左乘到多个独立 local 上得到绕枢轴旋转。 */
    const useWorldPivotRotate =
      selecteds.length > 1 && tfStatus === TransformableStatus.ROTATING;

    const delta = mat3.create();
    if (useWorldPivotRotate) {
      const theta = newAttrs.rotation - oldAttrs.rotation;
      const [px, py] = this.getRotatePivotWorldStable(api, selection);
      mat3.identity(delta);
      mat3.translate(delta, delta, [px, py]);
      mat3.rotate(delta, delta, theta);
      mat3.translate(delta, delta, [-px, -py]);
    } else {
      const baseSize = 10000000;
      const oldTr = mat3.create();
      mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
      mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
      mat3.scale(oldTr, oldTr, [
        oldAttrs.width / baseSize,
        oldAttrs.height / baseSize,
      ]);
      const newTr = mat3.create();
      const newScaleX = newAttrs.width / baseSize;
      const newScaleY = newAttrs.height / baseSize;

      const { flipEnabled } = api.getAppState();
      if (flipEnabled) {
        mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
        mat3.rotate(newTr, newTr, newAttrs.rotation);
        mat3.scale(newTr, newTr, [newScaleX, newScaleY]);
      } else {
        mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
        mat3.rotate(newTr, newTr, newAttrs.rotation);
        mat3.translate(newTr, newTr, [
          newAttrs.width < 0 ? newAttrs.width : 0,
          newAttrs.height < 0 ? newAttrs.height : 0,
        ]);
        mat3.scale(newTr, newTr, [Math.abs(newScaleX), Math.abs(newScaleY)]);
      }

      // Borrow from Konva.js
      // @see https://github.com/konvajs/konva/blob/9a9bd00cd377a6d12cce3ee7c9fbf906afa55de5/src/shapes/Transformer.ts#L1103
      // [delta transform] = [new transform] * [old transform inverted]
      mat3.multiply(delta, newTr, mat3.invert(mat3.create(), oldTr));
    }

    const entitiesToUpdate: Entity[] = [];
    const visited = new Set<Entity>();
    const collectSelectedAndDescendants = (entity: Entity) => {
      if (visited.has(entity)) {
        return;
      }
      visited.add(entity);
      // Group：selection OBB 是世界子并集 AABB，与 Group 根 Transform 不一致，不能对根套用 Konva delta；
      // 只把 delta 下发到子树（与多选 resize 一致）。
      if (entity.has(Group)) {
        if (entity.has(Parent)) {
          const { children } = entity.read(Parent);
          children.forEach((child) => collectSelectedAndDescendants(child));
        }
        return;
      }
      // 非 Group：只更新该节点。子节点随父级 Transform 级联，若再对子节点套用同一 delta 会在世界空间叠加两次变换。
      entitiesToUpdate.push(entity);
    };
    selecteds.forEach((selected) => collectSelectedAndDescendants(selected));

    let resizePreviewSet = false;
    entitiesToUpdate.forEach((selected) => {
      const node = api.getNodeByEntity(selected);
      if (!node) {
        return;
      }
      const oldNode = selection.nodes.find((n) => n.id === node.id);
      if (!oldNode) {
        return;
      }
      // for each node we have the same [delta transform]
      // the equations is
      // [delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
      // and we need to find [new local transform]
      // [new local] = [parent inverted] * [delta] * [parent] * [old local]
      const parentTransform = api.getParentTransform(selected);
      const localTransform = api.getTransform(oldNode);

      const newLocalTransform = mat3.create();
      mat3.multiply(newLocalTransform, parentTransform, localTransform);
      mat3.multiply(newLocalTransform, delta, newLocalTransform);
      mat3.multiply(
        newLocalTransform,
        mat3.invert(mat3.create(), parentTransform),
        newLocalTransform,
      );

      const { rotation, translation, scale } = decompose(newLocalTransform);

      const obb = {
        x: translation[0],
        y: translation[1],
        // Keep geometry size positive; flip sign is carried by scaleX/scaleY.
        width: Math.max(Math.abs(oldNode.width * scale[0]), epsilon),
        height: Math.max(Math.abs(oldNode.height * scale[1]), epsilon),
        rotation,
        scaleX: oldAttrs.scaleX * (Math.sign(width) || 1),
        scaleY: oldAttrs.scaleY * (Math.sign(height) || 1),
      };

      /**
       * 旋转：仅改 Transform，不烘焙 d/points（避免 transformPath + rebase 与 Konva 框抖动）。
       * resize / 其它：烘焙局部几何（API 内用 mat3WithoutTranslation 避免平移重复），缩放进路径定义；
       * 此时 Transform 的 scale 若再乘 decompose 的尺度会与 d 双重叠加，故只保留翻转符号（±1）。
       */
      const skipGeometryDeltaForEdge =
        selection.mode === SelectionMode.ROTATE &&
        selected.hasSomeOf(Polyline, Path, Line);
      if (
        !skipGeometryDeltaForEdge &&
        selected.hasSomeOf(Polyline, Path, Line)
      ) {
        const signW = Math.sign(width) || 1;
        const signH = Math.sign(height) || 1;
        obb.scaleX = Math.sign(oldAttrs.scaleX || 1) * signW;
        obb.scaleY = Math.sign(oldAttrs.scaleY || 1) * signH;
      }

      api.updateNodeOBB(
        node,
        obb,
        node.lockAspectRatio,
        skipGeometryDeltaForEdge ? undefined : newLocalTransform,
        oldNode,
      );

      if (selecteds.length === 1 && selected.has(Text)) {
        const t = selected.read(Text);
        if (t.wordWrap && (t.wordWrapWidth ?? 0) > 0) {
          const tf = camera.write(Transformable);
          tf.resizeWidth = obb.width;
          tf.resizeHeight = obb.height;
          resizePreviewSet = true;
        }
      }

      updateGlobalTransform(selected);
      updateComputedPoints(selected);
    });

    if (!resizePreviewSet) {
      const tf = camera.write(Transformable);
      tf.resizeWidth = -1;
      tf.resizeHeight = -1;
    }
  }

  private hideBrush(selection: SelectOBB) {
    if (selection.brushContainer) {
      selection.brushContainer.setAttribute('visibility', 'hidden');
    }
    selection.mode = SelectionMode.IDLE;
  }

  private renderBrush(
    api: API,
    selection: SelectOBB,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const { brushContainer } = selection;
    brushContainer.setAttribute('visibility', 'visible');

    const canvas = api.getCamera().read(Camera).canvas;
    const { mode, colors } = canvas.read(Theme);
    const palette = {
      ...DEFAULT_THEME_COLORS[mode],
      ...(colors[mode] ?? {}),
    };

    let brush = brushContainer.firstChild as SVGRectElement;
    if (!brush) {
      brush = createSVGElement('rect') as SVGRectElement;
      brush.setAttribute('x', '0');
      brush.setAttribute('y', '0');
      brush.setAttribute('width', '0');
      brush.setAttribute('height', '0');
      brush.setAttribute('opacity', '0.5');
      brush.setAttribute('stroke-width', '1');
      brushContainer.appendChild(brush);
    }

    brush.setAttribute('fill', palette.selectionBrushFill);
    brush.setAttribute('stroke', palette.selectionBrushStroke);
    brush.setAttribute('x', x.toString());
    brush.setAttribute('y', y.toString());
    brush.setAttribute('width', width.toString());
    brush.setAttribute('height', height.toString());
  }

  private clearSnapLines(selection: SelectOBB) {
    const { snapContainer } = selection;
    snapContainer.innerHTML = '';
  }

  private renderSnapLines(
    selection: SelectOBB,
    snapLines: { type: string; points: [number, number][] }[],
    api: API,
  ) {
    const { snapLineStroke, snapLineStrokeWith } = api.getAppState();
    const { snapContainer } = selection;
    this.clearSnapLines(selection);

    snapLines.forEach((snapLine) => {
      const { type, points } = snapLine;
      if (type === 'points') {
        const pointsInViewport = points.map((p) =>
          api.canvas2Viewport({ x: p[0], y: p[1] }),
        );

        const line = createSVGElement('polyline') as SVGPolylineElement;
        line.setAttribute(
          'points',
          pointsInViewport.map((p) => `${p.x},${p.y}`).join(' '),
        );
        line.setAttribute('stroke', snapLineStroke);
        line.setAttribute('stroke-width', `${snapLineStrokeWith}`);
        snapContainer.appendChild(line);

        pointsInViewport.forEach((p) => {
          // cross point
          const tlbr = createSVGElement('line') as SVGLineElement;
          tlbr.setAttribute('x1', `${p.x - 4}`);
          tlbr.setAttribute('y1', `${p.y - 4}`);
          tlbr.setAttribute('x2', `${p.x + 4}`);
          tlbr.setAttribute('y2', `${p.y + 4}`);
          tlbr.setAttribute('stroke', snapLineStroke);
          tlbr.setAttribute('stroke-width', `${snapLineStrokeWith}`);
          snapContainer.appendChild(tlbr);

          const trbl = createSVGElement('line') as SVGLineElement;
          trbl.setAttribute('x1', `${p.x - 4}`);
          trbl.setAttribute('y1', `${p.y + 4}`);
          trbl.setAttribute('x2', `${p.x + 4}`);
          trbl.setAttribute('y2', `${p.y - 4}`);
          trbl.setAttribute('stroke', snapLineStroke);
          trbl.setAttribute('stroke-width', `${snapLineStrokeWith}`);
          snapContainer.appendChild(trbl);
        });
      } else if (type === 'gap') {
        // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts#L123
        const { x: fromX, y: fromY } = api.canvas2Viewport({
          x: points[0][0],
          y: points[0][1],
        });
        const { x: toX, y: toY } = api.canvas2Viewport({
          x: points[1][0],
          y: points[1][1],
        });
        const distance = Math.sqrt(
          Math.pow(points[0][0] - points[1][0], 2) +
          Math.pow(points[0][1] - points[1][1], 2),
        );
        const from = [fromX, fromY] as [number, number];
        const to = [toX, toY] as [number, number];
        const { direction } = snapLine as GapSnapLine;

        // a horizontal gap snap line
        // |–––––––||–––––––|
        // ^    ^   ^       ^
        // \    \   \       \
        // (1)  (2) (3)     (4)

        const FULL = 8;
        const HALF = FULL / 2;
        const QUARTER = FULL / 4;
        // (1)
        if (direction === 'horizontal') {
          const halfPoint = [(from[0] + to[0]) / 2, from[1]];

          this.renderSnapLine(
            [from[0], from[1] - FULL],
            [from[0], from[1] + FULL],
            api,
            snapContainer,
          );

          // (3)
          this.renderSnapLine(
            [halfPoint[0] - QUARTER, halfPoint[1] - HALF],
            [halfPoint[0] - QUARTER, halfPoint[1] + HALF],
            api,
            snapContainer,
          );
          this.renderSnapLine(
            [halfPoint[0] + QUARTER, halfPoint[1] - HALF],
            [halfPoint[0] + QUARTER, halfPoint[1] + HALF],
            api,
            snapContainer,
          );

          // (4)
          this.renderSnapLine(
            [to[0], to[1] - FULL],
            [to[0], to[1] + FULL],
            api,
            snapContainer,
          );

          // (2)
          this.renderSnapLine(from, to, api, snapContainer);

          // Render distance label below (3)

          const label = createSVGElement('text') as SVGTextElement;
          label.setAttribute('x', `${halfPoint[0]}`);
          label.setAttribute('y', `${halfPoint[1] + 16}`);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'middle');
          label.textContent = `${distance.toFixed(0)}`;
          label.setAttribute('fill', snapLineStroke);
          label.setAttribute('font-size', '12');
          snapContainer.appendChild(label);
        } else {
          const halfPoint = [from[0], (from[1] + to[1]) / 2];

          this.renderSnapLine(
            [from[0] - FULL, from[1]],
            [from[0] + FULL, from[1]],
            api,
            snapContainer,
          );

          // (3)
          this.renderSnapLine(
            [halfPoint[0] - HALF, halfPoint[1] - QUARTER],
            [halfPoint[0] + HALF, halfPoint[1] - QUARTER],
            api,
            snapContainer,
          );
          this.renderSnapLine(
            [halfPoint[0] - HALF, halfPoint[1] + QUARTER],
            [halfPoint[0] + HALF, halfPoint[1] + QUARTER],
            api,
            snapContainer,
          );

          // (4)
          this.renderSnapLine(
            [to[0] - FULL, to[1]],
            [to[0] + FULL, to[1]],
            api,
            snapContainer,
          );

          // (2)
          this.renderSnapLine(from, to, api, snapContainer);

          // Render distance label to the right of (3)
          const label = createSVGElement('text') as SVGTextElement;
          label.setAttribute('x', `${halfPoint[0] + 16}`);
          label.setAttribute('y', `${halfPoint[1]}`);
          label.setAttribute('text-anchor', 'start');
          label.setAttribute('dominant-baseline', 'middle');
          label.textContent = `${distance.toFixed(0)}`;
          label.setAttribute('fill', snapLineStroke);
          label.setAttribute('font-size', '12');
          snapContainer.appendChild(label);
        }
      }
    });
  }

  private renderSnapLine(
    from: [number, number],
    to: [number, number],
    api: API,
    snapContainer: SVGSVGElement,
  ) {
    const { snapLineStroke, snapLineStrokeWith } = api.getAppState();
    const line = createSVGElement('line') as SVGLineElement;

    line.setAttribute('x1', `${from[0]}`);
    line.setAttribute('y1', `${from[1]}`);
    line.setAttribute('x2', `${to[0]}`);
    line.setAttribute('y2', `${to[1]}`);
    line.setAttribute('stroke', snapLineStroke);
    line.setAttribute('stroke-width', `${snapLineStrokeWith}`);
    snapContainer.appendChild(line);
  }
}
