import type { DrawcallFilterHost, DrawcallPostChain } from './drawcall-host';
import type { FilterBackend, PostProcessingRendererLike } from './backend';
import type { AdjustmentEffect, Effect } from './types';

class NoopDrawcallPostChain implements DrawcallPostChain {
  isReadyForSize(): boolean {
    return false;
  }
  destroy(): void {}
  invalidateEngineTimeCaches(): void {}
  createPostProcessing(
    _effects: Effect[],
    inputTexture: import('@infinite-canvas-tutorial/device-api').Texture,
    _width: number,
    _height: number,
  ): { texture: import('@infinite-canvas-tutorial/device-api').Texture } {
    return { texture: inputTexture };
  }
  renderPostProcessingTextureSpace(
    _width: number,
    _height: number,
  ): {
    resized: boolean;
    texture: import('@infinite-canvas-tutorial/device-api').Texture;
  } {
    throw new Error('Filter plugin not registered');
  }
}

class NoopPostProcessingRenderer implements PostProcessingRendererLike {
  render(): void {}
  destroy(): void {}
}

export const ADJUSTMENT_DEFAULTS = {
  gamma: 1,
  contrast: 1,
  saturation: 1,
  brightness: 1,
  red: 1,
  green: 1,
  blue: 1,
  alpha: 1,
} as const;

export const SATURATE_ADJUSTMENT_SATURATION = 1.25;
export const HALFTONE_DOTS_DEFAULTS = {} as Record<string, unknown>;
export const BLUR_DEFAULTS = { deviation: 3 } as const;
export const LUT_EFFECT_DEFAULTS = { strength: 1 } as const;
export const FLUTED_GLASS_DEFAULTS = {} as Record<string, unknown>;
export const CRT_DEFAULTS = {} as Record<string, unknown>;
export const VIGNETTE_DEFAULTS = {} as Record<string, unknown>;
export const ASCII_DEFAULTS = {} as Record<string, unknown>;
export const GLITCH_DEFAULTS = {} as Record<string, unknown>;
export const LIQUID_GLASS_DEFAULTS = {} as Record<string, unknown>;
export const LIQUID_METAL_DEFAULTS = {} as Record<string, unknown>;
export const LIQUID_METAL_POISSON_STUB_DEFAULTS = {} as Record<string, unknown>;
export const HEATMAP_DEFAULTS = {} as Record<string, unknown>;
export const GEM_SMOKE_DEFAULTS = {} as Record<string, unknown>;
export const TSUNAMI_DEFAULTS = {} as Record<string, unknown>;
export const RAIN_DEFAULTS = {} as Record<string, unknown>;
export const RAIN_DROP_TEXTURE_DEFAULTS = {} as Record<string, unknown>;
export const RAINDROP_FX_RENDER_DEFAULTS = {} as Record<string, unknown>;
export const RAINDROP_FX_COMPOSE_DEFAULTS = {} as Record<string, unknown>;
export const RAINDROP_FX_COMPOSE_DECAY_DEFAULT = 0.96;
export const RAINDROP_FX_SIM_DEFAULTS = {} as Record<string, unknown>;
export const RAINDROP_FX_SIM_DT = 1 / 60;
export const RAINDROPS_WATER_DEFAULTS = {} as Record<string, unknown>;
export const RAINDROPS_SIM_DEFAULTS = {} as Record<string, unknown>;
export const RAIN_DROPDROP_TEXTURE_DEFAULT = '';
export const BURN_DEFAULTS = {} as Record<string, unknown>;

export function parseEffect(_filter: string): Effect[] {
  return [];
}

export function formatFilter(_effects: Effect[]): string {
  return '';
}

export function createDefaultEffect(_kind: string): Effect {
  return { type: 'brightness', value: 0 };
}

export function formatLutFilterSegment(_lutKey: string, _strength: number): string {
  return '';
}

export function filterStringUsesEngineTimeCrt(_filter: string): boolean {
  return false;
}

export function filterStringUsesEngineTimePost(_filter: string): boolean {
  return false;
}

export function filterStringUsesEngineTimeGlitch(_filter: string): boolean {
  return false;
}

export function hasRasterPostEffects(_filterValue: string | undefined): boolean {
  return false;
}

export function filterRasterPostEffects(effects: Effect[]): Effect[] {
  return effects;
}

export function collectRainDropTextureUrlsFromFilterValue(
  _filterValue?: string,
): string[] {
  return [];
}

export function isRainFxEffect(_effect: Effect): boolean {
  return false;
}

export function isRainCodropsRainEffect(_effect: Effect): boolean {
  return false;
}

export function isSaturateOnlyAdjustment(_effect: AdjustmentEffect): boolean {
  return false;
}

export function setPostEffectEngineTimeSeconds(_seconds: number): void {}

export async function preloadRaindropSprites(_urls: string[]): Promise<void> {}

export function createDefaultRainEffect(): Effect {
  return { type: 'rain' };
}

export function rainFxRenderOptionsFromEffect(_effect: Effect): Record<string, unknown> {
  return {};
}

export function raindropSimulatorOptionsForEffect(
  _effect: Effect,
  width: number,
  height: number,
): Record<string, unknown> {
  return { width, height };
}

export function raindropsSimulatorOptionsForEffect(_effect: Effect): Record<string, unknown> {
  return {};
}

export function halftoneDotsUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function flutedGlassUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function tsunamiUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function rainUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function rainCodropsWaterUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function burnUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function crtUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function vignetteUniformValues(_effect: Effect): number[] {
  return [];
}

export function asciiUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function glitchUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function liquidGlassUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function liquidMetalUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function heatmapUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function gemSmokeUniformValues(
  _effect: Effect,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function kawaseKernelsForBlurEffect(_effect: Effect): number[] {
  return [];
}

export function kawaseBlurUniformValues(
  _effect: Effect,
  _kernel: number,
  _tw: number,
  _th: number,
): number[] {
  return [];
}

export function getPostEffectEngineTimeSeconds(): number {
  return 0;
}

export function getRaindropSpriteBitmapIfReady(_url: string): ImageBitmap | undefined {
  return undefined;
}

export async function loadRaindropSpriteCached(_url: string): Promise<ImageBitmap> {
  throw new Error('Filter plugin not registered');
}

export class RaindropSimulator {
  raindrops: unknown[] = [];
  update(_opts: unknown): void {}
}

export const stubFilterBackend: FilterBackend = {
  parseEffect,
  formatFilter,
  hasRasterPostEffects,
  filterRasterPostEffects,
  collectRainDropTextureUrlsFromFilterValue,
  filterStringUsesEngineTimePost,
  filterStringUsesEngineTimeCrt,
  filterStringUsesEngineTimeGlitch,
  isRainFxEffect,
  isRainCodropsRainEffect,
  setPostEffectEngineTimeSeconds,
  preloadRaindropSprites,
  createDrawcallPostChain: (_host: DrawcallFilterHost) => new NoopDrawcallPostChain(),
  createPostProcessingRenderer: () => new NoopPostProcessingRenderer(),
};
