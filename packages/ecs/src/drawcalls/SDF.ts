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
} from '../utils';
import {
  getRasterFilterValueForShape,
  filterRasterPostEffects,
} from '../utils/filter';
import { scheduleFillImageSvgRerasterIfNeeded } from '../utils/fillImageSvgReraster';
import {
  blitImageBitmapToPixelSize,
  getDevicePixelRatioForRaster,
  getShapePixelBoundsForFillImage,
  resolveFillImageTexturePixelSize,
} from '../utils/fillImageTextureSize';
import {
  Circle,
  ComputedBounds,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  InnerShadow,
  Mat3,
  Opacity,
  Rect,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  StrokeGradient,
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

  /** Rasterize {@link FillSolid} for texture-space filters (same alpha as `u_FillColor` before `fillOpacity`). */
  private createSolidFillRasterCanvas(
    shape: Entity,
    tw: number,
    th: number,
  ): HTMLCanvasElement | OffscreenCanvas {
    const fill = shape.read(FillSolid).value;
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = tw;
      c.height = th;
      canvas = c;
    } else {
      canvas = new OffscreenCanvas(tw, th);
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) {
      throw new Error('Canvas 2D required for solid fill + filter');
    }
    ctx.fillStyle = `rgba(${fr},${fg},${fb},${fo})`;
    ctx.fillRect(0, 0, tw, th);
    return canvas;
  }

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    const isInstanceFillImage = this.shapes[0].has(FillImage);
    const isShapeFillImage = shape.has(FillImage);
    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    const isInstanceFillGradient = this.shapes[0].has(FillGradient);
    const isShapeFillGradient = shape.has(FillGradient);
    if (isInstanceFillGradient !== isShapeFillGradient) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].read(FillImage).src === shape.read(FillImage).src;
    }

    if (isInstanceFillGradient && isShapeFillGradient) {
      return this.shapes[0].read(FillGradient) === shape.read(FillGradient);
    }

    const isInstanceStrokeGradient = this.shapes[0].has(StrokeGradient);
    const isShapeStrokeGradient = shape.has(StrokeGradient);
    if (isInstanceStrokeGradient !== isShapeStrokeGradient) {
      return false;
    }
    if (isInstanceStrokeGradient && isShapeStrokeGradient) {
      return this.shapes[0].read(StrokeGradient) === shape.read(StrokeGradient);
    }

    if (SDF.useDash(shape) !== SDF.useDash(this.shapes[0])) {
      return false;
    }

    const fa = getRasterFilterValueForShape(this.shapes[0]);
    const fb = getRasterFilterValueForShape(shape);
    if (Boolean(fa) !== Boolean(fb) || (fa && fb && fa !== fb)) {
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

    if (!this.instanced && !this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 * 8),
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
      if (!getRasterFilterValueForShape(instance)) {
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
        // `Texture` has no public size here; per-shape filter on FillTexture needs GPU size API.
        this.#texture = instance.read(FillTexture).value;
      } else if (instance.has(FillImage)) {
        const src = instance.read(FillImage).src as ImageBitmap;
        const sw = Math.max(1, src.width);
        const sh = Math.max(1, src.height);
        const { geomW, geomH } = getShapePixelBoundsForFillImage(instance);
        const { width: tw, height: th } = resolveFillImageTexturePixelSize(
          sw,
          sh,
          geomW,
          geomH,
          getDevicePixelRatioForRaster(),
        );

        const raw = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: tw,
          height: th,
          usage: TextureUsage.SAMPLED,
        });
        if (tw === sw && th === sh) {
          raw.setImageData([src]);
        } else {
          const canvas = blitImageBitmapToPixelSize(src, tw, th);
          raw.setImageData([canvas as HTMLCanvasElement]);
        }
        this.#texture = this.applyRasterFilterChainIfNeeded(
          instance,
          raw,
          tw,
          th,
        );
        scheduleFillImageSvgRerasterIfNeeded({
          entity: instance,
          url: instance.read(FillImage).url,
          targetW: tw,
          targetH: th,
          sourceW: sw,
          sourceH: sh,
        });
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
      this.programSoftClipOutside = programOutside;
      const bindingsOutside: BindingsDescriptor = {
        pipeline: this.pipelineSoftClipOutside,
        uniformBufferBindings: [...bindings.uniformBufferBindings!],
      };
      if (bindings.samplerBindings) {
        bindingsOutside.samplerBindings = bindings.samplerBindings;
      }
      this.bindingsSoftClipOutside = this.renderCache.createBindings(bindingsOutside);
    }
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
      this.#uniformBuffer = null;
    }
  }

  private generateBuffer(
    shape: Entity,
    index: number,
    total: number,
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
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);
    const {
      r: isr,
      g: isg,
      b: isb,
      opacity: iso,
    } = parseColor(innerShadowColor);

    const u_Position = position;
    const u_Size = size;
    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    let strokeWidthForSdf = SDF.useDash(shape) ? 0 : width;
    if (shape.has(StrokeGradient)) {
      strokeWidthForSdf = 0;
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
    const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed];
    const u_InnerShadowColor = [isr / 255, isg / 255, isb / 255, iso];
    const u_InnerShadow = [offsetX, offsetY, blurRadius, 0];

    return [
      [
        ...u_Position,
        ...u_Size,
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_InnerShadowColor,
        ...u_InnerShadow,
      ],
      {
        u_Position,
        u_Size,
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_InnerShadowColor,
        u_InnerShadow,
      },
    ];
  }
}
