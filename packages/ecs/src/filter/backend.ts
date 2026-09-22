import type { Device, SwapChain } from '@infinite-canvas-tutorial/device-api';
import type { RenderCache } from '../utils/render-cache';
import type { DrawcallFilterHost, DrawcallPostChain } from './drawcall-host';
import type { Effect } from './types';

export interface PostProcessingRendererLike {
  render(
    renderPass: import('@infinite-canvas-tutorial/device-api').RenderPass,
    texture: import('@infinite-canvas-tutorial/device-api').Texture,
    effect: Effect,
  ): void;
  destroy(): void;
}

export interface FilterBackend {
  parseEffect(filter: string): Effect[];
  formatFilter(effects: Effect[]): string;
  hasRasterPostEffects(filterValue: string | undefined): boolean;
  filterRasterPostEffects(effects: Effect[]): Effect[];
  collectRainDropTextureUrlsFromFilterValue(filterValue?: string): string[];
  filterStringUsesEngineTimePost(filter: string): boolean;
  filterStringUsesEngineTimeCrt(filter: string): boolean;
  filterStringUsesEngineTimeGlitch(filter: string): boolean;
  isRainFxEffect(effect: Effect): boolean;
  isRainCodropsRainEffect(effect: Effect): boolean;
  setPostEffectEngineTimeSeconds(seconds: number): void;
  preloadRaindropSprites(urls: string[]): Promise<void>;
  createDrawcallPostChain(host: DrawcallFilterHost): DrawcallPostChain;
  createPostProcessingRenderer(
    device: Device,
    swapChain: SwapChain,
    renderCache: RenderCache,
  ): PostProcessingRendererLike;
  [key: string]: unknown;
}

let registered: FilterBackend | null = null;

export function registerFilterBackend(backend: FilterBackend): void {
  registered = backend;
}

export function getFilterBackend(): FilterBackend | null {
  return registered;
}

export function requireFilterBackend(): FilterBackend {
  if (!registered) {
    throw new Error(
      'Filter plugin not registered. Import and add FilterPlugin from @infinite-canvas-tutorial/filter.',
    );
  }
  return registered;
}
