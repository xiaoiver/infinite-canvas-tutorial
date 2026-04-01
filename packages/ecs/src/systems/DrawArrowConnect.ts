import { Entity, System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  Canvas,
  Circle,
  ComputedBounds,
  ComputedCamera,
  ComputedCameraControl,
  Cursor,
  Ellipse,
  FillGradient,
  FillImage,
  FillSolid,
  FractionalIndex,
  GlobalTransform,
  Input,
  InputPoint,
  Locked,
  MaterialDirty,
  Pen,
  RBush,
  Rect,
  Stroke,
  Line,
  UI,
  Path,
  Polyline,
  Highlighted,
  FillPattern,
  Transform,
  Renderable,
  Marker,
  Opacity,
  ZIndex,
  Visibility,
  Name,
  Children,
  Parent,
  Selected,
  Transformable,
  Group,
  Binding,
  ComputedPoints,
} from '../components';
import { API } from '../API';
import type {
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
} from '../types/serialized-node';
import { constraintAttrsFromCanvasPoint } from '../utils/binding/constraint-from-point';
import { EdgeStyle } from '../utils/binding/edge-style';

type Phase = 'idle' | 'picked_source';

interface ArrowConnectSelection {
  phase: Phase;
  sourceId?: string;
  exitX?: number;
  exitY?: number;
  exitPerimeter?: boolean;
  exitDx?: number;
  exitDy?: number;
  pointerMoveViewportX?: number;
  pointerMoveViewportY?: number;
  pointerMoveCanvasX?: number;
  pointerMoveCanvasY?: number;
  bindTarget?: SerializedNode;
}

/**
 * DRAW_ARROW：悬停高亮可连接图形，第一次点击确定起点，第二次点击确定终点并创建绑定边。
 */
export class DrawArrowConnect extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly states = new Map<number, ArrowConnectSelection>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            ComputedBounds,
            ComputedCamera,
            ComputedCameraControl,
            FractionalIndex,
            RBush,
            ComputedPoints
          )
          .read.update.and.using(
            Canvas,
            GlobalTransform,
            Transform,
            InputPoint,
            Input,
            Cursor,
            Camera,
            UI,
            Renderable,
            Rect,
            Circle,
            Line,
            Polyline,
            Path,
            Ellipse,
            FillImage,
            FillSolid,
            FillGradient,
            FillPattern,
            Stroke,
            MaterialDirty,
            Highlighted,
            Marker,
            Opacity,
            ZIndex,
            Visibility,
            Name,
            Children,
            Parent,
            Locked,
            Selected,
            Transformable,
            Group,
            Binding,
          ).write,
    );
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
      if (pen !== Pen.DRAW_ARROW) {
        this.states.delete(camera.__id);
        return;
      }

      const input = canvas.read(Input);
      const cursor = canvas.write(Cursor);
      cursor.value = 'crosshair';

      let state = this.states.get(camera.__id);
      if (!state) {
        state = { phase: 'idle' };
        this.states.set(camera.__id, state);
      }

      if (input.pointerDownTrigger) {
        const { bindTarget, pointerMoveCanvasX, pointerMoveCanvasY } = state;
        if (!bindTarget) {
          if (state.phase === 'picked_source') {
            state.phase = 'idle';
            delete state.sourceId;
            delete state.exitX;
            delete state.exitY;
            delete state.exitPerimeter;
            delete state.exitDx;
            delete state.exitDy;
          }
          api.highlightNodes([]);
          return;
        }

        if (state.phase === 'idle') {
          const c = constraintAttrsFromCanvasPoint(bindTarget, pointerMoveCanvasX!, pointerMoveCanvasY!);
          state.phase = 'picked_source';
          state.sourceId = bindTarget.id;
          state.exitX = c.x;
          state.exitY = c.y;
          state.exitPerimeter = c.perimeter;
          state.exitDx = c.dx;
          state.exitDy = c.dy;
          return;
        }

        if (state.phase === 'picked_source') {
          if (bindTarget.id === state.sourceId) {
            return;
          }
          const entry = constraintAttrsFromCanvasPoint(bindTarget, pointerMoveCanvasX!, pointerMoveCanvasY!);
          const appState = api.getAppState();
          const defaults = appState.penbarDrawArrow;
          const nodes = api.getNodes();
          const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);

          const fromNode = api.getNodeById(state.sourceId!);
          const toNode = bindTarget;
          if (!fromNode) {
            state.phase = 'idle';
            return;
          }

          const edge: PathSerializedNode = {
            id: uuidv4(),
            ...defaults,
            type: 'path',
            version: 0,
            zIndex: maxZ + 1,
            fromId: fromNode.id,
            toId: toNode.id,
            exitX: state.exitX,
            exitY: state.exitY,
            // exitPerimeter: state.exitPerimeter ?? true,
            exitDx: state.exitDx ?? 0,
            exitDy: state.exitDy ?? 0,
            entryX: entry.x,
            entryY: entry.y,
            // entryPerimeter: entry.perimeter,
            entryDx: entry.dx,
            entryDy: entry.dy,
            edgeStyle: EdgeStyle.ORTHOGONAL,
            curved: true,
          };

          api.runAtNextTick(() => {
            api.setAppState({ penbarSelected: Pen.SELECT });
            api.updateNode(edge as unknown as SerializedNode);
            api.selectNodes([edge]);
            api.record();
          });

          state.phase = 'idle';
          delete state.sourceId;
          delete state.exitX;
          delete state.exitY;
          delete state.exitPerimeter;
          delete state.exitDx;
          delete state.exitDy;
          api.highlightNodes([]);
        }
      }

      // pointer move
      if (camera.has(ComputedCamera) && inputPoints.length === 0) {
        const [vx, vy] = input.pointerViewport;
        if (
          state.pointerMoveViewportX !== vx &&
          state.pointerMoveViewportY !== vy
        ) {
          state.pointerMoveViewportX = vx;
          state.pointerMoveViewportY = vy;

          const { x: canvasX, y: canvasY } = api.viewport2Canvas({
            x: vx,
            y: vy,
          });
          state.pointerMoveCanvasX = canvasX;
          state.pointerMoveCanvasY = canvasY;
          const bindTarget = this.pickBindTarget(api, canvasX, canvasY);
          state.bindTarget = bindTarget;
          if (state.phase === 'idle') {
            if (bindTarget) {
              api.highlightNodes([bindTarget]);
            } else {
              api.highlightNodes([]);
            }
          } else {
            if (bindTarget && bindTarget.id !== state.sourceId) {
              api.highlightNodes([bindTarget]);
            } else if (bindTarget && bindTarget.id === state.sourceId) {
              api.highlightNodes([bindTarget]);
            } else {
              api.highlightNodes([]);
            }
          }
        }
      }

      if (input.key === 'Escape') {
        state.phase = 'idle';
        delete state.sourceId;
        delete state.exitX;
        delete state.exitY;
        delete state.exitPerimeter;
        delete state.exitDx;
        delete state.exitDy;
        api.highlightNodes([]);
      }

      if (input.pointerUpTrigger) { }
    });
  }

  private pickBindTarget(
    api: API,
    canvasX: number,
    canvasY: number,
  ): SerializedNode | undefined {
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
        return node;
      }
    }
    return undefined;
  }
}
