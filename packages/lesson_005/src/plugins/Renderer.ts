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
import { paddingMat3 } from '../utils';
import { Grid } from '../shapes/Grid';
import { Grid2 } from '../shapes/Grid2';

export enum GridImplementation {
  LINE_GEOMETRY,
  SCREEN_SPACE,
}

export enum CheckboardStyle {
  NONE,
  GRID,
  DOTS,
}

export class Renderer implements Plugin {
  #swapChain: SwapChain;
  #device: Device;
  #renderTarget: RenderTarget;
  #renderPass: RenderPass;
  #uniformBuffer: Buffer;

  #gridImplementation: GridImplementation = GridImplementation.SCREEN_SPACE;
  #checkboardStyle: CheckboardStyle = CheckboardStyle.GRID;
  #grid: Grid;
  #grid2: Grid2;

  apply(context: PluginContext) {
    const {
      hooks,
      canvas,
      renderer,
      shaderCompilerPath,
      devicePixelRatio,
      camera,
    } = context;

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution({
          targets: ['webgl2', 'webgl1'],
          antialias: true,
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
          ...paddingMat3(camera.projectionMatrix),
          ...paddingMat3(camera.viewMatrix),
          ...paddingMat3(camera.viewProjectionMatrixInv),
          camera.zoom,
          this.#checkboardStyle,
          0,
          0,
        ]),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      if (this.#gridImplementation === GridImplementation.LINE_GEOMETRY) {
        this.#grid = new Grid(1 / devicePixelRatio);
      } else {
        this.#grid2 = new Grid2();
      }
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
      if (this.#gridImplementation === GridImplementation.LINE_GEOMETRY) {
        this.#grid.destroy();
      } else {
        this.#grid2.destroy();
      }

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
            ...paddingMat3(camera.projectionMatrix),
            ...paddingMat3(camera.viewMatrix),
            ...paddingMat3(camera.viewProjectionMatrixInv),
            camera.zoom,
            this.#checkboardStyle,
            0,
            0,
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

      if (this.#gridImplementation === GridImplementation.LINE_GEOMETRY) {
        if (!this.#grid) {
          this.#grid = new Grid(1 / devicePixelRatio);
        }

        this.#grid.render(
          this.#device,
          this.#renderPass,
          this.#uniformBuffer,
          camera,
        );
      } else {
        this.#grid2.render(this.#device, this.#renderPass, this.#uniformBuffer);
      }
    });

    hooks.endFrame.tap(() => {
      this.#device.submitPass(this.#renderPass);
      this.#device.endFrame();

      if (this.#gridImplementation === GridImplementation.LINE_GEOMETRY) {
        this.#grid.reset();
      }
    });

    hooks.render.tap((shape) => {
      shape.transform.updateTransform(
        shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
      );
      shape.render(this.#device, this.#renderPass, this.#uniformBuffer);
    });
  }

  setGridImplementation(implementation: GridImplementation) {
    this.#gridImplementation = implementation;
  }

  setCheckboardStyle(style: CheckboardStyle) {
    this.#checkboardStyle = style;
  }
}
