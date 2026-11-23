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
