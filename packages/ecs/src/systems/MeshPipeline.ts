import * as d3 from 'd3-color';
import { mat3 } from 'gl-matrix';
import { co, Entity, System } from '@lastolivegames/becsy';
import {
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  SwapChain,
  TransparentWhite,
} from '@infinite-canvas-tutorial/device-api';
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
  AnimationExportOutput,
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
  RasterAnimationExportRequest,
  RasterScreenshotRequest,
  Rect,
  Renderable,
  Rough,
  Screenshot,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  StrokeGradient,
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
  Mat3,
  Locked,
  ClipMode,
  Flex,
  IconFont,
  IconFontEllipseStrokeRasterPlaceholder,
} from '../components';
import {
  Effect,
  filterStringUsesEngineTimePost,
  paddingMat3,
  parseColor,
  parseEffect,
} from '../utils';
import type { SerializedNode } from '../types/serialized-node';
import { GridRenderer } from '../render-graph/GridRenderer';
import { BatchManager } from './BatchManager';
import { getSceneRoot } from './Transform';
import {
  pickWebmMimeType,
  recordWebMFromCanvas,
  encodeGifFromCanvas,
  maxColorsForAnimationGifQuality,
} from '../utils/animationExportCodec';
import { setPostEffectEngineTimeSeconds } from '../utils/postEffectEngineTime';
import { safeAddComponent, safeRemoveComponent } from '../history';
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

/**
 * 动画栅格导出或覆盖引擎时间时传入 {@link MeshPipeline.renderCamera}。
 */
export type MeshRenderCameraOptions = {
  postEffectTimeSec?: number;
  rasterForExport?: {
    grid: boolean;
    nodes: SerializedNode[];
    scale: number;
  };
};

/**
 * 与 {@link BatchManager} / `getDrawcallCtors` 中参与批次的图元类型一致；用于判断实体是否本帧应加入局部导出批次。
 * iconfont 等组合节点在父级无 Path/Rect 等，图元在子实体上，仅 add 根节点时不会生成任何 drawcall。
 */
function entityHasPartialExportGeometry(e: Entity): boolean {
  return (
    e.has(Circle) ||
    e.has(Ellipse) ||
    e.has(Rect) ||
    e.has(Line) ||
    e.has(Polyline) ||
    e.has(Path) ||
    e.has(Text) ||
    e.has(Brush) ||
    e.has(VectorNetwork)
  );
}

/**
 * 自根节点 DFS，收集子树中所有带可栅格化几何的实体（含根自身若具备几何）。
 */
function collectDescendantsWithPartialExportGeometry(root: Entity): Entity[] {
  const out: Entity[] = [];
  const visit = (e: Entity) => {
    if (entityHasPartialExportGeometry(e)) {
      out.push(e);
    }
    if (e.has(Parent)) {
      for (const c of e.read(Parent).children) {
        visit(c);
      }
    }
  };
  visit(root);
  return out;
}

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

  private rasterAnimationExportRequests = this.query(
    (q) => q.addedChangedOrRemoved.with(RasterAnimationExportRequest).trackWrites,
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
  private strokeGradients = this.query(
    (q) => q.addedChangedOrRemoved.with(StrokeGradient).trackWrites,
  );
  private rectsStrokeGradientBounds = this.query(
    (q) => q.addedChangedOrRemoved.with(Rect).trackWrites,
  );
  private ellipsesStrokeGradientBounds = this.query(
    (q) => q.addedChangedOrRemoved.with(Ellipse).trackWrites,
  );
  private circlesStrokeGradientBounds = this.query(
    (q) => q.addedChangedOrRemoved.with(Circle).trackWrites,
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
  /** Used to force continuous frames when CRT `useEngineTime` animates without component churn. */
  private filtersCurrent = this.query((q) => q.current.with(Filter).read);
  private clipModes = this.query(
    (q) => q.addedChangedOrRemoved.with(ClipMode).trackWrites,
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
            StrokeGradient,
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
            Locked,
            ClipMode,
            Flex,
            IconFont,
            IconFontEllipseStrokeRasterPlaceholder,
          )
          .read.and.using(
            RasterScreenshotRequest,
            RasterAnimationExportRequest,
            AnimationExportOutput,
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
    safeAddComponent(canvas, Screenshot);
    const screenshot = canvas.write(Screenshot);

    Object.assign(screenshot, { dataURL, canvas, download });
    yield;

    safeRemoveComponent(canvas, Screenshot);
    safeRemoveComponent(canvas, RasterScreenshotRequest);
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

  private renderCamera(
    canvas: Entity,
    camera: Entity,
    sort = false,
    renderOpts?: MeshRenderCameraOptions,
  ) {
    if (!canvas.has(GPUResource)) {
      return;
    }

    if (renderOpts?.postEffectTimeSec != null) {
      setPostEffectEngineTimeSeconds(renderOpts.postEffectTimeSec);
    }

    let renderer: GPURenderer;
    let gpuResource = canvas.read(GPUResource);

    const { api } = canvas.read(Canvas);
    const { filter } = api.getAppState();

    const request = canvas.has(RasterScreenshotRequest)
      ? canvas.read(RasterScreenshotRequest)
      : null;
    const raster = request
      ? request
      : renderOpts?.rasterForExport
        ? {
          type: 'image/png' as const,
          encoderOptions: 0.92,
          grid: renderOpts.rasterForExport.grid,
          download: false,
          nodes: renderOpts.rasterForExport.nodes,
          scale: renderOpts.rasterForExport.scale,
        }
        : null;
    const { type, encoderOptions, grid, download, nodes, scale: rasterScale = 1 } =
      raster ?? {
        type: 'image/png' as const,
        encoderOptions: 1,
        grid: false,
        nodes: [],
        scale: 1,
      };
    const shouldRenderGrid = !raster || grid;
    const shouldRenderPartially = nodes.length > 0;

    const PADDING = 0;
    let exportViewOverride: {
      projectionMatrix: Mat3;
      viewMatrix: Mat3;
      viewProjectionMatrixInv: Mat3;
      zoom: number;
    } | null = null;

    if (shouldRenderPartially) {
      const bounds = api.getBounds(nodes);
      const exportLogicalWidth = bounds.maxX - bounds.minX + 2 * PADDING;
      const exportLogicalHeight = bounds.maxY - bounds.minY + 2 * PADDING;
      if (
        bounds.minX <= bounds.maxX &&
        bounds.minY <= bounds.maxY &&
        exportLogicalWidth > 0 &&
        exportLogicalHeight > 0
      ) {
        const s = Math.max(
          0.25,
          Math.min(8, Number.isFinite(rasterScale) ? rasterScale : 1),
        );
        // 与主画布一致：投影用「逻辑」选区宽高，离屏 buffer 为 逻辑×s 像素，使 1 个世界单位在图像上占 s 个像素。
        // 若投影也乘 s，则正交范围变成 0..(逻辑×s)，而节点仍在 0..逻辑 内，内容只会占图像的 1/s 区域。
        const exportPixelWidth = Math.max(1, Math.ceil(exportLogicalWidth * s));
        const exportPixelHeight = Math.max(
          1,
          Math.ceil(exportLogicalHeight * s),
        );
        this.setupDevice.resizeOffscreen(exportPixelWidth, exportPixelHeight);

        const viewMatrixGL = mat3.create();
        mat3.translate(viewMatrixGL, viewMatrixGL, [
          -(bounds.minX - PADDING),
          -(bounds.minY - PADDING),
        ]);
        const projectionMatrixGL = mat3.projection(
          mat3.create(),
          exportLogicalWidth,
          exportLogicalHeight,
        );
        const viewProjectionMatrix = mat3.multiply(
          mat3.create(),
          projectionMatrixGL,
          viewMatrixGL,
        );
        const viewProjectionMatrixInv = mat3.invert(
          mat3.create(),
          viewProjectionMatrix,
        );
        exportViewOverride = {
          projectionMatrix: Mat3.fromGLMat3(projectionMatrixGL),
          viewMatrix: Mat3.fromGLMat3(viewMatrixGL),
          viewProjectionMatrixInv: viewProjectionMatrixInv
            ? Mat3.fromGLMat3(viewProjectionMatrixInv)
            : Mat3.IDENTITY,
          zoom: 1,
        };
      }
    }

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

    if (raster) {
      batchManager.hideUIs();
    }

    const [buffer, legacyObject] = this.updateUniform(
      canvas,
      camera,
      shouldRenderGrid,
      swapChain,
      exportViewOverride,
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
          // Add clip parent if exists.
          const clipParents = new Set<Entity>();
          nodes.forEach((node: SerializedNode) => {
            const parentNode = node.parentId && api.getNodeById(node.parentId);
            const parentEntity = parentNode && api.getEntity(parentNode);
            const needRenderClipParent = parentNode && !nodes.includes(parentNode) && parentNode.clipMode && !clipParents.has(parentEntity);
            if (needRenderClipParent) {
              clipParents.add(parentEntity);
              batchManager.add(parentEntity);
            }

            const rootEntity = api.getEntity(node);
            const withGeometry = collectDescendantsWithPartialExportGeometry(
              rootEntity,
            );
            const toBatch =
              withGeometry.length > 0 ? withGeometry : [rootEntity];
            for (const e of toBatch) {
              batchManager.add(e);
            }
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

  private async runRasterAnimationExport(
    canvas: Entity,
    camera: Entity,
    req: {
      download: boolean;
      format: 'webm' | 'gif';
      durationSec: number;
      fps: number;
      grid: boolean;
      nodes: SerializedNode[];
      scale: number;
      timeStart: number;
      gifQuality: 'high' | 'medium' | 'low';
    },
  ): Promise<void> {
    const { durationSec, fps, timeStart, download } = req;
    let { format } = req;
    const totalFrames = Math.max(
      1,
      Math.min(450, Math.ceil(Math.max(0, durationSec) * Math.max(1, fps))),
    );
    const invFps = 1 / Math.max(1, fps);
    const renderFrame = (frameIndex: number) => {
      this.renderCamera(canvas, camera, true, {
        postEffectTimeSec: timeStart + frameIndex * invFps,
        rasterForExport: {
          grid: req.grid,
          nodes: req.nodes,
          scale: req.scale,
        },
      });
    };
    if (!canvas.has(GPUResource)) {
      return;
    }
    if (format === 'webm' && !pickWebmMimeType()) {
      format = 'gif';
    }
    const usePartial = req.nodes.length > 0;
    const getExportCanvas = (): HTMLCanvasElement => {
      if (usePartial) {
        return this.setupDevice
          .getOffscreenGPUResource()
          .swapChain.getCanvas() as HTMLCanvasElement;
      }
      return canvas
        .read(GPUResource)
        .swapChain.getCanvas() as HTMLCanvasElement;
    };
    try {
      let blob: Blob;
      if (format === 'webm') {
        blob = await recordWebMFromCanvas(
          getExportCanvas,
          totalFrames,
          renderFrame,
        );
      } else {
        blob = await encodeGifFromCanvas(
          getExportCanvas,
          totalFrames,
          fps,
          renderFrame,
          0.92,
          maxColorsForAnimationGifQuality(req.gifQuality),
        );
      }
      const ext = format === 'webm' ? 'webm' : 'gif';
      safeAddComponent(canvas, AnimationExportOutput, {
        canvas,
        download,
        blob,
        fileName: `infinite-canvas-animation.${ext}`,
      });
    } catch (e) {
      console.error('Raster animation export failed', e);
    }
  }

  private anyFilterUsesEngineTimePost(): boolean {
    for (const entity of this.filtersCurrent.current) {
      const { value } = entity.read(Filter);
      if (filterStringUsesEngineTimePost(value)) {
        return true;
      }
    }
    return false;
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
          entity.has(Rough) ||
          entity.has(Brush)
        ) {
          safeAddComponent(entity, GeometryDirty);
        }
        if (entity.has(Text)) {
          safeAddComponent(entity, MaterialDirty);
        }
      }

      if (entity.has(FillGradient) || entity.has(StrokeGradient)) {
        safeAddComponent(entity, MaterialDirty);
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

    new Set([
      ...this.rectsStrokeGradientBounds.addedChangedOrRemoved,
      ...this.ellipsesStrokeGradientBounds.addedChangedOrRemoved,
      ...this.circlesStrokeGradientBounds.addedChangedOrRemoved,
    ]).forEach((entity) => {
      if (entity.has(StrokeGradient)) {
        safeAddComponent(entity, MaterialDirty);
        safeAddComponent(entity, GeometryDirty);
      }
    });

    const engineTimeNeedsContinuousRender = this.anyFilterUsesEngineTimePost();

    this.canvases.current.forEach((canvas) => {
      if (
        this.rasterAnimationExportRequests.addedChangedOrRemoved.includes(
          canvas,
        ) &&
        canvas.has(RasterAnimationExportRequest)
      ) {
        const r = canvas.read(RasterAnimationExportRequest);
        const snapshot = {
          download: r.download,
          format: r.format,
          durationSec: r.durationSec,
          fps: r.fps,
          grid: r.grid,
          nodes: r.nodes,
          scale: r.scale,
          timeStart: r.timeStart,
          gifQuality: r.gifQuality,
        };
        safeRemoveComponent(canvas, RasterAnimationExportRequest);
        const { cameras } = canvas.read(Canvas);
        const firstCamera = cameras[0];
        if (firstCamera) {
          void this.runRasterAnimationExport(canvas, firstCamera, snapshot);
        }
        return;
      }
      let toRender =
        this.grids.addedChangedOrRemoved.includes(canvas) ||
        this.themes.addedChangedOrRemoved.includes(canvas) ||
        this.rasterScreenshotRequests.addedChangedOrRemoved.includes(canvas) ||
        engineTimeNeedsContinuousRender;

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
            !!this.strokeGradients.addedChangedOrRemoved.length ||
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
            !!this.filters.addedChangedOrRemoved.length ||
            !!this.clipModes.addedChangedOrRemoved.length)
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
    viewOverride?: {
      projectionMatrix: Mat3;
      viewMatrix: Mat3;
      viewProjectionMatrixInv: Mat3;
      zoom: number;
    } | null,
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
    } = parseColor(backgroundColor);
    const {
      r: gr,
      g: gg,
      b: gb,
      opacity: go,
    } = parseColor(gridColor);

    const { projectionMatrix, viewMatrix, viewProjectionMatrixInv, zoom } =
      viewOverride ?? computedCamera;

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
      u_ProjectionMatrix: Mat3.toGLMat3(u_ProjectionMatrix),
      u_ViewMatrix: Mat3.toGLMat3(u_ViewMatrix),
      u_ViewProjectionInvMatrix: Mat3.toGLMat3(u_ViewProjectionInvMatrix),
      u_BackgroundColor,
      u_GridColor,
      u_ZoomScale,
      u_CheckboardStyle,
      u_Viewport,
    };
    return [buffer, legacyObject];
  }
}
