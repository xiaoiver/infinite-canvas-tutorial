interface Packing {
  appendStrokeInstances(
    points: readonly number[],
    travel: readonly number[],
    transform: readonly [number, number, number],
    stride: number,
    packed: number[],
    packedTravel: number[],
  ): void;
}
export function strokePackingContract(packing: Packing, stride: number) {
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
    const packed: number[] = [],
      distances: number[] = [];
    packing.appendStrokeInstances(
      first,
      travel,
      [100, -40, 0.25],
      stride,
      packed,
      distances,
    );
    packing.appendStrokeInstances(
      second,
      stride === 1 ? [0] : [0, 5, 6],
      [-3, 5, 0.75],
      stride,
      packed,
      distances,
    );
    expect(packed).toEqual([
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
    expect(distances).toEqual([...travel, ...(stride === 1 ? [0] : [0, 5, 6])]);
    // A short/empty subpath contributes no native row and cannot bridge its neighbours.
    packing.appendStrokeInstances(
      [0, 0, 0, 1, 1, 0],
      [],
      [0, 0, 0],
      stride,
      packed,
      distances,
    );
    expect(packed).toHaveLength(45);
    expect(distances).toHaveLength(3 * stride);
  });
}
