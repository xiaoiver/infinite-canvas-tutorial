import { compilePolyStar } from '../../packages/plugin-lottie/src/polystar';
import type { PolyStarShape } from '../../packages/plugin-lottie/src/type';

const shape = (patch: Partial<PolyStarShape> = {}) =>
  ({
    sy: 1,
    pt: { k: 4 },
    p: { k: [0, 0] },
    r: { k: 0 },
    or: { k: 20 },
    os: { k: 0 },
    ir: { k: 10 },
    is: { k: 0 },
    ...patch,
  } as PolyStarShape);

test('star rotation interpolates parameters without shrinking radii, preserving holds and legacy end values', () => {
  const geometry = compilePolyStar(
    shape({
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [180] },
          { t: 20, s: [180], h: 1 },
          { t: 30, s: [270], e: [360] },
          { t: 40 } as any,
        ],
      },
    }),
  );
  expect(geometry.animated).toBe(true);
  expect(geometry.sample(10).v[0][0]).toBeCloseTo(20);
  expect(geometry.sample(10).v[0][1]).toBeCloseTo(0);
  expect(geometry.sample(29.99).v[0][1]).toBeCloseTo(20);
  expect(geometry.sample(30).v[0][0]).toBeCloseTo(-20);
  expect(geometry.sample(40).v[0][1]).toBeCloseTo(-20);
  expect(geometry.sample(-10).v[0][1]).toBeCloseTo(-20);
});

test('point-count changes use lottie-web integer topology at the exact transition and after reverse seeks', () => {
  const geometry = compilePolyStar(
    shape({
      pt: {
        a: 1,
        k: [
          { t: 0, s: [4] },
          { t: 20, s: [6] },
        ],
      },
    }),
  );
  expect(geometry.sample(9.99).v).toHaveLength(8);
  expect(geometry.sample(10).v).toHaveLength(10);
  expect(geometry.sample(20).v).toHaveLength(12);
  expect(geometry.sample(0).v).toHaveLength(8);
  expect(
    compilePolyStar(shape({ sy: 2, pt: { k: 6.9 } })).sample(0).v,
  ).toHaveLength(6);
});

test('zero radii and zero points generate finite geometry, and unchanged parameters reuse geometry', () => {
  const geometry = compilePolyStar(
    shape({ or: { k: 0 }, ir: { k: 0 }, os: { k: 100 }, is: { k: 100 } }),
  );
  const path = geometry.sample(0);
  expect(
    [...path.v, ...path.in, ...path.out].flat().every(Number.isFinite),
  ).toBe(true);
  expect(geometry.sample(60)).toBe(path);
  expect(compilePolyStar(shape({ pt: { k: 0 } })).sample(0).v).toEqual([]);
});
