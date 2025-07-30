import { Entity, System } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  ComputedBounds,
  Ellipse,
  FillSolid,
  GlobalTransform,
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
  ComputedPoints,
  Canvas,
  Camera,
  FractionalIndex,
  ComputedCamera,
  Brush,
} from '../components';
import { Commands } from '../commands';
import { getSceneRoot, updateGlobalTransform } from './Transform';
import {
  TRANSFORMER_ANCHOR_FILL_COLOR,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
} from './RenderTransformer';
import { HIGHLIGHTER_Z_INDEX } from '../context';
import { safeAddComponent } from '../history';
import { updateComputedPoints } from './ComputePoints';

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
          .using(
            ComputedBounds,
            ComputedCamera,
            Canvas,
            Camera,
            FractionalIndex,
          )
          .read.and.using(
            GlobalTransform,
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
            Brush,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
            ComputedPoints,
          ).write,
    );
  }

  execute() {
    this.highlighted.added.forEach((entity) => {
      // Group
      if (!entity.has(ComputedBounds)) {
        return;
      }

      this.createOrUpdate(entity);
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

  createOrUpdate(entity: Entity) {
    let highlighter = this.#highlighters.get(entity);
    if (!highlighter) {
      highlighter = this.commands
        .spawn(
          new UI(UIType.HIGHLIGHTER),
          new Transform(),
          new Renderable(),
          new FillSolid(TRANSFORMER_ANCHOR_FILL_COLOR),
          new Opacity({ fillOpacity: 0 }),
          new Stroke({ width: 2, color: TRANSFORMER_ANCHOR_STROKE_COLOR }), // --spectrum-thumbnail-border-color-selected
          new ZIndex(HIGHLIGHTER_Z_INDEX),
          new StrokeAttenuation(),
        )
        .id()
        .hold();

      this.commands.execute();

      const camera = this.commands.entity(getSceneRoot(entity));
      camera.appendChild(this.commands.entity(highlighter));

      this.commands.execute();

      this.#highlighters.set(entity, highlighter);
    }

    const {
      obb: { x, y, width, height, rotation, scaleX, scaleY },
    } = entity.read(ComputedBounds);
    Object.assign(highlighter.write(Transform), {
      translation: {
        x,
        y,
      },
      rotation,
      scale: {
        x: scaleX,
        y: scaleY,
      },
    });

    if (entity.has(Circle)) {
      safeAddComponent(highlighter, Circle);

      const { cx, cy, r } = entity.read(Circle);
      Object.assign(highlighter.write(Circle), {
        cx,
        cy,
        r,
      });
    } else if (entity.has(Ellipse)) {
      safeAddComponent(highlighter, Ellipse);

      const { cx, cy, rx, ry } = entity.read(Ellipse);
      Object.assign(highlighter.write(Ellipse), {
        cx,
        cy,
        rx,
        ry,
      });
    } else if (entity.has(Rect)) {
      safeAddComponent(highlighter, Rect);

      Object.assign(highlighter.write(Rect), {
        width,
        height,
      });
    } else if (entity.has(Path)) {
      safeAddComponent(highlighter, Path);

      const { d } = entity.read(Path);
      Object.assign(highlighter.write(Path), {
        d,
      });
    } else if (entity.has(Polyline)) {
      safeAddComponent(highlighter, Polyline);

      const { points } = entity.read(Polyline);
      Object.assign(highlighter.write(Polyline), {
        points,
      });
    } else if (entity.has(Brush)) {
      safeAddComponent(highlighter, Polyline);

      const { points } = entity.read(Brush);
      Object.assign(highlighter.write(Polyline), {
        points: points.map((point) => [point.x, point.y]),
      });
    } else if (entity.has(Text)) {
      safeAddComponent(highlighter, Polyline);

      const {
        obb: { width, height },
      } = entity.read(ComputedBounds);
      Object.assign(highlighter.write(Polyline), {
        points: [
          [0, height],
          [width, height],
        ],
      });
    }

    updateGlobalTransform(highlighter);
    updateComputedPoints(highlighter);

    return highlighter;
  }
}
