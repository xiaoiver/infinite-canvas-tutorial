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

export class SetupDevice extends System {
  /**
   * Global app config.
   */
  private readonly canvasConfig = this.singleton.read(CanvasConfig); // can't use # field here
  private readonly windowResized = this.singleton.read(WindowResized);

  // private windowResizedQuery = this.query(
  //   (q) => q.changed.with(WindowResized).trackWrites,
  // );

  /**
   * Device represents a "virtual GPU".
   */
  device: Device;
  swapChain: SwapChain;
  renderTarget: RenderTarget;
  depthRenderTarget: RenderTarget;

  async prepare() {
    const { canvas, renderer, shaderCompilerPath } = this.canvasConfig;

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

    const { width, height } = canvas;
    this.swapChain = await deviceContribution.createSwapChain(
      canvas as HTMLCanvasElement,
    );

    this.swapChain.configureSwapChain(width, height);
    this.device = this.swapChain.getDevice();

    this.renderTarget = this.device.createRenderTargetFromTexture(
      this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );
    this.depthRenderTarget = this.device.createRenderTargetFromTexture(
      this.device.createTexture({
        format: Format.D24_S8,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      }),
    );
  }

  execute() {
    const { devicePixelRatio } = this.canvasConfig;
    const { width, height } = this.windowResized;

    if (width > 0 && height > 0) {
      console.log('window resized', width, height);

      this.swapChain.configureSwapChain(
        width * devicePixelRatio,
        height * devicePixelRatio,
      );

      if (this.renderTarget) {
        this.renderTarget.destroy();
        this.renderTarget = this.device.createRenderTargetFromTexture(
          this.device.createTexture({
            format: Format.U8_RGBA_RT,
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
            usage: TextureUsage.RENDER_TARGET,
          }),
        );
        this.depthRenderTarget.destroy();
        this.depthRenderTarget = this.device.createRenderTargetFromTexture(
          this.device.createTexture({
            format: Format.D24_S8,
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
            usage: TextureUsage.RENDER_TARGET,
          }),
        );
      }
    }
  }

  finalize(): void {
    this.device.destroy();
    this.device.checkForLeaks();
  }
}
