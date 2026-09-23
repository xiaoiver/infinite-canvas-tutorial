import type { Entity } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import type { API } from '../API';
import {
  Cursor,
  Editable,
  GlobalTransform,
  Input,
  Locked,
  Mat3,
  Pen,
  VectorNetwork,
  VectorNetworkEditMode,
} from '../components';
import type { SerializedFillLayerItem } from '../types/serialized-node';
import { createSVGElement } from '../utils/browser';
import {
  findVectorNetworkFaces,
  toggleVectorNetworkFace,
  vectorNetworkFaceAtPoint,
  type VectorNetworkFace,
} from '../utils/vector-network-region';
import { splitVectorNetworkIntersections } from '../utils/vector-network-intersections';
import type { VectorNetworkData } from '../utils/vector-network-topology';
import { buildVectorNetworkFillPathD } from '../utils/vector-network-svg';
import { isEntityAlive } from './Transform';

interface FillSession {
  nodeId: string;
  vertices: VectorNetwork['vertices'];
  segments: VectorNetwork['segments'];
  faces: VectorNetworkFace[];
  regions: VectorNetwork['regions'];
  geometry: VectorNetworkData;
  pending?: { face: VectorNetworkFace; point: [number, number] };
  preview?: SVGSVGElement;
  path?: SVGPathElement;
  previewFace?: VectorNetworkFace;
  dispose: () => void;
}

const visibleFill = (fills: SerializedFillLayerItem[] | undefined) =>
  fills?.some(
    (fill) =>
      fill.enabled !== false &&
      fill.opacity !== 0 &&
      (fill.type !== 'solid' || fill.value !== 'none'),
  );

/** Canvas-owned transient interaction; previews never enter the scene/history. */
export class VectorNetworkFillEditor {
  private sessions = new WeakMap<API, FillSession>();

  clear(api: API) {
    this.sessions.get(api)?.dispose();
  }

  /** Returns true while Fill owns input, so Select cannot start a node drag. */
  update(api: API, input: Input, selecteds: readonly Entity[]): boolean {
    const state = api.getAppState();
    const selected = selecteds.length === 1 ? selecteds[0] : undefined;
    if (
      state.penbarSelected !== Pen.SELECT ||
      state.vectorNetworkEditMode !== VectorNetworkEditMode.FILL ||
      input.key === 'Escape' ||
      !isEntityAlive(selected) ||
      !selected.has(VectorNetwork) ||
      !selected.has(Editable) ||
      !selected.read(Editable).isEditing ||
      selected.has(Locked) ||
      !selected.has(GlobalTransform)
    ) {
      this.clear(api);
      return false;
    }
    const node = api.getNodeByEntity(selected);
    if (node?.type !== 'vector-network') {
      this.clear(api);
      return false;
    }
    const geometry = selected.read(VectorNetwork);
    let session = this.sessions.get(api);
    if (
      !session ||
      session.nodeId !== node.id ||
      session.vertices !== geometry.vertices ||
      session.segments !== geometry.segments ||
      session.regions !== geometry.regions
    ) {
      this.clear(api);
      const connected = splitVectorNetworkIntersections({
        vertices: geometry.vertices,
        segments: geometry.segments,
        regions: geometry.regions,
      });
      session = {
        geometry: connected,
        regions: geometry.regions,
        nodeId: node.id,
        vertices: geometry.vertices,
        segments: geometry.segments,
        faces: findVectorNetworkFaces(connected.vertices, connected.segments),
        dispose: () => {},
      };
      const current = session;
      current.dispose = api.onDestroy(() => {
        current.preview?.remove();
        this.sessions.delete(api);
      });
      this.sessions.set(api, session);
    }

    const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
    const inverse = mat3.invert(mat3.create(), matrix);
    const [x, y] = input.pointerViewport;
    const canvasPoint = api.viewport2Canvas({ x, y });
    const local =
      inverse &&
      vec2.transformMat3(
        vec2.create(),
        [canvasPoint.x, canvasPoint.y],
        inverse,
      );
    const face =
      input.pointerInside && local
        ? vectorNetworkFaceAtPoint(session.faces, [local[0], local[1]])
        : null;
    api.getCanvas().write(Cursor).value = face ? 'crosshair' : 'default';

    if (
      !face &&
      input.pointerDownTrigger &&
      input.pointerButton === 0 &&
      !api.elementsFromPoint(canvasPoint).includes(selected)
    ) {
      this.clear(api);
      api.updateNode(node, { isEditing: false });
      return false;
    }

    if (input.pointerCancelled || !input.pointerInside)
      session.pending = undefined;
    if (
      input.pointerDownTrigger &&
      !input.pointerCancelled &&
      input.pointerButton === 0 &&
      face
    ) {
      session.pending = { face, point: [...input.pointerDownViewport] };
    }
    if (
      session.pending &&
      Math.hypot(x - session.pending.point[0], y - session.pending.point[1]) > 4
    ) {
      session.pending = undefined;
    }
    if (input.pointerUpTrigger) {
      if (face && session.pending?.face === face) {
        const hasFill = visibleFill(node.fills);
        const regions = toggleVectorNetworkFace(
          session.geometry.vertices,
          session.geometry.segments,
          hasFill ? session.geometry.regions : [],
          session.faces,
          face,
        );
        const configured = state.penbarVectorNetwork.fills;
        // Use the layer's existing paint. A stroke-only network gets a visible
        // paint on its first fill; all faces continue to share the layer style.
        const fills = hasFill
          ? node.fills
          : visibleFill(configured)
          ? configured
          : [{ type: 'solid' as const, value: '#147af3', opacity: 1 }];
        api.updateNode(node, { ...session.geometry, regions, fills });
        api.record();
      }
      session.pending = undefined;
    }

    this.preview(api, session, face, matrix);
    return true;
  }

  private preview(
    api: API,
    session: FillSession,
    face: VectorNetworkFace | null,
    matrix: mat3,
  ) {
    if (!face) {
      if (session.preview) session.preview.style.display = 'none';
      session.previewFace = undefined;
      return;
    }
    const layer = api.getSvgLayer();
    if (!layer) return;
    if (!session.preview) {
      const svg = createSVGElement('svg') as SVGSVGElement;
      svg.setAttribute('data-vector-network-fill-preview', '');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden';
      const path = createSVGElement('path') as SVGPathElement;
      path.setAttribute('fill', '#147af3');
      path.setAttribute('fill-opacity', '0.24');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('stroke', '#147af3');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      layer.append(svg);
      session.preview = svg;
      session.path = path;
    }
    if (session.previewFace !== face) {
      session.path!.setAttribute(
        'd',
        buildVectorNetworkFillPathD(session.vertices, session.segments, [
          face.region,
        ]),
      );
      session.previewFace = face;
    }
    const toViewport = (x: number, y: number) => {
      const world = vec2.transformMat3(vec2.create(), [x, y], matrix);
      return api.canvas2Viewport({ x: world[0], y: world[1] });
    };
    const origin = toViewport(0, 0);
    const right = toViewport(1, 0);
    const down = toViewport(0, 1);
    session.path!.setAttribute(
      'transform',
      `matrix(${right.x - origin.x} ${right.y - origin.y} ${
        down.x - origin.x
      } ${down.y - origin.y} ${origin.x} ${origin.y})`,
    );
    session.preview.style.display = '';
  }
}
