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

  private readonly bounds = this.query(
    (q) => q.changed.with(ComputedBounds).trackWrites,
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

      const highlighter = this.createOrUpdate(entity);

      this.commands.execute();

      const camera = this.commands.entity(getSceneRoot(entity));
      camera.appendChild(this.commands.entity(highlighter));

      this.commands.execute();
    });

    this.highlighted.removed.forEach((entity) => {
      if (this.#highlighters.has(entity)) {
        const highlighter = this.#highlighters.get(entity);

        highlighter.add(ToBeDeleted);
        this.#highlighters.delete(entity);
      }
    });

    this.bounds.changed.forEach((entity) => {
      if (this.#highlighters.has(entity)) {
        this.createOrUpdate(entity);
      }
    });
  }

  private createOrUpdate(entity: Entity) {
    let highlighter = this.#highlighters.get(entity);
    if (!highlighter) {
      const { geometryBounds } = entity.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const { rotation } = entity.read(Transform);

      highlighter = this.commands
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

      this.#highlighters.set(entity, highlighter);
    }
    if (entity.has(Circle)) {
      if (!highlighter.has(Circle)) {
        highlighter.add(Circle);
      }

      const { cx, cy, r } = entity.read(Circle);
      Object.assign(highlighter.write(Circle), {
        cx,
        cy,
        r,
      });
    } else if (entity.has(Ellipse)) {
      if (!highlighter.has(Ellipse)) {
        highlighter.add(Ellipse);
      }

      const { cx, cy, rx, ry } = entity.read(Ellipse);
      Object.assign(highlighter.write(Ellipse), {
        cx,
        cy,
        rx,
        ry,
      });
    } else if (entity.has(Rect)) {
      if (!highlighter.has(Rect)) {
        highlighter.add(Rect);
      }

      const { x, y, width, height } = entity.read(Rect);
      Object.assign(highlighter.write(Rect), {
        x,
        y,
        width,
        height,
      });
    } else if (entity.has(Path)) {
      if (!highlighter.has(Path)) {
        highlighter.add(Path);
      }

      const { d } = entity.read(Path);
      Object.assign(highlighter.write(Path), {
        d,
      });
    } else if (entity.has(Polyline)) {
      if (!highlighter.has(Polyline)) {
        highlighter.add(Polyline);
      }

      const { points } = entity.read(Polyline);
      Object.assign(highlighter.write(Polyline), {
        points,
      });
    } else if (entity.has(Text)) {
      if (!highlighter.has(Polyline)) {
        highlighter.add(Polyline);
      }

      const { geometryBounds } = entity.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const { rotation } = entity.read(Transform);

      Object.assign(highlighter.write(Polyline), {
        points: [
          [minX, maxY],
          [maxX, maxY],
        ],
      });
    }

    return highlighter;
  }
}
