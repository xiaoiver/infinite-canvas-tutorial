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
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TransparentBlack,
  Texture,
  StencilOp,
} from '@antv/g-device-api';
import { Circle, Ellipse, Rect, Shape } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/sdf';
import { isPattern, isString, paddingMat3 } from '../utils';
import { InstanceBuffer } from '../utils/instance-buffer';

const NO_INSTANCE_UNIFORMS = Object.freeze({});

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class SDF extends Drawcall {
  // protected maxInstances: number = 1000;

  #uniformBuffer: Buffer;
  #texture: Texture;
  #attributes?: InstanceBuffer;
  #matrices?: InstanceBuffer;
  #fullRenderOrder?: number;

  static useDash(shape: Shape) {
    const { strokeDasharray } = shape;
    return (
      strokeDasharray.length > 0 && strokeDasharray.some((dash) => dash > 0)
    );
  }

  validate(shape: Shape) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    const isInstanceFillImage = !isString(this.shapes[0].fill);
    const isShapeFillImage = !isString(shape.fill);
    const isInstanceFillGradient = this.shapes[0].fillGradient?.length > 0;
    const isShapeFillGradient = shape.fillGradient?.length > 0;
    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillGradient !== isShapeFillGradient) {
      return false;
    }

    if (
      (isInstanceFillImage && isShapeFillImage) ||
      (isInstanceFillGradient && isShapeFillGradient)
    ) {
      return this.shapes[0].fill === shape.fill;
    }

    if (SDF.useDash(shape) !== SDF.useDash(this.shapes[0])) {
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

      this.vertexBufferDatas[1] = new Float32Array(32 * this.shapes.length);
      this.vertexBuffers[1] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[1],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      this.vertexBufferDatas[2] = new Float32Array(6 * this.shapes.length);
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
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
        stencilWrite: false,
        stencilFront: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
        stencilBack: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
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
      const fill = this.shapes[0].fill;

      if (this.bindings) {
        this.bindings.destroy();
      }

      if (isString(fill) || isPattern(fill)) {
        const { minX, minY, maxX, maxY } = this.shapes[0].getGeometryBounds();
        const width = maxX - minX;
        const height = maxY - minY;

        const canvas = isPattern(fill)
          ? this.texturePool.getOrCreatePattern({
              pattern: fill,
              width,
              height,
            })
          : this.texturePool.getOrCreateGradient({
              gradients: this.shapes[0].fillGradient,
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
        this.#texture = texture;
      } else if ((fill as { texture: Texture }).texture) {
        this.#texture = (fill as { texture: Texture }).texture;
      } else {
        const texture = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: (fill as ImageBitmap).width,
          height: (fill as ImageBitmap).height,
          usage: TextureUsage.SAMPLED,
        });
        texture.setImageData([fill as ImageBitmap]);
        this.#texture = texture;
      }

      const sampler = this.renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
      bindings.samplerBindings = [
        {
          texture: this.#texture,
          sampler,
        },
      ];
    }

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (this.destroyed) return;
    const depthChanged = this.instanced
      ? this.shapes.some((shape, i) => {
          const data = this.vertexBufferDatas[1];
          return (
            !data ||
            !Object.is(
              data[i * 32 + 16],
              Math.fround(shape.globalRenderOrder / ZINDEX_FACTOR),
            ) ||
            !Object.is(
              data[i * 32 + 2],
              Math.fround(
                (shape.globalRenderOrder + (1 / this.shapes.length) * i) /
                  ZINDEX_FACTOR,
              ),
            )
          );
        })
      : this.#fullRenderOrder !== this.shapes[0]?.globalRenderOrder;
    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty ||
      depthChanged
    ) {
      if (this.instanced) {
        if (
          !this.#attributes?.matches(
            this.vertexBufferDatas[1],
            this.vertexBuffers[1],
          )
        ) {
          this.#attributes?.dispose();
          this.#attributes = new InstanceBuffer(
            this.vertexBufferDatas[1],
            this.vertexBuffers[1],
            32,
          );
        }
        if (
          !this.#matrices?.matches(
            this.vertexBufferDatas[2],
            this.vertexBuffers[2],
          )
        ) {
          this.#matrices?.dispose();
          this.#matrices = new InstanceBuffer(
            this.vertexBufferDatas[2],
            this.vertexBuffers[2],
            6,
          );
        }
        this.shapes.forEach((shape, i, total) => {
          const [buffer] = this.generateBuffer(shape, i, total.length);
          this.#attributes.write(i, buffer);
          const m = shape.worldTransform;
          this.#matrices.set(i, 0, m.a);
          this.#matrices.set(i, 1, m.b);
          this.#matrices.set(i, 2, m.c);
          this.#matrices.set(i, 3, m.d);
          this.#matrices.set(i, 4, m.tx);
          this.#matrices.set(i, 5, m.ty);
        });
      } else {
        const { worldTransform } = this.shapes[0];
        const [buffer, legacyObject] = this.generateBuffer(
          this.shapes[0],
          0,
          1,
        );
        const u_ModelMatrix = worldTransform.toArray(true);
        this.#uniformBuffer.setSubData(
          0,
          new Uint8Array(
            new Float32Array([...paddingMat3(u_ModelMatrix), ...buffer]).buffer,
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
        this.#fullRenderOrder = this.shapes[0].globalRenderOrder;
      }

      if (this.useWireframe && this.geometryDirty) {
        this.#attributes?.flush(this.shapes.length);
        this.#matrices?.flush(this.shapes.length);
        this.#attributes?.dispose();
        this.#matrices?.dispose();
        this.#attributes = this.#matrices = undefined;
        this.generateWireframe();
      }
    }

    this.#attributes?.flush(this.shapes.length);
    this.#matrices?.flush(this.shapes.length);
    this.program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.pipeline);

    const vertexBuffers = this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(6, this.shapes.length);
  }

  destroy(): void {
    this.#attributes?.dispose();
    this.#matrices?.dispose();
    this.#attributes = this.#matrices = undefined;
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy?.();
    }
  }

  private generateBuffer(
    shape: Shape,
    index: number,
    total: number,
  ): [number[], Record<string, unknown>] {
    const {
      fillRGB,
      strokeRGB: { r: sr, g: sg, b: sb, opacity: so },
      strokeWidth,
      strokeAlignment,
      opacity,
      fillOpacity,
      strokeOpacity,
      innerShadowColorRGB: { r: isr, g: isg, b: isb, opacity: iso },
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      sizeAttenuation,
      strokeAttenuation,
    } = shape;

    let px = 0,
      py = 0,
      pz = 0,
      sx = 0,
      sy = 0;
    let type: number = 0;
    let cornerRadius = 0;
    const zIndex =
      (shape.globalRenderOrder + (1 / total) * index) / ZINDEX_FACTOR;
    if (shape instanceof Circle) {
      const { cx, cy, r } = shape;
      pz = zIndex;
      px = cx;
      py = cy;
      sx = r;
      sy = r;
      type = 0;
    } else if (shape instanceof Ellipse) {
      const { cx, cy, rx, ry } = shape;
      pz = zIndex;
      px = cx;
      py = cy;
      sx = rx;
      sy = ry;
      type = 1;
    } else if (shape instanceof Rect) {
      const { x, y, width, height, cornerRadius: r } = shape;
      pz = zIndex;
      px = x + width / 2;
      py = y + height / 2;
      sx = width / 2;
      sy = height / 2;
      type = 2;
      cornerRadius = r;
    }

    const { r: fr, g: fg, b: fb, opacity: fo } = fillRGB || {};

    const LEFT_SHIFT22 = 4194304.0;
    const LEFT_SHIFT23 = 8388608.0;
    const compressed =
      (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 +
      (strokeAttenuation ? 1 : 0) * LEFT_SHIFT22 +
      type;
    const flat = [
      px,
      py,
      pz,
      0,
      sx,
      sy,
      0,
      0,
      fr / 255,
      fg / 255,
      fb / 255,
      fo,
      sr / 255,
      sg / 255,
      sb / 255,
      so,
      shape.globalRenderOrder / ZINDEX_FACTOR,
      SDF.useDash(shape) ? 0 : strokeWidth,
      cornerRadius,
      strokeAlignmentMap[strokeAlignment],
      opacity,
      fillOpacity,
      strokeOpacity,
      compressed,
      isr / 255,
      isg / 255,
      isb / 255,
      iso,
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      0,
    ];
    // Instance attributes consume only the packed row. Full draws still own
    // independent legacy arrays, including when submission is deferred.
    if (this.instanced) return [flat, NO_INSTANCE_UNIFORMS];
    return [
      flat,
      {
        u_Position: flat.slice(0, 4),
        u_Size: flat.slice(4, 8),
        u_FillColor: flat.slice(8, 12),
        u_StrokeColor: flat.slice(12, 16),
        u_ZIndexStrokeWidth: flat.slice(16, 20),
        u_Opacity: flat.slice(20, 24),
        u_InnerShadowColor: flat.slice(24, 28),
        u_InnerShadow: flat.slice(28, 32),
      },
    ];
  }
}
