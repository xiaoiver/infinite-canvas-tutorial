import { Entity, System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  Canvas,
  ComputedCamera,
  ComputedCameraControl,
  Cursor,
  Input,
  InputPoint,
  Pen,
  Polyline,
  UI,
  UIType,
  VectorNetwork,
  Transform,
  Renderable,
  FillLayers,
  StrokeLayers,
  Stroke,
  Opacity,
  Visibility,
  Name,
  ZIndex,
  Parent,
  Children,
  Theme,
  Selected,
  Transformable,
  FractionalIndex,
  ComputedBounds,
  GlobalTransform,
  Rect,
  ToBeDeleted,
  MaterialDirty,
  Rough,
  Ellipse,
  Circle,
  Path,
  HTML,
  Embed,
  Filter,
  Flex,
  GeometryDirty,
  Highlighted,
} from '../components';
import { API } from '../API';
import type {
  PolylineSerializedNode,
  VectorNetworkSerializedNode,
} from '../types/serialized-node';
import { DRAW_RECT_Z_INDEX } from '../context';
import {
  distanceBetweenPoints,
  serializePoints,
} from '../utils';
import { inferXYWidthHeight } from '../utils/deserialize/entity';
import { requestTransformerRefreshForCanvas } from '../utils/pick3d-bridge';
import type { VectorNetworkData } from '../utils/vector-network-topology';
import { updateGlobalTransform } from './Transform';

const SNAP_RADIUS_VIEWPORT = 10;
const DRAG_CURVE_THRESHOLD_VIEWPORT = 4;

interface DrawVectorNetworkState {
  nodeId?: string;
  activeVertexIndex: number;
  pendingDownCanvas?: { x: number; y: number };
  draggingCurve: boolean;
  hoverCloseVertexIndex: number;
  /** Transient rubber-band polyline (not in scene nodes when updateAppState=false). */
  previewLine?: PolylineSerializedNode;
}

function getNodeNetwork(
  api: API,
  nodeId: string,
): VectorNetworkData | null {
  const node = api.getNodeById(nodeId);
  if (!node || node.type !== 'vector-network') {
    return null;
  }
  const vn = node as VectorNetworkSerializedNode;
  return {
    vertices: vn.vertices?.map((v) => ({ ...v })) ?? [],
    segments: vn.segments?.map((s) => ({ ...s })) ?? [],
    regions: vn.regions?.map((r) => ({
      ...r,
      loops: r.loops.map((loop) => [...loop]),
    })),
  };
}

function vertexCanvasPoint(
  node: VectorNetworkSerializedNode,
  vertexIndex: number,
): { x: number; y: number } | null {
  const v = node.vertices?.[vertexIndex];
  if (!v) {
    return null;
  }
  return {
    x: (node.x ?? 0) + v.x,
    y: (node.y ?? 0) + v.y,
  };
}

function findSnappedVertexIndex(
  api: API,
  nodeId: string,
  canvasX: number,
  canvasY: number,
  excludeIndex = -1,
): number {
  const node = api.getNodeById(nodeId) as VectorNetworkSerializedNode | undefined;
  if (!node?.vertices?.length) {
    return -1;
  }
  const pointerViewport = api.canvas2Viewport({ x: canvasX, y: canvasY });
  let best = -1;
  let bestDist = SNAP_RADIUS_VIEWPORT;

  node.vertices.forEach((_, i) => {
    if (i === excludeIndex) {
      return;
    }
    const p = vertexCanvasPoint(node, i);
    if (!p) {
      return;
    }
    const vp = api.canvas2Viewport(p);
    const d = distanceBetweenPoints(
      pointerViewport.x,
      pointerViewport.y,
      vp.x,
      vp.y,
    );
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  });

  return best;
}

function deepCloneNetwork(data: VectorNetworkData): VectorNetworkData {
  return {
    vertices: data.vertices.map((v) => ({ ...v })),
    segments: data.segments.map((s) => ({
      ...s,
      tangentStart: s.tangentStart ? { ...s.tangentStart } : undefined,
      tangentEnd: s.tangentEnd ? { ...s.tangentEnd } : undefined,
    })),
    regions: data.regions?.map((r) => ({
      ...r,
      loops: r.loops.map((loop) => [...loop]),
    })),
  };
}

export class DrawVectorNetwork extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly states = new Map<number, DrawVectorNetworkState>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ComputedCamera, ComputedCameraControl, ComputedBounds)
          .read.and.using(Canvas, Theme, Input, Children, Parent, GlobalTransform, Transformable, Selected, InputPoint, Cursor, Transform, Renderable, VectorNetwork, FillLayers, StrokeLayers, Stroke, Opacity, Visibility,
            Name, ZIndex, FractionalIndex, UI, Polyline, Rect, Ellipse, Circle, MaterialDirty, GeometryDirty, Rough, Path, HTML, Embed, Filter, Flex, ToBeDeleted, Highlighted).write,
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

      if (pen !== Pen.VECTOR_NETWORK) {
        const prev = this.states.get(camera.__id);
        if (prev) {
          this.clearPreview(api, prev);
        }
        this.states.delete(camera.__id);
        return;
      }

      const input = canvas.read(Input);
      const cursor = canvas.write(Cursor);

      let state = this.states.get(camera.__id);
      if (!state) {
        state = {
          activeVertexIndex: -1,
          draggingCurve: false,
          hoverCloseVertexIndex: -1,
        };
        this.states.set(camera.__id, state);
      }

      const [pvx, pvy] = input.pointerViewport;
      const pointerCanvas = api.viewport2Canvas({ x: pvx, y: pvy });

      if (state.nodeId) {
        state.hoverCloseVertexIndex = findSnappedVertexIndex(
          api,
          state.nodeId,
          pointerCanvas.x,
          pointerCanvas.y,
          state.activeVertexIndex,
        );
        if (state.hoverCloseVertexIndex >= 0) {
          cursor.value = 'pointer';
        } else {
          cursor.value = 'crosshair';
        }
      } else {
        state.hoverCloseVertexIndex = -1;
        cursor.value = 'crosshair';
      }

      if (state.nodeId && !state.pendingDownCanvas) {
        this.updateRubberBand(api, state, pointerCanvas.x, pointerCanvas.y);
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.read(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        if (prevX === pvx && prevY === pvy) {
          return;
        }
        if (!state.pendingDownCanvas) {
          return;
        }
        const dist = distanceBetweenPoints(
          pvx,
          pvy,
          api.canvas2Viewport(state.pendingDownCanvas).x,
          api.canvas2Viewport(state.pendingDownCanvas).y,
        );
        if (dist >= DRAG_CURVE_THRESHOLD_VIEWPORT) {
          state.draggingCurve = true;
        }
        if (state.nodeId && state.activeVertexIndex >= 0) {
          this.updateRubberBand(
            api,
            state,
            pointerCanvas.x,
            pointerCanvas.y,
            state.pendingDownCanvas,
          );
        }
      });

      if (input.key === 'Escape') {
        this.finishSession(api, camera, state, true);
        return;
      }

      if (input.pointerDownTrigger) {
        state.pendingDownCanvas = { ...pointerCanvas };
        state.draggingCurve = false;
      }

      if (input.pointerUpTrigger) {
        if (!state.pendingDownCanvas) {
          return;
        }
        this.commitPoint(
          api,
          camera,
          state,
          state.pendingDownCanvas,
          pointerCanvas,
          state.draggingCurve,
        );
        state.pendingDownCanvas = undefined;
        state.draggingCurve = false;
        this.clearPreview(api, state);
        if (state.nodeId) {
          this.updateRubberBand(api, state, pointerCanvas.x, pointerCanvas.y);
        }
      }
    });
  }

  private commitPoint(
    api: API,
    camera: Entity,
    state: DrawVectorNetworkState,
    downCanvas: { x: number; y: number },
    upCanvas: { x: number; y: number },
    draggedCurve: boolean,
  ) {
    const defaults = api.getAppState().penbarVectorNetwork;
    const snapIndex =
      state.nodeId ?
        findSnappedVertexIndex(
          api,
          state.nodeId,
          upCanvas.x,
          upCanvas.y,
          state.activeVertexIndex,
        )
        : -1;

    if (!state.nodeId) {
      const id = uuidv4();
      const node: VectorNetworkSerializedNode = {
        id,
        type: 'vector-network',
        version: 0,
        zIndex:
          api.getNodes().reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0) + 1,
        x: downCanvas.x,
        y: downCanvas.y,
        width: 0,
        height: 0,
        vertices: [{ x: 0, y: 0 }],
        segments: [],
        ...defaults,
      };
      api.updateNode(node);
      api.selectNodes([node]);
      state.nodeId = id;
      state.activeVertexIndex = 0;
      api.record();
      requestTransformerRefreshForCanvas(camera.read(Camera).canvas!);
      return;
    }

    const node = api.getNodeById(state.nodeId) as VectorNetworkSerializedNode;
    const network = getNodeNetwork(api, state.nodeId);
    if (!network || state.activeVertexIndex < 0) {
      return;
    }

    const nextNetwork = deepCloneNetwork(network);
    const nodeBefore = { ...node };
    const placeCanvas = draggedCurve ? downCanvas : upCanvas;

    const targetIndex =
      snapIndex >= 0 ? snapIndex : nextNetwork.vertices.length;

    if (targetIndex === state.activeVertexIndex) {
      return;
    }

    const hasDuplicate = nextNetwork.segments.some(
      (s) =>
        (s.start === state.activeVertexIndex && s.end === targetIndex) ||
        (s.start === targetIndex && s.end === state.activeVertexIndex),
    );
    if (hasDuplicate) {
      state.activeVertexIndex = targetIndex;
      return;
    }

    if (snapIndex < 0) {
      nextNetwork.vertices.push({
        x: placeCanvas.x - (node.x ?? 0),
        y: placeCanvas.y - (node.y ?? 0),
      });
    }

    const newSegment: VectorNetwork['segments'][number] = {
      start: state.activeVertexIndex,
      end: targetIndex,
    };

    if (draggedCurve) {
      const endVertex = nextNetwork.vertices[targetIndex];
      const tangentEnd = {
        x: upCanvas.x - ((node.x ?? 0) + endVertex.x),
        y: upCanvas.y - ((node.y ?? 0) + endVertex.y),
      };
      if (Math.hypot(tangentEnd.x, tangentEnd.y) > 1e-3) {
        newSegment.tangentEnd = tangentEnd;
        newSegment.tangentStart = {
          x: -tangentEnd.x,
          y: -tangentEnd.y,
        };
      }
    }

    nextNetwork.segments.push(newSegment);
    api.updateNodeVectorNetwork(
      nodeBefore,
      nextNetwork as unknown as VectorNetwork,
    );
    state.activeVertexIndex = targetIndex;
    api.record();
    requestTransformerRefreshForCanvas(camera.read(Camera).canvas!);
  }

  private updateRubberBand(
    api: API,
    state: DrawVectorNetworkState,
    canvasX: number,
    canvasY: number,
    curveDragFrom?: { x: number; y: number },
  ) {
    const node = api.getNodeById(state.nodeId!) as
      | VectorNetworkSerializedNode
      | undefined;
    if (!node || state.activeVertexIndex < 0) {
      return;
    }
    const from = vertexCanvasPoint(node, state.activeVertexIndex);
    if (!from) {
      return;
    }

    const points: [number, number][] = [[from.x, from.y]];
    if (curveDragFrom && state.draggingCurve) {
      const endLocal = {
        x: canvasX - (node.x ?? 0),
        y: canvasY - (node.y ?? 0),
      };
      const tangentEnd = {
        x: canvasX - ((node.x ?? 0) + endLocal.x),
        y: canvasY - ((node.y ?? 0) + endLocal.y),
      };
      const samples = sampleCubic(
        from.x - (node.x ?? 0),
        from.y - (node.y ?? 0),
        from.x - (node.x ?? 0) - tangentEnd.x,
        from.y - (node.y ?? 0) - tangentEnd.y,
        endLocal.x,
        endLocal.y,
        endLocal.x + tangentEnd.x,
        endLocal.y + tangentEnd.y,
        node.x ?? 0,
        node.y ?? 0,
      );
      points.push(...samples);
    } else {
      points.push([canvasX, canvasY]);
    }

    const previewId = state.previewLine?.id ?? uuidv4();
    const preview: PolylineSerializedNode = {
      id: previewId,
      type: 'polyline',
      points: serializePoints(points),
      visibility: 'visible',
      zIndex: DRAW_RECT_Z_INDEX,
      strokes: api.getAppState().penbarVectorNetwork.strokes ?? [
        { type: 'solid', value: '#147af3', opacity: 0.55 },
      ],
      strokeWidth: api.getAppState().penbarVectorNetwork.strokeWidth ?? 1,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };
    inferXYWidthHeight(preview);

    if (!state.previewLine) {
      api.updateNode(preview, undefined, false);
      api.getEntity(preview).add(UI, { type: UIType.BRUSH });
      state.previewLine = preview;
    } else {
      api.updateNode(state.previewLine, preview, false);
      state.previewLine = { ...state.previewLine, ...preview };
    }

    const entity = api.getEntity(preview);
    if (entity) {
      updateGlobalTransform(entity);
    }
  }

  private clearPreview(api: API, state: DrawVectorNetworkState) {
    const preview = state.previewLine;
    if (!preview) {
      return;
    }
    const entityCommands = api.getEntityCommands().get(preview.id);
    if (entityCommands) {
      entityCommands.id().add(ToBeDeleted);
      api.getEntityCommands().delete(preview.id);
    }
    state.previewLine = undefined;
  }

  private finishSession(
    api: API,
    camera: Entity,
    state: DrawVectorNetworkState,
    deselect: boolean,
  ) {
    this.clearPreview(api, state);

    if (state.nodeId) {
      const network = getNodeNetwork(api, state.nodeId);
      const empty =
        !network ||
        (network.vertices.length <= 1 && network.segments.length === 0);
      if (empty) {
        api.deleteNodesById([state.nodeId]);
      } else if (deselect) {
        api.selectNodes([]);
      }
    }

    api.setAppState({ penbarSelected: Pen.SELECT });
    this.states.delete(camera.__id);
    requestTransformerRefreshForCanvas(camera.read(Camera).canvas!);
  }
}

function sampleCubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  offsetX: number,
  offsetY: number,
  steps = 16,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x =
      u * u * u * x0 +
      3 * u * u * t * x1 +
      3 * u * t * t * x2 +
      t * t * t * x3;
    const y =
      u * u * u * y0 +
      3 * u * u * t * y1 +
      3 * u * t * t * y2 +
      t * t * t * y3;
    out.push([x + offsetX, y + offsetY]);
  }
  return out;
}
