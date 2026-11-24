interface StrokePart {
  points: readonly number[];
  travel: readonly number[];
  translationAndOrder: readonly [number, number, number];
}
interface Packing {
  packStrokeInstances(
    parts: readonly StrokePart[],
    stride: 1 | 3,
  ): { points: Float32Array; travel: Float32Array };
}
export function strokePackingContract(packing: Packing, stride: 1 | 3) {
  it('keeps native four-point windows, joint flags, independent travel and per-path depth', () => {
    const first = Object.freeze([
      1, 2, 32, 3, 4, 12, 5, 6, 8, 7, 8, 16, 9, 10, 0,
    ]);
    const second = Object.freeze([
      21, 22, 64, 23, 24, 4, 25, 26, 20, 27, 28, 0,
    ]);
    const travel = Object.freeze(
      stride === 1 ? [0, 10] : [0, 2, 3, 10, 12, 13],
    );
    const result = packing.packStrokeInstances(
      [
        { points: first, travel, translationAndOrder: [100, -40, 0.25] },
        {
          points: second,
          travel: stride === 1 ? [0] : [0, 5, 6],
          translationAndOrder: [-3, 5, 0.75],
        },
        {
          points: [0, 0, 0, 1, 1, 0],
          travel: [],
          translationAndOrder: [0, 0, 0],
        },
      ],
      stride,
    );
    const expected = new Float32Array([
      ...first.slice(0, 12),
      100,
      -40,
      0.25,
      ...first.slice(3, 15),
      100,
      -40,
      0.25,
      ...second,
      -3,
      5,
      0.75,
    ]);
    expect(result.points).toEqual(expected);
    expect(result.travel).toEqual(
      new Float32Array([...travel, ...(stride === 1 ? [0] : [0, 5, 6])]),
    );
    expect(result.points).toHaveLength(45);
    expect(result.travel).toHaveLength(3 * stride);
  });
  it('preserves float32 conversion, flags, missing travel and partial windows byte for byte', () => {
    const points = Object.freeze([
      1 / 3,
      -0,
      32,
      NaN,
      Infinity,
      12,
      -Infinity,
      1e-30,
      8,
      7,
      8,
    ]);
    const placement = Object.freeze([1e20, -1 / 7, -0] as const);
    const result = packing.packStrokeInstances(
      [
        Object.freeze({
          points,
          travel: Object.freeze([NaN]),
          translationAndOrder: placement,
        }),
      ],
      stride,
    );
    const expected = new Float32Array([...points, NaN, ...placement]);
    const distances = new Float32Array(stride);
    distances[0] = NaN;
    expect(new Uint8Array(result.points.buffer)).toEqual(
      new Uint8Array(expected.buffer),
    );
    expect(new Uint8Array(result.travel.buffer)).toEqual(
      new Uint8Array(distances.buffer),
    );
    expect(packing.packStrokeInstances([], stride).points).toHaveLength(0);
    expect(
      packing.packStrokeInstances(
        [{ points: [], travel: [], translationAndOrder: [0, 0, 0] }],
        stride,
      ).travel,
    ).toHaveLength(0);
  });
  it('owns exact fresh page snapshots without changing source data or previous pages', () => {
    const points = Object.freeze([
      1, 2, 32, 3, 4, 12, 5, 6, 8, 7, 8, 16, 9, 10, 0,
    ]);
    const source = Object.freeze({
      points,
      travel: Object.freeze([0, 1, 2, 3, 4, 5]),
      translationAndOrder: Object.freeze([3, 4, 0.5] as const),
    });
    const first = packing.packStrokeInstances([source], stride);
    const oldPoints = first.points.slice(),
      oldTravel = first.travel.slice();
    const next = packing.packStrokeInstances(
      [source, { ...source, translationAndOrder: [30, 40, 0.75] }],
      stride,
    );
    expect(first.points.byteLength).toBe(2 * 15 * 4);
    expect(first.travel.byteLength).toBe(2 * stride * 4);
    expect(next.points).toHaveLength(4 * 15);
    for (const [a, b] of [
      [first.points, next.points],
      [first.travel, next.travel],
    ]) {
      expect(a.byteOffset).toBe(0);
      expect(a.buffer.byteLength).toBe(a.byteLength);
      expect(b.buffer).not.toBe(a.buffer);
    }
    expect(first.points).toEqual(oldPoints);
    expect(first.travel).toEqual(oldTravel);
  });
}
