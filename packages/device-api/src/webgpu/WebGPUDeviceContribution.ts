import init, {
  glsl_compile,
  WGSLComposer,
} from '../../../../rust/glsl-wgsl-compiler/pkg/glsl_wgsl_compiler';
import { DeviceContribution } from '../api';
import { Device_WebGPU } from './Device';

export interface WebGPUDeviceOptions {
  shaderCompilerPath: string;
  xrCompatible: boolean;
  onContextLost: () => void;
}

export class WebGPUDeviceContribution implements DeviceContribution {
  constructor(private pluginOptions: Partial<WebGPUDeviceOptions>) { }

  async createSwapChain($canvas: HTMLCanvasElement) {
    // eslint-disable-next-line
    if ((globalThis.navigator as any).gpu === undefined) return null;

    let adapter = null;
    try {
      const { xrCompatible } = this.pluginOptions;
      // eslint-disable-next-line
      adapter = await (globalThis.navigator as any).gpu.requestAdapter({
        xrCompatible,
      });
    } catch (e) {
      console.log(e);
    }

    if (adapter === null) return null;

    // @see https://www.w3.org/TR/webgpu/#dom-gpudevicedescriptor-requiredfeatures
    const optionalFeatures: GPUFeatureName[] = [
      // 'depth24unorm-stencil8',
      'depth32float-stencil8',
      'texture-compression-bc',
      'float32-filterable',
    ];
    const requiredFeatures = optionalFeatures.filter((feature) =>
      adapter.features.has(feature),
    );
    const device = await adapter.requestDevice({ requiredFeatures });

    if (device) {
      // @see https://github.com/gpuweb/gpuweb/blob/main/design/ErrorHandling.md#fatal-errors-requestadapter-requestdevice-and-devicelost
      const { onContextLost } = this.pluginOptions;
      device.lost.then(() => {
        if (onContextLost) {
          onContextLost();
        }
      });
    }

    if (device === null) return null;

    const context = $canvas.getContext('webgpu');

    if (!context) return null;

    try {
      await init(this.pluginOptions.shaderCompilerPath);
    } catch (e) { }

    return new Device_WebGPU(
      adapter,
      device,
      $canvas,
      context,
      glsl_compile,
      WGSLComposer && new WGSLComposer(),
    );
  }
}
