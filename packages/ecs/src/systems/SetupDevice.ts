import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Device,
  DeviceContribution,
  Format,
  TextureUsage,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { Canvas, GPUResource, Grid, Theme } from '../components';
import { isBrowser, RenderCache } from '../utils';
import { TexturePool } from '../resources';

/**
 * Usually the first built-in system to run.
 * It will create a new device and swap chain for each canvas.
 */
export class SetupDevice extends System {
  private readonly canvases = this.query(
    (q) => q.added.and.changed.and.removed.and.current.with(Canvas).trackWrites,
  );

  #texturePool: TexturePool;

  /**
   * Used for rendering and exporting the shapes in canvas to image(PNG, JPEG, etc.).
   */
  #offscreenElement: HTMLCanvasElement | OffscreenCanvas;
  #offscreenGPUResource: GPUResource;

  constructor() {
    super();
    this.query((q) => q.using(GPUResource, Canvas, Theme, Grid).write);
    this.#texturePool = new TexturePool();
  }

  @co private *addGPUResource(
    canvas: Entity,
    gpuResource: GPUResource,
  ): Generator {
    canvas.add(GPUResource, gpuResource);
    yield;
  }

  getOffscreenGPUResource() {
    return this.#offscreenGPUResource;
  }

  execute() {
    this.canvases.added.forEach(async (canvas) => {
      if (!canvas.has(Theme)) {
        canvas.add(Theme);
      }

      if (!canvas.has(Grid)) {
        canvas.add(Grid);
      }

      const {
        width,
        height,
        devicePixelRatio,
        renderer,
        shaderCompilerPath,
        element,
      } = canvas.read(Canvas);

      if (!this.#offscreenElement && isBrowser) {
        this.#offscreenElement = document.createElement('canvas');
        this.#offscreenElement.width = width * devicePixelRatio;
        this.#offscreenElement.height = height * devicePixelRatio;
        this.#offscreenGPUResource = {
          ...(await this.createGPUResource(
            renderer,
            shaderCompilerPath,
            this.#offscreenElement,
            width,
            height,
            devicePixelRatio,
          )),
          texturePool: this.#texturePool,
        };
      }

      const holder = canvas.hold();
      const {
        device,
        swapChain,
        renderTarget,
        depthRenderTarget,
        renderCache,
      } = await this.createGPUResource(
        renderer,
        shaderCompilerPath,
        element,
        width,
        height,
        devicePixelRatio,
      );

      this.addGPUResource(holder, {
        device,
        swapChain,
        renderTarget,
        depthRenderTarget,
        renderCache,
        texturePool: this.#texturePool,
      });
    });

    this.canvases.changed.forEach((canvas) => {
      if (!canvas.has(GPUResource)) {
        return;
      }

      const { width, height, devicePixelRatio } = canvas.read(Canvas);
      const widthDPR = width * devicePixelRatio;
      const heightDPR = height * devicePixelRatio;

      const {
        swapChain,
        device,
        renderTarget: oldRenderTarget,
        depthRenderTarget: oldDepthRenderTarget,
      } = canvas.read(GPUResource);
      swapChain.configureSwapChain(widthDPR, heightDPR);

      oldRenderTarget.destroy();
      oldDepthRenderTarget.destroy();
      const [renderTarget, depthRenderTarget] = this.createRenderTarget(
        device,
        widthDPR,
        heightDPR,
      );

      Object.assign(canvas.write(GPUResource), {
        renderTarget,
        depthRenderTarget,
      });
    });

    this.canvases.removed.forEach((canvas) => {
      this.accessRecentlyDeletedData();
      this.destroyCanvas(canvas);
    });
  }

  finalize(): void {
    this.canvases.current.forEach((canvas) => {
      this.destroyCanvas(canvas);
    });

    this.#texturePool.destroy();
  }

  private async createGPUResource(
    renderer: 'webgl' | 'webgpu',
    shaderCompilerPath: string,
    element: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    devicePixelRatio: number,
  ) {
    const widthDPR = width * devicePixelRatio;
    const heightDPR = height * devicePixelRatio;

    let deviceContribution: DeviceContribution;
    if (renderer === 'webgl') {
      deviceContribution = new WebGLDeviceContribution({
        targets: ['webgl2', 'webgl1'],
        antialias: true,
        shaderDebug: true,
        trackResources: false,
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

    const swapChain = await deviceContribution.createSwapChain(
      element as HTMLCanvasElement,
    );

    swapChain.configureSwapChain(widthDPR, heightDPR);
    const device = swapChain.getDevice();
    const [renderTarget, depthRenderTarget] = this.createRenderTarget(
      device,
      widthDPR,
      heightDPR,
    );
    const renderCache = new RenderCache(device);

    return {
      device,
      swapChain,
      renderTarget,
      depthRenderTarget,
      renderCache,
    };
  }

  private createRenderTarget(device: Device, width: number, height: number) {
    const renderTarget = device.createRenderTargetFromTexture(
      device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );
    const depthRenderTarget = device.createRenderTargetFromTexture(
      device.createTexture({
        format: Format.D24_S8,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );

    return [renderTarget, depthRenderTarget];
  }

  private destroyCanvas(canvas: Entity) {
    const { device, renderTarget, depthRenderTarget, renderCache } =
      canvas.read(GPUResource);
    renderCache.destroy();
    renderTarget.destroy();
    depthRenderTarget.destroy();
    device.destroy();
    device.checkForLeaks();
  }
}
