import { System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import { mat3, vec2 } from 'gl-matrix';
import {
  Camera,
  Canvas,
  ComputedCamera,
  Cursor,
  Input,
  Pen,
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
  Mat3,
} from '../components';
import type { API } from '../API';
import type { VectorNetworkSerializedNode } from '../types/serialized-node';
import { createSVGElement } from '../utils/browser';
import { splitVectorNetworkIntersections } from '../utils/vector-network-intersections';
import { findVectorNetworkFaces } from '../utils/vector-network-region';
import { requestTransformerRefreshForCanvas } from '../utils/pick3d-bridge';
import { updateGlobalTransform } from './Transform';

type Point = { x: number; y: number };
type Segment = VectorNetwork['segments'][number];
interface PenSession {
  nodeId?: string;
  /** Existing networks retain their paints, regions and existing handles. */
  resumed?: boolean;
  version?: number;
  /** A first anchor is transient until an edge is committed. */
  first?: Point;
  active: number;
  outgoing?: Point;
  initialOutgoing?: Point;
  vertices?: VectorNetworkSerializedNode['vertices'];
  segments?: VectorNetworkSerializedNode['segments'];
  pending?: { anchor: Point; viewport: Point; snap: number };
  preview?: SVGSVGElement;
  previewKey?: string;
  dispose: () => void;
}
const SNAP_RADIUS = 10;
const DRAG_THRESHOLD = 4;
const negate = (p: Point): Point => ({ x: -p.x, y: -p.y });

/** The same relative controls are used for both the rubber band and the commit. */
function segment(
  start: number,
  end: number,
  outgoing?: Point,
  incoming?: Point,
): Segment {
  return {
    start,
    end,
    ...(outgoing && { tangentStart: { ...outgoing } }),
    ...(incoming && { tangentEnd: { ...incoming } }),
  };
}

export class DrawVectorNetwork extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);
  private readonly sessions = new WeakMap<API, PenSession>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ComputedCamera, ComputedBounds)
          .read.and.using(
            Canvas,
            Theme,
            Input,
            Children,
            Parent,
            GlobalTransform,
            Transformable,
            Selected,
            Cursor,
            Transform,
            Renderable,
            VectorNetwork,
            FillLayers,
            StrokeLayers,
            Stroke,
            Opacity,
            Visibility,
            Name,
            ZIndex,
            FractionalIndex,
            Rect,
            Ellipse,
            Circle,
            MaterialDirty,
            GeometryDirty,
            Rough,
            Path,
            HTML,
            Embed,
            Filter,
            Flex,
            ToBeDeleted,
            Highlighted,
          ).write,
    );
  }

  execute() {
    for (const camera of this.cameras.current) {
      const canvas = camera.read(Camera).canvas;
      if (!canvas?.has(Canvas)) continue;
      const { api } = canvas.read(Canvas);
      if (api.getAppState().penbarSelected !== Pen.VECTOR_NETWORK) {
        this.sessions.get(api)?.dispose();
        continue;
      }
      let state = this.sessions.get(api);
      // Undo, deletion or an external edit invalidates the continuation anchor.
      const current = state?.nodeId && api.getNodeById(state.nodeId);
      if (
        state?.nodeId &&
        (current?.type !== 'vector-network' ||
          current.vertices !== state.vertices ||
          current.segments !== state.segments ||
          !Object.is(current.version, state.version) ||
          current.locked ||
          current.isDeleted ||
          current.visibility === 'hidden' ||
          !api.getAppState().layersSelected.includes(state.nodeId))
      ) {
        state.dispose();
        state = undefined;
      }
      if (!state) {
        state = { active: 0, dispose: () => {} };
        const owned = state;
        owned.dispose = api.onDestroy(() => {
          owned.preview?.remove();
          this.sessions.delete(api);
        });
        this.sessions.set(api, state);
      }
      const input = canvas.read(Input);
      if (input.key === 'Escape' || input.key === 'Enter') {
        this.finish(api, state);
        continue;
      }
      // Before the first anchor, only the selected network offers resume targets.
      // Merely hovering or pressing never mutates its geometry or history.
      if (!state.first && !state.pending) {
        const ids = api.getAppState().layersSelected;
        const candidate = ids.length === 1 && api.getNodeById(ids[0]);
        const node =
          candidate &&
          candidate.type === 'vector-network' &&
          !candidate.locked &&
          !candidate.isDeleted &&
          candidate.visibility !== 'hidden' &&
          this.inverse(api, candidate)
            ? candidate
            : undefined;
        state.nodeId = node?.id;
        state.vertices = node?.vertices;
        state.segments = node?.segments;
        state.version = node?.version;
      }
      const [x, y] = input.pointerViewport;
      const pointer = api.viewport2Canvas({ x, y });
      if (input.pointerCancelled || !input.pointerInside)
        state.pending = undefined;
      if (
        input.pointerDownTrigger &&
        !input.pointerCancelled &&
        input.pointerButton === 0
      ) {
        const [dx, dy] = input.pointerDownViewport;
        const down = api.viewport2Canvas({ x: dx, y: dy });
        const snap = this.snap(api, state, down);
        state.pending = {
          anchor: snap >= 0 ? this.vertex(api, state, snap)! : down,
          viewport: { x: dx, y: dy },
          snap,
        };
      }
      const pending = state.pending;
      const dragged =
        pending &&
        Math.hypot(x - pending.viewport.x, y - pending.viewport.y) >=
          DRAG_THRESHOLD;
      const outgoing = dragged
        ? {
            x: pointer.x - pending.anchor.x,
            y: pointer.y - pending.anchor.y,
          }
        : undefined;
      if (input.pointerUpTrigger && pending) {
        this.commit(api, state, pending.anchor, pending.snap, outgoing);
        state.pending = undefined;
        if (this.sessions.get(api) !== state) continue;
      }
      const hovered = this.snap(api, state, pointer);
      canvas.write(Cursor).value = hovered >= 0 ? 'pointer' : 'crosshair';
      if (!input.pointerInside) {
        if (state.preview) state.preview.style.display = 'none';
        continue;
      }
      this.preview(
        api,
        state,
        state.pending?.anchor ??
          (hovered >= 0 ? this.vertex(api, state, hovered)! : pointer),
        state.pending ? outgoing : undefined,
        state.pending?.snap ?? hovered,
      );
    }
  }

  private vertex(
    api: API,
    state: PenSession,
    index: number,
  ): Point | undefined {
    if (!state.nodeId) return index === 0 ? state.first : undefined;
    const node = api.getNodeById(state.nodeId) as VectorNetworkSerializedNode;
    const v = node?.vertices[index];
    if (!v) return;
    const matrix = Mat3.toGLMat3(
      api.getEntity(node).read(GlobalTransform).matrix,
    );
    const p = vec2.transformMat3(vec2.create(), [v.x, v.y], matrix);
    return { x: p[0], y: p[1] };
  }

  private inverse(api: API, node: VectorNetworkSerializedNode) {
    const entity = api.getEntity(node);
    if (!entity?.has(GlobalTransform)) return null;
    return mat3.invert(
      mat3.create(),
      Mat3.toGLMat3(entity.read(GlobalTransform).matrix),
    );
  }

  private snap(api: API, state: PenSession, point: Point): number {
    const pointer = api.canvas2Viewport(point);
    let index = -1;
    let distance = SNAP_RADIUS;
    const count = state.nodeId
      ? state.vertices?.length ?? 0
      : state.first
      ? 1
      : 0;
    for (let i = 0; i < count; i++) {
      const p = api.canvas2Viewport(this.vertex(api, state, i)!);
      const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      if (d < distance) {
        index = i;
        distance = d;
      }
    }
    return index;
  }

  private incoming(
    state: PenSession,
    snap: number,
    outgoing?: Point,
  ): Point | undefined {
    if (outgoing) return negate(outgoing);
    if (!state.resumed && snap === 0 && state.initialOutgoing)
      return negate(state.initialOutgoing);
    return undefined;
  }

  private commit(
    api: API,
    state: PenSession,
    anchor: Point,
    snap: number,
    outgoing?: Point,
  ) {
    if (!state.first) {
      state.first = { ...anchor };
      state.outgoing = outgoing;
      if (state.nodeId && snap >= 0) {
        state.resumed = true;
        state.active = snap;
      } else {
        state.nodeId = undefined;
        state.vertices = undefined;
        state.segments = undefined;
        state.active = 0;
        state.initialOutgoing = outgoing;
        api.selectNodes([]);
      }
      return;
    }
    // Clicking the active anchor finishes an open path without a zero-length edge.
    if (snap === state.active) {
      this.finish(api, state);
      return;
    }
    const existing = state.nodeId
      ? (api.getNodeById(state.nodeId) as VectorNetworkSerializedNode)
      : undefined;
    const origin = existing
      ? { x: existing.x ?? 0, y: existing.y ?? 0 }
      : state.first;
    const inverse = existing ? this.inverse(api, existing) : undefined;
    // A collapsed transform has no unambiguous local point to append.
    if (existing && !inverse) {
      this.finish(api, state);
      return;
    }
    const localAnchor = inverse
      ? vec2.transformMat3(vec2.create(), [anchor.x, anchor.y], inverse)
      : [anchor.x - origin.x, anchor.y - origin.y];
    const localVector = (v?: Point): Point | undefined =>
      v &&
      (inverse
        ? {
            x: inverse[0] * v.x + inverse[3] * v.y,
            y: inverse[1] * v.x + inverse[4] * v.y,
          }
        : { ...v });
    const vertices: VectorNetwork['vertices'] = existing
      ? existing.vertices.map((v) => ({ ...v }))
      : [
          {
            x: 0,
            y: 0,
            ...(state.initialOutgoing && {
              handleMirroring: 'ANGLE_AND_LENGTH' as const,
            }),
          },
        ];
    const segments = existing ? existing.segments.map((s) => ({ ...s })) : [];
    const target = snap >= 0 ? snap : vertices.length;
    const next = segment(
      state.active,
      target,
      localVector(state.outgoing),
      localVector(this.incoming(state, snap, outgoing)),
    );
    const equal = (a?: Point, b?: Point) =>
      Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)) < 1e-6;
    if (
      segments.some(
        (s) =>
          (s.start === state.active &&
            s.end === target &&
            equal(s.tangentStart, next.tangentStart) &&
            equal(s.tangentEnd, next.tangentEnd)) ||
          (s.end === state.active &&
            s.start === target &&
            equal(s.tangentEnd, next.tangentStart) &&
            equal(s.tangentStart, next.tangentEnd)),
      )
    ) {
      this.finish(api, state);
      return;
    }
    if (snap < 0)
      vertices.push({
        x: localAnchor[0],
        y: localAnchor[1],
        ...(outgoing && { handleMirroring: 'ANGLE_AND_LENGTH' as const }),
      });
    if (!state.resumed && snap === 0 && outgoing && segments.length) {
      segments[0] = { ...segments[0], tangentStart: localVector(outgoing) };
      vertices[0].handleMirroring = 'ANGLE_AND_LENGTH';
    }
    segments.push(next);
    const geometry = { vertices, segments, regions: existing?.regions ?? [] };
    const connected = splitVectorNetworkIntersections(
      geometry,
      new Set([segments.length - 1]),
    );
    const regions =
      !state.resumed && (snap >= 0 || connected !== geometry)
        ? findVectorNetworkFaces(connected.vertices, connected.segments).map(
            (face) => face.region,
          )
        : connected.regions;
    const node: VectorNetworkSerializedNode = existing ?? {
      ...api.getAppState().penbarVectorNetwork,
      id: uuidv4(),
      version: 1,
      type: 'vector-network',
      zIndex:
        api.getNodes().reduce((max, n) => Math.max(max, n.zIndex ?? 0), 0) + 1,
      x: origin.x,
      y: origin.y,
      width: 0,
      height: 0,
      vertices: [],
      segments: [],
    };
    if (!existing)
      api.updateNode({
        ...node,
        ...connected,
        regions,
      } as VectorNetworkSerializedNode);
    api.updateNodeVectorNetwork(node, {
      ...connected,
      regions,
    } as VectorNetwork);
    const saved = api.getNodeById(node.id) as VectorNetworkSerializedNode;
    updateGlobalTransform(api.getEntity(saved));
    api.selectNodes([saved]);
    state.nodeId = saved.id;
    state.vertices = saved.vertices;
    state.segments = saved.segments;
    state.version = saved.version;
    state.active = target;
    state.outgoing = outgoing;
    api.record();
    requestTransformerRefreshForCanvas(api.getCanvas());
    if (snap >= 0) this.finish(api, state);
  }

  private preview(
    api: API,
    state: PenSession,
    anchor: Point,
    outgoing: Point | undefined,
    snap: number,
  ) {
    if (!state.first && !state.pending && snap < 0) {
      if (state.preview) state.preview.style.display = 'none';
      return;
    }
    const layer = api.getSvgLayer();
    if (!layer) return;
    if (!state.preview) {
      const svg = createSVGElement('svg') as SVGSVGElement;
      svg.setAttribute('data-vector-network-pen-preview', '');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden';
      layer.append(svg);
      state.preview = svg;
    }
    const svg = state.preview;
    svg.style.display = '';
    const toScreen = (p: Point) => api.canvas2Viewport(p);
    const from = state.first && this.vertex(api, state, state.active);
    const key = JSON.stringify([
      from,
      anchor,
      state.outgoing,
      this.incoming(state, snap, outgoing),
      outgoing,
      snap,
      toScreen({ x: 0, y: 0 }),
      toScreen({ x: 1, y: 0 }),
      toScreen({ x: 0, y: 1 }),
    ]);
    if (state.previewKey === key) return;
    state.previewKey = key;
    svg.replaceChildren();
    const addPath = (d: string, role: string, dashed = false) => {
      const path = createSVGElement('path');
      path.setAttribute('d', d);
      path.setAttribute('data-pen-part', role);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#147af3');
      path.setAttribute('stroke-width', '1');
      if (dashed) path.setAttribute('stroke-dasharray', '4 3');
      svg.append(path);
    };
    const dot = (point: Point, radius = 3) => {
      const p = toScreen(point);
      const circle = createSVGElement('circle');
      circle.setAttribute('cx', String(p.x));
      circle.setAttribute('cy', String(p.y));
      circle.setAttribute('r', String(radius));
      circle.setAttribute('fill', 'white');
      circle.setAttribute('stroke', '#147af3');
      svg.append(circle);
    };
    if (from && snap !== state.active) {
      const controls = segment(
        0,
        1,
        state.outgoing,
        this.incoming(state, snap, outgoing),
      );
      const a = toScreen(from);
      const b = toScreen({
        x: from.x + (controls.tangentStart?.x ?? 0),
        y: from.y + (controls.tangentStart?.y ?? 0),
      });
      const c = toScreen({
        x: anchor.x + (controls.tangentEnd?.x ?? 0),
        y: anchor.y + (controls.tangentEnd?.y ?? 0),
      });
      const d = toScreen(anchor);
      addPath(
        `M ${a.x} ${a.y} C ${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`,
        'curve',
      );
      dot(from);
    }
    dot(anchor, snap >= 0 ? 5 : 3);
    if (outgoing) {
      const a = toScreen({
        x: anchor.x - outgoing.x,
        y: anchor.y - outgoing.y,
      });
      const b = toScreen({
        x: anchor.x + outgoing.x,
        y: anchor.y + outgoing.y,
      });
      addPath(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, 'handles', true);
      dot({ x: anchor.x + outgoing.x, y: anchor.y + outgoing.y });
      dot({ x: anchor.x - outgoing.x, y: anchor.y - outgoing.y });
    }
  }

  private finish(api: API, state: PenSession) {
    state.dispose();
    api.setAppState({ penbarSelected: Pen.SELECT });
    requestTransformerRefreshForCanvas(api.getCanvas());
  }
}
