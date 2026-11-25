import * as core from '../../packages/core/src/utils/stroke-batching';
import * as ecs from '../../packages/ecs/src/utils/stroke-batching';
import { strokePackingContract } from '../contracts/stroke-batching';

for (const [backend, packing, stride] of [
  ['core', core, 1],
  ['ecs', ecs, 3],
] as const) {
  describe(`${backend} native stroke page packing`, () => {
    strokePackingContract(packing, stride);

    it('matches an independent row oracle across partial, sparse and multi-page inputs', () => {
      // Include every partial-triple length, zero-row paths, short travel and
      // page boundaries. Frozen inputs also detect accidental source writes.
      const parts = Object.freeze(
        Array.from({ length: 513 }, (_, index) => {
          const points = Array.from(
            { length: index % 101 },
            (_, i) => ((index * 31 + i * 17) % 97) / 7 - 4,
          );
          if (points.length > 14 && index % 3 === 0) delete points[13];
          const travel = Array.from({ length: index % 37 }, (_, i) => i / 3);
          if (travel.length > 2 && index % 5 === 0) delete travel[1];
          return Object.freeze({
            points: Object.freeze(points),
            travel: Object.freeze(travel),
            translationAndOrder: Object.freeze([
              index / 11,
              -index / 13,
              index / 65536,
            ] as const),
          });
        }),
      );
      const expectedPoints: number[] = [];
      const expectedTravel: number[] = [];
      for (const part of parts) {
        // A row exists while the fourth triple has at least one number.
        for (let start = 0; start + 9 < part.points.length; start += 3) {
          for (let i = 0; i < 12; i++) {
            expectedPoints.push(part.points[start + i]);
          }
          expectedPoints.push(...part.translationAndOrder);
          for (let i = 0; i < stride; i++) {
            expectedTravel.push(part.travel[(start / 3) * stride + i] ?? 0);
          }
        }
      }
      const result = packing.packStrokeInstances(parts, stride);
      const bytes = (array: Float32Array) => new Uint8Array(array.buffer);
      expect(bytes(result.points)).toEqual(
        bytes(new Float32Array(expectedPoints)),
      );
      expect(bytes(result.travel)).toEqual(
        bytes(new Float32Array(expectedTravel)),
      );
    });
  });
}
