import { Entity, System } from '@lastolivegames/becsy';
import { Camera } from '../components/camera';
import {
  Binded,
  Binding,
  Canvas,
  Children,
  ComputedBounds,
  Ellipse,
  Embed,
  FractionalIndex,
  GlobalTransform,
  HTML,
  Line,
  Parent,
  Rect,
  Transform,
  Transformable,
  UI,
  ZIndex,
} from '../components';
import { getSceneRoot, updateGlobalTransform } from './Transform';
import {
  inferPointsWithFromIdAndToId,
  inferXYWidthHeight,
  LineSerializedNode,
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
          .read.and.using(GlobalTransform, Transform, Transformable, Line)
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

      const edge = api.getNodeByEntity(binding) as LineSerializedNode;
      const fromNode = api.getNodeByEntity(from);
      const toNode = api.getNodeByEntity(to);

      inferPointsWithFromIdAndToId(fromNode, toNode, edge);
      delete edge.x;
      delete edge.y;
      delete edge.width;
      delete edge.height;
      inferXYWidthHeight(edge);

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

      updateGlobalTransform(binding);
    });
  }
}
