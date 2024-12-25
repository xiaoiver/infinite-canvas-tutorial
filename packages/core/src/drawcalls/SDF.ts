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
import { isString, paddingMat3 } from '../utils';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class SDF extends Drawcall {
  // protected maxInstances: number = 1000;

  #uniformBuffer: Buffer;
  #texture: Texture;

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

    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].fill === shape.fill;
    }

    if (SDF.useDash(shape) !== SDF.useDash(this.shapes[0])) {
      return false;
    }

    return true;
  }

  createGeometry(): void {
    if (!this.indexBuffer) {
      this.indexBufferData = new Uint32Array([0, 1, 2, 0, 2, 3]);
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: this.indexBufferData,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });

      this.vertexBufferDatas[0] = new Float32Array([
        -1, -1, 1, -1, 1, 1, -1, 1,
      ]);
      this.vertexBuffers[0] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[0],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }

    if (this.instanced) {
      if (this.vertexBuffers[1]) {
        this.vertexBuffers[1].destroy();
        this.vertexBuffers[2].destroy();
      }

      this.vertexBufferDatas[1] = new Float32Array(
        new Array(28 * this.shapes.length).fill(0),
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
          arrayStride: 4 * 28,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.POSITION_SIZE, // a_PositionSize
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.FILL_COLOR, // a_FillColor
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.STROKE_COLOR, // a_StrokeColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.ZINDEX_STROKE_WIDTH, // a_ZIndexStrokeWidth
              offset: 4 * 12,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.OPACITY, // a_Opacity
              offset: 4 * 16,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW_COLOR, // a_InnerShadowColor
              offset: 4 * 20,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW, // a_InnerShadow
              offset: 4 * 24,
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

  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
    if (this.useFillImage) {
      defines += '#define USE_FILLIMAGE\n';
    }
    if (this.useWireframe) {
      defines += '#define USE_WIREFRAME\n';
    }

    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: this.vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });

    if (!this.instanced && !this.#uniformBuffer) {
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

    // TODO: Canvas Gradient
    if (this.useFillImage) {
      const fill = this.shapes[0].fill as ImageBitmap;
      const texture = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: fill.width,
        height: fill.height,
        usage: TextureUsage.SAMPLED,
      });
      texture.setImageData([fill]);
      this.#texture = texture;
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
          texture,
          sampler,
        },
      ];
    }

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      if (this.instanced) {
        const instancedData: number[] = [];
        this.shapes.forEach((shape) => {
          const [buffer] = this.generateBuffer(shape);
          instancedData.push(...buffer);
        });
        this.vertexBufferDatas[1] = new Float32Array(instancedData);
        this.vertexBuffers[1].setSubData(
          0,
          new Uint8Array(this.vertexBufferDatas[1].buffer),
        );

        this.vertexBufferDatas[2] = new Float32Array(
          this.shapes
            .map((shape) => [
              shape.worldTransform.a,
              shape.worldTransform.b,
              shape.worldTransform.c,
              shape.worldTransform.d,
              shape.worldTransform.tx,
              shape.worldTransform.ty,
            ])
            .flat(),
        );
        this.vertexBuffers[2].setSubData(
          0,
          new Uint8Array(this.vertexBufferDatas[2].buffer),
        );
      } else {
        const { worldTransform } = this.shapes[0];
        const [buffer, legacyObject] = this.generateBuffer(this.shapes[0]);
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
      }

      if (this.useWireframe) {
        this.generateWireframe();

        if (this.instanced) {
          this.vertexBuffers[1].setSubData(
            0,
            new Uint8Array(this.vertexBufferDatas[1].buffer),
          );
          this.vertexBuffers[2].setSubData(
            0,
            new Uint8Array(this.vertexBufferDatas[2].buffer),
          );
        }
      }
    }

    this.program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexInput(
      this.inputLayout,
      this.vertexBuffers.map((buffer) => ({ buffer })),
      {
        buffer: this.indexBuffer,
      },
    );
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(6, this.shapes.length);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }
  }

  private generateBuffer(shape: Shape): [number[], Record<string, unknown>] {
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
    } = shape;

    let size: [number, number, number, number] = [0, 0, 0, 0];
    let type: number = 0;
    let cornerRadius = 0;
    if (shape instanceof Circle) {
      const { cx, cy, r } = shape;
      size = [cx, cy, r, r];
      type = 0;
    } else if (shape instanceof Ellipse) {
      const { cx, cy, rx, ry } = shape;
      size = [cx, cy, rx, ry];
      type = 1;
    } else if (shape instanceof Rect) {
      const { x, y, width, height, cornerRadius: r } = shape;
      size = [x + width / 2, y + height / 2, width / 2, height / 2];
      type = 2;
      cornerRadius = r;
    }

    const { r: fr, g: fg, b: fb, opacity: fo } = fillRGB || {};

    const u_PositionSize = size;
    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      SDF.useDash(shape) ? 0 : strokeWidth,
      cornerRadius,
      strokeAlignmentMap[strokeAlignment],
    ];

    const LEFT_SHIFT23 = 8388608.0;
    const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;
    const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed];
    const u_InnerShadowColor = [isr / 255, isg / 255, isb / 255, iso];
    const u_InnerShadow = [
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      fillRGB ? 0 : 1,
    ];

    return [
      [
        ...u_PositionSize,
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_InnerShadowColor,
        ...u_InnerShadow,
      ],
      {
        u_PositionSize,
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
