import * as d3 from 'd3-color';
import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  SwapChain,
  TransparentWhite,
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
  Line,
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
  MaterialDirty,
  GeometryDirty,
  TextDecoration,
  Parent,
  UI,
  ZIndex,
  Brush,
  Marker,
  VectorNetwork,
  Filter,
  Transform,
} from '../components';
import { Effect, paddingMat3, parseEffect, SerializedNode } from '../utils';
import { GridRenderer } from '../render-graph/GridRenderer';
import { BatchManager } from './BatchManager';
import { getSceneRoot } from './Transform';
import { safeAddComponent } from '../history';
import { SetupDevice } from './SetupDevice';
import { API } from '../API';
import { RGAttachmentSlot } from '../render-graph/interface';
import {
  AntialiasingMode,
  makeAttachmentClearDescriptor,
  makeBackbufferDescSimple,
  opaqueWhiteFullClearRenderPassDescriptor,
} from '../render-graph/utils';
import { RenderGraph } from '../render-graph/RenderGraph';
import { PostProcessingRenderer } from '../render-graph/PostProcessingRenderer';

type GPURenderer = {
  uniformBuffer: Buffer;
  uniformLegacyObject: Record<string, unknown>;
  gridRenderer: GridRenderer;
  batchManager: BatchManager;
  filters: Record<Effect['type'], PostProcessingRenderer>;
  renderGraph: RenderGraph;
};

export class MeshPipeline extends System {
  private setupDevice = this.attach(SetupDevice);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private cameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  private renderables = this.query(
    (q) =>
      q.added.and.changed.and.removed
        .with(Renderable)
        .withAny(
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          Text,
          Brush,
          VectorNetwork,
          Transform,
        ).trackWrites,
  );

  private lines = this.query((q) => q.added.and.removed.with(Line));
  private polylines = this.query((q) => q.added.and.removed.with(Polyline));
  private paths = this.query((q) => q.added.and.removed.with(Path));
  private vectorNetworks = this.query((q) =>
    q.added.and.removed.with(VectorNetwork),
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

  private fillSolids = this.query(
    (q) => q.addedChangedOrRemoved.with(FillSolid).trackWrites,
  );
  private fillGradients = this.query(
    (q) => q.addedChangedOrRemoved.with(FillGradient).trackWrites,
  );
  private fillPatterns = this.query(
    (q) => q.addedChangedOrRemoved.with(FillPattern).trackWrites,
  );
  private fillTextures = this.query(
    (q) => q.addedChangedOrRemoved.with(FillTexture).trackWrites,
  );
  private fillImages = this.query(
    (q) => q.addedChangedOrRemoved.with(FillImage).trackWrites,
  );
  private strokes = this.query(
    (q) => q.addedChangedOrRemoved.with(Stroke).trackWrites,
  );
  private opacities = this.query(
    (q) => q.addedChangedOrRemoved.with(Opacity).trackWrites,
  );
  private innerShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(InnerShadow).trackWrites,
  );
  private dropShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(DropShadow).trackWrites,
  );
  private wireframes = this.query(
    (q) => q.addedChangedOrRemoved.with(Wireframe).trackWrites,
  );
  private roughs = this.query(
    (q) => q.addedChangedOrRemoved.with(Rough).trackWrites,
  );
  private fractionalIndexes = this.query(
    (q) => q.addedChangedOrRemoved.with(FractionalIndex).trackWrites,
  );
  private textDecorations = this.query(
    (q) => q.addedChangedOrRemoved.with(TextDecoration).trackWrites,
  );
  private sizeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(SizeAttenuation).trackWrites,
  );
  private strokeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(StrokeAttenuation).trackWrites,
  );
  private markers = this.query(
    (q) => q.addedChangedOrRemoved.with(Marker).trackWrites,
  );
  private filters = this.query(
    (q) => q.addedChangedOrRemoved.with(Filter).trackWrites,
  );

  renderers: Map<Entity, GPURenderer> = new Map();

  private pendingRenderables: WeakMap<
    Entity,
    {
      type: 'add' | 'remove';
      entity: Entity;
    }[]
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
            Parent,
            Children,
            Circle,
            Ellipse,
            Rect,
            Line,
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
            TextDecoration,
            UI,
            ZIndex,
            Marker,
          )
          .read.and.using(
            RasterScreenshotRequest,
            Screenshot,
            GeometryDirty,
            MaterialDirty,
          ).write,
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

  private createRenderer(gpuResource: GPUResource, api: API) {
    const { device, swapChain, renderCache, texturePool, renderGraph } =
      gpuResource;
    return {
      uniformBuffer: device.createBuffer({
        viewOrSize: (16 * 3 + 4 * 5) * Float32Array.BYTES_PER_ELEMENT,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      }),
      uniformLegacyObject: null,
      gridRenderer: new GridRenderer(),
      filters: {} as Record<Effect['type'], PostProcessingRenderer>,
      batchManager: new BatchManager(
        device,
        swapChain,
        renderCache,
        texturePool,
        api,
      ),
      renderGraph,
    };
  }

  private renderCamera(canvas: Entity, camera: Entity, sort = false) {
    if (!canvas.has(GPUResource)) {
      return;
    }

    let renderer: GPURenderer;
    let gpuResource = canvas.read(GPUResource);

    const { api } = canvas.read(Canvas);
    const { filter } = api.getAppState();

    const request = canvas.has(RasterScreenshotRequest)
      ? canvas.read(RasterScreenshotRequest)
      : null;
    const { type, encoderOptions, grid, download, nodes } = request ?? {
      type: 'image/png',
      encoderOptions: 1,
      grid: false,
      nodes: [],
    };
    const shouldRenderGrid = !request || grid;
    const shouldRenderPartially = nodes.length > 0;

    if (shouldRenderPartially) {
      // Render to offscreen canvas.
      gpuResource = this.setupDevice.getOffscreenGPUResource();
      renderer = this.createRenderer(gpuResource, api);
    } else {
      if (!this.renderers.get(camera)) {
        this.renderers.set(camera, this.createRenderer(gpuResource, api));
      }
      renderer = this.renderers.get(camera);
    }

    const { swapChain, device, renderCache, renderGraph } = gpuResource;
    const { uniformBuffer, gridRenderer, batchManager, filters } = renderer;

    const { width, height } = swapChain.getCanvas();
    const onscreenTexture = swapChain.getOnscreenTexture();

    if (request) {
      batchManager.hideUIs();
    }

    const [buffer, legacyObject] = this.updateUniform(
      canvas,
      camera,
      shouldRenderGrid,
      swapChain,
    );
    renderer.uniformLegacyObject = legacyObject;

    uniformBuffer.setSubData(0, new Uint8Array(buffer.buffer));

    const renderInput = {
      backbufferWidth: width,
      backbufferHeight: height,
      antialiasingMode: AntialiasingMode.None,
    };

    const mainColorDesc = makeBackbufferDescSimple(
      RGAttachmentSlot.Color0,
      renderInput,
      makeAttachmentClearDescriptor(TransparentWhite),
    );
    const mainDepthDesc = makeBackbufferDescSimple(
      RGAttachmentSlot.DepthStencil,
      renderInput,
      opaqueWhiteFullClearRenderPassDescriptor,
    );

    const builder = renderGraph.newGraphBuilder();

    const mainColorTargetID = builder.createRenderTargetID(
      mainColorDesc,
      'Main Color',
    );
    const mainDepthTargetID = builder.createRenderTargetID(
      mainDepthDesc,
      'Main Depth',
    );
    builder.pushPass((pass) => {
      pass.setDebugName('Main Render Pass');
      pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
      pass.attachRenderTargetID(
        RGAttachmentSlot.DepthStencil,
        mainDepthTargetID,
      );
      pass.exec((renderPass) => {
        gridRenderer.render(device, renderPass, uniformBuffer, legacyObject);
        if (shouldRenderPartially) {
          const { api } = canvas.read(Canvas);
          nodes.forEach((node: SerializedNode) => {
            const entity = api.getEntity(node);
            batchManager.add(entity);
          });
        } else {
          if (this.pendingRenderables.has(camera)) {
            this.pendingRenderables.get(camera).forEach(({ type, entity }) => {
              if (type === 'remove') {
                batchManager.remove(entity, !entity.has(Culled));
              } else {
                batchManager.add(entity);
              }
            });
            this.pendingRenderables.delete(camera);
          }
        }

        if (sort) {
          batchManager.sort();
        }
        batchManager.flush(renderPass, uniformBuffer, legacyObject, builder);
      });
    });

    parseEffect(filter).forEach((effect) => {
      builder.pushPass((pass) => {
        pass.setDebugName(effect.type.toUpperCase());
        pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

        const mainColorResolveTextureID =
          builder.resolveRenderTarget(mainColorTargetID);
        pass.attachResolveTexture(mainColorResolveTextureID);
        pass.exec((passRenderer, scope) => {
          if (!filters[effect.type]) {
            filters[effect.type] = new PostProcessingRenderer(
              device,
              swapChain,
              renderCache,
            );
          }
          filters[effect.type].render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
            effect,
          );
        });
      });
    });

    builder.resolveRenderTargetToExternalTexture(
      mainColorTargetID,
      onscreenTexture,
    );
    renderGraph.execute();

    if (request) {
      const dataURL = (swapChain.getCanvas() as HTMLCanvasElement).toDataURL(
        type,
        encoderOptions,
      );
      this.setScreenshotTrigger(canvas, dataURL, download);
      batchManager.showUIs();
    }
  }

  execute() {
    new Set([
      ...this.renderables.added,
      ...this.renderables.changed,
      ...this.polylines.added,
      ...this.lines.added,
      ...this.paths.added,
      ...this.vectorNetworks.added,
      ...this.culleds.removed,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // TODO: batchable

      if (this.renderables.added.includes(entity)) {
        safeAddComponent(entity, GeometryDirty);
        safeAddComponent(entity, MaterialDirty);
      }

      if (this.renderables.changed.includes(entity)) {
        if (
          entity.has(Line) ||
          entity.has(Polyline) ||
          entity.has(Path) ||
          entity.has(Text) ||
          entity.has(Rough)
        ) {
          safeAddComponent(entity, GeometryDirty);
        }
        if (entity.has(Text)) {
          safeAddComponent(entity, MaterialDirty);
        }
      }

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }
      this.pendingRenderables.get(camera).push({
        type: 'add',
        entity,
      });
    });

    new Set([
      ...this.toBeDeleted.addedOrChanged,
      ...this.renderables.removed,
      ...this.polylines.removed,
      ...this.lines.removed,
      ...this.paths.removed,
      ...this.vectorNetworks.removed,
      ...this.culleds.addedOrChanged,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }
      this.pendingRenderables.get(camera).push({
        type: 'remove',
        entity,
      });
    });

    // Handle some special cases.
    [
      ...this.strokes.addedChangedOrRemoved,
      ...this.markers.addedChangedOrRemoved,
    ].forEach((entity) => {
      if (entity.has(Polyline) || entity.has(Path) || entity.has(Line)) {
        safeAddComponent(entity, GeometryDirty);
      }
    });

    this.canvases.current.forEach((canvas) => {
      let toRender =
        this.grids.addedChangedOrRemoved.includes(canvas) ||
        this.themes.addedChangedOrRemoved.includes(canvas) ||
        this.rasterScreenshotRequests.addedChangedOrRemoved.includes(canvas);

      const { cameras } = canvas.read(Canvas);
      cameras.forEach((camera) => {
        if (!toRender && this.pendingRenderables.get(camera)) {
          const pendingRenderables = this.pendingRenderables.get(camera);
          toRender = !!pendingRenderables.length;
        }

        if (!toRender && this.cameras.addedOrChanged.includes(camera)) {
          toRender = true;
        }

        if (
          !toRender &&
          (!!this.fillSolids.addedChangedOrRemoved.length ||
            !!this.fillGradients.addedChangedOrRemoved.length ||
            !!this.fillPatterns.addedChangedOrRemoved.length ||
            !!this.fillTextures.addedChangedOrRemoved.length ||
            !!this.fillImages.addedChangedOrRemoved.length ||
            !!this.strokes.addedChangedOrRemoved.length ||
            !!this.opacities.addedChangedOrRemoved.length ||
            !!this.innerShadows.addedChangedOrRemoved.length ||
            !!this.dropShadows.addedChangedOrRemoved.length ||
            !!this.wireframes.addedChangedOrRemoved.length ||
            !!this.roughs.addedChangedOrRemoved.length ||
            !!this.fractionalIndexes.addedChangedOrRemoved.length ||
            !!this.textDecorations.addedChangedOrRemoved.length ||
            !!this.sizeAttenuations.addedChangedOrRemoved.length ||
            !!this.strokeAttenuations.addedChangedOrRemoved.length ||
            !!this.markers.addedChangedOrRemoved.length ||
            !!this.filters.addedChangedOrRemoved.length)
        ) {
          toRender = true;
        }

        if (toRender) {
          this.renderCamera(canvas, camera, true);
        }
      });
    });
  }

  finalize() {
    this.renderers.forEach(
      ({ gridRenderer, batchManager, renderGraph, filters }) => {
        gridRenderer.destroy();
        Object.values(filters).forEach((filter) => {
          filter.destroy();
        });
        batchManager.clear();
        batchManager.destroy();
        renderGraph.destroy();
      },
    );
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
