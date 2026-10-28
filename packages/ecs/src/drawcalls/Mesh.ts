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
  BindingsDescriptor,
  Bindings,
  TransparentBlack,
  Texture,
  PrimitiveTopology,
  TextureUsage,
  type RenderPipeline,
} from '@infinite-canvas-tutorial/device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import earcut from 'earcut';
import { buildPathFillMesh } from '../utils/path-fill-mesh';
import { ZINDEX_FACTOR, STENCIL_CLIP_REF } from './Drawcall';
import { PathDrawcall } from './PathDrawcall';
import { vert, frag, Location } from '../shaders/mesh';
import {
  buildVectorNetworkFillMesh,
  isClockWise,
  paddingMat3,
  parseColor,
  parseGradient,
  isMeshGradientGradient,
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
  resolveGpuStrokeColor,
  strokePaintAlphaMultipliers,
} from '../utils/strokeLayers';
import { composeFillLayerTexturesOnGpu } from '../utils/fillLayerComposeGpu';
import { createComposedFillTexture } from '../utils/composed-fill-texture';
import { createRasterFilterInput } from '../utils/raster-filter-input';
import {
  getRasterFilterValueForShape,
  hasRasterPostEffects,
  parseEffect,
  filterRasterPostEffects,
  getRasterFilterPadding,
} from '../utils/filter';
import { getRainFxAnimationExportContext } from '../utils/rain-fx/rain-fx-export-context';
import {
  isLikelySvgResourceUrl,
  prepareSvgPatternFill,
  scheduleFillImageSvgRerasterIfNeeded,
} from '../utils/fillImageSvgReraster';
import { svgFillImageZoomBucket } from '../utils/fillImageTextureSize';
import {
  getFillLayerDecodedBitmap,
  getOrScheduleFillLayerPatternSource,
  resolveImageFillRasterOptions,
  rasterizeFillLayerImageUrlForTexture,
  resolveFillLayerImageRasterPixelSize,
  transparentFillLayerCanvas,
} from '../utils/fill-layer-image-url-raster';
import { DOMAdapter } from '../environment';
import { upload2DRasterCanvasToTexture } from '../utils/rasterCanvasTextureUpload';
import { safeAddComponent } from '../history';
import { getSdfGeometryBoundsForFilter } from '../utils/solidShapeRasterForFilter';
import {
  ComputedPoints,
  ComputedCamera,
  Ellipse,
  FillLayers,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  MaterialDirty,
  Path,
  Rect,
  Rough,
  Stroke,
  TesselationMethod,
  Circle,
  ComputedRough,
  Mat3,
  VectorNetwork,
} from '../components';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class Mesh extends PathDrawcall {
  #uniformBuffer: Buffer;
  #texture: Texture;
  /** Unfiltered GPU texture when applying {@link Filter} (chain samples this). */
  #rawFillImageTexture: Texture | null = null;
  /** True when {@link #texture} is the post-process chain output (do not `destroy` in Mesh.destroy). */
  #fillTextureFromPostChain = false;
  #borrowedFillTexture = false;
  #blurRaster: ReturnType<typeof createRasterFilterInput> | null = null;
  #blurVertices: Buffer | null = null;
  #blurIndices: Buffer | null = null;

  #fillLayerTextures: Texture[] = [];
  #fillLayerBindings: Bindings[] = [];
  /** 多层填充中间 pass，禁用 depthWrite，避免同深度后续 pass 被遮挡（与 Rough 水彩一致）。 */
  #pipelineMultiFillMidPass: RenderPipeline | null = null;
  #fillLayerBindingsMidPass: Bindings[] = [];
  #bindingsMultiFillMidPass: Bindings | null = null;
  #usePrecomposedMultiFill = false;

  points: number[] = [];

  instanced = false;

  private get blurPadding(): number {
    const shape = this.shapes[0];
    // Keep stencil and wireframe geometry intact. External textures do not yet
    // expose the raster dimensions required by the capture path.
    if (
      !shape ||
      this.instanced ||
      this.useStencil ||
      this.useWireframe ||
      shape.has(FillTexture) ||
      shape.has(Rough) ||
      !super.useFillImage
    )
      return 0;
    return getRasterFilterPadding(getRasterFilterValueForShape(shape));
  }

  protected override get extraShaderDefines(): string {
    if (this.blurPadding > 0) {
      return `${super.extraShaderDefines}#define USE_BLUR_FILTER_OUTPUT\n`;
    }
    return super.extraShaderDefines;
  }

  static useDash(shape: Entity) {
    const { dasharray = [] } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { dasharray: [] };
    return dasharray[0] >= 0 && dasharray[1] > 0;
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
    const padding = this.blurPadding;
    if (padding > 0) {
      const geometry = getSdfGeometryBoundsForFilter(instance);
      const [, uniforms] = this.generateBuffer(instance);
      const bounds = {
        minX: geometry.minX - padding,
        minY: geometry.minY - padding,
        maxX: geometry.maxX + padding,
        maxY: geometry.maxY + padding,
      };
      this.#blurRaster = createRasterFilterInput({
        device: this.device,
        renderCache: this.renderCache,
        vertex: '#define USE_FILLIMAGE\n' + vert,
        fragment: '#define USE_FILLIMAGE\n' + frag,
        points: this.vertexBufferDatas[0],
        indices: this.indexBufferData,
        uniforms,
        texture: raw,
        sampler: this.createSampler(),
        bounds,
      });
      this.#blurVertices = this.device.createBuffer({
        viewOrSize: new Float32Array([
          bounds.minX,
          bounds.minY,
          bounds.maxX,
          bounds.minY,
          bounds.maxX,
          bounds.maxY,
          bounds.minX,
          bounds.maxY,
        ]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      this.#blurIndices = this.device.createBuffer({
        viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      raw.destroy();
      raw = this.#blurRaster.texture;
      tw = this.#blurRaster.width;
      th = this.#blurRaster.height;
    }
    this.#rawFillImageTexture = raw;
    const anim = getRainFxAnimationExportContext();
    const chain = this.getPostChain();
    const ready = chain?.isReadyForSize(tw, th) ?? false;
    if (!anim || !ready || !chain?.syncEffects(effects)) {
      this.createPostProcessing(effects, raw, tw, th);
    }
    const { texture: filtered } = this.renderPostProcessingTextureSpace(tw, th);
    this.#fillTextureFromPostChain = true;
    return filtered;
  }

  private disposeMeshFillLayerResources(): void {
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
    this.#bindingsMultiFillMidPass?.destroy();
    this.#bindingsMultiFillMidPass = null;
    for (const b of this.#fillLayerBindingsMidPass) {
      b.destroy();
    }
    this.#fillLayerBindingsMidPass = [];
    this.#pipelineMultiFillMidPass = null;
    const clearsMainTexture =
      this.#texture != null && this.#fillLayerTextures.includes(this.#texture);
    for (const t of this.#fillLayerTextures) {
      t.destroy?.();
    }
    this.#fillLayerTextures = [];
    if (clearsMainTexture || precomposedTexture) {
      this.#texture = null;
    }
    precomposedTexture?.destroy?.();
  }

  private disposeFillImageResources(): void {
    this.disposeMeshFillLayerResources();
    if (!this.#fillTextureFromPostChain && !this.#borrowedFillTexture) {
      this.#texture?.destroy();
    }
    if (this.#blurRaster) this.#blurRaster.destroy();
    else this.#rawFillImageTexture?.destroy();
    this.#blurRaster = null;
    this.#blurVertices?.destroy();
    this.#blurIndices?.destroy();
    this.#blurVertices = null;
    this.#blurIndices = null;
    this.#rawFillImageTexture = null;
    this.#texture = null;
    this.#fillTextureFromPostChain = false;
    this.#borrowedFillTexture = false;
  }

  /** Rasterize one {@link FillLayers} entry for mesh fill sampling. */
  private createMeshFillLayerTexture(
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
        isLikelySvgResourceUrl(layer.value) &&
          this.api?.getCamera()?.has(ComputedCamera)
          ? svgFillImageZoomBucket(
              this.api.getCamera().read(ComputedCamera).zoom,
            )
          : 1,
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
      return raw;
    }
    if (layer.type === 'pattern') {
      const prepared = typeof layer.value === 'string' &&
        isLikelySvgResourceUrl(layer.value)
        ? prepareSvgPatternFill({
            entity: instance,
            url: layer.value,
            geomW: width,
            geomH: height,
            zoom: this.api?.getCamera()?.has(ComputedCamera)
              ? this.api.getCamera().read(ComputedCamera).zoom : 1,
            onDecoded: () => safeAddComponent(instance, MaterialDirty),
          })
        : undefined;
      const pw = prepared?.width ?? Math.max(1, Math.ceil(width));
      const ph = prepared?.height ?? Math.max(1, Math.ceil(height));
      const image =
        prepared?.image ?? (typeof layer.value === 'string'
          ? getOrScheduleFillLayerPatternSource(layer.value, () =>
              safeAddComponent(instance, MaterialDirty),
            )
          : layer.value);
      const canvas = this.texturePool.getOrCreatePattern({
        pattern: {
          image,
          repetition: layer.repetition ?? 'repeat',
          transform: layer.transform ?? '',
        },
        width: pw,
        height: ph,
        rasterScale: prepared?.rasterScale,
        tileScale: prepared?.tileScale,
      });
      const texture = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: pw,
        height: ph,
        usage: TextureUsage.SAMPLED,
      });
      texture.setImageData([canvas]);
      return texture;
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
      return raw;
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
      return raw;
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
    return texture;
  }

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    const wc0 =
      this.shapes[0].has(Rough) &&
      this.shapes[0].read(Rough).fillStyle === 'watercolor';
    const wc1 =
      shape.has(Rough) && shape.read(Rough).fillStyle === 'watercolor';
    if (wc0 !== wc1) {
      return false;
    }

    if (
      this.shapes[0].has(Path) &&
      shape.has(Path) &&
      (this.shapes[0].read(Path).d !== shape.read(Path).d ||
        this.shapes[0].read(Path).fillRule !== shape.read(Path).fillRule ||
        this.shapes[0].read(Path).tessellationMethod !==
          shape.read(Path).tessellationMethod)
    ) {
      return false;
    }

    const vn0 = this.shapes[0].has(VectorNetwork)
      ? this.shapes[0].read(VectorNetwork)
      : null;
    const vn1 = shape.has(VectorNetwork) ? shape.read(VectorNetwork) : null;
    if ((vn0 === null) !== (vn1 === null)) {
      return false;
    }
    if (vn0 && vn1) {
      const vnKey = (v: typeof vn0) =>
        JSON.stringify({
          vertices: v.vertices,
          segments: v.segments,
          regions: v.regions,
        });
      if (vnKey(vn0) !== vnKey(vn1)) {
        return false;
      }
    }

    const isInstanceFillTexture = this.shapes[0].has(FillTexture);
    const isShapeFillTexture = shape.has(FillTexture);

    if (isInstanceFillTexture !== isShapeFillTexture) {
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
    if (fl0 && fl1 && JSON.stringify(fl0) !== JSON.stringify(fl1)) {
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

    return true;
  }

  createGeometry(): void {
    const instance = this.shapes[0];

    let rawPoints: [number, number][][] | undefined;
    let tessellationMethod: TesselationMethod | undefined;
    let fillMesh: { points: number[]; indices: number[] } | undefined;

    if (
      instance.has(Rough) &&
      instance.has(ComputedRough) &&
      instance.hasSomeOf(Circle, Ellipse, Rect, Path)
    ) {
      rawPoints = instance.read(ComputedRough).fillPathPoints;
      tessellationMethod = TesselationMethod.EARCUT;
    } else if (instance.has(Path)) {
      const { fillRule, tessellationMethod } = instance.read(Path);
      fillMesh = buildPathFillMesh(
        this.pathPoints.get(instance) ?? instance.read(ComputedPoints).points,
        fillRule,
        tessellationMethod,
      );
    } else if (instance.has(VectorNetwork)) {
      const { vertices, segments, regions } = instance.read(VectorNetwork);
      fillMesh = buildVectorNetworkFillMesh(vertices, segments, regions);
    }

    if (fillMesh !== undefined) {
      this.points = fillMesh.points;
      this.indexBufferData = new Uint32Array(fillMesh.indices);
    } else if (rawPoints !== undefined && tessellationMethod !== undefined) {
      const points = rawPoints.flat(2);

      if (points.length > 0) {
        if (tessellationMethod === TesselationMethod.EARCUT) {
          let holes = [];
          let contours = [];
          const indices = [];
          let indexOffset = 0;

          let firstClockWise = isClockWise(rawPoints[0]);

          rawPoints.forEach((points) => {
            const isHole = isClockWise(points) !== firstClockWise;
            if (isHole) {
              holes.push(contours.length);
            } else {
              firstClockWise = isClockWise(points);

              if (holes.length > 0) {
                indices.push(
                  ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
                );
                indexOffset += contours.length;
                holes = [];
                contours = [];
              }
            }
            contours.push(...points);
          });

          if (contours.length) {
            indices.push(
              ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
            );
          }

          this.indexBufferData = new Uint32Array(indices);
          this.points = points;
        }
      } else {
        this.points = [];
        this.indexBufferData = new Uint32Array([]);
      }
    } else {
      this.points = [];
      this.indexBufferData = new Uint32Array([]);
    }

    if (this.vertexBuffers[0]) {
      this.vertexBuffers[0].destroy();
    }
    this.vertexBufferDatas[0] = new Float32Array(this.points ?? []);
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData ?? new Uint32Array([]),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION, // a_Position
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    this.createProgram(vert, frag, defines);
    this.disposeFillImageResources();
    if (!hasRasterPostEffects(getRasterFilterValueForShape(this.shapes[0]))) {
      this.destroyFullPostProcessingChain();
    }
    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize:
          Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      topology: PrimitiveTopology.TRIANGLES,
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
        // Watercolor fills many overlapping triangles at the same z; with depthWrite
        // + GREATER, the first fragment wins and later overlapping fragments fail the
        // depth test — alpha never stacks. Solid earcut meshes rarely self-overlap.
        depthWrite: !this.isWatercolorRoughMesh(),
        depthCompare: CompareFunction.GREATER,
        ...this.stencilDescriptor,
      },
    });
    this.device.setResourceName(this.pipeline, 'MeshPipeline');

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
        topology: PrimitiveTopology.TRIANGLES,
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
          depthWrite: false,
          depthCompare: CompareFunction.GREATER,
          ...this.stencilDescriptor,
        },
      });
      this.device.setResourceName(
        this.#pipelineMultiFillMidPass,
        'MeshPipelineMultiFillMidPass',
      );
    }

    const bindings: BindingsDescriptor = {
      pipeline: this.pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
        {
          buffer: this.#uniformBuffer,
        },
      ],
    };

    if (this.useFillImage) {
      if (this.bindings) {
        this.bindings.destroy();
      }

      const instance = this.shapes[0];

      this.#fillTextureFromPostChain = false;
      if (this.#rawFillImageTexture) {
        this.#rawFillImageTexture.destroy();
        this.#rawFillImageTexture = null;
      }

      const multiForTex = getMultiFillLayers(instance);
      const hasRasterFilter =
        !this.instanced &&
        hasRasterPostEffects(getRasterFilterValueForShape(instance));
      const needsFillLayerRaster =
        multiForTex &&
        (fillLayersNeedFillImage(multiForTex) ||
          fillLayersShouldPrecompose(multiForTex) ||
          hasRasterFilter);
      if (needsFillLayerRaster && multiForTex) {
        const { minX, minY, maxX, maxY } =
          getSdfGeometryBoundsForFilter(instance);
        const rasterize = (layer: FillLayerItem) =>
          this.createMeshFillLayerTexture(
            instance,
            layer,
            minX,
            minY,
            maxX - minX,
            maxY - minY,
          );
        if (fillLayersShouldPrecompose(multiForTex) || hasRasterFilter) {
          const composed = createComposedFillTexture(
            multiForTex,
            rasterize,
            (textures, width, height) =>
              composeFillLayerTexturesOnGpu(
                this.device,
                this.renderCache,
                multiForTex,
                textures,
                width,
                height,
                () => this.createSampler(),
              ),
          );
          this.#texture = composed.texture;
          this.#usePrecomposedMultiFill = true;
          this.#texture = this.applyRasterFilterChainIfNeeded(
            instance,
            composed.texture,
            composed.width,
            composed.height,
          );
        } else {
          this.#fillLayerTextures = multiForTex.map(rasterize);
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
          const raw = this.createMeshFillLayerTexture(
            instance,
            one,
            minX,
            minY,
            width,
            height,
          );
          const size = raw as Texture & { width: number; height: number };
          this.#texture = this.applyRasterFilterChainIfNeeded(
            instance,
            raw,
            size.width,
            size.height,
          );
        }
      } else if (instance.has(FillTexture)) {
        this.#texture = instance.read(FillTexture).value;
        this.#borrowedFillTexture = true;
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
      this.#bindingsMultiFillMidPass = this.renderCache.createBindings(midDesc);
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
        this.#fillLayerBindingsMidPass = this.#fillLayerTextures.map((tex) =>
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
  }

  /** Rough.js solid fill is one contour; watercolor uses many overlapping layers. */
  private isWatercolorRoughMesh(): boolean {
    return (
      !!this.shapes[0]?.has(Rough) &&
      this.shapes[0].read(Rough).fillStyle === 'watercolor'
    );
  }

  render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    const roughFill = this.shapes[0].has(Rough)
      ? this.shapes[0].read(Rough).fillStyle
      : null;
    if (
      this.points.length === 0 ||
      (roughFill !== null &&
        roughFill !== 'solid' &&
        roughFill !== 'watercolor')
    ) {
      return;
    }

    // if (
    //   this.shapes.some((shape) => shape.renderDirtyFlag) ||
    //   this.geometryDirty
    // ) {
    const shape = this.shapes[0];
    const multi = getMultiFillLayers(shape);
    if (multi && !this.#usePrecomposedMultiFill) {
      if (this.useWireframe && this.geometryDirty) {
        this.generateWireframe();
      }
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
      for (let i = 0; i < multi.length; i++) {
        const isMidFillPass = multi.length > 1 && i < multi.length - 1;
        const fillPipeline =
          isMidFillPass && this.#pipelineMultiFillMidPass
            ? this.#pipelineMultiFillMidPass
            : this.pipeline;
        const [buffer, legacyObject] = this.generateBuffer(shape, {
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
        renderPass.drawIndexed(this.indexBufferData.length, this.shapes.length);
      }
      return;
    }

    const { matrix } = this.shapes[0].read(GlobalTransform);
    const [buffer, legacyObject] = this.generateBuffer(this.shapes[0]);
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

    if (this.useWireframe && this.geometryDirty) {
      this.generateWireframe();
    }
    // }

    this.program.setUniformsLegacy(sceneUniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    const vertexBuffers = this.#blurVertices
      ? [{ buffer: this.#blurVertices }]
      : this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.#blurIndices ?? this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);
    if (this.useStencil || this.parentClipMode) {
      renderPass.setStencilReference(STENCIL_CLIP_REF);
    }
    renderPass.drawIndexed(
      this.#blurRaster ? 6 : this.indexBufferData.length,
      this.shapes.length,
    );
  }

  destroy(): void {
    this.disposeFillImageResources();
    this.destroyFullPostProcessingChain();
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
    }
  }

  private generateBuffer(
    shape: Entity,
    multiFill?: { kind: 'fill-layer'; layerIndex: number },
  ): [number[], Record<string, unknown>] {
    const sizeAttenuation = 0;
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    let fill: string | null = getFirstSolidFillLayerValue(shape);
    const multiLayers = getMultiFillLayers(shape);
    const enabledFill = getEnabledFillLayers(shape);
    if (multiFill?.kind === 'fill-layer' && multiLayers) {
      const L = multiLayers[multiFill.layerIndex];
      fill = L.type === 'solid' ? L.value : '#ffffff';
    } else if (
      !multiFill &&
      enabledFill.length === 1 &&
      shape.has(FillLayers)
    ) {
      const L = enabledFill[0];
      fill = L.type === 'solid' ? L.value : '#ffffff';
    } else if (
      !multiFill &&
      this.#usePrecomposedMultiFill &&
      shape.has(FillLayers)
    ) {
      fill = '#ffffff';
    }
    const {
      r: fr,
      g: fg,
      b: fb,
      opacity: fo,
    } = parseColor(fill != null && fill !== '' ? fill : 'transparent');

    const opacity = this.getOpacity(shape);

    const strokeColor = resolveGpuStrokeColor(shape);
    const width = shape.has(Stroke) ? shape.read(Stroke).width : 0;
    const alignment = shape.has(Stroke)
      ? shape.read(Stroke).alignment
      : 'center';
    const {
      r: sr,
      g: sg,
      b: sb,
      opacity: so,
    } = parseColor(strokeColor ?? 'transparent');
    const { strokeColorAlphaMul, strokeUniformOpacityMul } =
      strokePaintAlphaMultipliers(shape);

    let minX = 0;
    let minY = 0;
    let invWidth = 0;
    let invHeight = 0;
    if (
      enabledFill.some((l) => l.type === 'pattern') ||
      (multiLayers != null && fillLayersNeedFillImage(multiLayers)) ||
      (shape.has(FillLayers) &&
        (fillLayersNeedFillImage(enabledFill) || this.#usePrecomposedMultiFill))
    ) {
      const {
        minX: gMinX,
        minY: gMinY,
        maxX: gMaxX,
        maxY: gMaxY,
      } = getSdfGeometryBoundsForFilter(shape);
      const geometryWidth = gMaxX - gMinX;
      const geometryHeight = gMaxY - gMinY;
      minX = gMinX;
      minY = gMinY;
      invWidth = geometryWidth === 0 ? 0 : 1 / geometryWidth;
      invHeight = geometryHeight === 0 ? 0 : 1 / geometryHeight;
    } else if (this.useFillImage) {
      const {
        minX: gMinX,
        minY: gMinY,
        maxX: gMaxX,
        maxY: gMaxY,
      } = getSdfGeometryBoundsForFilter(shape);
      const geometryWidth = gMaxX - gMinX;
      const geometryHeight = gMaxY - gMinY;
      minX = gMinX;
      minY = gMinY;
      invWidth = geometryWidth === 0 ? 0 : 1 / geometryWidth;
      invHeight = geometryHeight === 0 ? 0 : 1 / geometryHeight;
    } else {
      minX = 0;
      minY = 0;
      invWidth = 0;
      invHeight = 0;
    }

    let frN = fr / 255;
    let fgN = fg / 255;
    let fbN = fb / 255;
    let fa = fo;
    if (multiFill?.kind === 'fill-layer' && multiLayers) {
      const L = multiLayers[multiFill.layerIndex];
      const lo = fillLayerOpacity(L.opacity);
      if (this.useFillImage) {
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
      if (this.useFillImage) {
        frN = 1;
        fgN = 1;
        fbN = 1;
        fa = lo;
      } else {
        fa = fo * lo;
      }
    } else if (
      !multiFill &&
      this.#usePrecomposedMultiFill &&
      shape.has(FillLayers)
    ) {
      frN = 1;
      fgN = 1;
      fbN = 1;
      fa = 1;
    }
    const u_FillColor = this.#blurRaster ? [1, 1, 1, 1] : [frN, fgN, fbN, fa];
    const u_StrokeColor = [
      sr / 255,
      sg / 255,
      sb / 255,
      so * strokeColorAlphaMul,
    ];
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      Mesh.useDash(shape) ? 0 : width,
      0,
      strokeAlignmentMap[alignment],
    ];
    const u_Opacity = [
      opacity,
      1,
      strokeUniformOpacityMul,
      sizeAttenuation ? 1 : 0,
    ];
    const bounds = this.#blurRaster?.bounds;
    const u_FillUVRect = bounds
      ? [
          bounds.minX,
          bounds.minY,
          1 / (bounds.maxX - bounds.minX),
          1 / (bounds.maxY - bounds.minY),
        ]
      : [minX, minY, invWidth, invHeight];

    if (this.isWatercolorRoughMesh()) {
      u_Opacity[1] *= 0.05;
    }

    return [
      [
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_FillUVRect,
      ],
      {
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_FillUVRect,
      },
    ];
  }
}
