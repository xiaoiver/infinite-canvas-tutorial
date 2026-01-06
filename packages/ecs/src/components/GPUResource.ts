import { Device, SwapChain } from '@antv/g-device-api';
import { field } from '@lastolivegames/becsy';
import { RenderCache } from '../utils';
import { TexturePool } from '../resources';
import { RenderGraph } from '../render-graph/RenderGraph';

export class GPUResource {
  @field.object declare device: Device;
  @field.object declare swapChain: SwapChain;
  @field.object declare renderCache: RenderCache;
  @field.object declare renderGraph: RenderGraph;
  @field.object declare texturePool: TexturePool;

  constructor(value?: Partial<GPUResource>) {
    Object.assign(this, value);
  }
}
