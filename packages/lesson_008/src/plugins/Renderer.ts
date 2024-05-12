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
import { IDENTITY_TRANSFORM, Grid, Shape } from '../shapes';
import { paddingMat3 } from '../utils';
import { BatchManager } from '../drawcalls/BatchManager';

export enum CheckboardStyle {
  NONE,
  GRID,
  DOTS,
}

export class Renderer implements Plugin {
  #swapChain: SwapChain;
  #device: Device;
  #renderTarget: RenderTarget;
  #depthRenderTarget: RenderTarget;
  #renderPass: RenderPass;
  #uniformBuffer: Buffer;

  #checkboardStyle: CheckboardStyle = CheckboardStyle.GRID;
  #grid: Grid;

  #batchManager: BatchManager;
  #zIndexCounter = 1;

  #shapesRenderedLastFrame = new Set<Shape>();
  #shapesRenderedThisFrame = new Set<Shape>();

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
      this.#batchManager = new BatchManager(this.#device);

      this.#renderTarget = this.#device.createRenderTargetFromTexture(
        this.#device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        }),
      );
      this.#depthRenderTarget = this.#device.createRenderTargetFromTexture(
        this.#device.createTexture({
          format: Format.D24_S8,
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

      this.#grid = new Grid();
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
        this.#depthRenderTarget.destroy();
        this.#depthRenderTarget = this.#device.createRenderTargetFromTexture(
          this.#device.createTexture({
            format: Format.D24_S8,
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
            usage: TextureUsage.RENDER_TARGET,
          }),
        );
      }
    });

    hooks.destroy.tap(() => {
      this.#batchManager.destroy();
      this.#uniformBuffer.destroy();
      this.#grid.destroy();
      this.#renderTarget.destroy();
      this.#depthRenderTarget.destroy();
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
        depthStencilAttachment: this.#depthRenderTarget,
        depthClearValue: 1,
      });

      this.#renderPass.setViewport(0, 0, width, height);
      this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
      this.#batchManager.clear();
      this.#zIndexCounter = 1;
      this.#shapesRenderedThisFrame.clear();
    });

    hooks.endFrame.tap(() => {
      this.#shapesRenderedThisFrame.forEach((shape) => {
        this.#batchManager.add(shape);
      });
      // Use Set difference is much faster.
      // @see https://stackoverflow.com/questions/1723168/what-is-the-fastest-or-most-elegant-way-to-compute-a-set-difference-using-javasc
      // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference
      [...this.#shapesRenderedLastFrame]
        .filter((shape) => !this.#shapesRenderedThisFrame.has(shape))
        .forEach((shape) => {
          this.#batchManager.remove(shape);
        });

      this.#batchManager.flush(this.#renderPass, this.#uniformBuffer);
      this.#device.submitPass(this.#renderPass);
      this.#device.endFrame();
      this.#shapesRenderedLastFrame = this.#shapesRenderedThisFrame;
    });

    hooks.render.tap((shape) => {
      // Changed Transform should also set dirty flag.
      const isDirty = shape['_localID'] !== shape['_currentLocalID'];
      if (isDirty) {
        shape['renderDirtyFlag'] = true;
      }

      shape.transform.updateTransform(
        shape.parent ? shape.parent.transform : IDENTITY_TRANSFORM,
      );

      if (shape.renderable) {
        this.#shapesRenderedThisFrame.add(shape);
        shape.globalRenderOrder = this.#zIndexCounter++;
      }
    });
  }

  setCheckboardStyle(style: CheckboardStyle) {
    this.#checkboardStyle = style;
  }
}
