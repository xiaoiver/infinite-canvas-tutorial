/** Render-only points. Never assign these arrays to the document or ComputedPoints. */
export type PolylinePoints = [number, number][];
export const POLYLINE_CSS_ERROR = 0.25;

/** Iterative Douglas–Peucker with a bounded work budget and exact cap tangents. */
export function simplifyPolyline(
  points: PolylinePoints,
  tolerance: number,
): PolylinePoints {
  const n = points.length;
  if (
    n < 32 ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)) ||
    (points[0][0] === points[n - 1][0] && points[0][1] === points[n - 1][1])
  )
    return points;
  const keep = new Uint8Array(n);
  keep[0] = keep[1] = keep[n - 2] = keep[n - 1] = 1;
  const stack = [1, n - 2];
  let budget = n * 64;
  const squared = tolerance * tolerance;
  while (stack.length) {
    const end = stack.pop()!,
      start = stack.pop()!;
    const [ax, ay] = points[start],
      [bx, by] = points[end];
    const dx = bx - ax,
      dy = by - ay,
      length2 = dx * dx + dy * dy;
    let farthest = -1,
      max = squared;
    for (let i = start + 1; i < end; i++) {
      if (--budget < 0) return points;
      const x = points[i][0] - ax,
        y = points[i][1] - ay;
      const t = length2
        ? Math.max(0, Math.min(1, (x * dx + y * dy) / length2))
        : 0;
      const distance = (x - t * dx) ** 2 + (y - t * dy) ** 2;
      if (!Number.isFinite(distance)) return points;
      if (distance > max) {
        max = distance;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push(start, farthest, farthest, end);
    }
  }
  const result = points.filter((_, i) => keep[i]);
  return result.length < n ? result : points;
}

/** Four retained precision levels; refinement is immediate, coarsening has hysteresis. */
export class PolylineGeometryCache {
  private source: PolylinePoints;
  private scale = 0;
  private levels = new Map<number, PolylinePoints>();

  get(
    points: PolylinePoints,
    scale: number,
    invalidated = false,
  ): PolylinePoints {
    if (invalidated || points !== this.source) {
      this.source = points;
      this.scale = 0;
      this.levels.clear();
    }
    // Invalid/projective/singular passes must never select the coarsest geometry.
    if (!Number.isFinite(scale) || scale <= 0) return points;
    if (!(scale <= this.scale && scale > this.scale / 4))
      this.scale = 2 ** Math.ceil(Math.log2(scale));
    let result = this.levels.get(this.scale);
    if (!result)
      result = simplifyPolyline(points, POLYLINE_CSS_ERROR / this.scale);
    this.levels.delete(this.scale);
    this.levels.set(this.scale, result);
    if (this.levels.size > 4)
      this.levels.delete(this.levels.keys().next().value);
    return result;
  }
}
