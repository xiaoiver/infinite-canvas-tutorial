export function bezierTangentContract<Paths extends { curves: object[] }[]>(
  curves: { parsePath: (d: string) => { subPaths: Paths } },
  flatten: (
    subPaths: Paths,
    scale: number,
    strokeRadius?: number,
  ) => number[][][],
) {
  it('reuses tangent lengths while preserving straight stroke endpoints', () => {
    const path = curves.parsePath('M0 0 C3 4 6 8 9 12').subPaths;
    const hypot = jest.spyOn(Math, 'hypot');
    try {
      const points = flatten(path, 64, 200);
      // Four control distances, three edge lengths, one chord and one seam.
      // Recomputing lengths for every pair takes 27 calls for this same span.
      expect(hypot.mock.calls.length).toBeLessThanOrEqual(9);
      expect(points).toEqual([
        [
          [0, 0],
          [9, 12],
        ],
      ]);
    } finally {
      hypot.mockRestore();
    }
  });

  it.each([
    [
      'M0 0 Q0 0 9 12',
      [
        [0, 0],
        [9, 12],
      ],
    ],
    [
      'M0 0 C0 0 9 12 9 12',
      [
        [0, 0],
        [9, 12],
      ],
    ],
    ['M0 0 C0 0 0 0 0 0', [[0, 0]]],
  ])(
    'handles repeated controls without changing authored data: %s',
    (d, expected) => {
      const path = curves.parsePath(d as string).subPaths;
      for (const curve of path[0].curves) {
        const controls = Object.values(curve).filter(Array.isArray);
        controls.forEach(Object.freeze);
      }
      const before = JSON.stringify(path);
      expect(flatten(path, 64, 200)).toEqual([expected]);
      expect(JSON.stringify(path)).toBe(before);
    },
  );
}
