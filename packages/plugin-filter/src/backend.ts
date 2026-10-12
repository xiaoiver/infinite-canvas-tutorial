import type { FilterBackend } from '@infinite-canvas-tutorial/ecs';
import * as filter from './filter';
import { DrawcallPostChain } from './drawcall-post-chain';
import { PostProcessingRenderer } from './PostProcessingRenderer';
import { setPostEffectEngineTimeSeconds } from './utils/postEffectEngineTime';
import { preloadRaindropSprites } from './utils/raindrop-sim/raindrop-sprite-cache';
import { kawaseBlurPadding } from './utils/kawase-blur';

export function createFilterBackend(): FilterBackend {
  return {
    ...filter,
    getRasterFilterPadding: (value?: string) =>
      filter
        .parseEffect(value ?? '')
        .reduce(
          (padding, effect) =>
            padding + (effect.type === 'blur' ? kawaseBlurPadding(effect) : 0),
          0,
        ),
    setPostEffectEngineTimeSeconds,
    preloadRaindropSprites,
    createDrawcallPostChain: (host) => new DrawcallPostChain(host),
    createPostProcessingRenderer: (device, swapChain, renderCache) =>
      new PostProcessingRenderer(device, swapChain, renderCache),
  } as unknown as FilterBackend;
}
