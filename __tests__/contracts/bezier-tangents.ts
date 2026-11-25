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
    ['M0 0 C3 4 6 8 9 12', 9],
    ['M0 0 Q3 4 9 12', 6],
  ] as const)(
    'compares each symmetric tangent pair once for %s',
    (d, calls) => {
      const path = curves.parsePath(d).subPaths;
      const acos = jest.spyOn(Math, 'acos');
      try {
        expect(flatten(path, 64, 200)).toEqual([
          [
            [0, 0],
            [9, 12],
          ],
        ]);
        // One limit + all diagonal/upper-triangle pairs + two end checks.
        expect(acos).toHaveBeenCalledTimes(calls);
      } finally {
        acos.mockRestore();
      }
    },
  );

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
        const controls = Object.entries(curve).filter(([key]) =>
          /^v[0-3]$/.test(key),
        );
        expect(controls.length).toBeGreaterThan(0);
        // Parsed controls are typed arrays, which cannot be frozen. Curves also
        // accept ordinary vec2 arrays; freeze those to catch accidental writes.
        for (const [key, value] of controls) {
          Object.defineProperty(curve, key, {
            value: Object.freeze(Array.from(value as ArrayLike<number>)),
            writable: false,
          });
        }
      }
      const before = JSON.stringify(path);
      expect(flatten(path, 64, 200)).toEqual([expected]);
      expect(JSON.stringify(path)).toBe(before);
    },
  );
}
