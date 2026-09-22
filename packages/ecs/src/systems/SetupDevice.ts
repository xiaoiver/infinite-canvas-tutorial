import { Entity, System } from '@lastolivegames/becsy';
import {
  DeviceContribution,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { Canvas, GPUResource, Grid, Theme } from '../components';
import { isBrowser, RenderCache } from '../utils';
import { TexturePool } from '../resources';
import { RenderGraph } from '../render-graph/RenderGraph';
import { ResourceScope } from '../resources/ResourceScope';

type CanvasResources = {
  canvas: Entity;
  resource?: GPUResource;
  attached: boolean;
  cancelled: boolean;
};

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
  #offscreenGPUResource: GPUResource;
  #offscreenPromise: Promise<void>;
  #resources = new Map<number, CanvasResources>();
  #disposed = false;

  constructor() {
    super();
    this.query((q) => q.using(GPUResource, Canvas, Theme, Grid).write);
    this.#texturePool = new TexturePool();
  }

  getOffscreenGPUResource() {
    return this.#offscreenGPUResource;
  }

  execute() {
    this.canvases.removed.forEach((canvas) => {
      const entry = this.#resources.get(canvas.__id);
      if (entry) {
        entry.cancelled = true;
        entry.resource?.scope.dispose();
        this.#resources.delete(canvas.__id);
      }
    });

    this.canvases.added.forEach((canvas) => {
      if (!canvas.has(Theme)) {
        canvas.add(Theme);
      }

      if (!canvas.has(Grid)) {
        canvas.add(Grid);
      }

      const entry: CanvasResources = {
        canvas: canvas.hold(),
        attached: false,
        cancelled: false,
      };
      this.#resources.set(canvas.__id, entry);
      // Copy component values before crossing an asynchronous boundary.
      const {
        renderer,
        shaderCompilerPath,
        element,
        width,
        height,
        devicePixelRatio,
      } = canvas.read(Canvas);
      const props = {
        renderer,
        shaderCompilerPath,
        element,
        width,
        height,
        devicePixelRatio,
      };
      this.initializeCanvas(entry, props).catch((error) => {
        if (!this.#disposed && !entry.cancelled) {
          console.error('Failed to initialize canvas GPU resources', error);
        }
      });
    });

    // Attach completed resources only while executing in the owning system.
    this.#resources.forEach((entry) => {
      if (entry.resource && !entry.attached) {
        const { width, height, devicePixelRatio } = entry.canvas.read(Canvas);
        entry.resource.swapChain.configureSwapChain(
          width * devicePixelRatio,
          height * devicePixelRatio,
        );
        entry.canvas.add(GPUResource, entry.resource);
        entry.attached = true;
      }
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
  }

  finalize(): void {
    this.#disposed = true;
    this.#resources.forEach((entry) => {
      entry.cancelled = true;
      entry.resource?.scope.dispose();
    });
    this.#resources.clear();
    this.#offscreenGPUResource?.scope.dispose();
    this.#texturePool.destroy();
  }

  private async initializeCanvas(
    entry: CanvasResources,
    props: Pick<
      Canvas,
      | 'renderer'
      | 'shaderCompilerPath'
      | 'element'
      | 'width'
      | 'height'
      | 'devicePixelRatio'
    >,
  ) {
    const {
      renderer,
      shaderCompilerPath,
      element,
      width,
      height,
      devicePixelRatio,
    } = props;
    if (isBrowser) {
      if (!this.#offscreenPromise) {
        const offscreen = document.createElement('canvas');
        offscreen.width = width * devicePixelRatio;
        offscreen.height = height * devicePixelRatio;
        this.#offscreenPromise = this.createGPUResource(
          renderer,
          shaderCompilerPath,
          offscreen,
          width,
          height,
          devicePixelRatio,
        ).then((resource) => {
          if (this.#disposed) resource.scope.dispose();
          else this.#offscreenGPUResource = resource;
        });
      }
      await this.#offscreenPromise;
    }
    if (this.#disposed || entry.cancelled) return;
    const resource = await this.createGPUResource(
      renderer,
      shaderCompilerPath,
      element,
      width,
      height,
      devicePixelRatio,
    );
    if (this.#disposed || entry.cancelled) resource.scope.dispose();
    else entry.resource = resource;
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

    const device = swapChain.getDevice();
    const scope = new ResourceScope();
    scope.add(() => {
      device.destroy();
      device.checkForLeaks();
    });
    try {
      swapChain.configureSwapChain(widthDPR, heightDPR);
      const renderCache = new RenderCache(device);
      scope.add(() => renderCache.destroy());
      const renderGraph = new RenderGraph(device);
      scope.add(() => renderGraph.destroy());
      return {
        device,
        swapChain,
        renderCache,
        renderGraph,
        scope,
        texturePool: this.#texturePool,
      };
    } catch (error) {
      scope.dispose();
      throw error;
    }
  }
}
