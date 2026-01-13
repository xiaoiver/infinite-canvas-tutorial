import { co, Entity, System } from '@lastolivegames/becsy';
import {
  DeviceContribution,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { Canvas, GPUResource, Grid, Theme } from '../components';
import { isBrowser, RenderCache } from '../utils';
import { TexturePool } from '../resources';
import { RenderGraph } from '../render-graph/RenderGraph';

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
      const { device, swapChain, renderCache, renderGraph } =
        await this.createGPUResource(
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
        renderCache,
        renderGraph,
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

      const { swapChain } = canvas.read(GPUResource);
      swapChain.configureSwapChain(widthDPR, heightDPR);
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

    if (this.#offscreenElement) {
      const { device, renderCache, renderGraph } = this.#offscreenGPUResource;
      renderCache.destroy();
      renderGraph.destroy();
      device.destroy();
      device.checkForLeaks();
    }

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
    const renderCache = new RenderCache(device);
    const renderGraph = new RenderGraph(device);

    return {
      device,
      swapChain,
      renderCache,
      renderGraph,
    };
  }

  private destroyCanvas(canvas: Entity) {
    const { device, renderCache, renderGraph } = canvas.read(GPUResource);
    renderCache.destroy();
    renderGraph.destroy();
    device.destroy();
    device.checkForLeaks();
  }
}
