export * from './types';
export {
  registerFilterBackend,
  getFilterBackend,
  requireFilterBackend,
  type FilterBackend,
  type PostProcessingRendererLike,
} from './backend';
export type { DrawcallFilterHost, DrawcallPostChain } from './drawcall-host';

import type { FilterBackend } from './backend';
import { getFilterBackend } from './backend';
import * as stubs from './stubs';

function resolve(): FilterBackend {
  return getFilterBackend() ?? stubs.stubFilterBackend;
}

function delegate<T extends (...args: never[]) => unknown>(name: string): T {
  return ((...args: unknown[]) => {
    const fn = resolve()[name];
    if (typeof fn !== 'function') {
      throw new Error(`Filter backend missing ${name}`);
    }
    return fn(...args);
  }) as T;
}

export const parseEffect = delegate<typeof stubs.parseEffect>('parseEffect');
export const formatFilter = delegate<typeof stubs.formatFilter>('formatFilter');
export const createDefaultEffect = delegate<typeof stubs.createDefaultEffect>('createDefaultEffect');
export const formatLutFilterSegment = delegate<typeof stubs.formatLutFilterSegment>('formatLutFilterSegment');
export const filterStringUsesEngineTimeCrt = delegate<typeof stubs.filterStringUsesEngineTimeCrt>('filterStringUsesEngineTimeCrt');
export const filterStringUsesEngineTimePost = delegate<typeof stubs.filterStringUsesEngineTimePost>('filterStringUsesEngineTimePost');
export const filterStringUsesEngineTimeGlitch = delegate<typeof stubs.filterStringUsesEngineTimeGlitch>('filterStringUsesEngineTimeGlitch');
export const hasRasterPostEffects = delegate<typeof stubs.hasRasterPostEffects>('hasRasterPostEffects');
export const filterRasterPostEffects = delegate<typeof stubs.filterRasterPostEffects>('filterRasterPostEffects');
export const collectRainDropTextureUrlsFromFilterValue = delegate<typeof stubs.collectRainDropTextureUrlsFromFilterValue>('collectRainDropTextureUrlsFromFilterValue');
export const isRainFxEffect = delegate<typeof stubs.isRainFxEffect>('isRainFxEffect');
export const isRainCodropsRainEffect = delegate<typeof stubs.isRainCodropsRainEffect>('isRainCodropsRainEffect');
export const isSaturateOnlyAdjustment = delegate<typeof stubs.isSaturateOnlyAdjustment>('isSaturateOnlyAdjustment');
export const setPostEffectEngineTimeSeconds = delegate<typeof stubs.setPostEffectEngineTimeSeconds>('setPostEffectEngineTimeSeconds');
export const preloadRaindropSprites = delegate<typeof stubs.preloadRaindropSprites>('preloadRaindropSprites');
export const createDefaultRainEffect = delegate<typeof stubs.createDefaultRainEffect>('createDefaultRainEffect');
export const rainFxRenderOptionsFromEffect = delegate<typeof stubs.rainFxRenderOptionsFromEffect>('rainFxRenderOptionsFromEffect');
export const raindropSimulatorOptionsForEffect = delegate<typeof stubs.raindropSimulatorOptionsForEffect>('raindropSimulatorOptionsForEffect');
export const raindropsSimulatorOptionsForEffect = delegate<typeof stubs.raindropsSimulatorOptionsForEffect>('raindropsSimulatorOptionsForEffect');
export const halftoneDotsUniformValues = delegate<typeof stubs.halftoneDotsUniformValues>('halftoneDotsUniformValues');
export const flutedGlassUniformValues = delegate<typeof stubs.flutedGlassUniformValues>('flutedGlassUniformValues');
export const tsunamiUniformValues = delegate<typeof stubs.tsunamiUniformValues>('tsunamiUniformValues');
export const rainUniformValues = delegate<typeof stubs.rainUniformValues>('rainUniformValues');
export const rainCodropsWaterUniformValues = delegate<typeof stubs.rainCodropsWaterUniformValues>('rainCodropsWaterUniformValues');
export const burnUniformValues = delegate<typeof stubs.burnUniformValues>('burnUniformValues');
export const crtUniformValues = delegate<typeof stubs.crtUniformValues>('crtUniformValues');
export const vignetteUniformValues = delegate<typeof stubs.vignetteUniformValues>('vignetteUniformValues');
export const asciiUniformValues = delegate<typeof stubs.asciiUniformValues>('asciiUniformValues');
export const glitchUniformValues = delegate<typeof stubs.glitchUniformValues>('glitchUniformValues');
export const liquidGlassUniformValues = delegate<typeof stubs.liquidGlassUniformValues>('liquidGlassUniformValues');
export const liquidMetalUniformValues = delegate<typeof stubs.liquidMetalUniformValues>('liquidMetalUniformValues');
export const heatmapUniformValues = delegate<typeof stubs.heatmapUniformValues>('heatmapUniformValues');
export const gemSmokeUniformValues = delegate<typeof stubs.gemSmokeUniformValues>('gemSmokeUniformValues');
export const kawaseKernelsForBlurEffect = delegate<typeof stubs.kawaseKernelsForBlurEffect>('kawaseKernelsForBlurEffect');
export const kawaseBlurUniformValues = delegate<typeof stubs.kawaseBlurUniformValues>('kawaseBlurUniformValues');
export const getPostEffectEngineTimeSeconds = delegate<typeof stubs.getPostEffectEngineTimeSeconds>('getPostEffectEngineTimeSeconds');
export const getRaindropSpriteBitmapIfReady = delegate<typeof stubs.getRaindropSpriteBitmapIfReady>('getRaindropSpriteBitmapIfReady');
export const loadRaindropSpriteCached = delegate<typeof stubs.loadRaindropSpriteCached>('loadRaindropSpriteCached');

export {
  RAINDROP_FX_RENDER_DEFAULTS,
  RAINDROP_FX_COMPOSE_DEFAULTS,
  RAINDROP_FX_COMPOSE_DECAY_DEFAULT,
  RAINDROP_FX_SIM_DEFAULTS,
  RAINDROP_FX_SIM_DT,
  RAIN_DROPDROP_TEXTURE_DEFAULT,
} from './filter-defaults';

export {
  ADJUSTMENT_DEFAULTS,
  SATURATE_ADJUSTMENT_SATURATION,
  HALFTONE_DOTS_DEFAULTS,
  BLUR_DEFAULTS,
  LUT_EFFECT_DEFAULTS,
  FLUTED_GLASS_DEFAULTS,
  CRT_DEFAULTS,
  VIGNETTE_DEFAULTS,
  ASCII_DEFAULTS,
  GLITCH_DEFAULTS,
  LIQUID_GLASS_DEFAULTS,
  LIQUID_METAL_DEFAULTS,
  HEATMAP_DEFAULTS,
  GEM_SMOKE_DEFAULTS,
  TSUNAMI_DEFAULTS,
  RAIN_DEFAULTS,
  RAIN_DROP_TEXTURE_DEFAULTS,
  RAINDROPS_WATER_DEFAULTS,
  RAINDROPS_SIM_DEFAULTS,
  BURN_DEFAULTS,
  RaindropSimulator,
} from './stubs';

export function createPostProcessingRenderer(
  device: import('@infinite-canvas-tutorial/device-api').Device,
  swapChain: import('@infinite-canvas-tutorial/device-api').SwapChain,
  renderCache: import('../utils/render-cache').RenderCache,
): import('./backend').PostProcessingRendererLike {
  return resolve().createPostProcessingRenderer(device, swapChain, renderCache) as import('./backend').PostProcessingRendererLike;
}

export function createDrawcallPostChain(
  host: import('./drawcall-host').DrawcallFilterHost,
): import('./drawcall-host').DrawcallPostChain {
  return resolve().createDrawcallPostChain(host) as import('./drawcall-host').DrawcallPostChain;
}
