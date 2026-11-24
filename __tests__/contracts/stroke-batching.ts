interface Packing {
  LocalStrokeGeometryCache: new () => {
    get(level: object, cap: string, join: string, create: () => {pointsBuffer: number[]; travelBuffer: number[]}): {pointsBuffer: ArrayLike<number>; travelBuffer: ArrayLike<number>};
  };
  appendStrokeInstances(
    points: ArrayLike<number>,
    travel: ArrayLike<number>,
    transform: readonly [number, number, number],
    stride: number,
    packed: number[],
    packedTravel: number[],
  ): void;
}
export function strokePackingContract(packing: Packing, stride: number) {
  it('retains the exact final GPU bytes when cached local inputs use Float32 storage', () => {
    const points = [Math.PI, Math.E, 32, 1 / 3, 1e-7, 12, 100000.001, -2 / 3, 8, 7, 8, 16, 9, 10, 0];
    const travel = stride === 1 ? [0.1, Math.PI] : [0.1, Math.PI, 1 / 3, 100000.1, -2 / 3, 0];
    const cache = new packing.LocalStrokeGeometryCache();
    const cached = cache.get(points, 'round', 'miter', () => ({pointsBuffer: points, travelBuffer: travel}));
    expect(cached.pointsBuffer).not.toBeInstanceOf(Float32Array);
    const admitted = cache.get(points, 'round', 'miter', () => ({pointsBuffer: points, travelBuffer: travel}));
    expect(admitted.pointsBuffer).toBeInstanceOf(Float32Array);
    expect(cache.get(points, 'round', 'miter', () => { throw new Error('warm level rebuilt'); })).toBe(admitted);
    const pack = (p: ArrayLike<number>, t: ArrayLike<number>) => {
      const vertices: number[] = [], distances: number[] = [];
      packing.appendStrokeInstances(p, t, [100000 + 1 / 3, -50.1, 0.25], stride, vertices, distances);
      return [new Float32Array(vertices), new Float32Array(distances)].map(a => new Uint8Array(a.buffer));
    };
    expect(pack(admitted.pointsBuffer, admitted.travelBuffer)).toEqual(pack(points, travel));
  });
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
