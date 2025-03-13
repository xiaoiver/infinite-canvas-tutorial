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
import { PrepareViewUniforms } from './PrepareViewUniforms';
import {
  CheckboardStyle,
  Children,
  Circle,
  ComputedPoints,
  ComputedRough,
  DropShadow,
  Ellipse,
  FillSolid,
  GlobalRenderOrder,
  GlobalTransform,
  Grid,
  InnerShadow,
  Opacity,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Rough,
  Stroke,
  Theme,
  WindowResized,
  Wireframe,
} from '../components';
import { paddingMat3 } from '../utils';
import { GridRenderer } from './GridRenderer';
import { BatchManager } from './BatchManager';

export class MeshPipeline extends System {
  private rendererResource = this.attach(SetupDevice);
  private prepareViewUniforms = this.attach(PrepareViewUniforms);
  private batchManager = this.attach(BatchManager);

  private readonly theme = this.singleton.read(Theme);
  private readonly grid = this.singleton.read(Grid);

  private windowResized = this.query(
    (q) => q.changed.with(WindowResized).trackWrites,
  );

  private grids = this.query((q) => q.addedOrChanged.with(Grid).trackWrites);
  private themes = this.query((q) => q.addedOrChanged.with(Theme).trackWrites);

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
          FillSolid,
          Opacity,
          Stroke,
          InnerShadow,
          DropShadow,
          Wireframe,
          GlobalRenderOrder,
          Rough,
          ComputedRough,
        ).read,
    );
  }

  initialize() {
    const { device } = this.rendererResource;
    const [buffer, legacyObject] = this.updateUniform(true);
    this.#uniformBuffer = device.createBuffer({
      viewOrSize: buffer,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });
    this.#uniformLegacyObject = legacyObject;

    this.#gridRenderer = new GridRenderer();
  }

  private renderFrame() {
    const { swapChain, device, renderTarget, depthRenderTarget } =
      this.rendererResource;
    const { width, height } = swapChain.getCanvas();
    const onscreenTexture = swapChain.getOnscreenTexture();

    // const shouldRenderGrid =
    //     !this.#enableCapture ||
    //     (this.#enableCapture && this.#captureOptions?.grid);
    const shouldRenderGrid = true;

    const [buffer, legacyObject] = this.updateUniform(shouldRenderGrid);
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
    let needRender = false;
    this.windowResized.changed.forEach((entity) => {
      needRender = true;

      console.log('window resized');
    });
    this.themes.addedOrChanged.forEach((entity) => {
      console.log('theme added or changed', this.theme.mode);
      needRender = true;
    });
    this.grids.addedOrChanged.forEach((entity) => {
      console.log('grid added or changed', this.theme.mode);
      needRender = true;
    });

    if (needRender) {
      console.log('render');
      this.renderFrame();
    }
  }

  finalize() {
    this.batchManager.clear();
    this.#gridRenderer.destroy();
  }

  private updateUniform(
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
      this.prepareViewUniforms;

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
