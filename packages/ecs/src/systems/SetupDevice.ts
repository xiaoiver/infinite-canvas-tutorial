import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Device,
  DeviceContribution,
  Format,
  TextureUsage,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { Canvas } from '../components';
import { RenderCache } from '../utils';
import { TexturePool } from '../resources';
import { GPUResource, PreStartUp, StartUp } from '..';

export class SetupDevice extends System {
  private readonly canvases = this.query(
    (q) => q.added.and.changed.with(Canvas).trackWrites,
  );

  #texturePool: TexturePool;

  constructor() {
    super();
    this.schedule((s) => s.after(PreStartUp).before(StartUp));
    this.query((q) => q.using(GPUResource, Canvas).write);

    this.#texturePool = new TexturePool();
  }

  @co private *addGPUResource(
    canvas: Entity,
    gpuResource: GPUResource,
  ): Generator {
    canvas.add(GPUResource, gpuResource);
    yield;
  }

  execute() {
    this.canvases.added.forEach(async (canvas) => {
      const {
        width,
        height,
        devicePixelRatio,
        renderer,
        shaderCompilerPath,
        element,
      } = canvas.read(Canvas);

      const holder = canvas.hold();

      const widthDPR = width * devicePixelRatio;
      const heightDPR = height * devicePixelRatio;

      let deviceContribution: DeviceContribution;
      if (renderer === 'webgl') {
        deviceContribution = new WebGLDeviceContribution({
          targets: ['webgl1'],
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
  }

  finalize(): void {
    this.canvases.current.forEach((canvas) => {
      const { device, renderTarget, depthRenderTarget, renderCache } =
        canvas.read(GPUResource);
      renderCache.destroy();
      renderTarget.destroy();
      depthRenderTarget.destroy();
      device.destroy();
      device.checkForLeaks();
    });

    this.#texturePool.destroy();
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
}
