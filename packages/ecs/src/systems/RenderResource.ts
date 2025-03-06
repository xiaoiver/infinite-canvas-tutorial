import * as d3 from 'd3-color';
import { System } from '@lastolivegames/becsy';
import {
  BufferFrequencyHint,
  BufferUsage,
  Device,
  DeviceContribution,
  Format,
  SwapChain,
  TextureUsage,
  WebGLDeviceContribution,
  WebGPUDeviceContribution,
} from '@antv/g-device-api';
import { AppConfig } from '../components';
import { paddingMat3 } from '../utils';

export class RenderResource extends System {
  /**
   * Global app config.
   */
  private readonly appConfig = this.singleton.read(AppConfig); // can't use # field here

  private appConfigs = this.query(
    (q) => q.addedOrChanged.with(AppConfig).trackWrites,
  );

  /**
   * Device represents a "virtual GPU".
   */
  device: Device;
  swapChain: SwapChain;

  async prepare() {
    const { canvas, renderer, shaderCompilerPath } = this.appConfig;

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
    const swapChain = await deviceContribution.createSwapChain(
      canvas as HTMLCanvasElement,
    );
    this.swapChain = swapChain;

    swapChain.configureSwapChain(width, height);
    const device = swapChain.getDevice();
    this.device = device;

    const renderTarget = device.createRenderTargetFromTexture(
      this.device.createTexture({
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

    // const [buffer, legacyObject] = this.updateUniform(true);
    // this.uniformBuffer = this.device.createBuffer({
    //   viewOrSize: buffer,
    //   usage: BufferUsage.UNIFORM,
    //   hint: BufferFrequencyHint.DYNAMIC,
    // });
    // this.uniformLegacyObject = legacyObject;

    // this.#grid = new Grid();
  }

  initialize(): void {
    // Build render graph
    // const renderHelper = new RenderHelper();
    // this.renderHelper = renderHelper;
    // renderHelper.setDevice(this.device);
    // renderHelper.renderInstManager.disableSimpleMode();
  }

  execute(): void {
    // this.appConfigs.addedOrChanged.forEach((entity) => {
    //   const appConfig = entity.hold().read(AppConfig);
    //   console.log(appConfig);
    // });
  }

  finalize(): void {
    // this.renderHelper.destroy();
    this.device.destroy();
    this.device.checkForLeaks();
  }

  // private updateUniform(
  //   shouldRenderGrid: boolean,
  // ): [Float32Array, Record<string, unknown>] {
  //   const { canvas, theme, themeColors, checkboardStyle } = this.appConfig;

  //   const backgroundColor = themeColors[theme].background;
  //   const gridColor = themeColors[theme].grid;

  //   const {
  //     r: br,
  //     g: bg,
  //     b: bb,
  //     opacity: bo,
  //   } = d3.rgb(backgroundColor)?.rgb() || d3.rgb(0, 0, 0, 1);
  //   const {
  //     r: gr,
  //     g: gg,
  //     b: gb,
  //     opacity: go,
  //   } = d3.rgb(gridColor)?.rgb() || d3.rgb(0, 0, 0, 1);

  //   const u_ProjectionMatrix = camera.projectionMatrix;
  //   const u_ViewMatrix = camera.viewMatrix;
  //   const u_ViewProjectionInvMatrix = camera.viewProjectionMatrixInv;
  //   const u_BackgroundColor = [br / 255, bg / 255, bb / 255, bo];
  //   const u_GridColor = [gr / 255, gg / 255, gb / 255, go];
  //   const u_ZoomScale = camera.zoom;
  //   const u_CheckboardStyle = shouldRenderGrid ? checkboardStyle : 0;
  //   const u_Viewport = [canvas.width, canvas.height];

  //   const buffer = new Float32Array([
  //     ...paddingMat3(u_ProjectionMatrix),
  //     ...paddingMat3(u_ViewMatrix),
  //     ...paddingMat3(u_ViewProjectionInvMatrix),
  //     ...u_BackgroundColor,
  //     ...u_GridColor,
  //     u_ZoomScale,
  //     u_CheckboardStyle,
  //     ...u_Viewport,
  //   ]);
  //   const legacyObject = {
  //     u_ProjectionMatrix,
  //     u_ViewMatrix,
  //     u_ViewProjectionInvMatrix,
  //     u_BackgroundColor,
  //     u_GridColor,
  //     u_ZoomScale,
  //     u_CheckboardStyle,
  //     u_Viewport,
  //   };

  //   return [buffer, legacyObject];
  // }
}
