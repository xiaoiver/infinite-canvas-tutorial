import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  TransparentWhite,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import type {
  SwapChain,
  DeviceContribution,
  Device,
  RenderPass,
  Buffer,
  RenderTarget,
} from '@antv/g-device-api';
import type { Plugin, PluginContext } from './interfaces';
import { IDENTITY_TRANSFORM } from '../shapes';

export class Renderer implements Plugin {
  #swapChain: SwapChain;
  #device: Device;
  #renderTarget: RenderTarget;
  #renderPass: RenderPass;
  #uniformBuffer: Buffer;

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

      this.#renderTarget = this.#device.createRenderTargetFromTexture(
        this.#device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        }),
      );

      this.#uniformBuffer = this.#device.createBuffer({
        viewOrSize: new Float32Array([
          width / devicePixelRatio,
          height / devicePixelRatio,
        ]),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    });

    hooks.resize.tap((width, height) => {
      this.#swapChain.configureSwapChain(
        width * devicePixelRatio,
        height * devicePixelRatio,
      );

      if (this.#renderTarget) {
        this.#renderTarget.destroy();
        this.#renderTarget = this.#device.createRenderTargetFromTexture(
          this.#device.createTexture({
            format: Format.U8_RGBA_RT,
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
            usage: TextureUsage.RENDER_TARGET,
          }),
        );
      }
    });

    hooks.destroy.tap(() => {
      this.#renderTarget.destroy();
      this.#uniformBuffer.destroy();
      this.#device.destroy();
      this.#device.checkForLeaks();
    });

    hooks.beginFrame.tap(() => {
      const { width, height } = this.#swapChain.getCanvas();
      const onscreenTexture = this.#swapChain.getOnscreenTexture();

      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([
            width / devicePixelRatio,
            height / devicePixelRatio,
          ]).buffer,
        ),
      );

      this.#device.beginFrame();

      this.#renderPass = this.#device.createRenderPass({
        colorAttachment: [this.#renderTarget],
        colorResolveTo: [onscreenTexture],
        colorClearColor: [TransparentWhite],
      });

      this.#renderPass.setViewport(0, 0, width, height);
    });

    hooks.endFrame.tap(() => {
      this.#device.submitPass(this.#renderPass);
      this.#device.endFrame();
    });

    hooks.render.tap((shape) => {
      shape.transform.updateTransform(
        shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
      );
      shape.render(this.#device, this.#renderPass, this.#uniformBuffer);
    });
  }
}
