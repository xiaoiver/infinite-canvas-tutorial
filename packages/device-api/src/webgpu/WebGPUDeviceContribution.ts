import init, {
  glsl_compile,
  WGSLComposer,
} from '../../../../rust/glsl-wgsl-compiler/pkg/glsl_wgsl_compiler';
import { DeviceContribution } from '../api';
import { Device_WebGPU } from './Device';

/**
 * 浏览器内只允许把属于**同一原生 `GPUDevice`** 的纹理绑到该设备上的管线。
 * `SetupDevice` 会为可见画布各建一个 `SwapChain`，再为**导出用离屏画布**额外
 * `requestDevice()` 一次 → 两个 `GPUDevice`，出现
 * “TextureView … is associated with [Device], and cannot be used with [Device]”。
 * 同一标签页内复用**首次** `requestDevice()` 的结果，使主画布与离屏导出共享设备。
 */
let sharedWebGpuSingleton: {
  adapter: GPUAdapter;
  device: GPUDevice;
} | null = null;

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

    let nativeDevice: GPUDevice;
    let boundAdapter: GPUAdapter;

    if (sharedWebGpuSingleton !== null) {
      boundAdapter = sharedWebGpuSingleton.adapter;
      nativeDevice = sharedWebGpuSingleton.device;
    } else {
      const device = await adapter.requestDevice({ requiredFeatures });

      if (device === null) return null;

      boundAdapter = adapter;
      nativeDevice = device;
      sharedWebGpuSingleton = { adapter: boundAdapter, device: nativeDevice };

      {
        // @see https://github.com/gpuweb/gpuweb/blob/main/design/ErrorHandling.md#fatal-errors-requestadapter-requestdevice-and-devicelost
        const { onContextLost } = this.pluginOptions;
        nativeDevice.lost.then(() => {
          sharedWebGpuSingleton = null;
          if (onContextLost) {
            onContextLost();
          }
        });
      }
    }

    const context = $canvas.getContext('webgpu');

    if (!context) return null;

    try {
      await init(this.pluginOptions.shaderCompilerPath);
    } catch (e) { }

    return new Device_WebGPU(
      boundAdapter,
      nativeDevice,
      $canvas,
      context,
      glsl_compile,
      WGSLComposer && new WGSLComposer(),
    );
  }
}
