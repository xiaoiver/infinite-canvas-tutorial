import { System } from '@lastolivegames/becsy';
import {
  Device,
  DeviceContribution,
  Format,
  RenderTarget,
  SwapChain,
  TextureUsage,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { CanvasConfig, WindowResized } from '../components';
import { RenderCache } from '../utils';
import { TexturePool } from '../resources';

export class SetupDevice extends System {
  /**
   * Global app config.
   */
  private readonly canvasConfig = this.singleton.read(CanvasConfig); // can't use # field here

  private readonly windowResized = this.query(
    (q) => q.changed.with(WindowResized).trackWrites,
  );

  /**
   * Device represents a "virtual GPU".
   */
  device: Device;
  swapChain: SwapChain;
  renderTarget: RenderTarget;
  depthRenderTarget: RenderTarget;
  renderCache: RenderCache;
  texturePool: TexturePool;

  async prepare() {
    const {
      canvas,
      renderer,
      width,
      height,
      devicePixelRatio,
      shaderCompilerPath,
    } = this.canvasConfig;
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

    this.swapChain = await deviceContribution.createSwapChain(
      canvas as HTMLCanvasElement,
    );

    this.swapChain.configureSwapChain(widthDPR, heightDPR);
    this.device = this.swapChain.getDevice();
    this.createRenderTarget(widthDPR, heightDPR);

    this.renderCache = new RenderCache(this.device);
    this.texturePool = new TexturePool();
  }

  execute() {
    this.windowResized.changed.forEach((entity) => {
      const { devicePixelRatio } = this.canvasConfig;
      const { width, height } = entity.read(WindowResized);
      const widthDPR = width * devicePixelRatio;
      const heightDPR = height * devicePixelRatio;

      this.swapChain.configureSwapChain(widthDPR, heightDPR);
      this.createRenderTarget(widthDPR, heightDPR);
    });
  }

  finalize(): void {
    this.renderCache.destroy();
    this.texturePool.destroy();

    this.device.destroy();
    this.device.checkForLeaks();
  }

  private createRenderTarget(width: number, height: number) {
    this.renderTarget?.destroy();
    this.renderTarget = this.device.createRenderTargetFromTexture(
      this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );
    this.depthRenderTarget?.destroy();
    this.depthRenderTarget = this.device.createRenderTargetFromTexture(
      this.device.createTexture({
        format: Format.D24_S8,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );
  }
}
