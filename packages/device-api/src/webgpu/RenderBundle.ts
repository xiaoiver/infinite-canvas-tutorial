import { RenderBundle, ResourceType } from '../api';
import { ResourceBase_WebGPU } from './ResourceBase';
import { IDevice_WebGPU } from './interfaces';

/**
 * It works by recording the draw calls during one frame and by replaying this recording for all subsequent frames.
 * So, the scene should be mostly static for this mode to work as expected.
 * @see https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUSnapshotRendering
 */
export class RenderBundle_WebGPU
  extends ResourceBase_WebGPU
  implements RenderBundle
{
  type: ResourceType.RenderBundle = ResourceType.RenderBundle;

  private renderBundleEncoder: GPURenderBundleEncoder;
  renderBundle: GPURenderBundle;

  constructor({ id, device }: { id: number; device: IDevice_WebGPU }) {
    super({ id, device });

    this.renderBundleEncoder = this.device.device.createRenderBundleEncoder({
      colorFormats: [this.device['swapChainFormat']],
    });
  }

  finish() {
    this.renderBundle = this.renderBundleEncoder.finish();
  }
}
