import { toCSSMixBlendMode } from '../../packages/ecs/src/utils/blend-mode';
import type { FillLayerBlendMode } from '../../packages/ecs/src/types/fill-layer-blend';

describe('toCSSMixBlendMode', () => {
  it('returns null for undefined / normal (no style needed)', () => {
    expect(toCSSMixBlendMode(undefined)).toBeNull();
    expect(toCSSMixBlendMode('normal')).toBeNull();
  });

  it('maps modes with a direct CSS keyword', () => {
    const cases: Array<[FillLayerBlendMode, string]> = [
      ['darken', 'darken'],
      ['multiply', 'multiply'],
      ['colorBurn', 'color-burn'],
      ['light', 'lighten'],
      ['screen', 'screen'],
      ['colorDodge', 'color-dodge'],
      ['overlay', 'overlay'],
      ['softLight', 'soft-light'],
      ['hardLight', 'hard-light'],
      ['difference', 'difference'],
      ['exclusion', 'exclusion'],
      ['hue', 'hue'],
      ['saturation', 'saturation'],
      ['color', 'color'],
      ['luminosity', 'luminosity'],
    ];
    for (const [mode, css] of cases) {
      expect(toCSSMixBlendMode(mode)).toBe(css);
    }
  });

  it('returns null for modes without a standard CSS equivalent', () => {
    expect(toCSSMixBlendMode('linearBurn')).toBeNull();
    expect(toCSSMixBlendMode('linearDodge')).toBeNull();
  });
});
