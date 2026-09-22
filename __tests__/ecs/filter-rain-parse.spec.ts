import './filter-test-setup';
import {
  collectRainDropTextureUrlsFromFilterValue,
  createDefaultRainEffect,
  formatFilter,
  parseEffect,
  RAIN_DROPDROP_TEXTURE_DEFAULT,
  RAINDROP_FX_COMPOSE_DECAY_DEFAULT,
  RAINDROP_FX_RENDER_DEFAULTS,
} from '../../packages/ecs/src/utils/filter';

describe('rain() filter parse / format', () => {
  it('round-trips default raindrop-fx rain()', () => {
    const s = formatFilter([createDefaultRainEffect()]);
    expect(s).toBe('rain()');
    const parsed = parseEffect(s);
    expect(parsed).toEqual([
      { type: 'rain', dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT },
    ]);
  });

  it('parses rain(url("…")) for custom sprite', () => {
    const parsed = parseEffect('rain(url("/custom-raindrop.png"))');
    expect(parsed).toEqual([
      { type: 'rain', dropTextureUrl: '/custom-raindrop.png' },
    ]);
  });

  it('collectRainDropTextureUrlsFromFilterValue includes fx sprite', () => {
    expect(collectRainDropTextureUrlsFromFilterValue('rain()')).toEqual([
      RAIN_DROPDROP_TEXTURE_DEFAULT,
    ]);
    expect(
      collectRainDropTextureUrlsFromFilterValue('rain(url("/x.png"))'),
    ).toEqual(['/x.png']);
  });

  it('round-trips raindrop-fx numeric tail', () => {
    const R = RAINDROP_FX_RENDER_DEFAULTS;
    const effect = {
      type: 'rain' as const,
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      rainFx: {
        backgroundBlurSteps: 4,
        mist: false,
        dropletsPerSecond: 400,
        composeDecay: 0.97,
        raindropCompose: 'harder' as const,
      },
    };
    const s = formatFilter([effect]);
    expect(s).toContain('rain(');
    const parsed = parseEffect(s)[0]!;
    expect(parsed.type).toBe('rain');
    expect(parsed).toMatchObject({
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      rainFx: expect.objectContaining({
        backgroundBlurSteps: 4,
        mist: false,
        dropletsPerSecond: 400,
        composeDecay: 0.97,
        raindropCompose: 'harder',
      }),
    });
    expect(R.backgroundBlurSteps).toBe(3);
    expect(RAINDROP_FX_COMPOSE_DECAY_DEFAULT).toBe(1);
  });

  it('round-trips lighting and rainFxSim in numeric tail', () => {
    const effect = {
      type: 'rain' as const,
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      rainFx: {
        raindropLightBump: 1.5,
        raindropShadowOffset: 1.1,
      },
      rainFxSim: {
        gravity: 1800,
        trailSpread: 0.45,
      },
    };
    const s = formatFilter([effect]);
    const parsed = parseEffect(s)[0]!;
    expect(parsed).toMatchObject({
      type: 'rain',
      rainFx: expect.objectContaining({
        raindropLightBump: 1.5,
        raindropShadowOffset: 1.1,
      }),
      rainFxSim: expect.objectContaining({
        gravity: 1800,
        trailSpread: 0.45,
      }),
    });
  });

  it('round-trips xShifting and slipRate in rainFxSim tail', () => {
    const effect = {
      type: 'rain' as const,
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      rainFxSim: {
        xShifting: [0.05, 0.25] as [number, number],
        slipRate: 0.2,
      },
    };
    const s = formatFilter([effect]);
    const parsed = parseEffect(s)[0]!;
    expect(parsed).toMatchObject({
      type: 'rain',
      rainFxSim: {
        xShifting: [0.05, 0.25],
        slipRate: 0.2,
      },
    });
  });

  it('round-trips mistColor and raindropEraserSize in numeric tail', () => {
    const effect = {
      type: 'rain' as const,
      dropTextureUrl: RAIN_DROPDROP_TEXTURE_DEFAULT,
      rainFx: {
        mistColor: [0.02, 0.03, 0.04, 0.9] as [number, number, number, number],
        raindropEraserSize: [0.91, 0.98] as [number, number],
      },
    };
    const s = formatFilter([effect]);
    const parsed = parseEffect(s)[0]!;
    expect(parsed).toMatchObject({
      type: 'rain',
      rainFx: expect.objectContaining({
        mistColor: [0.02, 0.03, 0.04, 0.9],
        raindropEraserSize: [0.91, 0.98],
      }),
    });
  });
});
