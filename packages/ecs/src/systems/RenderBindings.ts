import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Binded,
  Binding,
  PartialBinding,
  Canvas,
  Children,
  ComputedBounds,
  EdgeLabel,
  Ellipse,
  Embed,
  FractionalIndex,
  GlobalTransform,
  HTML,
  Line,
  Parent,
  Rect,
  Text,
  Transform,
  Transformable,
  UI,
  ZIndex,
  Polyline,
  Path,
} from '../components';
import { getSceneRoot, updateGlobalTransform } from './Transform';
import type {
  EdgeSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from '../types/serialized-node';
import {
  EdgeState,
  hasTerminalPoint,
  inferEdgePoints,
  inferEdgePointsPreservingBezierHandles,
  inferPointsWithFromIdAndToId,
  inferXYWidthHeight,
  layoutTextAnchoredInParent,
  pointAndNormalAlongPolylineByT,
  polylineVertexApproxFromPathD,
  type EdgePathPreserveSnapshot,
} from '../utils';

function edgeBindingPointsPayload(edge: EdgeSerializedNode): Partial<EdgeSerializedNode> {
  const o: Partial<EdgeSerializedNode> = {};
  if (hasTerminalPoint(edge.targetPoint)) {
    o.targetPoint = { x: edge.targetPoint!.x, y: edge.targetPoint!.y };
  }
  if (hasTerminalPoint(edge.sourcePoint)) {
    o.sourcePoint = { x: edge.sourcePoint!.x, y: edge.sourcePoint!.y };
  }
  return o;
}

export class RenderBindings extends System {
  private readonly boundeds = this.query(
    (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
  );

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(
            ComputedBounds,
            Camera,
            Canvas,
            Binding,
            FractionalIndex,
            Parent,
            Children,
            Rect,
            Ellipse,
            UI,
            ZIndex,
            HTML,
            Embed,
          )
          .read.and.using(
            GlobalTransform,
            Transform,
            Transformable,
            Line,
            Polyline,
            Path,
            EdgeLabel,
            Text,
            Binded,
            PartialBinding,
          )
          .write,
    );
  }

  execute() {
    const bindingsToUpdate = new Set<Entity>();
    this.boundeds.changed.forEach((entity) => {
      const { fromBindings, toBindings, partialBindings } = entity.read(Binded);
      [...fromBindings, ...toBindings, ...partialBindings].forEach((edgeEntity) => {
        bindingsToUpdate.add(edgeEntity);
      });
    });

    bindingsToUpdate.forEach((edgeEntity) => {
      const camera = getSceneRoot(edgeEntity);
      const { canvas } = camera.read(Camera);
      const { api } = canvas.read(Canvas);

      const edge = api.getNodeByEntity(edgeEntity) as EdgeState | undefined;
      if (!edge) {
        return;
      }

      let pathPreserve: EdgePathPreserveSnapshot | undefined;
      if (edge.type === 'path' || edge.type === 'rough-path') {
        const pe = edge as EdgeState & {
          d?: string;
          x?: number;
          y?: number;
          rotation?: number;
          scaleX?: number;
          scaleY?: number;
        };
        if (pe.d) {
          pathPreserve = {
            d: pe.d,
            x: pe.x ?? 0,
            y: pe.y ?? 0,
            rotation: pe.rotation ?? 0,
            scaleX: pe.scaleX ?? 1,
            scaleY: pe.scaleY ?? 1,
          };
        }
      }

      // 必须先清掉上一帧的包围盒，再推理：否则 edge.x/y 仍是旧值，与已移动的端点节点坐标混用会导致整条边偏移（首次无 x/y 故无此问题）
      delete edge.x;
      delete edge.y;
      delete edge.width;
      delete edge.height;

      if (edgeEntity.has(Binding)) {
        const { from, to } = edgeEntity.read(Binding);
        const fromNode = api.getNodeByEntity(from);
        const toNode = api.getNodeByEntity(to);
        const preserved =
          pathPreserve != null &&
          inferEdgePointsPreservingBezierHandles(
            fromNode,
            toNode,
            edge,
            pathPreserve,
          );
        if (!preserved) {
          inferPointsWithFromIdAndToId(fromNode, toNode, edge);
        }
      } else if (edgeEntity.has(PartialBinding)) {
        const { attached, sourceIsAttached } = edgeEntity.read(PartialBinding);
        const attachedNode = api.getNodeByEntity(attached);
        const attachSource = sourceIsAttached !== 0;
        const fromN = attachSource ? attachedNode : null;
        const toN = attachSource ? null : attachedNode;
        const preserved =
          pathPreserve != null &&
          inferEdgePointsPreservingBezierHandles(fromN, toN, edge, pathPreserve);
        if (!preserved) {
          inferEdgePoints(fromN, toN, edge);
        }
      } else {
        return;
      }
      inferXYWidthHeight(edge);

      // 随几何更新一并写回 targetPoint/sourcePoint（勿用 stroke 反推覆盖，正交/曲线近似会与真实约束点不一致导致偏移）
      const persistBindingPts = edgeBindingPointsPayload(edge as EdgeSerializedNode);

      if (edge.type === 'line' || edge.type === 'rough-line') {
        api.updateNode(edge, {
          x1: edge.x1,
          y1: edge.y1,
          x2: edge.x2,
          y2: edge.y2,
          x: edge.x,
          y: edge.y,
          width: edge.width,
          height: edge.height,
          ...persistBindingPts,
        } as Partial<SerializedNode>);
      } else if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
        api.updateNode(edge, {
          points: edge.points,
          x: edge.x,
          y: edge.y,
          width: edge.width,
          height: edge.height,
          ...persistBindingPts,
        } as Partial<SerializedNode>);
      } else if (edge.type === 'path' || edge.type === 'rough-path') {
        api.updateNode(edge, {
          d: edge.d,
          x: edge.x,
          y: edge.y,
          width: edge.width,
          height: edge.height,
          ...persistBindingPts,
        } as Partial<SerializedNode>);
      }

      updateGlobalTransform(edgeEntity);

      const points: [number, number][] | null = edgeEntity.has(Polyline)
        ? edgeEntity.read(Polyline).points
        : edgeEntity.has(Line)
          ? [
            [edgeEntity.read(Line).x1, edgeEntity.read(Line).y1],
            [edgeEntity.read(Line).x2, edgeEntity.read(Line).y2],
          ]
          : edgeEntity.has(Path)
            ? polylineVertexApproxFromPathD(edgeEntity.read(Path).d)
            : null;

      if (points && points.length >= 2 && edgeEntity.has(Parent)) {
        edgeEntity.read(Parent).children.forEach((child) => {
          if (!child.has(EdgeLabel) || !child.has(Text)) {
            return;
          }
          const { labelPosition, labelOffset } = child.read(EdgeLabel);
          const { point: [px, py], normal: [nx, ny] } = pointAndNormalAlongPolylineByT(points, labelPosition);
          const ax = px + nx * labelOffset;
          const ay = py + ny * labelOffset;
          const labelNode = api.getNodeByEntity(child) as
            | TextSerializedNode
            | undefined;
          if (!labelNode) {
            return;
          }
          const layout = layoutTextAnchoredInParent(labelNode, ax, ay);
          api.updateNode(labelNode, layout);
        });
      }
    });
  }
}
