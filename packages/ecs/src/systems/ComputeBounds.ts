import { System } from '@lastolivegames/becsy';
import {
  AABB,
  Circle,
  ComputedBounds,
  ComputedPoints,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  GlobalTransform,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  Text,
} from '../components';

export class ComputeBounds extends System {
  renderables = this.query(
    (q) =>
      q.addedOrChanged
        .with(Renderable, GlobalTransform)
        .withAny(Circle, Ellipse, Rect, Polyline, Path, Text).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedBounds).write);
    this.query(
      (q) =>
        q.using(
          Circle,
          Ellipse,
          Rect,
          Polyline,
          Path,
          ComputedPoints,
          Text,
          ComputedTextMetrics,
          Stroke,
          DropShadow,
        ).read,
    );
  }

  execute() {
    this.renderables.addedOrChanged.forEach((entity) => {
      if (!entity.has(ComputedBounds)) {
        entity.add(ComputedBounds);
      }

      const stroke = entity.has(Stroke) ? entity.read(Stroke) : undefined;
      const dropShadow = entity.has(DropShadow)
        ? entity.read(DropShadow)
        : undefined;
      let geometryBounds: AABB;
      let renderBounds: AABB;
      if (entity.has(Circle)) {
        geometryBounds = Circle.getGeometryBounds(entity.read(Circle));
        renderBounds = Circle.getRenderBounds(entity.read(Circle), stroke);
      } else if (entity.has(Ellipse)) {
        geometryBounds = Ellipse.getGeometryBounds(entity.read(Ellipse));
        renderBounds = Ellipse.getRenderBounds(entity.read(Ellipse), stroke);
      } else if (entity.has(Rect)) {
        geometryBounds = Rect.getGeometryBounds(entity.read(Rect));
        renderBounds = Rect.getRenderBounds(
          entity.read(Rect),
          stroke,
          dropShadow,
        );
      } else if (entity.has(Polyline)) {
        geometryBounds = Polyline.getGeometryBounds({
          ...entity.read(Polyline),
          points: entity.read(ComputedPoints).shiftedPoints,
        });
        renderBounds = Polyline.getRenderBounds(entity.read(Polyline), stroke);
      } else if (entity.has(Path)) {
        geometryBounds = Path.getGeometryBounds(
          entity.read(Path),
          entity.read(ComputedPoints),
        );
        renderBounds = Path.getRenderBounds(
          entity.read(Path),
          entity.read(ComputedPoints),
          stroke,
        );
      } else if (entity.has(Text)) {
        geometryBounds = Text.getGeometryBounds(
          entity.read(Text),
          entity.read(ComputedTextMetrics),
        );
        renderBounds = Text.getRenderBounds(
          entity.read(Text),
          entity.read(ComputedTextMetrics),
          stroke,
          dropShadow,
        );
      }

      if (geometryBounds) {
        entity.write(ComputedBounds).geometryBounds = geometryBounds;
      }
      if (renderBounds) {
        entity.write(ComputedBounds).renderBounds = renderBounds;
      }

      {
        const matrix = entity.read(GlobalTransform).matrix;
        const { renderBounds } = entity.read(ComputedBounds);

        // apply global transform
        const bounds = new AABB();
        bounds.addBounds(renderBounds, matrix);

        Object.assign(entity.write(ComputedBounds), { bounds });
      }
    });
  }
}
