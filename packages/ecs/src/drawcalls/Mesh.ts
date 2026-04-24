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
  TransparentBlack,
  Texture,
  PrimitiveTopology,
  TextureUsage,
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
import { parseEffect, filterRasterPostEffects } from '../utils/filter';
import { createSolidFillMaskRasterForFilter } from '../utils/solidShapeRasterForFilter';
import {
  ComputedPoints,
  ComputedBounds,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
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
  Filter,
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
    if (
      this.instanced ||
      !instance.has(Filter) ||
      !instance.read(Filter).value
    ) {
      return raw;
    }
    const effects = filterRasterPostEffects(
      parseEffect(instance.read(Filter).value),
    );
    if (effects.length === 0) {
      return raw;
    }
    this.#rawFillImageTexture = raw;
    this.createPostProcessing(effects, raw, tw, th);
    const { texture: filtered } = this.renderPostProcessingTextureSpace(tw, th);
    this.#fillTextureFromPostChain = true;
    return filtered;
  }

  /**
   * Rasterize {@link FillSolid} geometry to a mask bitmap for texture-space filters
   * (vector silhouette + premultiplied-ish RGBA, same bounds as {@link ComputedBounds} used for `u_FillUVRect`).
   */
  private createSolidFillRasterCanvas(
    shape: Entity,
    tw: number,
    th: number,
  ): HTMLCanvasElement | OffscreenCanvas {
    const fill = shape.read(FillSolid).value;
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);
    const fillRgba = `rgba(${fr},${fg},${fb},${fo})`;
    const { minX, minY, maxX, maxY } = shape.read(ComputedBounds).geometryBounds;
    return createSolidFillMaskRasterForFilter(
      shape,
      fillRgba,
      { minX, minY, maxX, maxY },
      tw,
      th,
    );
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

    const isInstanceFillImage = this.shapes[0].has(FillImage);
    const isShapeFillImage = shape.has(FillImage);
    const isInstanceFillGradient = this.shapes[0].has(FillGradient);
    const isShapeFillGradient = shape.has(FillGradient);
    const isInstanceFillPattern = this.shapes[0].has(FillPattern);
    const isShapeFillPattern = shape.has(FillPattern);
    const isInstanceFillTexture = this.shapes[0].has(FillTexture);
    const isShapeFillTexture = shape.has(FillTexture);

    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillGradient !== isShapeFillGradient) {
      return false;
    }

    if (isInstanceFillPattern !== isShapeFillPattern) {
      return false;
    }

    if (isInstanceFillTexture !== isShapeFillTexture) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].read(FillImage).src === shape.read(FillImage).src;
    }

    if (isInstanceFillGradient && isShapeFillGradient) {
      return this.shapes[0].read(FillGradient) === shape.read(FillGradient);
    }

    if (this.shapes[0].has(Filter) || shape.has(Filter)) {
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
      if (!instance.has(Filter)) {
        this.destroyFullPostProcessingChain();
      }
      if (this.#rawFillImageTexture) {
        this.#rawFillImageTexture.destroy();
        this.#rawFillImageTexture = null;
      }

      if (instance.has(FillGradient) || instance.has(FillPattern)) {
        const { minX, minY, maxX, maxY } =
          instance.read(ComputedBounds).geometryBounds;
        const width = maxX - minX;
        const height = maxY - minY;
        const fillGradients = instance.has(FillGradient)
          ? parseGradient(instance.read(FillGradient).value)
          : undefined;
        const meshFill =
          fillGradients?.length === 1 ? fillGradients[0] : undefined;
        if (instance.has(FillPattern)) {
          const canvas = this.texturePool.getOrCreatePattern({
            pattern: instance.read(FillPattern),
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
          this.#texture = this.applyRasterFilterChainIfNeeded(
            instance,
            texture,
            128,
            128,
          );
        } else if (meshFill && isMeshGradientGradient(meshFill)) {
          const raw = this.renderMeshGradientTexture(meshFill, 128, 128);
          this.#texture = this.applyRasterFilterChainIfNeeded(
            instance,
            raw,
            128,
            128,
          );
        } else {
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
          this.#texture = this.applyRasterFilterChainIfNeeded(
            instance,
            texture,
            128,
            128,
          );
        }
      } else if (instance.has(FillTexture)) {
        this.#texture = instance.read(FillTexture).value;
      } else if (instance.has(FillImage)) {
        const src = instance.read(FillImage).src as ImageBitmap;
        const tw = Math.max(1, src.width);
        const th = Math.max(1, src.height);
        const raw = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: tw,
          height: th,
          usage: TextureUsage.SAMPLED,
        });
        raw.setImageData([src]);
        this.#texture = this.applyRasterFilterChainIfNeeded(
          instance,
          raw,
          tw,
          th,
        );
      } else if (instance.has(FillSolid)) {
        const { minX, minY, maxX, maxY } =
          instance.read(ComputedBounds).geometryBounds;
        const tw = Math.max(1, Math.ceil(maxX - minX));
        const th = Math.max(1, Math.ceil(maxY - minY));
        const canvas = this.createSolidFillRasterCanvas(instance, tw, th);
        const raw = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: tw,
          height: th,
          usage: TextureUsage.SAMPLED,
        });
        raw.setImageData([canvas as HTMLCanvasElement]);
        this.#texture = this.applyRasterFilterChainIfNeeded(
          instance,
          raw,
          tw,
          th,
        );
      }

      bindings.samplerBindings = [
        {
          texture: this.#texture,
          sampler: this.createSampler(),
        },
      ];
    }

    this.bindings = this.renderCache.createBindings(bindings);
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

  private generateBuffer(shape: Entity): [number[], Record<string, unknown>] {
    const sizeAttenuation = 0;
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: null };
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);

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

    let minX = 0;
    let minY = 0;
    let invWidth = 0;
    let invHeight = 0;
    if (shape.has(FillGradient) || shape.has(FillPattern)) {
      const { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY } = shape.read(ComputedBounds).geometryBounds;
      const geometryWidth = gMaxX - gMinX;
      const geometryHeight = gMaxY - gMinY;
      minX = gMinX;
      minY = gMinY;
      invWidth = geometryWidth === 0 ? 0 : 1 / geometryWidth;
      invHeight = geometryHeight === 0 ? 0 : 1 / geometryHeight;
    } else if (this.useFillImage && shape.has(ComputedBounds)) {
      const { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY } = shape.read(ComputedBounds).geometryBounds;
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

    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      Mesh.useDash(shape) ? 0 : width,
      0,
      strokeAlignmentMap[alignment],
    ];
    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
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
