import { co, Entity, System } from '@lastolivegames/becsy';
import {
  DeviceContribution,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@infinite-canvas-tutorial/device-api';
import { Canvas, GPUResource, Grid, Theme } from '../components';
import { DOMAdapter } from '../environment';
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

  /**
   * Resize the offscreen canvas for partial export (e.g. export selected nodes to PNG).
   * Call with desired output dimensions in pixels (for 1:1 export use logical width/height).
   */
  resizeOffscreen(pixelWidth: number, pixelHeight: number): void {
    if (!this.#offscreenElement || !this.#offscreenGPUResource) {
      return;
    }
    this.#offscreenElement.width = pixelWidth;
    this.#offscreenElement.height = pixelHeight;
    this.#offscreenGPUResource.swapChain.configureSwapChain(
      pixelWidth,
      pixelHeight,
    );
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

      // Jest sets `window` via JSDOM but offscreen must use DOMAdapter (headless-gl), not
      // `document.createElement('canvas')` (no WebGL). Skip in Jest when partial export is unused.
      const skipOffscreenInJest = typeof process !== 'undefined' && process.env.JEST_WORKER_ID;
      if (!this.#offscreenElement && isBrowser && !skipOffscreenInJest) {
        const offscreenWidth = Math.floor(width * devicePixelRatio);
        const offscreenHeight = Math.floor(height * devicePixelRatio);
        this.#offscreenElement = DOMAdapter.get().createCanvas(
          offscreenWidth,
          offscreenHeight,
        ) as HTMLCanvasElement;
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
      swapChain.configureSwapChain(Math.floor(widthDPR), Math.floor(heightDPR));
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
        preserveDrawingBuffer: true,
        shaderDebug: true,
        trackResources: false,
        onContextCreationError: () => { },
        onContextLost: () => { },
        onContextRestored(e) { },
      });
    } else {
      deviceContribution = new WebGPUDeviceContribution({
        shaderCompilerPath,
        onContextLost: () => { },
      });
    }

    const swapChain = await deviceContribution.createSwapChain(
      element as HTMLCanvasElement,
    );

    swapChain.configureSwapChain(Math.floor(widthDPR), Math.floor(heightDPR));
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
    if (!canvas.has(GPUResource)) {
      return;
    }
    const { device, renderCache, renderGraph } = canvas.read(GPUResource);
    renderCache.destroy();
    renderGraph.destroy();
    device.destroy();
    device.checkForLeaks();
  }
}
