import { compileRepeater } from '../../packages/plugin-lottie/src/repeater';
import { compileNumericProperty } from '../../packages/plugin-lottie/src/numeric-property';
import type { RepeatShape } from '../../packages/plugin-lottie/src/type';

const shape = (patch: Partial<RepeatShape> = {}) =>
  ({
    c: { k: 4 },
    o: { k: 0 },
    m: 1,
    tr: {
      p: { k: [10, 0] },
      a: { k: [0, 0] },
      s: { k: [100, 100] },
      r: { k: 0 },
      so: { k: 100 },
      eo: { k: 40 },
    },
    ...patch,
  } as RepeatShape);

test('fractional counts round up, zero counts hide everything and one copy uses start opacity', () => {
  expect(compileRepeater(shape({ c: { k: 2.25 } })).sample(0)).toHaveLength(3);
  expect(compileRepeater(shape({ c: { k: 0 } })).sample(0)).toEqual([]);
  expect(compileRepeater(shape({ c: { k: -2 } })).sample(0)).toEqual([]);
  expect(compileRepeater(shape({ c: { k: 1 } })).sample(0)[0].opacity).toBe(1);
});

test('fractional offsets interpolate one scale step before successive multiplication', () => {
  const data = shape({ o: { k: 0.5 } });
  data.tr.s = { k: [200, 100] };
  const copies = compileRepeater(data).sample(0);
  expect(copies.map((copy) => copy.outer.x)).toEqual([5, 15, 25, 35]);
  expect(copies.map((copy) => copy.outer.scaleX)).toEqual([1.5, 3, 6, 12]);
});

test('negative offset identity crossings follow the pinned lottie-web renderer', () => {
  const copies = compileRepeater(shape({ o: { k: -1 } })).sample(0);
  expect(copies.map((copy) => copy.outer.x)).toEqual([-10, 0, 0, 10]);
  expect(
    compileRepeater(shape({ o: { k: -0.5 } }))
      .sample(0)
      .map((copy) => copy.outer.x),
  ).toEqual([-5, 5, 15, 25]);
});

test('composite order reverses transform assignment while opacity stays indexed by draw order', () => {
  const forward = compileRepeater(shape()).sample(0);
  const reverse = compileRepeater(shape({ m: 2 })).sample(0);
  expect(reverse.map((copy) => copy.outer.x)).toEqual([30, 20, 10, 0]);
  expect(reverse.map((copy) => copy.opacity)).toEqual(
    forward.map((copy) => copy.opacity),
  );
});

test('rotation and nonuniform scale preserve the repeated anchor', () => {
  const data = shape();
  data.tr.a = { k: [2, 3] };
  data.tr.r = { k: 90 };
  data.tr.s = { k: [200, 50] };
  const { outer, inner } = compileRepeater(data).sample(0)[1];
  const transform = (x: number, y: number) => [
    outer.x +
      outer.scaleX *
        (inner.x + Math.cos(inner.rotation) * x - Math.sin(inner.rotation) * y),
    outer.y +
      outer.scaleY *
        (inner.y + Math.sin(inner.rotation) * x + Math.cos(inner.rotation) * y),
  ];
  expect(transform(2, 3)[0]).toBeCloseTo(12);
  expect(transform(2, 3)[1]).toBeCloseTo(3);
  expect(transform(3, 3)[0]).toBeCloseTo(12);
  expect(transform(3, 3)[1]).toBeCloseTo(3.5);
});

test('copy capacity includes easing overshoot and seeks reuse deterministic sampling', () => {
  const property = {
    a: 1,
    k: [
      { t: 0, s: [0], e: [5], o: { x: 0.3, y: 1.8 }, i: { x: 0.7, y: 1.8 } },
      { t: 60, s: [5] },
    ],
  };
  const repeater = compileRepeater(shape({ c: property }));
  expect(repeater.capacity).toBe(9);
  expect(repeater.sample(30).length).toBeGreaterThan(5);
  expect(repeater.sample(30).length).toBeLessThanOrEqual(repeater.capacity);
  const middle = repeater.sample(30);
  expect(repeater.sample(30)).toBe(middle);
  expect(repeater.sample(60)).toHaveLength(5);
  expect(repeater.sample(0)).toEqual([]);
  expect(
    compileNumericProperty({
      a: 1,
      k: [
        { t: 0, s: [0], h: 1 },
        { t: 60, s: [5] },
      ],
    }).sample(59.99),
  ).toBe(0);
});

test('singular inverse scales hide affected copies without leaking invalid transforms', () => {
  const data = shape({ o: { k: -0.5 } });
  data.tr.s = { k: [-100, 100] };
  const copies = compileRepeater(data).sample(0);
  expect(copies.every((copy) => copy.opacity === 0)).toBe(true);
  expect(
    copies.every((copy) => Object.values(copy.outer).every(Number.isFinite)),
  ).toBe(true);
});
