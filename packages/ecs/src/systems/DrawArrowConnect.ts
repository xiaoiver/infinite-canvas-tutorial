import { System } from '@lastolivegames/becsy';
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
  StrokeGradient,
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
  PartialBinding,
  ToBeDeleted,
  Binded,
  Theme,
  Flex,
} from '../components';
import { API } from '../API';
import type { PathSerializedNode, SerializedNode } from '../types/serialized-node';
import { constraintAttrsFromCanvasPoint } from '../utils/binding/constraint-from-point';
import { EdgeStyle } from '../utils/binding/edge-style';
import { updateComputedPoints, updateGlobalTransform } from '..';

type Phase = 'idle' | 'picked_source';

interface ArrowConnectSelection {
  phase: Phase;
  /** 起点在可连接图元上时使用 */
  sourceId?: string;
  /** 起点在空白处时使用（画布坐标） */
  sourceCanvas?: { x: number; y: number };
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
  /** 第一段点下后 pointer move 时实时预览的临时边 id */
  previewEdgeId?: string;
}

/**
 * DRAW_ARROW：悬停高亮可连接图形，第一次点击确定起点，第二次点击确定终点并创建边。
 * 起点或终点可在空白处，使用 {@link BindingAttributes.sourcePoint} / {@link BindingAttributes.targetPoint}（与 Select 拖拽悬空端一致）。
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
            StrokeGradient,
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
            PartialBinding,
            Binded,
            ToBeDeleted,
            ComputedPoints,
            Theme,
            Flex,
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
        const prevState = this.states.get(camera.__id);
        if (prevState) {
          this.clearArrowConnectState(api, prevState);
        }
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
        const [pvx, pvy] = input.pointerViewport;
        const { x: downCanvasX, y: downCanvasY } = api.viewport2Canvas({
          x: pvx,
          y: pvy,
        });
        const bindTarget = this.pickBindTarget(api, downCanvasX, downCanvasY);

        if (!bindTarget) {
          if (state.phase === 'picked_source') {
            const appState = api.getAppState();
            const defaults = appState.penbarDrawArrow;
            const nodes = api.getNodes();
            const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);

            if (state.sourceId) {
              const fromNode = api.getNodeById(state.sourceId);
              if (!fromNode) {
                this.clearArrowConnectState(api, state);
                api.highlightNodes([]);
                return;
              }
              const edge: PathSerializedNode = {
                id: uuidv4(),
                ...defaults,
                type: 'path',
                version: 0,
                zIndex: maxZ + 1,
                fromId: fromNode.id,
                exitX: state.exitX,
                exitY: state.exitY,
                exitPerimeter: state.exitPerimeter ?? true,
                exitDx: state.exitDx ?? 0,
                exitDy: state.exitDy ?? 0,
                targetPoint: { x: downCanvasX, y: downCanvasY },
                edgeStyle: EdgeStyle.ORTHOGONAL,
                curved: true,
                bezier: true,
              };
              this.finishArrowEdge(api, state, edge);
            } else if (state.sourceCanvas) {
              const edge: PathSerializedNode = {
                id: uuidv4(),
                ...defaults,
                type: 'path',
                version: 0,
                zIndex: maxZ + 1,
                sourcePoint: { ...state.sourceCanvas },
                targetPoint: { x: downCanvasX, y: downCanvasY },
                edgeStyle: EdgeStyle.ORTHOGONAL,
                curved: true,
              };
              this.finishArrowEdge(api, state, edge);
            } else {
              this.clearArrowConnectState(api, state);
            }
            this.clearArrowConnectState(api, state);
            api.highlightNodes([]);
            return;
          }

          if (state.phase === 'idle') {
            state.phase = 'picked_source';
            state.sourceCanvas = { x: downCanvasX, y: downCanvasY };
            delete state.sourceId;
            delete state.exitX;
            delete state.exitY;
            delete state.exitPerimeter;
            delete state.exitDx;
            delete state.exitDy;
            api.highlightNodes([]);
            return;
          }
        }

        if (state.phase === 'idle') {
          const c = constraintAttrsFromCanvasPoint(
            bindTarget,
            downCanvasX,
            downCanvasY,
          );
          state.phase = 'picked_source';
          state.sourceId = bindTarget.id;
          delete state.sourceCanvas;
          state.exitX = c.x;
          state.exitY = c.y;
          state.exitPerimeter = c.perimeter;
          state.exitDx = c.dx;
          state.exitDy = c.dy;
          return;
        }

        if (state.phase === 'picked_source') {
          if (state.sourceId && bindTarget.id === state.sourceId) {
            return;
          }
          const entry = constraintAttrsFromCanvasPoint(
            bindTarget,
            downCanvasX,
            downCanvasY,
          );
          const appState = api.getAppState();
          const defaults = appState.penbarDrawArrow;
          const nodes = api.getNodes();
          const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);

          if (state.sourceId) {
            const fromNode = api.getNodeById(state.sourceId);
            const toNode = bindTarget;
            if (!fromNode) {
              this.clearArrowConnectState(api, state);
              api.highlightNodes([]);
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
              exitPerimeter: state.exitPerimeter ?? true,
              exitDx: state.exitDx ?? 0,
              exitDy: state.exitDy ?? 0,
              entryX: entry.x,
              entryY: entry.y,
              entryPerimeter: entry.perimeter,
              entryDx: entry.dx,
              entryDy: entry.dy,
              edgeStyle: EdgeStyle.ORTHOGONAL,
              curved: true,
              bezier: true,
            };
            this.finishArrowEdge(api, state, edge);
          } else if (state.sourceCanvas) {
            const toNode = bindTarget;
            const edge: PathSerializedNode = {
              id: uuidv4(),
              ...defaults,
              type: 'path',
              version: 0,
              zIndex: maxZ + 1,
              sourcePoint: { ...state.sourceCanvas },
              toId: toNode.id,
              entryX: entry.x,
              entryY: entry.y,
              entryPerimeter: entry.perimeter,
              entryDx: entry.dx,
              entryDy: entry.dy,
              edgeStyle: EdgeStyle.ORTHOGONAL,
              curved: true,
              bezier: true,
            };
            this.finishArrowEdge(api, state, edge);
          }

          this.clearArrowConnectState(api, state);
          api.highlightNodes([]);
        }
      }

      // pointer move（picked_source 时允许按下键拖动，仍更新预览）
      if (
        camera.has(ComputedCamera) &&
        (inputPoints.length === 0 || state.phase === 'picked_source')
      ) {
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
          if (state.phase === 'picked_source') {
            this.syncArrowPreview(api, state, canvasX, canvasY, bindTarget);
          }
        }
      }

      if (input.key === 'Escape') {
        this.clearArrowConnectState(api, state);
        api.highlightNodes([]);
      }

      if (input.pointerUpTrigger) { }
    });
  }

  private finishArrowEdge(api: API, state: ArrowConnectSelection, edge: PathSerializedNode) {
    this.removeArrowPreview(api, state);
    api.runAtNextTick(() => {
      api.setAppState({ penbarSelected: Pen.SELECT });
      api.updateNode(edge as unknown as SerializedNode);
      api.selectNodes([edge]);
      api.record();
    });
  }

  private removeArrowPreview(api: API, state: ArrowConnectSelection) {
    if (state.previewEdgeId) {
      api.deleteNodesById([state.previewEdgeId]);
      delete state.previewEdgeId;
    }
  }

  /**
   * 第一段点下后，随 pointer 移动用与落点相同的绑定语义更新临时 path（正交 + 曲线），便于实时看到走向。
   */
  private syncArrowPreview(
    api: API,
    state: ArrowConnectSelection,
    canvasX: number,
    canvasY: number,
    bindTarget: SerializedNode | undefined,
  ) {
    if (state.phase !== 'picked_source') {
      return;
    }

    const appState = api.getAppState();
    const defaults = appState.penbarDrawArrow;
    const nodes = api.getNodes();
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
    const baseOpacity = defaults.strokeOpacity ?? 1;
    const previewOpacity = baseOpacity * 0.45;

    const id = state.previewEdgeId ?? uuidv4();
    if (!state.previewEdgeId) {
      state.previewEdgeId = id;
    }

    const existing = api.getNodeById(id) as PathSerializedNode | undefined;
    const version = existing?.version ?? 0;

    let edge: PathSerializedNode;

    if (state.sourceId) {
      const fromNode = api.getNodeById(state.sourceId);
      if (!fromNode) {
        return;
      }
      if (bindTarget && bindTarget.id !== state.sourceId) {
        const entry = constraintAttrsFromCanvasPoint(bindTarget, canvasX, canvasY);
        edge = {
          id,
          ...defaults,
          type: 'path',
          version,
          zIndex: maxZ + 1,
          fromId: fromNode.id,
          exitX: state.exitX,
          exitY: state.exitY,
          exitPerimeter: state.exitPerimeter ?? true,
          exitDx: state.exitDx ?? 0,
          exitDy: state.exitDy ?? 0,
          toId: bindTarget.id,
          entryX: entry.x,
          entryY: entry.y,
          entryPerimeter: entry.perimeter,
          entryDx: entry.dx,
          entryDy: entry.dy,
          edgeStyle: EdgeStyle.ORTHOGONAL,
          curved: true,
          bezier: true,
          strokeOpacity: previewOpacity,
        };
      } else {
        edge = {
          id,
          ...defaults,
          type: 'path',
          version,
          zIndex: maxZ + 1,
          fromId: fromNode.id,
          exitX: state.exitX,
          exitY: state.exitY,
          exitPerimeter: state.exitPerimeter ?? true,
          exitDx: state.exitDx ?? 0,
          exitDy: state.exitDy ?? 0,
          targetPoint: { x: canvasX, y: canvasY },
          edgeStyle: EdgeStyle.ORTHOGONAL,
          curved: true,
          bezier: true,
          strokeOpacity: previewOpacity,
        };
      }
    } else if (state.sourceCanvas) {
      if (bindTarget) {
        const entry = constraintAttrsFromCanvasPoint(bindTarget, canvasX, canvasY);
        edge = {
          id,
          ...defaults,
          type: 'path',
          version,
          zIndex: maxZ + 1,
          sourcePoint: { ...state.sourceCanvas },
          toId: bindTarget.id,
          entryX: entry.x,
          entryY: entry.y,
          entryPerimeter: entry.perimeter,
          entryDx: entry.dx,
          entryDy: entry.dy,
          edgeStyle: EdgeStyle.ORTHOGONAL,
          curved: true,
          bezier: true,
          strokeOpacity: previewOpacity,
        };
      } else {
        edge = {
          id,
          ...defaults,
          type: 'path',
          version,
          zIndex: maxZ + 1,
          sourcePoint: { ...state.sourceCanvas },
          targetPoint: { x: canvasX, y: canvasY },
          edgeStyle: EdgeStyle.ORTHOGONAL,
          curved: true,
          bezier: true,
          strokeOpacity: previewOpacity,
        };
      }
    } else {
      return;
    }

    api.updateNode(edge as unknown as SerializedNode);

    const entity = api.getEntity(edge);
    updateGlobalTransform(entity);
    updateComputedPoints(entity);
  }

  private clearArrowConnectState(api: API, state: ArrowConnectSelection) {
    this.removeArrowPreview(api, state);
    state.phase = 'idle';
    delete state.sourceId;
    delete state.sourceCanvas;
    delete state.exitX;
    delete state.exitY;
    delete state.exitPerimeter;
    delete state.exitDx;
    delete state.exitDy;
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
