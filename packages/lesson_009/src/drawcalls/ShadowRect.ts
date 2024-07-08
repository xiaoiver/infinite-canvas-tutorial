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
} from '@antv/g-device-api';
import { Rect } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag } from '../shaders/shadow_rect';
import { paddingMat3 } from '../utils';

export class ShadowRect extends Drawcall {
  #program: Program;
  #fragUnitBuffer: Buffer;
  #instancedBuffer: Buffer;
  #instancedMatrixBuffer: Buffer;
  #indexBuffer: Buffer;
  #uniformBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;

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
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 16 * this.shapes.length,
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

    if (this.#program) {
      this.#program.destroy();
      this.#inputLayout.destroy();
      this.#pipeline.destroy();
    }
    this.#program = this.device.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
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
          arrayStride: 4 * 16,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: 1, // a_PositionSize
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 4, // a_ZIndexStrokeWidth
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 5, // a_DropShadowColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: 6, // a_DropShadow
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
      this.#inputLayout = this.device.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.#program,
      });
    } else {
      this.#inputLayout = this.device.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.#program,
      });
      if (!this.#uniformBuffer) {
        this.#uniformBuffer = this.device.createBuffer({
          viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4),
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        });
      }
    }

    this.#pipeline = this.device.createRenderPipeline({
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
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
      },
    });

    if (this.instanced) {
      this.#bindings = this.device.createBindings({
        pipeline: this.#pipeline,
        uniformBufferBindings: [
          {
            buffer: uniformBuffer,
          },
        ],
      });
    } else {
      this.#bindings = this.device.createBindings({
        pipeline: this.#pipeline,
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

  render(renderPass: RenderPass) {
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
        this.shapes.forEach((shape: Rect) => {
          instancedData.push(...this.generateBuffer(shape));
        });
        this.#instancedBuffer.setSubData(
          0,
          new Uint8Array(new Float32Array(instancedData).buffer),
        );
      } else {
        const { worldTransform } = this.shapes[0];
        this.#uniformBuffer.setSubData(
          0,
          new Uint8Array(
            new Float32Array([
              ...paddingMat3(worldTransform.toArray(true)),
              ...this.generateBuffer(this.shapes[0] as Rect),
            ]).buffer,
          ),
        );
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

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(this.#inputLayout, buffers, {
      buffer: this.#indexBuffer,
    });
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(6, this.shapes.length);
  }

  destroy(): void {
    if (this.#program) {
      this.#program.destroy();
      this.#instancedMatrixBuffer?.destroy();
      this.#instancedBuffer?.destroy();
      this.#fragUnitBuffer?.destroy();
      this.#indexBuffer?.destroy();
      this.#uniformBuffer?.destroy();
      this.#pipeline?.destroy();
      this.#inputLayout?.destroy();
      this.#bindings?.destroy();
    }
  }

  private generateBuffer(shape: Rect) {
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
    } = shape;

    return [
      x,
      y,
      width,
      height,
      shape.globalRenderOrder / ZINDEX_FACTOR,
      strokeWidth,
      cornerRadius,
      0,
      r / 255,
      g / 255,
      b / 255,
      opacity,
      dropShadowOffsetX,
      dropShadowOffsetY,
      dropShadowBlurRadius,
      0,
    ];
  }
}
