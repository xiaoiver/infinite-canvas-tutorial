/** Pack each sliding four-point window independently; never join different paths. */
export function appendStrokeInstances(
  points: ArrayLike<number>,
  travel: ArrayLike<number>,
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

export interface StrokeGeometry {
  pointsBuffer: readonly number[] | Float32Array;
  travelBuffer: readonly number[] | Float32Array;
}

/** CPU-only arrays keyed weakly by an existing adaptive curve level.
 * One cap/join combination per level; neither levels, shapes nor devices are retained.
 */
export class LocalStrokeGeometryCache {
  private entries = new WeakMap<object, {
    cap: string;
    join: string;
    geometry?: StrokeGeometry;
  }>();

  get(
    level: object,
    cap: string,
    join: string,
    create: () => StrokeGeometry,
  ) {
    const previous = this.entries.get(level);
    // A one-off precision level uses the original builder without allocating
    // retained buffers. Admit it only when a page needs that level again.
    if (!previous || previous.cap !== cap || previous.join !== join) {
      this.entries.set(level, { cap, join });
      return create();
    }
    if (previous.geometry) return previous.geometry;
    // Packing only copies these values; the final GPU input is already Float32.
    // Keep that same representation instead of retaining boxed/double arrays.
    const built = create();
    const geometry = {
      pointsBuffer: new Float32Array(built.pointsBuffer),
      travelBuffer: new Float32Array(built.travelBuffer),
    };
    previous.geometry = geometry;
    return geometry;
  }
}
