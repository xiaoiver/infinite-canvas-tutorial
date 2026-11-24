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

/** Retain only the current CPU segment level for each weak shape key.
 * A new precision or style replaces the entry; builders are never retained.
 */
export class StrokeSegmentCache<T> {
  private entries = new WeakMap<
    object,
    {
      points: object;
      cap: CanvasLineCap;
      join: CanvasLineJoin;
      data: T;
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
    const cached = this.entries.get(owner);
    if (
      cached &&
      cached.points === points &&
      cached.cap === cap &&
      cached.join === join
    )
      return cached.data;
    const data = build();
    this.entries.set(owner, { points, cap, join, data });
    return data;
  }
}
