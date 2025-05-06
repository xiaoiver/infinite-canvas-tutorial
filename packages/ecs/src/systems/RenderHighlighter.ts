import { Entity, System } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  ComputedBounds,
  Ellipse,
  FillSolid,
  Highlighted,
  Opacity,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  SizeAttenuation,
  Stroke,
  StrokeAttenuation,
  Text,
  ToBeDeleted,
  Transform,
  UI,
  UIType,
  ZIndex,
} from '../components';
import { Commands } from '../commands';
import { getSceneRoot } from './Transform';
import { TRANSFORMER_Z_INDEX } from './RenderTransformer';

const HIGHLIGHTER_Z_INDEX = TRANSFORMER_Z_INDEX - 1;

/**
 * Highlight objects when hovering over them like Figma
 */
export class RenderHighlighter extends System {
  private readonly commands = new Commands(this);

  private readonly highlighted = this.query((q) =>
    q.current.and.added.and.removed.with(Highlighted),
  );

  #highlighters = new WeakMap<Entity, Entity>();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(ComputedBounds)
          .read.and.using(
            UI,
            Highlighted,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Rect,
            Circle,
            Ellipse,
            Path,
            Polyline,
            Text,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
          ).write,
    );
  }

  execute() {
    this.highlighted.added.forEach((entity) => {
      // Group
      if (!entity.has(ComputedBounds)) {
        return;
      }

      const { geometryBounds } = entity.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const { rotation } = entity.read(Transform);

      const highlighter = this.commands
        .spawn(
          new UI(UIType.HIGHLIGHTER),
          new Transform({
            rotation,
          }),
          new Renderable(),
          new FillSolid('white'),
          new Opacity({ fillOpacity: 0 }),
          new Stroke({ width: 2, color: '#147af3' }), // --spectrum-thumbnail-border-color-selected
          new ZIndex(HIGHLIGHTER_Z_INDEX),
          new StrokeAttenuation(),
        )
        .id()
        .hold();

      if (entity.has(Circle)) {
        const { cx, cy, r } = entity.read(Circle);
        highlighter.add(Circle, {
          cx,
          cy,
          r,
        });
      } else if (entity.has(Ellipse)) {
        const { cx, cy, rx, ry } = entity.read(Ellipse);
        highlighter.add(Ellipse, {
          cx,
          cy,
          rx,
          ry,
        });
      } else if (entity.has(Rect)) {
        const { x, y, width, height } = entity.read(Rect);
        highlighter.add(Rect, {
          x,
          y,
          width,
          height,
        });
      } else if (entity.has(Path)) {
        const { d } = entity.read(Path);
        highlighter.add(Path, {
          d,
        });
      } else if (entity.has(Polyline)) {
        const { points } = entity.read(Polyline);
        highlighter.add(Polyline, {
          points,
        });
      } else if (entity.has(Text)) {
        highlighter.add(Polyline, {
          points: [
            [minX, maxY],
            [maxX, maxY],
          ],
        });
      }

      this.commands.execute();

      const camera = this.commands.entity(getSceneRoot(entity));
      camera.appendChild(this.commands.entity(highlighter));

      this.commands.execute();

      this.#highlighters.set(entity, highlighter);
    });

    this.highlighted.removed.forEach((entity) => {
      if (this.#highlighters.has(entity)) {
        const highlighter = this.#highlighters.get(entity);

        highlighter.add(ToBeDeleted);
        this.#highlighters.delete(entity);
      }
    });
  }
}
