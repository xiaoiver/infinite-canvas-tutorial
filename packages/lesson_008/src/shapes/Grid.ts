import {
  VertexStepMode,
  type Device,
  type InputLayout,
  type Program,
  type RenderPipeline,
  Format,
  RenderPass,
  Buffer,
  Bindings,
  PrimitiveTopology,
  BufferUsage,
  BufferFrequencyHint,
} from '@antv/g-device-api';
import { vert, frag } from '../shaders/grid';
import { DataArray } from '../utils';

export class Grid {
  #program: Program;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;
  #buffer: Buffer;

  #vertices = new DataArray();

  appendVertex(x: number, y: number) {
    this.#vertices.appendFloat(x).appendFloat(y);
  }

  render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer) {
    if (!this.#program) {
      this.#program = device.createProgram({
        vertex: {
          glsl: vert,
        },
        fragment: {
          glsl: frag,
        },
      });

      this.#inputLayout = device.createInputLayout({
        vertexBufferDescriptors: [
          {
            arrayStride: 4 * 2,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              {
                format: Format.F32_RG,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
        indexBufferFormat: null,
        program: this.#program,
      });

      this.#pipeline = device.createRenderPipeline({
        inputLayout: this.#inputLayout,
        program: this.#program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        topology: PrimitiveTopology.TRIANGLE_STRIP,
      });

      this.#vertices.clear();

      this.appendVertex(-1, -1);
      this.appendVertex(-1, 1);
      this.appendVertex(1, -1);
      this.appendVertex(1, 1);

      const data = this.#vertices.bytes();
      const buffer = device.createBuffer({
        viewOrSize: data.byteLength,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#buffer = buffer;
      buffer.setSubData(0, data);

      this.#bindings = device.createBindings({
        pipeline: this.#pipeline,
        uniformBufferBindings: [
          {
            buffer: uniformBuffer,
          },
        ],
      });
    }

    renderPass.setBindings(this.#bindings);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(
      this.#inputLayout,
      [
        {
          buffer: this.#buffer,
        },
      ],
      null,
    );
    renderPass.draw(4);
  }

  destroy(): void {
    this.#program.destroy();
    this.#buffer.destroy();
    this.#pipeline.destroy();
    this.#inputLayout.destroy();
    this.#bindings.destroy();
  }
}
