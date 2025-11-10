import { Entity, System } from '@lastolivegames/becsy';
import {
  AABB,
  Brush,
  Circle,
  ComputedBounds,
  ComputedPoints,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  GlobalTransform,
  HTML,
  Line,
  Mat3,
  OBB,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  Text,
  Transform,
  VectorNetwork,
} from '../components';
import { decompose } from '../utils';
import { safeAddComponent } from '../history';

export class ComputeBounds extends System {
  renderables = this.query(
    (q) =>
      q.addedOrChanged
        .with(Renderable, GlobalTransform)
        .withAny(
          Transform,
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          Text,
          Brush,
          VectorNetwork,
        ).trackWrites,
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
          Line,
          Polyline,
          Path,
          ComputedPoints,
          Text,
          Brush,
          ComputedTextMetrics,
          Stroke,
          DropShadow,
          HTML,
        ).read,
    );
  }

  execute() {
    this.renderables.addedOrChanged.forEach((entity) => {
      this.updateBounds(entity);
    });
  }

  updateBounds(entity: Entity) {
    safeAddComponent(entity, ComputedBounds);
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
    } else if (entity.has(Line)) {
      geometryBounds = Line.getGeometryBounds(entity.read(Line));
      renderBounds = Line.getRenderBounds(entity.read(Line), stroke);
    } else if (entity.has(Polyline)) {
      geometryBounds = Polyline.getGeometryBounds({
        ...entity.read(Polyline),
        points: entity.read(ComputedPoints).shiftedPoints,
      });
      renderBounds = Polyline.getRenderBounds(entity.read(Polyline), stroke);
    } else if (entity.has(Brush)) {
      geometryBounds = Brush.getGeometryBounds(entity.read(Brush));
      renderBounds = Brush.getRenderBounds(entity.read(Brush));
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
    } else if (entity.has(VectorNetwork)) {
      geometryBounds = VectorNetwork.getGeometryBounds(
        entity.read(VectorNetwork),
      );
      renderBounds = VectorNetwork.getRenderBounds(
        entity.read(VectorNetwork),
        stroke,
      );
    } else if (entity.has(HTML)) {
      geometryBounds = HTML.getGeometryBounds(entity.read(HTML));
      renderBounds = geometryBounds;
    }

    const hitArea = entity.has(Renderable)
      ? entity.read(Renderable).hitArea
      : null;
    if (hitArea) {
      if (hitArea instanceof Circle) {
        renderBounds = Circle.getRenderBounds(hitArea);
      } else if (hitArea instanceof Rect) {
        renderBounds = Rect.getRenderBounds(hitArea);
      }
    }

    if (geometryBounds) {
      entity.write(ComputedBounds).geometryBounds = geometryBounds;
    }
    if (renderBounds) {
      entity.write(ComputedBounds).renderBounds = renderBounds;
    }

    if (geometryBounds && renderBounds) {
      const matrix = entity.read(GlobalTransform).matrix;
      const { translation, rotation, scale } = decompose(Mat3.toGLMat3(matrix));

      const { geometryBounds, renderBounds } = entity.read(ComputedBounds);

      const geometryWorldBounds = new AABB();
      geometryWorldBounds.addBounds(geometryBounds, matrix);

      // apply global transform
      const renderWorldBounds = new AABB();
      renderWorldBounds.addBounds(renderBounds, matrix);

      const obb = new OBB({
        x: translation[0],
        y: translation[1],
        width: geometryBounds.maxX - geometryBounds.minX,
        height: geometryBounds.maxY - geometryBounds.minY,
        rotation,
        scaleX: scale[0],
        scaleY: scale[1],
      });

      Object.assign(entity.write(ComputedBounds), {
        renderWorldBounds,
        geometryWorldBounds,
        obb,
      });
    }
  }
}
