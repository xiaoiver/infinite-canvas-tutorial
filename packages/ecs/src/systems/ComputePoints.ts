import { System } from '@lastolivegames/becsy';
import { vec2 } from 'gl-matrix';
import { ComputedPoints, Path, Polyline, Stroke } from '../components';
import { bisect, parsePath } from '../utils';

/**
 * Compute the points of the path according to the definition.
 */
export class ComputePoints extends System {
  paths = this.query((q) => q.addedOrChanged.with(Path).trackWrites);
  polylines = this.query((q) => q.addedOrChanged.with(Polyline).trackWrites);

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedPoints).write);
    this.query((q) => q.using(Stroke).read);
  }

  execute() {
    this.paths.addedOrChanged.forEach((entity) => {
      const { d } = entity.read(Path);

      const { subPaths } = parsePath(d);
      const points = subPaths.map((subPath) =>
        subPath
          .getPoints()
          .map((point) => [point[0], point[1]] as [number, number]),
      );

      if (!entity.has(ComputedPoints)) {
        entity.add(ComputedPoints);
      }
      entity.write(ComputedPoints).points = points;
    });

    this.polylines.addedOrChanged.forEach((entity) => {
      const { points } = entity.read(Polyline);
      const { alignment, width } = entity.read(Stroke);

      if (!entity.has(ComputedPoints)) {
        entity.add(ComputedPoints);
      }
      entity.write(ComputedPoints).shiftedPoints = maybeShiftPoints(
        points,
        alignment,
        width,
      );
    });
  }
}

export function maybeShiftPoints(
  points: [number, number][],
  strokeAlignment: Stroke['alignment'],
  strokeWidth: number,
) {
  return strokeAlignment === 'center'
    ? points
    : shiftPoints(points, strokeAlignment === 'inner', strokeWidth);
}

export function shiftPoints(
  points: [number, number][],
  innerStrokeAlignment: boolean,
  strokeWidth: number,
) {
  const shiftedPoints: [number, number][] = [];
  points.forEach(([x, y], index) => {
    const current = vec2.fromValues(x, y);
    const prev =
      index === 0
        ? current
        : vec2.fromValues(points[index - 1][0], points[index - 1][1]);
    const next =
      index === points.length - 1
        ? current
        : vec2.fromValues(points[index + 1][0], points[index + 1][1]);

    const xBasis = vec2.sub(vec2.create(), current, prev);
    const len = vec2.length(xBasis);
    const forward = vec2.create();
    vec2.divide(forward, xBasis, vec2.fromValues(len, len));
    const norm = vec2.fromValues(forward[1], -forward[0]);

    const xBasis2 = vec2.sub(vec2.create(), next, current);
    const len2 = vec2.length(xBasis2);
    const forward2 = vec2.create();
    vec2.divide(forward2, xBasis2, vec2.fromValues(len2, len2));
    const norm2 = vec2.fromValues(forward2[1], -forward2[0]);

    const D = norm[0] * norm2[1] - norm[1] * norm2[0];
    // norm2 *= sign2;

    const lineAlignment = 2.0 * (innerStrokeAlignment ? 0 : 1) - 1.0;
    const shift = (strokeWidth / 2) * lineAlignment;

    if (len === 0) {
      vec2.add(current, current, vec2.scale(norm2, norm2, shift));
    } else if (len2 === 0) {
      vec2.add(current, current, vec2.scale(norm, norm, shift));
    } else {
      if (Math.abs(D) < 0.01) {
        vec2.add(current, current, vec2.scale(norm, norm, shift));
      } else {
        vec2.add(current, current, bisect(norm, norm2, shift));
      }
    }

    shiftedPoints.push([current[0], current[1]]);
  });
  return shiftedPoints;
}
