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
  let offset = 0;
  for (const part of parts) {
    const size = count(part.points);
    for (let row = 0; row < size; row++) {
      const target = (offset + row) * 15;
      for (let i = 0; i < 12; i++)
        points[target + i] = part.points[row * 3 + i];
      points[target + 12] = part.translationAndOrder[0];
      points[target + 13] = part.translationAndOrder[1];
      points[target + 14] = part.translationAndOrder[2];
      for (let i = 0; i < travelStride; i++)
        travel[(offset + row) * travelStride + i] =
          part.travel[row * travelStride + i] ?? 0;
    }
    offset += size;
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
