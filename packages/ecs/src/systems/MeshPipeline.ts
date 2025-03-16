import * as d3 from 'd3-color';
import { System } from '@lastolivegames/becsy';
import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  RenderPass,
  TransparentBlack,
} from '@antv/g-device-api';
import { SetupDevice } from './SetupDevice';
import {
  Camera,
  CheckboardStyle,
  Circle,
  ComputedCamera,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  fillEnum,
  GlobalRenderOrder,
  GlobalTransform,
  Grid,
  InnerShadow,
  Opacity,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
  Text,
  Theme,
  WindowResized,
  Wireframe,
} from '../components';
import { paddingMat3 } from '../utils';
import { GridRenderer } from './GridRenderer';
import { BatchManager } from './BatchManager';

export class MeshPipeline extends System {
  private rendererResource = this.attach(SetupDevice);
  private batchManager = this.attach(BatchManager);

  private readonly theme = this.singleton.read(Theme);
  private readonly grid = this.singleton.read(Grid);
  private readonly windowResized = this.singleton.write(WindowResized);

  private grids = this.query((q) => q.addedOrChanged.with(Grid).trackWrites);
  private themes = this.query((q) => q.addedOrChanged.with(Theme).trackWrites);
  private cameras = this.query((q) => q.current.with(Camera).read);
  private computedCameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  private styles = this.query(
    (q) =>
      q.addedChangedOrRemoved.withAny(
        fillEnum,
        Stroke,
        Opacity,
        InnerShadow,
        DropShadow,
        Wireframe,
        Rough,
      ).trackWrites,
  );

  #renderPass: RenderPass;
  /**
   * Used in WebGL2 & WebGPU.
   */
  #uniformBuffer: Buffer;
  /**
   * Used in WebGL1.
   */
  #uniformLegacyObject: Record<string, unknown>;

  #gridRenderer: GridRenderer;

  constructor() {
    super();
    this.query(
      (q) =>
        q.current.with(
          Circle,
          Ellipse,
          Rect,
          Polyline,
          Path,
          ComputedPoints,
          GlobalTransform,
          Opacity,
          Stroke,
          InnerShadow,
          DropShadow,
          Wireframe,
          GlobalRenderOrder,
          Rough,
          ComputedRough,
          Text,
          ComputedTextMetrics,
        ).read,
    );
  }

  initialize() {
    this.#gridRenderer = new GridRenderer();
  }

  private renderFrame(computedCamera: ComputedCamera) {
    const { swapChain, device, renderTarget, depthRenderTarget } =
      this.rendererResource;
    const { width, height } = swapChain.getCanvas();
    const onscreenTexture = swapChain.getOnscreenTexture();

    // const shouldRenderGrid =
    //     !this.#enableCapture ||
    //     (this.#enableCapture && this.#captureOptions?.grid);
    const shouldRenderGrid = true;

    if (!this.#uniformBuffer) {
      this.#uniformBuffer = device.createBuffer({
        viewOrSize: (16 * 3 + 4 * 5) * Float32Array.BYTES_PER_ELEMENT,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    const [buffer, legacyObject] = this.updateUniform(
      computedCamera,
      shouldRenderGrid,
    );
    this.#uniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));
    this.#uniformLegacyObject = legacyObject;

    device.beginFrame();

    this.#renderPass = device.createRenderPass({
      colorAttachment: [renderTarget],
      colorResolveTo: [onscreenTexture],
      colorClearColor: [TransparentBlack],
      depthStencilAttachment: depthRenderTarget,
      depthClearValue: 1,
    });

    this.#renderPass.setViewport(0, 0, width, height);

    this.#gridRenderer.render(
      device,
      this.#renderPass,
      this.#uniformBuffer,
      this.#uniformLegacyObject,
    );

    this.batchManager.flush(
      this.#renderPass,
      this.#uniformBuffer,
      this.#uniformLegacyObject,
    );

    device.submitPass(this.#renderPass);
    device.endFrame();
  }

  execute() {
    this.cameras.current.forEach((entity) => {
      let needRender = true;
      const { width, height } = this.windowResized;
      if (width > 0 && height > 0) {
        needRender = true;
      }

      // Style changed.
      (this.computedCameras.addedOrChanged.length ||
        this.styles.addedChangedOrRemoved.length ||
        this.themes.addedOrChanged.length ||
        this.grids.addedOrChanged.length) &&
        (needRender = true);

      if (needRender) {
        console.log('render');
        this.renderFrame(entity.read(ComputedCamera));

        Object.assign(this.windowResized, {
          width: 0,
          height: 0,
        });
      }
    });
  }

  finalize() {
    this.batchManager.clear();
    this.#gridRenderer.destroy();
  }

  private updateUniform(
    computedCamera: ComputedCamera,
    shouldRenderGrid: boolean,
  ): [Float32Array, Record<string, unknown>] {
    const { swapChain } = this.rendererResource;
    const { width, height } = swapChain.getCanvas();

    const { mode, colors } = this.theme;

    const backgroundColor = colors[mode].background;
    const gridColor = colors[mode].grid;

    const {
      r: br,
      g: bg,
      b: bb,
      opacity: bo,
    } = d3.rgb(backgroundColor)?.rgb() || d3.rgb(0, 0, 0, 1);
    const {
      r: gr,
      g: gg,
      b: gb,
      opacity: go,
    } = d3.rgb(gridColor)?.rgb() || d3.rgb(0, 0, 0, 1);

    const { projectionMatrix, viewMatrix, viewProjectionMatrixInv, zoom } =
      computedCamera;

    const u_ProjectionMatrix = projectionMatrix;
    const u_ViewMatrix = viewMatrix;
    const u_ViewProjectionInvMatrix = viewProjectionMatrixInv;
    const u_BackgroundColor = [br / 255, bg / 255, bb / 255, bo];
    const u_GridColor = [gr / 255, gg / 255, gb / 255, go];
    const u_ZoomScale = zoom;
    const u_CheckboardStyle = shouldRenderGrid
      ? [
          CheckboardStyle.NONE,
          CheckboardStyle.GRID,
          CheckboardStyle.DOTS,
        ].indexOf(this.grid.checkboardStyle)
      : 0;
    const u_Viewport = [width, height];

    const buffer = new Float32Array([
      ...paddingMat3(u_ProjectionMatrix),
      ...paddingMat3(u_ViewMatrix),
      ...paddingMat3(u_ViewProjectionInvMatrix),
      ...u_BackgroundColor,
      ...u_GridColor,
      u_ZoomScale,
      u_CheckboardStyle,
      ...u_Viewport,
    ]);
    const legacyObject = {
      u_ProjectionMatrix,
      u_ViewMatrix,
      u_ViewProjectionInvMatrix,
      u_BackgroundColor,
      u_GridColor,
      u_ZoomScale,
      u_CheckboardStyle,
      u_Viewport,
    };
    return [buffer, legacyObject];
  }
}
