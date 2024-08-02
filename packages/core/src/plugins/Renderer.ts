import * as d3 from 'd3-color';
import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  TransparentBlack,
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
import { Grid } from '../shapes';
import { paddingMat3 } from '../utils';
import { BatchManager } from '../drawcalls/BatchManager';
import type { DataURLOptions } from '../ImageExporter';

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

  #enableCapture: boolean;
  #captureOptions?: Partial<DataURLOptions>;
  #capturePromise?: Promise<string>;
  #resolveCapturePromise?: (dataURL: string) => void;

  apply(context: PluginContext) {
    const {
      hooks,
      canvas,
      renderer,
      shaderCompilerPath,
      devicePixelRatio,
      camera,
      backgroundColor,
      gridColor,
    } = context;

    const {
      r: br,
      g: bg,
      b: bb,
      opacity: bo,
    } = backgroundColor
      ? d3.rgb(backgroundColor)
      : { r: 0.986 * 255, g: 0.986 * 255, b: 0.986 * 255, opacity: 1 };
    const {
      r: gr,
      g: gg,
      b: gb,
      opacity: go,
    } = gridColor
      ? d3.rgb(gridColor)
      : { r: 0.87 * 255, g: 0.87 * 255, b: 0.87 * 255, opacity: 1 };

    hooks.initAsync.tapPromise(async () => {
      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution({
          targets: ['webgl2', 'webgl1'],
          antialias: true,
          shaderDebug: false,
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
      const swapChain = await deviceContribution.createSwapChain(
        canvas as HTMLCanvasElement,
      );
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
          br / 255,
          bg / 255,
          bb / 255,
          bo,
          gr / 255,
          gg / 255,
          gb / 255,
          go,
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
            br / 255,
            bg / 255,
            bb / 255,
            bo,
            gr / 255,
            gg / 255,
            gb / 255,
            go,
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
        colorClearColor: [TransparentBlack],
        depthStencilAttachment: this.#depthRenderTarget,
        depthClearValue: 1,
      });

      this.#renderPass.setViewport(0, 0, width, height);

      if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions?.grid)
      ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
      }

      this.#batchManager.clear();
      this.#zIndexCounter = 1;
    });

    hooks.endFrame.tap(({ all, removed }) => {
      // Use Set difference is much faster.
      // @see https://stackoverflow.com/questions/1723168/what-is-the-fastest-or-most-elegant-way-to-compute-a-set-difference-using-javasc
      // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference
      [...all.filter((shape) => shape.culled), ...removed].forEach((shape) => {
        if (shape.renderable) {
          this.#batchManager.remove(shape);
        }
      });

      this.#batchManager.flush(this.#renderPass, this.#uniformBuffer);
      this.#device.submitPass(this.#renderPass);
      this.#device.endFrame();

      // capture here since we don't preserve drawing buffer
      if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions || {};
        const dataURL = (
          this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
      }
    });

    hooks.render.tap((shape) => {
      shape.globalRenderOrder = this.#zIndexCounter++;
      this.#batchManager.add(shape);
    });
  }

  get checkboardStyle() {
    return this.#checkboardStyle;
  }

  set checkboardStyle(style: CheckboardStyle) {
    this.#checkboardStyle = style;
  }

  async toDataURL(options: Partial<DataURLOptions>) {
    // trigger re-render
    this.#enableCapture = true;
    this.#captureOptions = options;
    this.#capturePromise = new Promise((resolve) => {
      this.#resolveCapturePromise = (dataURL: string) => {
        resolve(dataURL);
      };
    });
    return this.#capturePromise;
  }
}
