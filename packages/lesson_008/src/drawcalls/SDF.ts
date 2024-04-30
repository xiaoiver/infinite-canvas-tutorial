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
} from '@antv/g-device-api';
import { Circle } from '../shapes';
import { Drawcall } from './Drawcall';
import { vert, frag } from '../shaders/sdf';
import { paddingMat3 } from '../utils';

export class SDF extends Drawcall {
  #fragUnitBuffer: Buffer;
  #instancedBuffer: Buffer;
  #instancedMatrixBuffer: Buffer;
  #indexBuffer: Buffer;
  #uniformBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;

  init() {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }

    this.program = this.device.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
      },
    });
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

    const vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
      {
        arrayStride: 4 * 8,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            shaderLocation: 1,
            offset: 0,
            format: Format.F32_RG,
          },
          {
            shaderLocation: 2,
            offset: 4 * 2,
            format: Format.F32_RG,
          },
          {
            shaderLocation: 3,
            offset: 4 * 4,
            format: Format.F32_RGBA,
          },
        ],
      },
    ];

    this.#instancedBuffer = this.device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * 8 * this.shapes.length,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.instanced) {
      vertexBufferDescriptors.push({
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
      });
      this.#instancedMatrixBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 6 * this.shapes.length,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#inputLayout = this.device.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.program,
      });
    } else {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 16, // mat4
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#inputLayout = this.device.createInputLayout({
        vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.program,
      });
    }

    this.#pipeline = this.device.createRenderPipeline({
      inputLayout: this.#inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
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
      },
    });
  }

  render(renderPass: RenderPass, uniformBuffer: Buffer) {
    if (this.instanced) {
      this.#bindings = this.device.createBindings({
        pipeline: this.#pipeline,
        uniformBufferBindings: [
          {
            buffer: uniformBuffer,
          },
        ],
      });
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
      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array(
            paddingMat3(this.instance.worldTransform.toArray(true)),
          ).buffer,
        ),
      );
    }

    if (this.shapes.some((shape) => shape['renderDirtyFlag'])) {
      const instancedData: number[] = [];
      this.shapes.forEach((shape) => {
        if (shape instanceof Circle) {
          const {
            cx,
            cy,
            r: radius,
            fillRGB: { r, g, b, opacity },
          } = shape;
          instancedData.push(
            cx,
            cy,
            radius,
            radius,
            r / 255,
            g / 255,
            b / 255,
            opacity,
          );
        }
      });
      this.#instancedBuffer.setSubData(
        0,
        new Uint8Array(new Float32Array(instancedData).buffer),
      );
    }

    const buffers = [
      {
        buffer: this.#fragUnitBuffer,
      },
      {
        buffer: this.#instancedBuffer,
      },
    ];
    if (this.instanced) {
      buffers.push({ buffer: this.#instancedMatrixBuffer });
    }

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(this.#inputLayout, buffers, {
      buffer: this.#indexBuffer,
    });
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(6, this.shapes.length);

    this.shapes.forEach((shape) => {
      shape['renderDirtyFlag'] = false;
    });
  }

  destroy(): void {
    if (this.program) {
      this.program.destroy();
      this.#instancedMatrixBuffer?.destroy();
      this.#instancedBuffer.destroy();
      this.#fragUnitBuffer.destroy();
      this.#indexBuffer.destroy();
      this.#uniformBuffer.destroy();
      this.#pipeline.destroy();
      this.#inputLayout.destroy();
      this.#bindings.destroy();
    }
  }
}
