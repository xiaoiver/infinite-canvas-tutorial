import {
  normalizeLinearGradientStops,
  parseGradient,
  sampleLinearGradientPremultiplied,
} from '../../packages/ecs/src/utils/gradient';

describe('Linear gradient premultiplied sampling', () => {
  it('does not gray out between transparent and white (MDN background top layer)', () => {
    const layers = parseGradient(
      'linear-gradient(to right, black 0%, transparent 50%, white 100%)',
    );
    expect(layers).toBeDefined();
    const stops = normalizeLinearGradientStops(layers![0]!.steps);
    const midRight = sampleLinearGradientPremultiplied(stops, 0.75);
    expect(midRight.r).toBeGreaterThan(0.85);
    expect(midRight.g).toBeGreaterThan(0.85);
    expect(midRight.b).toBeGreaterThan(0.85);
    expect(midRight.a).toBeGreaterThan(0.25);
    expect(midRight.a).toBeLessThan(0.85);
  });
});
