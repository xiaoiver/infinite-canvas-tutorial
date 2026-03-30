import { vec2 } from 'gl-matrix';

/** gl-matrix vec2 or plain [x, y] (e.g. from transformation-matrix). */
type Point2 = vec2 | readonly [number, number];

export function pathPoly(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: readonly Point2[],
) {
  ctx.beginPath();
  const [first, ...rest] = points;
  ctx.moveTo(first[0], first[1]);
  rest.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
}

export function* segmentsOf<T extends vec2>(
  points: T[],
  looped: boolean,
): Generator<[T, T, number, number]> {
  const length = points.length;
  for (let i = 0; i < points.length - (looped ? 0 : 1); i++) {
    const next = (i + 1) % length;
    yield [points[i], points[next], i, next];
  }
}
