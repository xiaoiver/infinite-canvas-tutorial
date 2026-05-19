import {
  ellipsePerimeter,
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

  it('handles wrapped segments when end < start', () => {
    const { dasharray } = lottieTrimToStrokeDash(P, 80, 20, 0);
    expect(dasharray[0]).toBeCloseTo(40, 5);
    expect(dasharray[1]).toBeCloseTo(60, 5);
  });
});

describe('ellipsePerimeter', () => {
  it('approximates a circle', () => {
    const p = ellipsePerimeter(50, 50);
    expect(p).toBeGreaterThan(2 * Math.PI * 49);
    expect(p).toBeLessThan(2 * Math.PI * 51);
  });
});
