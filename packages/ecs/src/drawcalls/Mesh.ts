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
import { Drawcall, ZINDEX_FACTOR, STENCIL_CLIP_REF } from './Drawcall';
import { vert, frag, Location } from '../shaders/mesh';
import {
  buildVectorNetworkFillMesh,
  isClockWise,
  paddingMat3,
  parseColor,
  parseGradient,
  isMeshGradientGradient,
  triangulate,
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
import { strokePaintAlphaMultipliers } from '../utils/strokeLayers';
import { composeFillLayerTexturesOnGpu } from '../utils/fillLayerComposeGpu';
import {
  getRasterFilterValueForShape,
  parseEffect,
  filterRasterPostEffects,
} from '../utils/filter';
import { scheduleFillImageSvgRerasterIfNeeded } from '../utils/fillImageSvgReraster';
import {
  getFillLayerDecodedBitmap,
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
  Ellipse,
  FillLayers,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  MaterialDirty,
  Opacity,
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

export class Mesh extends Drawcall {
  #uniformBuffer: Buffer;
  #texture: Texture;
  /** Unfiltered GPU texture when applying {@link Filter} (chain samples this). */
  #rawFillImageTexture: Texture | null = null;
  /** True when {@link #texture} is the post-process chain output (do not `destroy` in Mesh.destroy). */
  #fillTextureFromPostChain = false;

  #fillLayerTextures: Texture[] = [];
  #fillLayerBindings: Bindings[] = [];
  /** 多层填充中间 pass，禁用 depthWrite，避免同深度后续 pass 被遮挡（与 Rough 水彩一致）。 */
  #pipelineMultiFillMidPass: RenderPipeline | null = null;
  #fillLayerBindingsMidPass: Bindings[] = [];
  #bindingsMultiFillMidPass: Bindings | null = null;
  #usePrecomposedMultiFill = false;

  points: number[] = [];

  instanced = false;

  static useDash(shape: Entity) {
    const { dasharray = [] } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { dasharray: [] };
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

  private disposeMeshFillLayerResources(): void {
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
    if (clearsMainTexture) {
      this.#texture = null;
    }
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
      const { width: tw, height: th } = resolveFillLayerImageRasterPixelSize(
        layer.value,
        width,
        height,
      );
      const fromUrl = rasterizeFillLayerImageUrlForTexture(
        layer.value,
        tw,
        th,
        () => safeAddComponent(instance, MaterialDirty),
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
      });
      return this.applyRasterFilterChainIfNeeded(instance, raw, tw, th);
    }
    if (layer.type === 'pattern') {
      const pw = Math.max(1, width);
      const ph = Math.max(1, height);
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
        width: 128,
        height: 128,
        usage: TextureUsage.SAMPLED,
      });
      texture.setImageData([canvas]);
      return this.applyRasterFilterChainIfNeeded(instance, texture, 128, 128);
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
    const fillGradients = parseGradient(layer.value);
    const meshFill =
      fillGradients !== undefined && fillGradients.length === 1
        ? fillGradients[0]
        : undefined;
    if (meshFill && isMeshGradientGradient(meshFill)) {
      const raw = this.renderMeshGradientTexture(meshFill, 128, 128);
      return this.applyRasterFilterChainIfNeeded(instance, raw, 128, 128);
    }
    const canvas = this.texturePool.getOrCreateGradient({
      gradients: fillGradients ?? [],
      min: [minX, minY],
      width,
      height,
    });
    const texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: 128,
      height: 128,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([canvas]);
    return this.applyRasterFilterChainIfNeeded(instance, texture, 128, 128);
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
      this.shapes[0].read(Path).d !== shape.read(Path).d
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
    if (
      fl0 &&
      fl1 &&
      JSON.stringify(fl0) !== JSON.stringify(fl1)
    ) {
      return false;
    }

    return true;
  }

  createGeometry(): void {
    const instance = this.shapes[0];

    let rawPoints: [number, number][][] | undefined;
    let tessellationMethod: TesselationMethod | undefined;
    let vnFillMesh: { points: number[]; indices: number[] } | undefined;

    if (
      instance.has(Rough) &&
      instance.has(ComputedRough) &&
      instance.hasSomeOf(Circle, Ellipse, Rect, Path)
    ) {
      rawPoints = instance.read(ComputedRough).fillPathPoints;
      tessellationMethod = TesselationMethod.EARCUT;
    } else if (instance.has(Path)) {
      rawPoints = instance.read(ComputedPoints).points;
      tessellationMethod = instance.read(Path).tessellationMethod;
    } else if (instance.has(VectorNetwork)) {
      const { vertices, segments, regions } = instance.read(VectorNetwork);
      vnFillMesh = buildVectorNetworkFillMesh(vertices, segments, regions);
    }

    if (vnFillMesh !== undefined) {
      this.points = vnFillMesh.points;
      this.indexBufferData = new Uint32Array(vnFillMesh.indices);
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
        } else if (tessellationMethod === TesselationMethod.LIBTESS) {
          const newPoints = triangulate(rawPoints, instance.read(Path).fillRule);
          this.indexBufferData = new Uint32Array(
            new Array(newPoints.length / 2).fill(undefined).map((_, i) => i),
          );
          this.points = newPoints;
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
    this.disposeMeshFillLayerResources();
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
          this.createMeshFillLayerTexture(
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
          this.#texture = this.createMeshFillLayerTexture(
            instance,
            one,
            minX,
            minY,
            width,
            height,
          );
        }
      } else if (instance.has(FillTexture)) {
        this.#texture = instance.read(FillTexture).value;
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
    renderPass.drawIndexed(this.indexBufferData.length, this.shapes.length);
  }

  destroy(): void {
    this.disposeMeshFillLayerResources();
    this.destroyFullPostProcessingChain();
    this.#rawFillImageTexture?.destroy();
    this.#rawFillImageTexture = null;
    if (!this.#fillTextureFromPostChain) {
      this.#texture?.destroy?.();
    }
    this.#texture = null;
    this.#fillTextureFromPostChain = false;
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
    } else if (!multiFill && this.#usePrecomposedMultiFill && shape.has(FillLayers)) {
      fill = '#ffffff';
    }
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(
      fill != null && fill !== '' ? fill : 'transparent',
    );

    const { opacity, strokeOpacity, fillOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1, fillOpacity: 1 };

    const {
      color: strokeColor,
      width,
      alignment,
    } = shape.has(Stroke)
        ? shape.read(Stroke)
        : { color: null, width: 0, alignment: 'center' };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);
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
      const { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY } =
        getSdfGeometryBoundsForFilter(shape);
      const geometryWidth = gMaxX - gMinX;
      const geometryHeight = gMaxY - gMinY;
      minX = gMinX;
      minY = gMinY;
      invWidth = geometryWidth === 0 ? 0 : 1 / geometryWidth;
      invHeight = geometryHeight === 0 ? 0 : 1 / geometryHeight;
    } else if (this.useFillImage) {
      const { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY } =
        getSdfGeometryBoundsForFilter(shape);
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
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      Mesh.useDash(shape) ? 0 : width,
      0,
      strokeAlignmentMap[alignment],
    ];
    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity * strokeUniformOpacityMul,
      sizeAttenuation ? 1 : 0,
    ];
    const u_FillUVRect = [minX, minY, invWidth, invHeight];

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
