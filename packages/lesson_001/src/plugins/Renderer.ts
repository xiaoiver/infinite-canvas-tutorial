import {
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type { SwapChain, DeviceContribution, Device } from '@antv/g-device-api';
import type { Plugin, PluginContext } from './interfaces';

export class Renderer implements Plugin {
  #swapChain: SwapChain;
  #device: Device;

  apply(context: PluginContext) {
    const { hooks, canvas, renderer, shaderCompilerPath, devicePixelRatio } =
      context;

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution({
          targets: ['webgl2', 'webgl1'],
          shaderDebug: true,
          trackResources: true,
          onContextCreationError: () => {},
          onContextLost: () => {},
          onContextRestored(e) {},
        });
      } else {
        deviceContribution = new WebGPUDeviceContribution({
          shaderCompilerPath,
          onContextLost: () => {},
        });
      }

      const { width, height } = canvas;
      const swapChain = await deviceContribution.createSwapChain(canvas);
      swapChain.configureSwapChain(width, height);

      this.#swapChain = swapChain;
      this.#device = swapChain.getDevice();
    });

    hooks.resize.tap((width, height) => {
      this.#swapChain.configureSwapChain(
        width * devicePixelRatio,
        height * devicePixelRatio,
      );
    });

    hooks.destroy.tap(() => {
      this.#device.destroy();
    });

    hooks.beginFrame.tap(() => {
      this.#device.beginFrame();
    });

    hooks.endFrame.tap(() => {
      this.#device.endFrame();
    });
  }
}
