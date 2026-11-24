/** Pack each sliding four-point window independently; never join different paths. */
export function appendStrokeInstances(
  points: readonly number[],
  travel: readonly number[],
  translationAndOrder: readonly [number, number, number],
  travelStride: number,
  packed: number[],
  packedTravel: number[],
): void {
  const count = Math.max(0, points.length / 3 - 3);
  for (let row = 0; row < count; row++) {
    for (let i = 0; i < 12; i++) packed.push(points[row * 3 + i]);
    packed.push(...translationAndOrder);
    for (let i = 0; i < travelStride; i++)
      packedTravel.push(travel[row * travelStride + i] ?? 0);
  }
}

export const STROKE_BATCH_PAGE_SIZE = 256;

/** CPU-only segment data follows the lifetime of immutable render precision points.
 * Retain one cap/join variant per weak point key; edits and LRU eviction release it.
 * Readers append placements into owned page buffers and never mutate this data.
 */
export class StrokeSegmentCache<T> {
  private entries = new WeakMap<
    object,
    {
      cap: CanvasLineCap;
      join: CanvasLineJoin;
      data: T;
    }
  >();

  get(
    points: object | undefined,
    cap: CanvasLineCap,
    join: CanvasLineJoin,
    build: () => T,
  ): T {
    if (!points) return build();
    const cached = this.entries.get(points);
    if (cached && cached.cap === cap && cached.join === join)
      return cached.data;
    const data = build();
    this.entries.set(points, { cap, join, data });
    return data;
  }
}
