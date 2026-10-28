import ClipperLib from 'clipper-lib';
import { flattenPath } from './curve/adaptive';
import { parsePath } from './curve/shape-path';
import type { Matrix } from 'transformation-matrix';

const SCALE = 1000;
type Point = [number, number];

function dashedContours(
  points: Point[],
  closed: boolean,
  pattern: number[],
  offset: number,
): Point[][] {
  const sequence = pattern.length % 2 ? [...pattern, ...pattern] : pattern;
  const period = sequence.reduce((total, value) => total + value, 0);
  if (!period || !Number.isFinite(period)) return [];
  const path = closed && points.length > 2 ? [...points, points[0]] : points;
  const result: Point[][] = [];
  let phase = ((offset % period) + period) % period;
  let dashIndex = 0;
  while (phase > 0 && phase >= sequence[dashIndex])
    phase -= sequence[dashIndex++];
  let remaining = sequence[dashIndex] - phase;
  let current: Point[] = [];
  let iterations = 0;
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1];
    const to = path[index];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < 1e-8) continue;
    let position = 0;
    while (position < length - 1e-8) {
      // A microscopic dash pattern can otherwise consume unbounded CPU time.
      if (++iterations > 30000) return [];
      if (remaining <= 1e-8) {
        if (dashIndex % 2 === 0 && sequence[dashIndex] === 0)
          result.push([[from[0] + (to[0] - from[0]) * position / length,
            from[1] + (to[1] - from[1]) * position / length]]);
        if (dashIndex % 2 === 0 && current.length > 1) result.push(current);
        current = [];
        dashIndex = (dashIndex + 1) % sequence.length;
        remaining = sequence[dashIndex];
        continue;
      }
      const next = Math.min(length, position + remaining);
      if (dashIndex % 2 === 0) {
        const at = (distance: number): Point => [
          from[0] + ((to[0] - from[0]) * distance) / length,
          from[1] + ((to[1] - from[1]) * distance) / length,
        ];
        if (!current.length) current.push(at(position));
        current.push(at(next));
      }
      remaining -= next - position;
      position = next;
    }
  }
  if (current.length > 1) result.push(current);
  if (remaining <= 1e-8 && dashIndex % 2 === 1 &&
    sequence[(dashIndex + 1) % sequence.length] === 0) {
    const endpoint = path[path.length - 1];
    const firstDot = result.find((contour) => contour.length === 1);
    if (!closed || !firstDot || Math.hypot(
      firstDot[0][0] - endpoint[0], firstDot[0][1] - endpoint[1],
    ) > 1e-6) result.push([endpoint]);
  }
  // A dash crossing the closing vertex is one continuous stroke with a join.
  if (
    closed &&
    result.length > 1 &&
    Math.hypot(result[0][0][0] - points[0][0], result[0][0][1] - points[0][1]) <
      1e-6 &&
    Math.hypot(
      result[result.length - 1].at(-1)![0] - points[0][0],
      result[result.length - 1].at(-1)![1] - points[0][1],
    ) < 1e-6
  ) {
    result[0] = [...result.pop()!, ...result[0].slice(1)];
  }
  return result;
}

/** Resolve a solid SVG stroke into filled contours that the Path extruder accepts. */
export function strokeOutline(
  d: string,
  width: number,
  linecap: CanvasLineCap = 'butt',
  linejoin: CanvasLineJoin = 'miter',
  miterlimit = 4,
  dasharray: number[] = [],
  dashoffset = 0,
  projected?: { matrix: Matrix; x: number; y: number },
): string {
  if (!Number.isFinite(width) || width <= 0) return '';
  const dashSequence = dasharray.length % 2 ? [...dasharray, ...dasharray] : dasharray;
  if (!Number.isFinite(dashoffset) || dashSequence.some((value, index) =>
    !Number.isFinite(value) || value < 0 ||
    (index % 2 === 1 ? value <= 1 / SCALE : value > 0 && value <= 1 / SCALE)) ||
    (linecap !== 'round' && dashSequence.some((value) => value === 0)))
    return '';
  const { subPaths } = parsePath(d);
  const matrix = projected?.matrix;
  const scale = matrix ? Math.max(1, Math.hypot(matrix.a, matrix.b),
    Math.hypot(matrix.c, matrix.d)) : 1;
  if (matrix && (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
    .every(Number.isFinite) || Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-12))
    return '';
  const contours = flattenPath(subPaths, 4 * scale, width / (2 * scale))
    .map((contour) => matrix ? contour.map(([x, y]): Point => [
      matrix.a * (x + projected.x) + matrix.c * (y + projected.y) + matrix.e,
      matrix.b * (x + projected.x) + matrix.d * (y + projected.y) + matrix.f,
    ]) : contour);
  const offset = new ClipperLib.ClipperOffset(
    Math.max(2, Number.isFinite(miterlimit) ? miterlimit : 4),
    SCALE / 8,
  );
  for (let index = 0; index < subPaths.length; index++) {
    const points = contours[index];
    if (points.length < 2) continue;
    const first = points[0];
    const last = points[points.length - 1];
    const closed =
      subPaths[index].autoClose ||
      Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5;
    const contoursToOffset = dasharray.length
      ? dashedContours(points, closed, dasharray, dashoffset)
      : [points];
    if (!contoursToOffset.length) return '';
    for (const contour of contoursToOffset) {
      const contourClosed =
        closed &&
        (!dasharray.length ||
          (contour.length > 2 &&
            Math.hypot(
              contour[0][0] - contour.at(-1)![0],
              contour[0][1] - contour.at(-1)![1],
            ) < 1e-6));
      const path = contour.map(([x, y]) => ({
        X: Math.round(x * SCALE),
        Y: Math.round(y * SCALE),
      }));
      if (
        contourClosed &&
        path.length > 2 &&
        path[0].X === path[path.length - 1].X &&
        path[0].Y === path[path.length - 1].Y
      )
        path.pop();
      offset.AddPath(
        path,
        linejoin === 'round'
          ? ClipperLib.JoinType.jtRound
          : linejoin === 'bevel'
          ? ClipperLib.JoinType.jtSquare
          : ClipperLib.JoinType.jtMiter,
        contourClosed
          ? ClipperLib.EndType.etClosedLine
          : linecap === 'round'
          ? ClipperLib.EndType.etOpenRound
          : linecap === 'square'
          ? ClipperLib.EndType.etOpenSquare
          : ClipperLib.EndType.etOpenButt,
      );
    }
  }
  const result: ClipperLib.Paths = [];
  offset.Execute(result, (width * SCALE) / 2);
  return result
    .map((path) =>
      path.length < 3
        ? ''
        : `M${path.map(({ X, Y }) => `${X / SCALE} ${Y / SCALE}`).join('L')}Z`,
    )
    .join('');
}
