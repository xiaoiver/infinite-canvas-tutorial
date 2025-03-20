import * as d3 from 'd3-color';
import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  SwapChain,
  TransparentBlack,
} from '@antv/g-device-api';
import { SetupDevice } from './SetupDevice';
import {
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  Circle,
  ComputedCamera,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  GPUResource,
  Grid,
  InnerShadow,
  Opacity,
  Path,
  Polyline,
  RasterScreenshotRequest,
  Rect,
  Renderable,
  Rough,
  Screenshot,
  Stroke,
  Text,
  Theme,
  Wireframe,
} from '../components';
import { paddingMat3 } from '../utils';
import { GridRenderer } from './GridRenderer';
import { BatchManager } from './BatchManager';
import { ComputeCamera } from './ComputeCamera';

export class MeshPipeline extends System {
  private readonly theme = this.singleton.read(Theme);
  private readonly grid = this.singleton.read(Grid);
  private readonly rasterScreenshotRequest = this.singleton.read(
    RasterScreenshotRequest,
  );
  private readonly screenshot = this.singleton.write(Screenshot);

  // private grids = this.query((q) => q.addedOrChanged.with(Grid).trackWrites);
  // private themes = this.query((q) => q.addedOrChanged.with(Theme).trackWrites);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private renderables = this.query(
    (q) =>
      q.addedOrChanged.and.removed
        .with(Renderable)
        .withAny(Circle, Ellipse, Rect, Polyline, Path, Text).trackWrites,
  );

  // private styles = this.query(
  //   (q) =>
  //     q.addedChangedOrRemoved.withAny(
  //       FillSolid,
  //       FillGradient,
  //       FillPattern,
  //       FillTexture,
  //       FillImage,
  //       Stroke,
  //       Opacity,
  //       InnerShadow,
  //       DropShadow,
  //       Wireframe,
  //       Rough,
  //     ).trackWrites,
  // );

  gpuResources: Map<
    Entity['__id'],
    {
      uniformBuffer: Buffer;
      uniformLegacyObject: Record<string, unknown>;
      gridRenderer: GridRenderer;
      batchManager: BatchManager;
    }
  > = new Map();

  private pendingRenderables: Record<
    Entity['__id'],
    {
      add: Entity[];
      remove: Entity[];
    }
  > = {};

  constructor() {
    super();
    this.query(
      (q) =>
        q.current.with(
          GPUResource,
          Camera,
          ComputedCamera,
          Children,
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
          FillImage,
          FillPattern,
          FillGradient,
          FillSolid,
          FillTexture,
        ).read,
    );

    this.schedule((s) => s.after(ComputeCamera, SetupDevice));
  }

  @co private *setScreenshotTrigger(dataURL: string): Generator {
    Object.assign(this.screenshot, { dataURL });
    yield;
    Object.assign(this.screenshot, { dataURL: '' });
  }

  private renderCamera(camera: Entity, canvas: Entity) {
    if (!canvas.has(GPUResource)) {
      return;
    }

    const {
      swapChain,
      device,
      renderTarget,
      depthRenderTarget,
      renderCache,
      texturePool,
    } = canvas.read(GPUResource);

    const { width, height } = swapChain.getCanvas();
    const onscreenTexture = swapChain.getOnscreenTexture();

    const shouldRenderGrid =
      !this.rasterScreenshotRequest.enabled ||
      this.rasterScreenshotRequest.grid;

    if (!this.gpuResources.get(camera.__id)) {
      this.gpuResources.set(camera.__id, {
        uniformBuffer: device.createBuffer({
          viewOrSize: (16 * 3 + 4 * 5) * Float32Array.BYTES_PER_ELEMENT,
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        }),
        uniformLegacyObject: null,
        gridRenderer: new GridRenderer(),
        batchManager: new BatchManager(device, renderCache, texturePool),
      });
    }

    const [buffer, legacyObject] = this.updateUniform(
      camera,
      shouldRenderGrid,
      swapChain,
    );
    this.gpuResources.set(camera.__id, {
      ...this.gpuResources.get(camera.__id),
      uniformLegacyObject: legacyObject,
    });

    const { uniformBuffer, uniformLegacyObject, gridRenderer, batchManager } =
      this.gpuResources.get(camera.__id);

    uniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    device.beginFrame();

    const renderPass = device.createRenderPass({
      colorAttachment: [renderTarget],
      colorResolveTo: [onscreenTexture],
      colorClearColor: [TransparentBlack],
      depthStencilAttachment: depthRenderTarget,
      depthClearValue: 1,
    });
    renderPass.setViewport(0, 0, width, height);

    gridRenderer.render(device, renderPass, uniformBuffer, uniformLegacyObject);

    if (this.pendingRenderables[camera.__id]) {
      this.pendingRenderables[camera.__id].add.forEach((entity) => {
        batchManager.add(entity);
      });
      this.pendingRenderables[camera.__id].remove.forEach((entity) => {
        batchManager.remove(entity);
      });
      delete this.pendingRenderables[camera.__id];
    }

    batchManager.flush(renderPass, uniformBuffer, uniformLegacyObject);

    device.submitPass(renderPass);
    device.endFrame();

    if (this.rasterScreenshotRequest.enabled) {
      const { type, encoderOptions } = this.rasterScreenshotRequest;
      const dataURL = (swapChain.getCanvas() as HTMLCanvasElement).toDataURL(
        type,
        encoderOptions,
      );
      this.setScreenshotTrigger(dataURL);
    }
  }

  execute() {
    // if (this.rasterScreenshotRequest.enabled) {
    //   console.log('raster screenshot');
    // }
    this.canvases.current.forEach((canvas) => {
      const { cameras } = canvas.read(Canvas);
      cameras.forEach((camera) => {
        this.renderCamera(camera, canvas);
      });

      // let needRender = true;
      // Style changed.
      // (this.computedCameras.addedOrChanged.length ||
      //   this.styles.addedChangedOrRemoved.length ||
      //   this.themes.addedOrChanged.length ||
      //   this.grids.addedOrChanged.length) &&
      //   (needRender = true);
    });

    this.renderables.addedOrChanged.forEach((entity) => {
      const camera = this.getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables[camera.__id]) {
        this.pendingRenderables[camera.__id] = {
          add: [],
          remove: [],
        };
      }
      this.pendingRenderables[camera.__id].add.push(entity);
    });

    this.renderables.removed.forEach((entity) => {
      const camera = this.getSceneRoot(entity);
      this.pendingRenderables[camera.__id].remove.push(entity);
    });
  }

  finalize() {
    this.gpuResources.forEach(({ gridRenderer, batchManager }) => {
      gridRenderer.destroy();
      batchManager.clear();
      batchManager.destroy();
    });
  }

  private getSceneRoot(entity: Entity): Entity {
    if (!entity.has(Children)) {
      return entity;
    }

    const parent = entity.read(Children).parent;
    if (parent) {
      return this.getSceneRoot(parent);
    }
    return entity;
  }

  private updateUniform(
    entity: Entity,
    shouldRenderGrid: boolean,
    swapChain: SwapChain,
  ): [Float32Array, Record<string, unknown>] {
    const computedCamera = entity.read(ComputedCamera);

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
