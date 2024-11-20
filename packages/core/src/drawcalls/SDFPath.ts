import {
  type RenderPass,
  Bindings,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  InputLayout,
  RenderPipeline,
  VertexStepMode,
  Program,
  CompareFunction,
  TextureUsage,
  BindingsDescriptor,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TransparentBlack,
  Texture,
  StencilOp,
  // makeTextureDescriptor2D,
} from '@antv/g-device-api';
import { Path } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag } from '../shaders/sdf_path';
import {
  // isBrowser,
  // isImageBitmapOrCanvases,
  isString,
  paddingMat3,
} from '../utils';
import pathSDF from 'svg-path-sdf';

const sdfDimension = 200;

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class SDFPath extends Drawcall {
  #program: Program;
  #fragUnitBuffer: Buffer;
  #instancedBuffer: Buffer;
  #instancedMatrixBuffer: Buffer;
  #indexBuffer: Buffer;
  #uniformBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;
  #texture: Texture;

  static useDash(shape: Path) {
    const { strokeDasharray } = shape;
    return (
      strokeDasharray.length > 0 && strokeDasharray.some((dash) => dash > 0)
    );
  }

  validate(shape: Path) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    if ((this.shapes[0] as Path).d !== (shape as Path).d) {
      return false;
    }

    const isInstanceFillImage = !isString(this.shapes[0].fill);
    const isShapeFillImage = !isString(shape.fill);

    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].fill === shape.fill;
    }

    // if (SDFPath.useDash(shape) !== SDFPath.useDash(this.shapes[0])) {
    //   return false;
    // }

    return true;
  }

  createGeometry(): void {
    if (!this.#fragUnitBuffer) {
      this.#fragUnitBuffer = this.device.createBuffer({
        viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      this.#indexBuffer = this.device.createBuffer({
        viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }

    if (this.instanced) {
      if (this.#instancedBuffer) {
        this.#instancedBuffer.destroy();
      }

      this.#instancedBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 28 * this.shapes.length,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      if (this.#instancedMatrixBuffer) {
        this.#instancedMatrixBuffer.destroy();
      }
      this.#instancedMatrixBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 6 * this.shapes.length,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }
  }

  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }
    defines += '#define USE_FILLIMAGE\n';

    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.#program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    const vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: 0, // a_FragCoord
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];

    if (this.instanced) {
      vertexBufferDescriptors.push(
        {
          arrayStride: 4 * 28,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: 1, // a_PositionSize
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 2, // a_FillColor
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 3, // a_StrokeColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 4, // a_ZIndexStrokeWidth
              offset: 4 * 12,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 5, // a_Opacity
              offset: 4 * 16,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 6, // a_InnerShadowColor
              offset: 4 * 20,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 7, // a_InnerShadow
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
              shaderLocation: 14,
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 15,
              offset: 4 * 4,
              format: Format.F32_RG,
            },
          ],
        },
      );
      this.#inputLayout = this.renderCache.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.#program,
      });
    } else {
      this.#inputLayout = this.renderCache.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.#program,
      });
      if (!this.#uniformBuffer) {
        this.#uniformBuffer = this.device.createBuffer({
          viewOrSize:
            Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4 + 4 + 4),
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        });
      }
    }

    this.#pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.#inputLayout,
      program: this.#program,
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
    this.device.setResourceName(this.#pipeline, 'SDFPipeline');

    const bindings: BindingsDescriptor = {
      pipeline: this.#pipeline,
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
    const { d } = this.shapes[0] as Path;
    const sdf = pathSDF(d, { width: sdfDimension, height: sdfDimension });

    console.log(sdf);

    // Convert single-channel float to RGBA uint8
    const data = new Uint8ClampedArray(sdf.length * 4);
    for (let i = 0; i < sdf.length; i++) {
      data[4 * i + 0] = sdf[i] * 255;
      data[4 * i + 1] = sdf[i] * 255;
      data[4 * i + 2] = sdf[i] * 255;
      data[4 * i + 3] = 255;
    }

    const texture = this.device.createTexture({
      // ...makeTextureDescriptor2D(Format.ALPHA, sdfDimension, sdfDimension, 1),
      // pixelStore: {
      //   unpackFlipY: false,
      //   unpackAlignment: 1,
      // },
      format: Format.U8_RGBA_NORM,
      width: sdfDimension,
      height: sdfDimension,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([data]);
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

    this.#bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      if (this.instanced) {
        this.#instancedMatrixBuffer.setSubData(
          0,
          new Uint8Array(
            new Float32Array(
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
            ).buffer,
          ),
        );

        const instancedData: number[] = [];
        this.shapes.forEach((shape) => {
          const [buffer] = this.generateBuffer(shape as Path);
          instancedData.push(...buffer);
        });
        this.#instancedBuffer.setSubData(
          0,
          new Uint8Array(new Float32Array(instancedData).buffer),
        );
      } else {
        const { worldTransform } = this.shapes[0];
        const [buffer, legacyObject] = this.generateBuffer(
          this.shapes[0] as Path,
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
        uniformLegacyObject.u_FillImage = this.#texture;
        this.#program.setUniformsLegacy(uniformLegacyObject);
      }
    }

    const buffers = [
      {
        buffer: this.#fragUnitBuffer,
      },
    ];
    if (this.instanced) {
      buffers.push(
        {
          buffer: this.#instancedBuffer,
        },
        { buffer: this.#instancedMatrixBuffer },
      );
    }

    this.#program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(this.#inputLayout, buffers, {
      buffer: this.#indexBuffer,
    });
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(6, this.shapes.length);
  }

  destroy(): void {
    super.destroy();
    if (this.#program) {
      this.#instancedMatrixBuffer?.destroy();
      this.#instancedBuffer?.destroy();
      this.#fragUnitBuffer?.destroy();
      this.#indexBuffer?.destroy();
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }
  }

  private generateBuffer(shape: Path): [number[], Record<string, unknown>] {
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
    } = shape;

    let size: [number, number, number, number] = [0, 0, 0, 0];
    const type: number = 0;
    const cornerRadius = 0;

    size = [0, 0, 100, 100];

    const { r: fr, g: fg, b: fb, opacity: fo } = fillRGB || {};

    const u_PositionSize = size;
    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      SDFPath.useDash(shape) ? 0 : strokeWidth,
      cornerRadius,
      strokeAlignmentMap[strokeAlignment],
    ];
    const u_Opacity = [opacity, fillOpacity, strokeOpacity, type];
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
