import { Entity, System } from '@lastolivegames/becsy';
import { vec2 } from 'gl-matrix';
import { ComputedPoints, Path, Polyline, Stroke } from '../components';
import { bisect, parsePath } from '../utils';
import { safeAddComponent } from '../history';

/**
 * Compute the points of the path according to the definition.
 */
export class ComputePoints extends System {
  paths = this.query((q) => q.addedOrChanged.with(Path).trackWrites);
  polylines = this.query((q) => q.addedOrChanged.with(Polyline).trackWrites);
  polylineStrokes = this.query(
    (q) => q.addedChangedOrRemoved.with(Polyline).and.with(Stroke).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedPoints).write);
    this.query((q) => q.using(Stroke).read);
  }

  execute() {
    this.paths.addedOrChanged.forEach((entity) => {
      updateComputedPoints(entity);
    });

    const polylines = new Set([
      ...this.polylines.addedOrChanged,
      ...this.polylineStrokes.addedChangedOrRemoved,
    ]);
    for (const entity of polylines) {
      // Removed strokes still need unshifted points; deleted shapes do not.
      if (entity.alive && entity.has(Polyline)) updateComputedPoints(entity);
    }
  }
}

export function updateComputedPoints(entity: Entity) {
  if (entity.has(Path)) {
    const { d } = entity.read(Path);
    const { subPaths } = parsePath(d);
    const points = subPaths.map((subPath) =>
      subPath
        .getPoints()
        .map((point) => [point[0], point[1]] as [number, number]),
    );

    safeAddComponent(entity, ComputedPoints);
    entity.write(ComputedPoints).points = points;
  } else if (entity.has(Polyline)) {
    const { points } = entity.read(Polyline);
    const stroke = entity.has(Stroke) ? entity.read(Stroke) : undefined;

    safeAddComponent(entity, ComputedPoints);
    entity.write(ComputedPoints).shiftedPoints = maybeShiftPoints(
      points,
      stroke?.alignment ?? 'center',
      stroke?.width ?? 0,
    );
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
  source: [number, number][],
  innerStrokeAlignment: boolean,
  strokeWidth: number,
) {
  // Repeated samples have no tangent. Offset their shared vertex once, then
  // restore the original point count/order for rendering and SVG export.
  const points: [number, number][] = [];
  const indices = source.map((point) => {
    const previous = points[points.length - 1];
    if (!previous || point[0] !== previous[0] || point[1] !== previous[1]) {
      points.push(point);
    }
    return points.length - 1;
  });
  if (points.length < 2)
    return source.map(([x, y]) => [x, y] as [number, number]);

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
    vec2.normalize(forward, xBasis);
    const norm = vec2.fromValues(forward[1], -forward[0]);

    const xBasis2 = vec2.sub(vec2.create(), next, current);
    const len2 = vec2.length(xBasis2);
    const forward2 = vec2.create();
    vec2.normalize(forward2, xBasis2);
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
  return indices.map((index) => shiftedPoints[index]);
}
