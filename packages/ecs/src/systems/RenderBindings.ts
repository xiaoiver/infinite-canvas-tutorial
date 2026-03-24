import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Binded,
  Binding,
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
import type { TextSerializedNode } from '../types/serialized-node';
import {
  EdgeState,
  inferPointsWithFromIdAndToId,
  inferXYWidthHeight,
  layoutTextAnchoredInParent,
  pointAndNormalAlongPolylineByT,
  polylineVertexApproxFromPathD,
} from '../utils';

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
            Binded,
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
          )
          .write,
    );
  }

  execute() {
    const bindingsToUpdate = new Set<Entity>();
    this.boundeds.changed.forEach((entity) => {
      const { fromBindings, toBindings } = entity.read(Binded);
      [...fromBindings, ...toBindings].forEach((binding) => {
        bindingsToUpdate.add(binding);
      });
    });

    bindingsToUpdate.forEach((binding) => {
      const { from, to } = binding.read(Binding);
      const camera = getSceneRoot(binding);
      const { canvas } = camera.read(Camera);
      const { api } = canvas.read(Canvas);

      const edge = api.getNodeByEntity(binding) as EdgeState;
      const fromNode = api.getNodeByEntity(from);
      const toNode = api.getNodeByEntity(to);

      inferPointsWithFromIdAndToId(fromNode, toNode, edge);
      delete edge.x;
      delete edge.y;
      delete edge.width;
      delete edge.height;
      inferXYWidthHeight(edge);

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
        });
      } else if (edge.type === 'polyline' || edge.type === 'rough-polyline') {
        api.updateNode(edge, {
          points: edge.points,
          x: edge.x,
          y: edge.y,
          width: edge.width,
          height: edge.height,
        });
      } else if (edge.type === 'path' || edge.type === 'rough-path') {
        api.updateNode(edge, {
          d: edge.d,
          x: edge.x,
          y: edge.y,
          width: edge.width,
          height: edge.height,
        });
      }

      updateGlobalTransform(binding);

      const points: [number, number][] | null = binding.has(Polyline)
        ? binding.read(Polyline).points
        : binding.has(Line)
          ? [
              [binding.read(Line).x1, binding.read(Line).y1],
              [binding.read(Line).x2, binding.read(Line).y2],
            ]
          : binding.has(Path)
            ? polylineVertexApproxFromPathD(binding.read(Path).d)
            : null;

      if (points && points.length >= 2 && binding.has(Parent)) {
        binding.read(Parent).children.forEach((child) => {
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
