import {
  createDefaultRainEffect,
  formatFilter,
  parseEffect,
  RAIN_DEFAULTS,
  RAIN_DROP_TEXTURE_DEFAULTS,
  RAINDROPS_SIM_DEFAULTS,
  RAINDROPS_WATER_DEFAULTS,
} from '../../packages/ecs/src/utils/filter';

describe('rain() filter parse / format', () => {
  it('round-trips defaults as Codrops rain()', () => {
    const s = formatFilter([createDefaultRainEffect()]);
    expect(s).toBe('rain()');
    const parsed = parseEffect(s);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      type: 'rain',
      ...RAIN_DROP_TEXTURE_DEFAULTS,
      rainSimScale: 1,
      codropsWater: { ...RAINDROPS_WATER_DEFAULTS },
      codropsSim: { ...RAINDROPS_SIM_DEFAULTS },
    });
  });

  it('parses bare rain() to default drop textures', () => {
    const parsed = parseEffect('rain()');
    expect(parsed[0]).toMatchObject({
      type: 'rain',
      ...RAIN_DROP_TEXTURE_DEFAULTS,
    });
  });

  it('parses partial numeric params', () => {
    const parsed = parseEffect('rain(100, 200, 0.9)');
    expect(parsed).toHaveLength(1);
    const e = parsed[0] as { type: string; minRefraction: number };
    expect(e.type).toBe('rain');
    expect(e.minRefraction).toBe(100);
  });

  it('parses optional Codrops shine url', () => {
    const parsed = parseEffect(
      'rain(url("/c.png"), url("/a.png"), url("/shine.png"), 256, 512)',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      type: 'rain',
      dropColorUrl: '/c.png',
      dropAlphaUrl: '/a.png',
      dropShineUrl: '/shine.png',
    });
  });

  it('round-trips Codrops rain with density tail', () => {
    const W = RAINDROPS_WATER_DEFAULTS;
    const S = RAINDROPS_SIM_DEFAULTS;
    const effect = {
      type: 'rain' as const,
      dropColorUrl: '/drop-color.png',
      dropAlphaUrl: '/drop-alpha.png',
      dropShineUrl: '/drop-shine.png',
      rainSimScale: 1,
      codropsWater: { ...W, renderShine: true },
      codropsSim: {
        rainChance: 0.5,
        rainLimit: 5,
        maxDrops: 1200,
        dropletsRate: 30,
      },
    };
    const s = formatFilter([effect]);
    const parsed = parseEffect(s);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      type: 'rain',
      dropColorUrl: '/drop-color.png',
      dropAlphaUrl: '/drop-alpha.png',
      dropShineUrl: '/drop-shine.png',
      rainSimScale: 1,
      codropsSim: {
        rainChance: 0.5,
        rainLimit: 5,
        maxDrops: 1200,
        dropletsRate: 30,
      },
    });
  });
});
