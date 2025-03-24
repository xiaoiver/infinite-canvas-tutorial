import { System } from '@lastolivegames/becsy';
import { Drawable } from 'roughjs/bin/core';
import {
  Circle,
  ComputedRough,
  Ellipse,
  FillSolid,
  getRoughOptions,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
} from '../components';
import { generator, parsePath } from '../utils';

export class ComputeRough extends System {
  roughs = this.query((q) => q.addedOrChanged.with(Rough).trackWrites);

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedRough).write);
    this.query(
      (q) =>
        q.using(Circle, Ellipse, Rect, Polyline, Path, FillSolid, Stroke).read,
    );
  }

  execute() {
    this.roughs.addedOrChanged.forEach((entity) => {
      let drawable: Drawable;
      const roughOptions = getRoughOptions(entity);

      if (entity.has(Circle)) {
        const { cx, cy, r } = entity.read(Circle);
        drawable = generator.circle(cx, cy, r * 2, roughOptions);
      } else if (entity.has(Ellipse)) {
        const { cx, cy, rx, ry } = entity.read(Ellipse);
        drawable = generator.ellipse(cx, cy, rx * 2, ry * 2, roughOptions);
      } else if (entity.has(Rect)) {
        const { x, y, width, height } = entity.read(Rect);
        drawable = generator.rectangle(x, y, width, height, roughOptions);
      } else if (entity.has(Polyline)) {
        const { points } = entity.read(Polyline);
        drawable = generator.linearPath(points, roughOptions);
      } else if (entity.has(Path)) {
        const { d } = entity.read(Path);
        drawable = generator.path(d, roughOptions);
      }

      const drawableSets = drawable.sets;
      let strokePoints: [number, number][][] = [];
      let fillPoints: [number, number][][] = [];
      let fillPathPoints: [number, number][][] = [];

      drawableSets.forEach((set) => {
        const { subPaths } = parsePath(set);
        const points = subPaths.map((subPath) =>
          subPath
            .getPoints()
            .map((point) => [point[0], point[1]] as [number, number]),
        );

        if (set.type === 'path') {
          strokePoints = points;
        } else if (set.type === 'fillPath') {
          fillPathPoints = points;
        } else if (set.type === 'fillSketch') {
          fillPoints = points;
        }
      });
      if (!entity.has(ComputedRough)) {
        entity.add(ComputedRough);
      }
      Object.assign(entity.write(ComputedRough), {
        drawableSets,
        strokePoints,
        fillPoints,
        fillPathPoints,
      });
    });
  }
}
