import {
  ellipsePerimeter,
  getShapePerimeter,
  hasLottieTrim,
  lottieTrimToStrokeDash,
} from '../../packages/plugin-lottie/src/trim-paths';

describe('lottieTrimToStrokeDash', () => {
  const P = 100;

  it('maps start/end percentages to dash and offset', () => {
    const { dasharray, dashoffset } = lottieTrimToStrokeDash(P, 21, 100, 0);
    expect(dasharray[0]).toBeCloseTo(79, 5);
    expect(dasharray[1]).toBeCloseTo(21, 5);
    expect(dashoffset).toBeCloseTo(-21, 5);
  });

  it('applies trim offset along the path', () => {
    const base = lottieTrimToStrokeDash(P, 21, 100, 0);
    const shifted = lottieTrimToStrokeDash(P, 21, 100, -46.8);
    expect(shifted.dasharray[0]).toBeCloseTo(base.dasharray[0], 5);
    expect(shifted.dashoffset).not.toBeCloseTo(base.dashoffset, 5);
  });

  it('sorts reversed endpoints like lottie-web', () => {
    const { dasharray } = lottieTrimToStrokeDash(P, 80, 20, 0);
    expect(dasharray[0]).toBeCloseTo(60, 5);
    expect(dasharray[1]).toBeCloseTo(40, 5);
  });
});

describe('ellipsePerimeter', () => {
  it('approximates a circle', () => {
    const p = ellipsePerimeter(50, 50);
    expect(p).toBeGreaterThan(2 * Math.PI * 49);
    expect(p).toBeLessThan(2 * Math.PI * 51);
  });
});

test.each([0, 45, -90, 720])('full coverage survives offset %s', (offset) => {
  expect(lottieTrimToStrokeDash(100, 0, 100, offset)).toEqual({
    dasharray: [100, 0],
    dashoffset: 0,
  });
});
test('empty, clamped, invalid and wrapped trims remain finite', () => {
  expect(lottieTrimToStrokeDash(100, 30, 30, 90).dasharray).toEqual([0, 100]);
  expect(lottieTrimToStrokeDash(100, -50, 200).dasharray).toEqual([100, 0]);
  expect(lottieTrimToStrokeDash(100, NaN, Infinity, NaN).dasharray).toEqual([
    100, 0,
  ]);
  expect(lottieTrimToStrokeDash(0, 20, 80).dasharray).toEqual([0, 0]);
  const wrapped = lottieTrimToStrokeDash(100, 20, 80, 180);
  expect(wrapped.dasharray[0]).toBeCloseTo(60);
  expect(wrapped.dashoffset).toBeCloseTo(-70);
});
test('full-trim keyframes remain detectable and rounded rect perimeter includes arcs', () => {
  expect(hasLottieTrim({ trimStart: 0, trimEnd: 100 })).toBe(true);
  expect(hasLottieTrim({})).toBe(false);
  expect(
    getShapePerimeter('rect', { width: 100, height: 50, r: 10 }),
  ).toBeCloseTo(220 + 20 * Math.PI);
  expect(getShapePerimeter('path', {}, 'M0 0L100 0')).toBeCloseTo(100);
});
