import type {
  Device,
  Sampler,
  SwapChain,
} from '@infinite-canvas-tutorial/device-api';
import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import type { TexturePool } from '../resources';
import type { RenderCache } from '../utils/render-cache';

/** Host surface {@link DrawcallPostChain} reads from (implemented by {@link Drawcall}). */
export interface DrawcallFilterHost {
  readonly device: Device;
  readonly swapChain: SwapChain;
  readonly renderCache: RenderCache;
  readonly texturePool: TexturePool;
  readonly api: API;
  readonly instanced: boolean;
  readonly shapes: Entity[];
  geometryDirty: boolean;
  materialDirty: boolean;
  readonly sceneZoomScale: number;
  readonly useFillImage: boolean;
  readonly useRasterFilterEngineTimeRefresh: boolean;
  createSampler(): Sampler;
  createLutSampler(): Sampler;
  createLutPassInputSampler(): Sampler;
}

export interface DrawcallPostChain {
  isReadyForSize(width: number, height: number): boolean;
  destroy(): void;
  invalidateEngineTimeCaches(): void;
  syncEffects(effects: import('./types').Effect[]): boolean;
  createPostProcessing(
    effects: import('./types').Effect[],
    inputTexture: import('@infinite-canvas-tutorial/device-api').Texture,
    width: number,
    height: number,
  ): { texture: import('@infinite-canvas-tutorial/device-api').Texture };
  renderPostProcessingTextureSpace(
    width: number,
    height: number,
  ): { resized: boolean; texture: import('@infinite-canvas-tutorial/device-api').Texture };
}
