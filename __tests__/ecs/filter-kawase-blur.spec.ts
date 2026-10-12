import './filter-test-setup';
import {
  parseEffect,
  formatFilter,
  hasRasterPostEffects,
} from '../../packages/ecs/src/utils/filter';
import {
  generateKawaseKernels,
  kawaseBlurUniformValues,
  kawaseKernelsForBlurEffect,
  kawaseBlurPadding,
} from '../../packages/plugin-filter/src/utils/kawase-blur';

describe('Kawase blur', () => {
  it('pads every pass for its bilinear sampling footprint', () => {
    expect(kawaseBlurPadding({ type: 'blur', value: 6, quality: 3 })).toBe(15);
    expect(kawaseBlurPadding({ type: 'blur', value: 0.2, quality: 1 })).toBe(1);
    expect(
      kawaseBlurPadding({
        type: 'blur',
        value: 6,
        quality: 3,
        pixelSize: { x: -2, y: 0.5 },
      }),
    ).toBe(27);
  });

  it('zero blur has neither a sampling offset nor padding', () => {
    const effect = { type: 'blur' as const, value: 0, quality: 3 };
    expect(kawaseBlurPadding(effect)).toBe(0);
    expect(hasRasterPostEffects('blur(0px)')).toBe(false);
    expect(kawaseBlurUniformValues(effect, 0, 100, 50).slice(0, 2)).toEqual([
      0, 0,
    ]);
  });

  it('parses blur(px)', () => {
    expect(parseEffect('blur(12px)')).toEqual([
      {
        type: 'blur',
        value: 12,
        clamp: true,
        quality: 3,
      },
    ]);
  });

  it('round-trips blur via formatFilter', () => {
    const e = parseEffect('blur(8px)');
    expect(formatFilter(e)).toBe('blur(8px)');
  });

  it('parses blur() with defaults', () => {
    expect(parseEffect('blur()')).toEqual([
      {
        type: 'blur',
        value: 4,
        quality: 3,
        clamp: true,
      },
    ]);
  });

  it('round-trips blur quality and clamp', () => {
    const e = parseEffect('blur(12px, 5, 0)');
    expect(e[0]).toMatchObject({
      type: 'blur',
      value: 12,
      quality: 5,
      clamp: false,
    });
    expect(formatFilter(e)).toBe('blur(12px, 5, 0)');
  });

  it('generates descending kernels like Pixi (strength=12, quality=3)', () => {
    expect(generateKawaseKernels(12, 3)).toEqual([12, 8, 4]);
  });

  it('quality=1 yields single kernel', () => {
    expect(generateKawaseKernels(16, 1)).toEqual([16]);
  });

  it('zero strength yields [0]', () => {
    expect(generateKawaseKernels(0, 3)).toEqual([0]);
  });

  it('kawaseBlurUniformValues scales offset by texture size', () => {
    const effect = { type: 'blur' as const, value: 4, quality: 1 };
    const u = kawaseBlurUniformValues(effect, 4, 200, 100);
    expect(u[0]).toBeCloseTo((4.5 * 1) / 200);
    expect(u[1]).toBeCloseTo((4.5 * 1) / 100);
    expect(u[2]).toBe(1);
    expect(u[4]).toBe(0.5 / 200);
    expect(u[5]).toBe(0.5 / 100);
    expect(u[6]).toBe(1 - 0.5 / 200);
    expect(u[7]).toBe(1 - 0.5 / 100);
  });

  it('kawaseKernelsForBlurEffect respects quality on effect', () => {
    const effect = { type: 'blur' as const, value: 9, quality: 3 };
    expect(kawaseKernelsForBlurEffect(effect)).toEqual([9, 6, 3]);
  });
});
