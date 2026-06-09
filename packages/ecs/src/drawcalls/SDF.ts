import {
  type RenderPass,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  VertexStepMode,
  CompareFunction,
  TextureUsage,
  BindingsDescriptor,
  TransparentBlack,
  Texture,
  StencilOp,
  CullMode,
  InputLayout,
  Bindings,
  type RenderPipeline,
} from '@infinite-canvas-tutorial/device-api';
import { mat3 } from 'gl-matrix';
import { Entity } from '@lastolivegames/becsy';
import { Drawcall, ZINDEX_FACTOR, STENCIL_CLIP_REF } from './Drawcall';
import { vert, frag, Location } from '../shaders/sdf';
import {
  paddingMat3,
  parseColor,
  parseGradient,
  isMeshGradientGradient,
  parseEffect,
  getNodeLayerBlendMode,
  isNonNormalNodeLayerBlend,
  compositeNodeLayerBlendOnRenderPass,
} from '../utils';
import {
  fillLayerOpacity,
  fillLayersNeedFillImage,
  fillLayersShouldPrecompose,
  getEnabledFillLayers,
  getFirstSolidFillLayerValue,
  getMultiFillLayers,
  getSingleEnabledFillLayer,
  type FillLayerItem,
} from '../utils/fillLayers';
import {
  getFirstGradientStrokeLayerValue,
  resolveGpuStrokeColor,
  strokePaintAlphaMultipliers,
} from '../utils/strokeLayers';
import { composeFillLayerTexturesOnGpu } from '../utils/fillLayerComposeGpu';
import {
  getRasterFilterValueForShape,
  filterRasterPostEffects,
} from '../utils/filter';
import { scheduleFillImageSvgRerasterIfNeeded } from '../utils/fillImageSvgReraster';
import {
  getFillLayerDecodedBitmap,
  resolveImageFillRasterOptions,
  rasterizeFillLayerImageUrlForTexture,
  resolveFillLayerImageRasterPixelSize,
  transparentFillLayerCanvas,
} from '../utils/fill-layer-image-url-raster';
import { DOMAdapter } from '../environment';
import { upload2DRasterCanvasToTexture } from '../utils/rasterCanvasTextureUpload';
import { safeAddComponent } from '../history';
import {
  createFillAndStrokeRgbaRasterForFilter,
  expandBoundsForCenterCanvasStroke,
  getSdfGeometryBoundsForFilter,
  shouldBakeStrokeIntoRasterFilterTexture,
} from '../utils/solidShapeRasterForFilter';
import {
  Circle,
  Ellipse,
  FillLayers,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  InnerShadow,
  Mat3,
  MaterialDirty,
  Opacity,
  Rect,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
} from '../components';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class SDF extends Drawcall {
  // protected maxInstances: number = 1000;

  #uniformBuffer: Buffer;
  #texture: Texture;
  /** Unfiltered image GPU texture when applying {@link Filter} (chain samples this). */
  #rawFillImageTexture: Texture | null = null;
  /** True when {@link #texture} references the post-process chain output (do not `destroy` in SDF.destroy). */
  #fillTextureFromPostChain = false;
  /** Fill+stroke were rasterized for raster filters; GPU stroke width must be zero to avoid double draw. */
  #bakedStrokeIntoFilterTexture = false;

  /** Per-layer GPU textures when {@link FillLayers} contains gradients (Normal 叠加). */
  #fillLayerTextures: Texture[] = [];
  #fillLayerBindings: Bindings[] = [];
  #fillLayerBindingsSoftClipOutside: Bindings[] = [];
  /**
   * 多层填充中非最后一遍：禁止 depthWrite，否则与底层同深度、后续 pass 全部被深度测试丢弃（矩形走 SDF，见 Mesh 水彩注释）。
   */
  #pipelineMultiFillMidPass: RenderPipeline | null = null;
  #fillLayerBindingsMidPass: Bindings[] = [];
  #bindingsMultiFillMidPass: Bindings | null = null;
  #pipelineSoftClipOutsideMidPass: RenderPipeline | null = null;
  #fillLayerBindingsSoftClipOutsideMidPass: Bindings[] = [];
  #bindingsSoftClipOutsideMidPass: Bindings | null = null;
  /**
   * 含 `blendMode` 时已把多层预合成到 {@link Drawcall} 的 `#texture`，形状走单次填充绘制。
   */
  #usePrecomposedMultiFill = false;

  protected override get extraShaderDefines(): string {
    const s = this.shapes[0];
    if (!s || this.instanced) {
      return super.extraShaderDefines;
    }
    if (shouldBakeStrokeIntoRasterFilterTexture(s)) {
      return `${super.extraShaderDefines}#define USE_FILLIMAGE_BAKED_STROKE\n`;
    }
    return super.extraShaderDefines;
  }

  static useDash(shape: Entity) {
    const { dasharray } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { dasharray: [0, 0] };
    return dasharray[0] > 0 && dasharray[1] > 0;
  }

  /**
   * Run GPU post chain on `raw` when {@link Filter} lists raster-supported effects
   * ({@link filterRasterPostEffects}).
   */
  private applyRasterFilterChainIfNeeded(
    instance: Entity,
    raw: Texture,
    tw: number,
    th: number,
  ): Texture {
    const filterValue = getRasterFilterValueForShape(instance);
    if (this.instanced || !filterValue) {
      return raw;
    }
    const effects = filterRasterPostEffects(parseEffect(filterValue));
    if (effects.length === 0) {
      return raw;
    }
    this.#rawFillImageTexture = raw;
    this.createPostProcessing(effects, raw, tw, th);
    const { texture: filtered } = this.renderPostProcessingTextureSpace(tw, th);
    this.#fillTextureFromPostChain = true;
    return filtered;
  }

  private disposeFillLayerResources(): void {
    const precomposedTexture =
      this.#usePrecomposedMultiFill &&
      !this.#fillTextureFromPostChain &&
      this.#texture != null
        ? this.#texture
        : null;
    this.#usePrecomposedMultiFill = false;
    for (const b of this.#fillLayerBindings) {
      b.destroy();
    }
    this.#fillLayerBindings = [];
    for (const b of this.#fillLayerBindingsSoftClipOutside) {
      b.destroy();
    }
    this.#fillLayerBindingsSoftClipOutside = [];
    const clearsMainTexture =
      this.#texture != null && this.#fillLayerTextures.includes(this.#texture);
    for (const t of this.#fillLayerTextures) {
      t.destroy?.();
    }
    this.#fillLayerTextures = [];
    if (clearsMainTexture) {
      this.#texture = null;
    }
    precomposedTexture?.destroy?.();
    this.disposeMultiFillDepthPassResources();
  }

  private disposeMultiFillDepthPassResources(): void {
    this.#bindingsMultiFillMidPass?.destroy();
    this.#bindingsMultiFillMidPass = null;
    for (const b of this.#fillLayerBindingsMidPass) {
      b.destroy();
    }
    this.#fillLayerBindingsMidPass = [];
    this.#bindingsSoftClipOutsideMidPass?.destroy();
    this.#bindingsSoftClipOutsideMidPass = null;
    for (const b of this.#fillLayerBindingsSoftClipOutsideMidPass) {
      b.destroy();
    }
    this.#fillLayerBindingsSoftClipOutsideMidPass = [];
    this.#pipelineMultiFillMidPass = null;
    this.#pipelineSoftClipOutsideMidPass = null;
  }

  /**
   * Rasterize one entry of {@link FillLayers} to a sampled texture (solid or CSS gradient).
   */
  private createFillImageTextureForLayer(
    instance: Entity,
    layer: FillLayerItem,
    minX: number,
    minY: number,
    width: number,
    height: number,
  ): Texture {
    if (layer.type === 'image') {
      const rasterOpts = resolveImageFillRasterOptions(
        this.api,
        instance,
        layer,
      );
      const { width: tw, height: th } = resolveFillLayerImageRasterPixelSize(
        layer.value,
        width,
        height,
        rasterOpts.objectFit,
      );
      const fromUrl = rasterizeFillLayerImageUrlForTexture(
        layer.value,
        tw,
        th,
        () => safeAddComponent(instance, MaterialDirty),
        rasterOpts,
      );
      const canvas = fromUrl ?? transparentFillLayerCanvas(tw, th);
      const raw = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: tw,
        height: th,
        usage: TextureUsage.SAMPLED,
      });
      upload2DRasterCanvasToTexture(raw, canvas);
      const cached = getFillLayerDecodedBitmap(layer.value);
      const sw = cached ? Math.max(1, cached.width) : 1;
      const sh = cached ? Math.max(1, cached.height) : 1;
      scheduleFillImageSvgRerasterIfNeeded({
        entity: instance,
        url: layer.value,
        targetW: tw,
        targetH: th,
        sourceW: sw,
        sourceH: sh,
        rasterOptions: rasterOpts,
      });
      return this.applyRasterFilterChainIfNeeded(instance, raw, tw, th);
    }
    if (layer.type === 'pattern') {
      const pw = Math.max(1, Math.ceil(width));
      const ph = Math.max(1, Math.ceil(height));
      const canvas = this.texturePool.getOrCreatePattern({
        pattern: {
          image: layer.value,
          repetition: layer.repetition ?? 'repeat',
          transform: layer.transform ?? '',
        },
        width: pw,
        height: ph,
      });
      const texture = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: pw,
        height: ph,
        usage: TextureUsage.SAMPLED,
      });
      texture.setImageData([canvas]);
      return this.applyRasterFilterChainIfNeeded(instance, texture, pw, ph);
    }
    if (layer.type === 'solid') {
      const tw = Math.max(1, Math.ceil(width));
      const th = Math.max(1, Math.ceil(height));
      const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(layer.value);
      const canvas = DOMAdapter.get().createCanvas(tw, th);
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      if (!ctx) {
        throw new Error('Canvas 2D required for FillLayers solid raster');
      }
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${fo})`;
      ctx.fillRect(0, 0, tw, th);
      const raw = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: tw,
        height: th,
        usage: TextureUsage.SAMPLED,
      });
      upload2DRasterCanvasToTexture(raw, canvas);
      return this.applyRasterFilterChainIfNeeded(instance, raw, tw, th);
    }
    const tw = Math.max(1, Math.ceil(width));
    const th = Math.max(1, Math.ceil(height));
    const fillGradients = parseGradient(layer.value);
    const meshFill =
      fillGradients !== undefined && fillGradients.length === 1
        ? fillGradients[0]
        : undefined;
    if (meshFill && isMeshGradientGradient(meshFill)) {
      const raw = this.renderMeshGradientTexture(meshFill, tw, th);
      return this.applyRasterFilterChainIfNeeded(instance, raw, tw, th);
    }
    const canvas = this.texturePool.getOrCreateGradient({
      gradients: fillGradients ?? [],
      min: [minX, minY],
      width: tw,
      height: th,
    });
    const texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: tw,
      height: th,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([canvas]);
    return this.applyRasterFilterChainIfNeeded(instance, texture, tw, th);
  }

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    const g0 = getFirstGradientStrokeLayerValue(this.shapes[0]);
    const g1 = getFirstGradientStrokeLayerValue(shape);
    if ((g0 == null) !== (g1 == null)) {
      return false;
    }
    if (g0 != null && g1 != null && g0 !== g1) {
      return false;
    }

    if (SDF.useDash(shape) !== SDF.useDash(this.shapes[0])) {
      return false;
    }

    const fa = getRasterFilterValueForShape(this.shapes[0]);
    const fb = getRasterFilterValueForShape(shape);
    if (Boolean(fa) !== Boolean(fb) || (fa && fb && fa !== fb)) {
      return false;
    }

    const fl0 = this.shapes[0].has(FillLayers)
      ? this.shapes[0].read(FillLayers).layers
      : null;
    const fl1 = shape.has(FillLayers) ? shape.read(FillLayers).layers : null;
    if ((fl0 == null) !== (fl1 == null)) {
      return false;
    }
    if (
      fl0 &&
      fl1 &&
      JSON.stringify(fl0) !== JSON.stringify(fl1)
    ) {
      return false;
    }
    const node0 = this.api.getNodeByEntity(this.shapes[0]);
    const node1 = this.api.getNodeByEntity(shape);
    if (
      JSON.stringify((node0 as { fills?: unknown })?.fills ?? null) !==
      JSON.stringify((node1 as { fills?: unknown })?.fills ?? null)
    ) {
      return false;
    }
    const hasImageFill = (layers: typeof fl0) =>
      layers?.some((l) => l.type === 'image') ?? false;
    if (hasImageFill(fl0) || hasImageFill(fl1)) {
      return false;
    }
    if (getMultiFillLayers(shape) && this.instanced) {
      return false;
    }

    const bm0 = getNodeLayerBlendMode(this.api, this.shapes[0]);
    const bm1 = getNodeLayerBlendMode(this.api, shape);
    if ((bm0 ?? 'normal') !== (bm1 ?? 'normal')) {
      return false;
    }
    if (
      isNonNormalNodeLayerBlend(bm0) ||
      isNonNormalNodeLayerBlend(bm1)
    ) {
      return false;
    }

    return true;
  }

  createGeometry(): void {
    this.indexBufferData = new Uint32Array([0, 1, 2, 0, 2, 3]);
    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.vertexBufferDatas[0] = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    if (this.vertexBuffers[0]) {
      this.vertexBuffers[0].destroy();
    }
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.instanced) {
      if (this.vertexBuffers[1]) {
        this.vertexBuffers[1].destroy();
        this.vertexBuffers[2].destroy();
      }

      this.vertexBufferDatas[1] = new Float32Array(
        new Array(32 * this.shapes.length).fill(0),
      );
      this.vertexBuffers[1] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[1],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      this.vertexBufferDatas[2] = new Float32Array(
        new Array(6 * this.shapes.length).fill(0),
      );
      this.vertexBuffers[2] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[2],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.FRAG_COORD, // a_FragCoord
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];

    if (this.instanced) {
      this.vertexBufferDescriptors.push(
        {
          arrayStride: 4 * 32,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.POSITION, // a_Position
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.SIZE, // a_Size
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.FILL_COLOR, // a_FillColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.STROKE_COLOR, // a_StrokeColor
              offset: 4 * 12,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.ZINDEX_STROKE_WIDTH, // a_ZIndexStrokeWidth
              offset: 4 * 16,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.OPACITY, // a_Opacity
              offset: 4 * 20,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW_COLOR, // a_InnerShadowColor
              offset: 4 * 24,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW, // a_InnerShadow
              offset: 4 * 28,
              format: Format.F32_RGBA,
            },
          ],
        },
        {
          arrayStride: 4 * 6,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.ABCD,
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.TXTY,
              offset: 4 * 4,
              format: Format.F32_RG,
            },
          ],
        },
      );
    }
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    this.createProgram(vert, frag, defines);
    this.disposeFillLayerResources();

    if (!this.instanced && !this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (12 + 36),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      megaStateDescriptor: {
        attachmentsState: [
          {
            channelWriteMask: ChannelWriteMask.ALL,
            rgbBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.SRC_ALPHA,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
            alphaBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
          },
        ],
        blendConstant: TransparentBlack,
        cullMode: CullMode.NONE,
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
        ...this.stencilDescriptor,
      },
    });
    this.device.setResourceName(this.pipeline, 'SDFPipeline');

    const multiFillForDepthPass =
      !this.instanced && this.shapes[0]?.has(FillLayers)
        ? getMultiFillLayers(this.shapes[0])
        : null;
    const useMultiFillMidDepthPipeline =
      multiFillForDepthPass != null && multiFillForDepthPass.length > 1;
    if (useMultiFillMidDepthPipeline) {
      this.#pipelineMultiFillMidPass = this.renderCache.createRenderPipeline({
        inputLayout: this.inputLayout,
        program: this.program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        megaStateDescriptor: {
          attachmentsState: [
            {
              channelWriteMask: ChannelWriteMask.ALL,
              rgbBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.SRC_ALPHA,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
              alphaBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.ONE,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
            },
          ],
          blendConstant: TransparentBlack,
          cullMode: CullMode.NONE,
          depthWrite: false,
          depthCompare: CompareFunction.GREATER,
          ...this.stencilDescriptor,
        },
      });
      this.device.setResourceName(
        this.#pipelineMultiFillMidPass,
        'SDFPipelineMultiFillMidPass',
      );
    }

    const bindings: BindingsDescriptor = {
      pipeline: this.pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
      ],
    };
    if (!this.instanced) {
      bindings.uniformBufferBindings!.push({
        buffer: this.#uniformBuffer,
      });
    }

    if (this.useFillImage) {
      if (this.bindings) {
        this.bindings.destroy();
      }

      const instance = this.shapes[0];

      this.#fillTextureFromPostChain = false;
      this.#bakedStrokeIntoFilterTexture = false;
      if (!getRasterFilterValueForShape(instance)) {
        this.destroyFullPostProcessingChain();
      }
      if (this.#rawFillImageTexture) {
        this.#rawFillImageTexture.destroy();
        this.#rawFillImageTexture = null;
      }

      const multiForTex = getMultiFillLayers(instance);
      const needsFillLayerRaster =
        multiForTex &&
        (fillLayersNeedFillImage(multiForTex) ||
          fillLayersShouldPrecompose(multiForTex));
      if (needsFillLayerRaster && multiForTex) {
        const { minX, minY, maxX, maxY } =
          getSdfGeometryBoundsForFilter(instance);
        const width = maxX - minX;
        const height = maxY - minY;
        this.#fillLayerTextures = multiForTex.map((layer) =>
          this.createFillImageTextureForLayer(
            instance,
            layer,
            minX,
            minY,
            width,
            height,
          ),
        );
        if (fillLayersShouldPrecompose(multiForTex)) {
          const w = Math.max(
            1,
            ...this.#fillLayerTextures.map(
              (t) => (t as unknown as { width: number }).width,
            ),
          );
          const h = Math.max(
            1,
            ...this.#fillLayerTextures.map(
              (t) => (t as unknown as { height: number }).height,
            ),
          );
          const composed = composeFillLayerTexturesOnGpu(
            this.device,
            this.renderCache,
            multiForTex,
            this.#fillLayerTextures,
            w,
            h,
            () => this.createSampler(),
          );
          for (const t of this.#fillLayerTextures) {
            t.destroy?.();
          }
          this.#fillLayerTextures = [];
          this.#texture = composed;
          this.#usePrecomposedMultiFill = true;
        } else {
          this.#texture = this.#fillLayerTextures[0]!;
          this.#usePrecomposedMultiFill = false;
        }
      } else if (instance.has(FillLayers)) {
        const one = getSingleEnabledFillLayer(instance);
        if (one) {
          const { minX, minY, maxX, maxY } =
            getSdfGeometryBoundsForFilter(instance);
          const width = maxX - minX;
          const height = maxY - minY;
          this.#texture = this.createFillImageTextureForLayer(
            instance,
            one,
            minX,
            minY,
            width,
            height,
          );
        }
      } else if (instance.has(FillTexture)) {
        // `Texture` has no public size here; per-shape filter on FillTexture needs GPU size API.
        this.#texture = instance.read(FillTexture).value;
      } else if (
        !this.instanced &&
        shouldBakeStrokeIntoRasterFilterTexture(instance)
      ) {
        const geom = getSdfGeometryBoundsForFilter(instance);
        const sw = instance.read(Stroke).width;
        const bounds = expandBoundsForCenterCanvasStroke(geom, sw);
        const bw = bounds.maxX - bounds.minX;
        const bh = bounds.maxY - bounds.minY;
        const tw = Math.max(1, Math.ceil(bw));
        const th = Math.max(1, Math.ceil(bh));
        const canvas = createFillAndStrokeRgbaRasterForFilter(
          instance,
          bounds,
          tw,
          th,
        );
        const raw = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: tw,
          height: th,
          usage: TextureUsage.SAMPLED,
        });
        upload2DRasterCanvasToTexture(raw, canvas);
        this.#texture = this.applyRasterFilterChainIfNeeded(
          instance,
          raw,
          tw,
          th,
        );
        this.#bakedStrokeIntoFilterTexture = true;
      }

      bindings.samplerBindings = [
        {
          texture: this.#texture,
          sampler: this.createSampler(),
        },
      ];
    }

    this.bindings = this.renderCache.createBindings(bindings);

    if (useMultiFillMidDepthPipeline && this.#pipelineMultiFillMidPass) {
      const midDesc: BindingsDescriptor = {
        pipeline: this.#pipelineMultiFillMidPass,
        uniformBufferBindings: bindings.uniformBufferBindings!,
      };
      if (bindings.samplerBindings) {
        midDesc.samplerBindings = bindings.samplerBindings;
      }
      this.#bindingsMultiFillMidPass =
        this.renderCache.createBindings(midDesc);
    }

    if (this.#fillLayerTextures.length > 0 && bindings.samplerBindings) {
      const layerSampler = this.createSampler();
      this.#fillLayerBindings = this.#fillLayerTextures.map((tex) =>
        this.renderCache.createBindings({
          pipeline: this.pipeline,
          uniformBufferBindings: bindings.uniformBufferBindings!,
          samplerBindings: [
            {
              texture: tex,
              sampler: layerSampler,
            },
          ],
        }),
      );
      if (useMultiFillMidDepthPipeline && this.#pipelineMultiFillMidPass) {
        const layerSamplerMid = this.createSampler();
        this.#fillLayerBindingsMidPass = this.#fillLayerTextures.map(
          (tex) =>
            this.renderCache.createBindings({
              pipeline: this.#pipelineMultiFillMidPass!,
              uniformBufferBindings: bindings.uniformBufferBindings!,
              samplerBindings: [
                {
                  texture: tex,
                  sampler: layerSamplerMid,
                },
              ],
            }),
        );
      }
    }

    if (this.parentClipMode === 'soft') {
      const diagnosticDerivativeUniformityHeader =
        this.device.queryVendorInfo().platformString === 'WebGPU'
          ? 'diagnostic(off,derivative_uniformity);\n'
          : '';
      const definesOutside = defines + '\n#define USE_SOFT_CLIP_OUTSIDE\n';
      const programOutside = this.renderCache.createProgram({
        vertex: { glsl: definesOutside + vert },
        fragment: {
          glsl: definesOutside + frag,
          postprocess: (fs: string) => diagnosticDerivativeUniformityHeader + fs,
        },
      });
      const vertexBufferDescriptorsForOutside = [...this.vertexBufferDescriptors];
      if (this.useWireframe) {
        vertexBufferDescriptorsForOutside.push(this.barycentricBufferDescriptor);
      }
      const inputLayoutOutside = this.renderCache.createInputLayout({
        vertexBufferDescriptors: vertexBufferDescriptorsForOutside,
        indexBufferFormat: Format.U32_R,
        program: programOutside,
      });
      this.inputLayoutSoftClipOutside = inputLayoutOutside;
      this.pipelineSoftClipOutside = this.renderCache.createRenderPipeline({
        inputLayout: inputLayoutOutside,
        program: programOutside,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        megaStateDescriptor: {
          attachmentsState: [
            {
              channelWriteMask: ChannelWriteMask.ALL,
              rgbBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.SRC_ALPHA,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
              alphaBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.ONE,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
            },
          ],
          blendConstant: TransparentBlack,
          cullMode: CullMode.NONE,
          depthWrite: true,
          depthCompare: CompareFunction.GREATER,
          ...this.stencilDescriptorForSoftOutside,
        },
      });
      this.device.setResourceName(this.pipelineSoftClipOutside, 'SDFPipelineSoftClipOutside');
      if (useMultiFillMidDepthPipeline) {
        this.#pipelineSoftClipOutsideMidPass = this.renderCache.createRenderPipeline({
          inputLayout: inputLayoutOutside,
          program: programOutside,
          colorAttachmentFormats: [Format.U8_RGBA_RT],
          depthStencilAttachmentFormat: Format.D24_S8,
          megaStateDescriptor: {
            attachmentsState: [
              {
                channelWriteMask: ChannelWriteMask.ALL,
                rgbBlendState: {
                  blendMode: BlendMode.ADD,
                  blendSrcFactor: BlendFactor.SRC_ALPHA,
                  blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
                },
                alphaBlendState: {
                  blendMode: BlendMode.ADD,
                  blendSrcFactor: BlendFactor.ONE,
                  blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
                },
              },
            ],
            blendConstant: TransparentBlack,
            cullMode: CullMode.NONE,
            depthWrite: false,
            depthCompare: CompareFunction.GREATER,
            ...this.stencilDescriptorForSoftOutside,
          },
        });
        this.device.setResourceName(
          this.#pipelineSoftClipOutsideMidPass,
          'SDFPipelineSoftClipOutsideMultiFillMidPass',
        );
      }
      this.programSoftClipOutside = programOutside;
      const bindingsOutside: BindingsDescriptor = {
        pipeline: this.pipelineSoftClipOutside,
        uniformBufferBindings: [...bindings.uniformBufferBindings!],
      };
      if (bindings.samplerBindings) {
        bindingsOutside.samplerBindings = bindings.samplerBindings;
      }
      this.bindingsSoftClipOutside = this.renderCache.createBindings(bindingsOutside);
      if (useMultiFillMidDepthPipeline && this.#pipelineSoftClipOutsideMidPass) {
        const bindMidOut: BindingsDescriptor = {
          pipeline: this.#pipelineSoftClipOutsideMidPass,
          uniformBufferBindings: [...bindings.uniformBufferBindings!],
        };
        if (bindings.samplerBindings) {
          bindMidOut.samplerBindings = bindings.samplerBindings;
        }
        this.#bindingsSoftClipOutsideMidPass =
          this.renderCache.createBindings(bindMidOut);
      }
      if (this.#fillLayerTextures.length > 0 && bindingsOutside.samplerBindings) {
        const softSampler = this.createSampler();
        this.#fillLayerBindingsSoftClipOutside = this.#fillLayerTextures.map(
          (tex) =>
            this.renderCache.createBindings({
              pipeline: this.pipelineSoftClipOutside,
              uniformBufferBindings: bindingsOutside.uniformBufferBindings!,
              samplerBindings: [
                {
                  texture: tex,
                  sampler: softSampler,
                },
              ],
            }),
        );
        if (useMultiFillMidDepthPipeline && this.#pipelineSoftClipOutsideMidPass) {
          const softSamplerMid = this.createSampler();
          this.#fillLayerBindingsSoftClipOutsideMidPass =
            this.#fillLayerTextures.map((tex) =>
              this.renderCache.createBindings({
                pipeline: this.#pipelineSoftClipOutsideMidPass!,
                uniformBufferBindings: bindingsOutside.uniformBufferBindings!,
                samplerBindings: [
                  {
                    texture: tex,
                    sampler: softSamplerMid,
                  },
                ],
              }),
            );
        }
      }
    }
  }

  override submitNodeLayerBlendComposite(
    renderPass: RenderPass,
    backdrop: Texture,
    src: Texture,
    uniformBuffer: Buffer,
    sceneUniformLegacyObject: Record<string, unknown>,
    width: number,
    height: number,
  ): void {
    void uniformBuffer;
    void sceneUniformLegacyObject;
    compositeNodeLayerBlendOnRenderPass(
      renderPass,
      this.device,
      this.renderCache,
      backdrop,
      src,
      getNodeLayerBlendMode(this.api, this.shapes[0]),
      width,
      height,
    );
  }

  render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    let drawLegacy: Record<string, unknown> = { ...sceneUniformLegacyObject };

    if (this.instanced) {
      const instancedData: number[] = [];
      this.shapes.forEach((shape, i, total) => {
        const [buffer] = this.generateBuffer(shape, i, total.length);
        instancedData.push(...buffer);
      });
      this.vertexBufferDatas[1] = new Float32Array(instancedData);
      this.vertexBuffers[1].setSubData(
        0,
        new Uint8Array(this.vertexBufferDatas[1].buffer),
      );

      this.vertexBufferDatas[2] = new Float32Array(
        this.shapes
          .map((shape) => {
            const { matrix } = shape.read(GlobalTransform);
            return [
              matrix.m00,
              matrix.m01,
              matrix.m02,
              matrix.m10,
              matrix.m11,
              matrix.m12,
            ];
          })
          .flat(),
      );
      this.vertexBuffers[2].setSubData(
        0,
        new Uint8Array(this.vertexBufferDatas[2].buffer),
      );
    } else {
      const shape = this.shapes[0];
      const multi = getMultiFillLayers(shape);
      if (multi && !this.#usePrecomposedMultiFill) {
        const { matrix } = shape.read(GlobalTransform);
        const u_ModelMatrix = [
          matrix.m00,
          matrix.m01,
          matrix.m02,
          matrix.m10,
          matrix.m11,
          matrix.m12,
          matrix.m20,
          matrix.m21,
          matrix.m22,
        ] as mat3;
        const needLayerTex = fillLayersNeedFillImage(multi);

        if (this.useWireframe && this.geometryDirty) {
          this.generateWireframe();
        }

        for (let i = 0; i < multi.length; i++) {
          const isMidFillPass = multi.length > 1 && i < multi.length - 1;
          const fillPipeline =
            isMidFillPass && this.#pipelineMultiFillMidPass
              ? this.#pipelineMultiFillMidPass
              : this.pipeline;
          const [buffer, legacyObject] = this.generateBuffer(shape, 0, 1, {
            kind: 'fill-layer',
            layerIndex: i,
          });
          this.#uniformBuffer.setSubData(
            0,
            new Uint8Array(
              new Float32Array([
                ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
                ...buffer,
              ]).buffer,
            ),
          );
          const uniformLegacyObject: Record<string, unknown> = {
            u_ModelMatrix,
            ...legacyObject,
          };
          if (needLayerTex) {
            uniformLegacyObject.u_FillImage = this.#fillLayerTextures[i];
          }
          const merged = {
            ...uniformLegacyObject,
            ...sceneUniformLegacyObject,
          };
          drawLegacy = merged;
          this.program.setUniformsLegacy(merged);
          renderPass.setPipeline(fillPipeline);
          const vertexBuffers = this.vertexBuffers.map((b) => ({ buffer: b }));
          if (this.useWireframe) {
            vertexBuffers.push({ buffer: this.barycentricBuffer });
          }
          renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
            buffer: this.indexBuffer,
          });
          const fillBindings = needLayerTex
            ? isMidFillPass && this.#fillLayerBindingsMidPass.length > 0
                ? this.#fillLayerBindingsMidPass[i]!
                : this.#fillLayerBindings[i]!
            : isMidFillPass && this.#bindingsMultiFillMidPass
              ? this.#bindingsMultiFillMidPass
              : this.bindings!;
          renderPass.setBindings(fillBindings);
          if (this.useStencil || this.parentClipMode) {
            renderPass.setStencilReference(STENCIL_CLIP_REF);
          }
          renderPass.drawIndexed(6, this.shapes.length);

          if (
            this.parentClipMode === 'soft' &&
            this.pipelineSoftClipOutside &&
            this.bindingsSoftClipOutside &&
            this.programSoftClipOutside
          ) {
            const outsideAlpha = this.parentOutsideAlpha;
            const softFillPipeline =
              isMidFillPass && this.#pipelineSoftClipOutsideMidPass
                ? this.#pipelineSoftClipOutsideMidPass
                : this.pipelineSoftClipOutside;
            this.programSoftClipOutside.setUniformsLegacy({
              ...drawLegacy,
              u_AlphaScale: outsideAlpha,
            });
            renderPass.setPipeline(softFillPipeline);
            renderPass.setVertexInput(
              this.inputLayoutSoftClipOutside,
              vertexBuffers,
              {
                buffer: this.indexBuffer,
              },
            );
            const softFillBindings = needLayerTex
              ? isMidFillPass &&
                  this.#fillLayerBindingsSoftClipOutsideMidPass.length > 0
                ? this.#fillLayerBindingsSoftClipOutsideMidPass[i]!
                : this.#fillLayerBindingsSoftClipOutside[i]!
              : isMidFillPass && this.#bindingsSoftClipOutsideMidPass
                ? this.#bindingsSoftClipOutsideMidPass
                : this.bindingsSoftClipOutside;
            renderPass.setBindings(softFillBindings);
            renderPass.setStencilReference(STENCIL_CLIP_REF);
            renderPass.drawIndexed(6, this.shapes.length);
          }
        }

        const strokeW = shape.has(Stroke) ? shape.read(Stroke).width : 0;
        if (
          strokeW > 0 &&
          !SDF.useDash(shape) &&
          getFirstGradientStrokeLayerValue(shape) == null
        ) {
          const [buffer2, legacy2] = this.generateBuffer(shape, 0, 1, {
            kind: 'stroke-pass',
            skipFillImageSample: needLayerTex,
          });
          this.#uniformBuffer.setSubData(
            0,
            new Uint8Array(
              new Float32Array([
                ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
                ...buffer2,
              ]).buffer,
            ),
          );
          const uniformLegacyObject2: Record<string, unknown> = {
            u_ModelMatrix,
            ...legacy2,
          };
          if (needLayerTex) {
            uniformLegacyObject2.u_FillImage = this.#fillLayerTextures[0];
          } else if (this.useFillImage) {
            uniformLegacyObject2.u_FillImage = this.#texture;
          }
          const merged2 = {
            ...uniformLegacyObject2,
            ...sceneUniformLegacyObject,
          };
          drawLegacy = merged2;
          this.program.setUniformsLegacy(merged2);
          renderPass.setPipeline(this.pipeline);
          const vertexBuffers2 = this.vertexBuffers.map((b) => ({ buffer: b }));
          if (this.useWireframe) {
            vertexBuffers2.push({ buffer: this.barycentricBuffer });
          }
          renderPass.setVertexInput(this.inputLayout, vertexBuffers2, {
            buffer: this.indexBuffer,
          });
          renderPass.setBindings(this.bindings);
          if (this.useStencil || this.parentClipMode) {
            renderPass.setStencilReference(STENCIL_CLIP_REF);
          }
          renderPass.drawIndexed(6, this.shapes.length);

          if (
            this.parentClipMode === 'soft' &&
            this.pipelineSoftClipOutside &&
            this.bindingsSoftClipOutside &&
            this.programSoftClipOutside
          ) {
            const outsideAlpha = this.parentOutsideAlpha;
            this.programSoftClipOutside.setUniformsLegacy({
              ...drawLegacy,
              u_AlphaScale: outsideAlpha,
            });
            renderPass.setPipeline(this.pipelineSoftClipOutside);
            renderPass.setVertexInput(
              this.inputLayoutSoftClipOutside,
              vertexBuffers2,
              {
                buffer: this.indexBuffer,
              },
            );
            renderPass.setBindings(this.bindingsSoftClipOutside);
            renderPass.setStencilReference(STENCIL_CLIP_REF);
            renderPass.drawIndexed(6, this.shapes.length);
          }
        }
        return;
      }

      const { matrix } = this.shapes[0].read(GlobalTransform);
      const [buffer, legacyObject] = this.generateBuffer(this.shapes[0], 0, 1);
      const u_ModelMatrix = [
        matrix.m00,
        matrix.m01,
        matrix.m02,
        matrix.m10,
        matrix.m11,
        matrix.m12,
        matrix.m20,
        matrix.m21,
        matrix.m22,
      ] as mat3;

      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([
            ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
            ...buffer,
          ]).buffer,
        ),
      );
      const uniformLegacyObject: Record<string, unknown> = {
        u_ModelMatrix,
        ...legacyObject,
      };
      if (this.useFillImage) {
        uniformLegacyObject.u_FillImage = this.#texture;
      }
      this.program.setUniformsLegacy(uniformLegacyObject);
      drawLegacy = { ...uniformLegacyObject, ...sceneUniformLegacyObject };
    }

    if (this.useWireframe && this.geometryDirty) {
      this.generateWireframe();
    }

    this.program.setUniformsLegacy(drawLegacy);
    renderPass.setPipeline(this.pipeline);

    const vertexBuffers = this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);

    if (this.useStencil || this.parentClipMode) {
      renderPass.setStencilReference(STENCIL_CLIP_REF);
    }
    renderPass.drawIndexed(6, this.shapes.length);

    if (this.parentClipMode === 'soft' && this.pipelineSoftClipOutside && this.bindingsSoftClipOutside && this.programSoftClipOutside) {
      const outsideAlpha = this.parentOutsideAlpha;
      this.programSoftClipOutside.setUniformsLegacy({ ...drawLegacy, u_AlphaScale: outsideAlpha });
      renderPass.setPipeline(this.pipelineSoftClipOutside);
      renderPass.setVertexInput(this.inputLayoutSoftClipOutside, vertexBuffers, {
        buffer: this.indexBuffer,
      });
      renderPass.setBindings(this.bindingsSoftClipOutside);
      renderPass.setStencilReference(STENCIL_CLIP_REF);
      renderPass.drawIndexed(6, this.shapes.length);
    }
  }

  destroy(): void {
    this.disposeFillLayerResources();
    this.destroyFullPostProcessingChain();
    this.#rawFillImageTexture?.destroy();
    this.#rawFillImageTexture = null;
    if (!this.#fillTextureFromPostChain) {
      this.#texture?.destroy?.();
    }
    this.#texture = null;
    this.#fillTextureFromPostChain = false;
    this.#bakedStrokeIntoFilterTexture = false;
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#uniformBuffer = null;
    }
  }

  private generateBuffer(
    shape: Entity,
    index: number,
    total: number,
    multiFill?:
      | { kind: 'fill-layer'; layerIndex: number }
      | { kind: 'stroke-pass'; skipFillImageSample: boolean },
  ): [number[], Record<string, unknown>] {
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    let position: [number, number, number, number] = [0, 0, 0, 0];
    let size: [number, number, number, number] = [0, 0, 0, 0];
    let type: number = 0;
    let cornerRadius = 0;
    const zIndex = (globalRenderOrder + (1 / total) * index) / ZINDEX_FACTOR;

    if (shape.has(Circle)) {
      const { cx, cy, r } = shape.read(Circle);
      position = [cx, cy, zIndex, 0];
      size = [r, r, 0, 0];
      type = 0;
    } else if (shape.has(Ellipse)) {
      const { cx, cy, rx, ry } = shape.read(Ellipse);
      position = [cx, cy, zIndex, 0];
      size = [rx, ry, 0, 0];
      type = 1;
    } else if (shape.has(Rect)) {
      const { x, y, width, height, cornerRadius: r } = shape.read(Rect);
      position = [x + width / 2, y + height / 2, zIndex, 0];
      size = [width / 2, height / 2, 0, 0];
      type = 2;
      cornerRadius = r;
    }

    let fill: string | null = getFirstSolidFillLayerValue(shape);
    const multiLayers = getMultiFillLayers(shape);
    const enabledFill = getEnabledFillLayers(shape);
    if (multiFill?.kind === 'fill-layer' && multiLayers) {
      const L = multiLayers[multiFill.layerIndex];
      fill = L.type === 'solid' ? L.value : '#ffffff';
    } else if (multiFill?.kind === 'stroke-pass') {
      fill = 'transparent';
    } else if (
      !multiFill &&
      enabledFill.length === 1 &&
      shape.has(FillLayers)
    ) {
      const L = enabledFill[0];
      fill = L.type === 'solid' ? L.value : '#ffffff';
    } else if (!multiFill && this.#usePrecomposedMultiFill && shape.has(FillLayers)) {
      fill = '#ffffff';
    }
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(
      fill != null && fill !== '' ? fill : 'transparent',
    );

    const opacity = shape.has(Opacity) ? shape.read(Opacity).opacity : 1;

    const strokeColor = resolveGpuStrokeColor(shape);
    const width = shape.has(Stroke) ? shape.read(Stroke).width : 0;
    const alignment = shape.has(Stroke)
      ? shape.read(Stroke).alignment
      : 'center';
    const {
      color: innerShadowColor,
      offsetX,
      offsetY,
      blurRadius,
    } = shape.has(InnerShadow)
        ? shape.read(InnerShadow)
        : {
          color: null,
          offsetX: 0,
          offsetY: 0,
          blurRadius: 0,
        };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(
      strokeColor ?? 'transparent',
    );
    const { strokeColorAlphaMul, strokeUniformOpacityMul } =
      strokePaintAlphaMultipliers(shape);
    const {
      r: isr,
      g: isg,
      b: isb,
      opacity: iso,
    } = parseColor(innerShadowColor);

    const u_Position = position;
    const u_Size = size;
    let frN = fr / 255;
    let fgN = fg / 255;
    let fbN = fb / 255;
    let fa = fo;
    if (multiFill?.kind === 'fill-layer' && multiLayers) {
      const L = multiLayers[multiFill.layerIndex];
      const lo = fillLayerOpacity(L.opacity);
      if (L.type === 'gradient') {
        frN = 1;
        fgN = 1;
        fbN = 1;
        fa = lo;
      } else {
        fa = fo * lo;
      }
    } else if (
      !multiFill &&
      enabledFill.length === 1 &&
      shape.has(FillLayers)
    ) {
      const L = enabledFill[0];
      const lo = fillLayerOpacity(L.opacity);
      if (L.type === 'gradient') {
        frN = 1;
        fgN = 1;
        fbN = 1;
        fa = lo;
      } else {
        fa = fo * lo;
      }
    } else if (!multiFill && this.#usePrecomposedMultiFill && shape.has(FillLayers)) {
      frN = 1;
      fgN = 1;
      fbN = 1;
      fa = 1;
    }
    const u_FillColor = [frN, fgN, fbN, fa];
    const u_StrokeColor = [
      sr / 255,
      sg / 255,
      sb / 255,
      so * strokeColorAlphaMul,
    ];
    let strokeWidthForSdf = SDF.useDash(shape) ? 0 : width;
    if (getFirstGradientStrokeLayerValue(shape) != null) {
      strokeWidthForSdf = 0;
    }
    if (multiFill?.kind === 'fill-layer') {
      strokeWidthForSdf = 0;
    }
    let filterExtras: [number, number, number, number] = [0, 0, 0, 0];
    if (
      this.#bakedStrokeIntoFilterTexture &&
      getFirstGradientStrokeLayerValue(shape) == null
    ) {
      strokeWidthForSdf = 0;
      const sw = shape.has(Stroke) ? shape.read(Stroke).width : 0;
      filterExtras = [sw * 0.5, sw, 0, 0];
    }
    if (multiFill?.kind === 'fill-layer') {
      filterExtras[2] = 1;
    } else if (
      multiFill?.kind === 'stroke-pass' &&
      multiFill.skipFillImageSample
    ) {
      filterExtras[3] = 1;
    }
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      strokeWidthForSdf,
      cornerRadius,
      strokeAlignmentMap[alignment],
    ];

    const LEFT_SHIFT22 = 4194304.0;
    const LEFT_SHIFT23 = 8388608.0;
    const compressed =
      (shape.has(SizeAttenuation) ? 1 : 0) * LEFT_SHIFT23 +
      (shape.has(StrokeAttenuation) ? 1 : 0) * LEFT_SHIFT22 +
      type;
    const u_Opacity = [
      opacity,
      1,
      strokeUniformOpacityMul,
      compressed,
    ];
    const u_InnerShadowColor = [isr / 255, isg / 255, isb / 255, iso];
    const u_InnerShadow = [offsetX, offsetY, blurRadius, 0];

    const flat: number[] = [
      ...u_Position,
      ...u_Size,
      ...u_FillColor,
      ...u_StrokeColor,
      ...u_ZIndexStrokeWidth,
      ...u_Opacity,
      ...u_InnerShadowColor,
      ...u_InnerShadow,
    ];
    if (!this.instanced) {
      flat.push(...filterExtras);
    }

    return [
      flat,
      {
        u_Position,
        u_Size,
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_InnerShadowColor,
        u_InnerShadow,
        u_FilterExtras: filterExtras,
      },
    ];
  }
}
