export type BezierPoint = [number, number];
export type BezierControls =
  | [BezierPoint, BezierPoint, BezierPoint]
  | [BezierPoint, BezierPoint, BezierPoint, BezierPoint];

/** Authored cases plus a fixed seed; each call returns independent controls. */
export function bezierControls(): BezierControls[] {
  const cases: BezierControls[] = [
    [
      [0, 0],
      [0, 300],
      [300, -300],
      [300, 0],
    ],
    [
      [0, 0],
      [200, 300],
      [-200, 300],
      [0, 0],
    ],
    [
      [0, 0],
      [300, 0],
      [-300, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [3, 4],
      [6, 8],
      [9, 12],
    ],
    [
      [0, 0],
      [0, 0],
      [9, 12],
      [9, 12],
    ],
    [
      [0, 0],
      [80, 220],
      [300, 0],
    ],
    [
      [0, 0],
      [300, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [9, 12],
    ],
    [
      [-0, -0],
      [-0, 0],
      [0, -0],
      [0, 0],
    ],
    [
      [1e8, -1e8],
      [1e8 + 0.125, -1e8 + 0.25],
      [1e8 - 0.5, -1e8 + 0.125],
      [1e8 + 0.25, -1e8],
    ],
  ];
  let seed = 0x493a71;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32 - 0.5) * 700;
  };
  const point = (): BezierPoint => [random(), random()];
  for (let i = 0; i < 54; i++) {
    cases.push(
      i % 2
        ? [point(), point(), point()]
        : [point(), point(), point(), point()],
    );
  }
  return cases;
}
