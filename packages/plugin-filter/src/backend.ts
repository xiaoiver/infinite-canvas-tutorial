import type { FilterBackend } from '@infinite-canvas-tutorial/ecs';
import * as filter from './filter';
import { DrawcallPostChain } from './drawcall-post-chain';
import { PostProcessingRenderer } from './PostProcessingRenderer';
import { setPostEffectEngineTimeSeconds } from './utils/postEffectEngineTime';
import { preloadRaindropSprites } from './utils/raindrop-sim/raindrop-sprite-cache';

export function createFilterBackend(): FilterBackend {
  return {
    ...filter,
    setPostEffectEngineTimeSeconds,
    preloadRaindropSprites,
    createDrawcallPostChain: (host) => new DrawcallPostChain(host),
    createPostProcessingRenderer: (device, swapChain, renderCache) =>
      new PostProcessingRenderer(device, swapChain, renderCache),
  } as unknown as FilterBackend;
}
