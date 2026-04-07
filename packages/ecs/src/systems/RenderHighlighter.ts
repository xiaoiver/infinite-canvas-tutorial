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
  Group,
  Brush,
  Pen,
  Transformable,
  Visibility,
  Line,
  OBB,
} from '../components';
import { Commands } from '../commands';
import { getSceneRoot, updateGlobalTransform } from './Transform';
import {
  calculateOBBRecursive,
  TRANSFORMER_ANCHOR_FILL_COLOR,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
} from './RenderTransformer';
import { HIGHLIGHTER_Z_INDEX } from '../context';
import { safeAddComponent, safeRemoveComponent } from '../history';
import { updateComputedPoints } from './ComputePoints';

/**
 * Highlight objects when hovering over them like Figma
 */
export class RenderHighlighter extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) =>
    q.current.and.added.with(Camera),
  );

  private readonly highlighted = this.query((q) =>
    q.added.and.removed.with(Highlighted),
  );

  private readonly bounds = this.query(
    (q) => q.changed.with(ComputedBounds).trackWrites,
  );

  // entity -> highlighter
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
            Transformable,
          )
          .read.and.using(
            Canvas,
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
            Line,
            Text,
            Group,
            Brush,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
            ComputedPoints,
            Visibility,
          ).write,
    );
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const { api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;
      // if (pen !== Pen.SELECT && pen !== Pen.DRAW_ARROW) {
      //   api.highlightNodes([]);
      //   return;
      // }
    });

    this.highlighted.removed.forEach((highlighted) => {
      const camera = getSceneRoot(highlighted);
      this.remove(highlighted, camera);
    });

    this.highlighted.added.forEach((highlighted) => {
      const camera = getSceneRoot(highlighted);
      this.createOrUpdate(highlighted, camera);
    });

    this.bounds.changed.forEach((entity) => {
      // 与 RenderTransformer 一致：hover 在 Group 上时 Highlighted 挂在 Group，子节点 bounds 变化需沿父链找到高亮目标
      let e: Entity | undefined = entity;
      while (e) {
        if (e.has(Highlighted)) {
          const camera = getSceneRoot(e);
          this.createOrUpdate(e, camera);
          break;
        }
        if (!e.has(Children)) {
          break;
        }
        e = e.read(Children).parent;
      }
    });
  }

  createOrUpdate(entity: Entity, camera: Entity) {
    const { selectionOBB, transformOBB } = entity.read(ComputedBounds);
    /**
     * Polyline / Path / Line / Brush 的高亮几何是拷贝实体局部点；须与实体世界原点变换一致（transformOBB）。
     * selectionOBB 对边类可为「包围盒 min 角」对齐，用于变换器，若用于高亮会与局部点错位。
     */
    const obb =
      entity.has(Polyline) ||
      entity.has(Path) ||
      entity.has(Line) ||
      entity.has(Brush)
        ? transformOBB
        : selectionOBB;
    const { x, y, width, height, rotation, scaleX, scaleY } = obb;

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
          new Visibility(),
        )
        .id()
        .hold();
      this.commands
        .entity(camera)
        .appendChild(this.commands.entity(highlighter));
      this.commands.execute();
      this.#highlighters.set(entity, highlighter);
    }

    safeRemoveComponent(highlighter, GlobalTransform);
    safeRemoveComponent(highlighter, Circle);
    safeRemoveComponent(highlighter, Ellipse);
    safeRemoveComponent(highlighter, Rect);
    safeRemoveComponent(highlighter, Path);
    safeRemoveComponent(highlighter, Polyline);
    highlighter.write(Visibility).value = 'visible';


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
    } else if (entity.has(Group)) {
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
    } else if (entity.has(Line)) {
      safeAddComponent(highlighter, Polyline);
      const { x1, y1, x2, y2 } = entity.read(Line);
      Object.assign(highlighter.write(Polyline), {
        points: [[x1, y1], [x2, y2]],
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
        selectionOBB: { width, height },
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
  }

  remove(entity: Entity, camera: Entity) {
    const highlighter = this.#highlighters.get(entity);
    highlighter.write(Visibility).value = 'hidden';
  }
}
