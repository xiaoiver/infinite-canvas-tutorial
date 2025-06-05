import * as d3 from 'd3-color';
import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  SwapChain,
  TransparentBlack,
} from '@antv/g-device-api';
import {
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  Culled,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  FractionalIndex,
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
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  Text,
  Theme,
  ToBeDeleted,
  Wireframe,
} from '../components';
import { paddingMat3 } from '../utils';
import { GridRenderer } from './GridRenderer';
import { BatchManager } from './BatchManager';
import { getSceneRoot } from './Transform';

export class MeshPipeline extends System {
  private canvases = this.query((q) => q.current.with(Canvas).read);

  private cameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  private renderables = this.query(
    (q) =>
      q.addedOrChanged
        .with(Renderable)
        .withAny(Circle, Ellipse, Rect, Polyline, Path, Text).trackWrites,
  );

  private toBeDeleted = this.query(
    (q) => q.addedOrChanged.with(ToBeDeleted).trackWrites,
  );

  private culleds = this.query(
    (q) => q.addedOrChanged.and.removed.with(Culled).trackWrites,
  );

  private grids = this.query(
    (q) => q.addedChangedOrRemoved.with(Grid).trackWrites,
  );
  private themes = this.query(
    (q) => q.addedChangedOrRemoved.with(Theme).trackWrites,
  );

  private rasterScreenshotRequests = this.query(
    (q) => q.addedChangedOrRemoved.with(RasterScreenshotRequest).trackWrites,
  );

  private styles = this.query(
    (q) =>
      q.addedChangedOrRemoved.withAny(
        FillSolid,
        FillGradient,
        FillPattern,
        FillTexture,
        FillImage,
        Stroke,
        Opacity,
        InnerShadow,
        DropShadow,
        Wireframe,
        Rough,
        FractionalIndex,
      ).trackWrites,
  );

  gpuResources: Map<
    Entity,
    {
      uniformBuffer: Buffer;
      uniformLegacyObject: Record<string, unknown>;
      gridRenderer: GridRenderer;
      batchManager: BatchManager;
    }
  > = new Map();

  private pendingRenderables: WeakMap<
    Entity,
    {
      add: Entity[];
      remove: Entity[];
    }
  > = new WeakMap();

  constructor() {
    super();
    this.query(
      (q) =>
        q.current
          .with(
            Theme,
            Grid,
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
            ComputedBounds,
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
            FractionalIndex,
            SizeAttenuation,
            StrokeAttenuation,
          )
          .read.and.using(RasterScreenshotRequest, Screenshot).write,
    );
  }

  @co private *setScreenshotTrigger(
    canvas: Entity,
    dataURL: string,
    download: boolean,
  ): Generator {
    if (!canvas.has(Screenshot)) {
      canvas.add(Screenshot);
    }

    const screenshot = canvas.write(Screenshot);

    Object.assign(screenshot, { dataURL, canvas, download });
    yield;

    canvas.remove(Screenshot);
    canvas.remove(RasterScreenshotRequest);
  }

  private renderCamera(canvas: Entity, camera: Entity, sort = false) {
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

    const request = canvas.has(RasterScreenshotRequest)
      ? canvas.read(RasterScreenshotRequest)
      : null;

    const { type, encoderOptions, grid, download } = request ?? {
      type: 'image/png',
      encoderOptions: 1,
      grid: false,
    };

    const { width, height } = swapChain.getCanvas();
    const onscreenTexture = swapChain.getOnscreenTexture();

    const shouldRenderGrid = !request || grid;

    if (!this.gpuResources.get(camera)) {
      this.gpuResources.set(camera, {
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
      canvas,
      camera,
      shouldRenderGrid,
      swapChain,
    );
    this.gpuResources.set(camera, {
      ...this.gpuResources.get(camera),
      uniformLegacyObject: legacyObject,
    });

    const { uniformBuffer, uniformLegacyObject, gridRenderer, batchManager } =
      this.gpuResources.get(camera);

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

    if (this.pendingRenderables.has(camera)) {
      this.pendingRenderables.get(camera).add.forEach((entity) => {
        batchManager.add(entity);
      });
      this.pendingRenderables.get(camera).remove.forEach((entity) => {
        // TODO: split removed and culled
        batchManager.remove(entity, false);
      });
      this.pendingRenderables.delete(camera);
    }

    if (sort) {
      batchManager.sort();
    }
    batchManager.flush(renderPass, uniformBuffer, uniformLegacyObject);

    device.submitPass(renderPass);
    device.endFrame();

    if (request) {
      const dataURL = (swapChain.getCanvas() as HTMLCanvasElement).toDataURL(
        type,
        encoderOptions,
      );
      this.setScreenshotTrigger(canvas, dataURL, download);
    }
  }

  execute() {
    new Set([
      ...this.renderables.addedOrChanged,
      ...this.culleds.removed,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, {
          add: [],
          remove: [],
        });
      }
      this.pendingRenderables.get(camera).add.push(entity);
    });

    new Set([
      ...this.toBeDeleted.addedOrChanged,
      // ...this.renderables.removed,
      ...this.culleds.addedOrChanged,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, {
          add: [],
          remove: [],
        });
      }
      this.pendingRenderables.get(camera).remove.push(entity);
    });

    this.canvases.current.forEach((canvas) => {
      let toRender =
        this.grids.addedChangedOrRemoved.includes(canvas) ||
        this.themes.addedChangedOrRemoved.includes(canvas) ||
        this.rasterScreenshotRequests.addedChangedOrRemoved.includes(canvas);

      const { cameras } = canvas.read(Canvas);
      cameras.forEach((camera) => {
        if (!toRender && this.pendingRenderables.get(camera)) {
          const { add, remove } = this.pendingRenderables.get(camera);
          toRender = !!(add.length || remove.length);
        }

        if (!toRender && this.cameras.addedOrChanged.includes(camera)) {
          toRender = true;
        }

        if (!toRender && !!this.styles.addedChangedOrRemoved.length) {
          toRender = true;
        }

        if (toRender) {
          this.renderCamera(canvas, camera, true);
        }
      });
    });
  }

  finalize() {
    this.gpuResources.forEach(({ gridRenderer, batchManager }) => {
      gridRenderer.destroy();
      batchManager.clear();
      batchManager.destroy();
    });
  }

  private updateUniform(
    canvas: Entity,
    camera: Entity,
    shouldRenderGrid: boolean,
    swapChain: SwapChain,
  ): [Float32Array, Record<string, unknown>] {
    const { mode, colors } = canvas.read(Theme);
    const { checkboardStyle } = canvas.read(Grid);
    const computedCamera = camera.read(ComputedCamera);

    const { width, height } = swapChain.getCanvas();

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
        ].indexOf(checkboardStyle)
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
