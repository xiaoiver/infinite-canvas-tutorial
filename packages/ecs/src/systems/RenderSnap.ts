import { Entity, System } from '@lastolivegames/becsy';
import {
  Children,
  Circle,
  ComputedBounds,
  Ellipse,
  FillSolid,
  GlobalTransform,
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
  Transformable,
  Visibility,
  SnapPoint,
} from '../components';
import { Commands } from '../commands';
import { updateGlobalTransform } from './Transform';
import { TRANSFORMER_ANCHOR_STROKE_COLOR } from './RenderTransformer';
import { HIGHLIGHTER_Z_INDEX } from '../context';
import { updateComputedPoints } from './ComputePoints';

/**
 * Render snap points & lines
 */
export class RenderSnap extends System {
  private readonly commands = new Commands(this);

  private readonly points = this.query((q) =>
    q.added.and.removed.with(SnapPoint),
  );

  private readonly pointsEntities = new Map<number, Entity[]>();

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
            SnapPoint,
          )
          .read.and.using(
            Canvas,
            GlobalTransform,
            UI,
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
            Visibility,
          ).write,
    );
  }

  execute() {
    this.points.added.forEach((point) => {
      const { points, camera } = point.read(SnapPoint);
      const pointEntities = this.createPoints(camera, points);
      this.pointsEntities.set(point.__id, pointEntities);
    });
    this.points.removed.forEach((point) => {
      // const { camera } = point.read(SnapPoint);
      const pointEntities = this.pointsEntities.get(point.__id);
      if (pointEntities) {
        pointEntities.forEach((p) => {
          p.add(ToBeDeleted);
        });
      }
      this.pointsEntities.delete(point.__id);
    });
  }

  createPoints(camera: Entity, points: [number, number][]) {
    const pointEntities = points.map((p) => {
      const point = this.commands
        .spawn(
          new UI(UIType.SNAP_POINT),
          new Transform(),
          new Renderable(),
          new Stroke({ width: 2, color: TRANSFORMER_ANCHOR_STROKE_COLOR }),
          new ZIndex(HIGHLIGHTER_Z_INDEX),
          new StrokeAttenuation(),
          new SizeAttenuation(),
          new Visibility(),
          // new Path({
          //   d: `M ${p[0]} ${p[1]} L ${p[0]} ${p[1]}`,
          // }),
          // new Circle({
          //   cx: p[0],
          //   cy: p[1],
          //   r: 10,
          // }),
        )
        .id()
        .hold();
      this.commands.entity(camera).appendChild(this.commands.entity(point));
      this.commands.execute();

      updateGlobalTransform(point);
      updateComputedPoints(point);
      return point;
    });

    const line = this.commands
      .spawn(
        new UI(UIType.SNAP_LINE),
        new Transform(),
        new Renderable(),
        new Stroke({
          width: 2,
          color: TRANSFORMER_ANCHOR_STROKE_COLOR,
          dasharray: [5, 5],
        }),
        new ZIndex(HIGHLIGHTER_Z_INDEX),
        new StrokeAttenuation(),
        new SizeAttenuation(),
        new Visibility(),
        new Polyline({
          points,
        }),
      )
      .id()
      .hold();
    this.commands.entity(camera).appendChild(this.commands.entity(line));
    this.commands.execute();
    updateGlobalTransform(line);
    updateComputedPoints(line);

    return [...pointEntities, line];
  }
}
