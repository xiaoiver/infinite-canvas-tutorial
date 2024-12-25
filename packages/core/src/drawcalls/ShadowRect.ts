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
  TransparentBlack,
  StencilOp,
} from '@antv/g-device-api';
import { Rect, RoughRect, Shape } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/shadow_rect';
import { paddingMat3 } from '../utils';

export class ShadowRect extends Drawcall {
  static check(shape: Shape) {
    return (
      (shape instanceof Rect || shape instanceof RoughRect) &&
      shape.dropShadowBlurRadius > 0
    );
  }

  #uniformBuffer: Buffer;

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
        new Array(16 * this.shapes.length).fill(0),
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
          arrayStride: 4 * 16,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.POSITION_SIZE, // a_PositionSize
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.ZINDEX_STROKE_WIDTH, // a_ZIndexStrokeWidth
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.DROP_SHADOW_COLOR, // a_DropShadowColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.DROP_SHADOW, // a_DropShadow
              offset: 4 * 12,
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

    this.program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
      },
    });

    if (!this.instanced && !this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: this.vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });

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
        depthWrite: false,
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

    if (this.instanced) {
      this.bindings = this.renderCache.createBindings({
        pipeline: this.pipeline,
        uniformBufferBindings: [
          {
            buffer: uniformBuffer,
          },
        ],
      });
    } else {
      this.bindings = this.device.createBindings({
        pipeline: this.pipeline,
        uniformBufferBindings: [
          {
            buffer: uniformBuffer,
          },
          {
            buffer: this.#uniformBuffer,
          },
        ],
      });
    }
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      if (this.instanced) {
        const instancedData: number[] = [];
        this.shapes.forEach((shape) => {
          const [buffer] = this.generateBuffer(shape as Rect);
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
        const [buffer, legacyObject] = this.generateBuffer(
          this.shapes[0] as Rect,
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
    }
  }

  private generateBuffer(shape: Rect): [number[], Record<string, unknown>] {
    const {
      x,
      y,
      width,
      height,
      strokeWidth,
      cornerRadius,
      dropShadowColorRGB: { r, g, b, opacity },
      dropShadowOffsetX,
      dropShadowOffsetY,
      dropShadowBlurRadius,
      sizeAttenuation,
    } = shape;

    const u_PositionSize = [x, y, width, height];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      strokeWidth,
      cornerRadius,
      sizeAttenuation ? 1 : 0,
    ];
    const u_DropShadowColor = [r / 255, g / 255, b / 255, opacity];
    const u_DropShadow = [
      dropShadowOffsetX,
      dropShadowOffsetY,
      dropShadowBlurRadius,
      0,
    ];

    return [
      [
        ...u_PositionSize,
        ...u_ZIndexStrokeWidth,
        ...u_DropShadowColor,
        ...u_DropShadow,
      ],
      {
        u_PositionSize,
        u_ZIndexStrokeWidth,
        u_DropShadowColor,
        u_DropShadow,
      },
    ];
  }
}
