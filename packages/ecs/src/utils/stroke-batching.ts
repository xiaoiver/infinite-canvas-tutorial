export interface StrokePart {
  readonly points: readonly number[];
  readonly travel: readonly number[];
  readonly translationAndOrder: readonly [number, number, number];
}

/** Allocate final page snapshots once; never join windows across different paths. */
export function packStrokeInstances(
  parts: readonly StrokePart[],
  travelStride: 1 | 3,
) {
  const count = (points: readonly number[]) =>
    Math.max(0, Math.ceil(points.length / 3 - 3));
  let rows = 0;
  for (const part of parts) rows += count(part.points);
  const points = new Float32Array(rows * 15);
  const travel = new Float32Array(rows * travelStride);
  let target = 0;
  let travelTarget = 0;
  for (const part of parts) {
    const size = count(part.points);
    const source = part.points;
    const [x, y, order] = part.translationAndOrder;
    // Each native instance contains four overlapping triples plus placement.
    // Advance offsets directly; keep each path's first/last window independent.
    for (let row = 0, start = 0; row < size; row++, start += 3, target += 15) {
      points[target] = source[start];
      points[target + 1] = source[start + 1];
      points[target + 2] = source[start + 2];
      points[target + 3] = source[start + 3];
      points[target + 4] = source[start + 4];
      points[target + 5] = source[start + 5];
      points[target + 6] = source[start + 6];
      points[target + 7] = source[start + 7];
      points[target + 8] = source[start + 8];
      points[target + 9] = source[start + 9];
      points[target + 10] = source[start + 10];
      points[target + 11] = source[start + 11];
      points[target + 12] = x;
      points[target + 13] = y;
      points[target + 14] = order;
    }
    const distances = part.travel;
    for (let i = 0; i < size * travelStride; i++) {
      travel[travelTarget++] = distances[i] ?? 0;
    }
  }
  return { points, travel };
}

export const STROKE_BATCH_PAGE_SIZE = 256;

/** CPU segments follow the lifetime of weak owner and sampled-point keys.
 * One style per owner; builders and sampled points are never retained here.
 */
export class StrokeSegmentCache<T> {
  private entries = new WeakMap<
    object,
    {
      cap: CanvasLineCap;
      join: CanvasLineJoin;
      levels: WeakMap<object, { data: T }>;
    }
  >();

  get(
    owner: object,
    points: object | undefined,
    cap: CanvasLineCap,
    join: CanvasLineJoin,
    build: () => T,
  ): T {
    if (!points) {
      this.entries.delete(owner);
      return build();
    }
    const current = this.entries.get(owner);
    const entry =
      current?.cap === cap && current.join === join
        ? current
        : { cap, join, levels: new WeakMap<object, { data: T }>() };
    const cached = entry.levels.get(points);
    if (cached) return cached.data;
    // Publish only after success, preserving previous hits when a build fails.
    const data = build();
    entry.levels.set(points, { data });
    this.entries.set(owner, entry);
    return data;
  }
}
