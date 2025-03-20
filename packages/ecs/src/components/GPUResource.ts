import { Device, RenderTarget, SwapChain } from '@antv/g-device-api';
import { field } from '@lastolivegames/becsy';
import { RenderCache } from '../utils';
import { TexturePool } from '../resources';

export class GPUResource {
  @field.object declare device: Device;
  @field.object declare swapChain: SwapChain;
  @field.object declare renderTarget: RenderTarget;
  @field.object declare depthRenderTarget: RenderTarget;
  @field.object declare renderCache: RenderCache;
  @field.object declare texturePool: TexturePool;

  constructor(value?: Partial<GPUResource>) {
    Object.assign(this, value);
  }
}
