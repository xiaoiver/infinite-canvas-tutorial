import * as d3 from 'd3-color';
import { Shape } from './Shape';
import {
  type Device,
  type RenderPass,
  Bindings,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  Format,
  InputLayout,
  Program,
  RenderPipeline,
  VertexStepMode,
} from '@antv/g-device-api';
import { vert, frag } from '../shaders/sdf';

export class Circle extends Shape {
  #program: Program;
  #fragUnitBuffer: Buffer;
  #instancedBuffer: Buffer;
  #indexBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;

  constructor(
    config: Partial<{
      cx: number;
      cy: number;
      r: number;
      fill: string;
    }> = {},
  ) {
    super();

    const { cx, cy, r, fill } = config;

    this.cx = cx ?? 0;
    this.cy = cy ?? 0;
    this.r = r ?? 0;
    this.fill = fill ?? 'black';
  }

  #cx: number;
  #cy: number;
  #r: number;
  #fill: string;
  #fillRGB: d3.RGBColor;

  get cx() {
    return this.#cx;
  }

  set cx(cx: number) {
    this.#cx = cx;
  }

  get cy() {
    return this.#cy;
  }

  set cy(cy: number) {
    this.#cy = cy;
  }

  get r() {
    return this.#r;
  }

  set r(r: number) {
    this.#r = r;
  }

  get fill() {
    return this.#fill;
  }

  set fill(fill: string) {
    this.#fill = fill;
    this.#fillRGB = d3.rgb(fill);
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

      this.#instancedBuffer = device.createBuffer({
        viewOrSize: new Float32Array([
          this.#cx,
          this.#cy,
          this.#r,
          this.#r,
          this.#fillRGB.r,
          this.#fillRGB.g,
          this.#fillRGB.b,
          this.#fillRGB.opacity,
        ]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#fragUnitBuffer = device.createBuffer({
        viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
      this.#indexBuffer = device.createBuffer({
        viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });

      this.#inputLayout = device.createInputLayout({
        vertexBufferDescriptors: [
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
        ],
        indexBufferFormat: Format.U32_R,
        program: this.#program,
      });

      this.#pipeline = device.createRenderPipeline({
        inputLayout: this.#inputLayout,
        program: this.#program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
      });

      this.#bindings = device.createBindings({
        pipeline: this.#pipeline,
        uniformBufferBindings: [
          {
            binding: 0,
            buffer: uniformBuffer,
          },
        ],
      });
    }

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(
      this.#inputLayout,
      [
        {
          buffer: this.#fragUnitBuffer,
        },
        {
          buffer: this.#instancedBuffer,
        },
      ],
      {
        buffer: this.#indexBuffer,
      },
    );
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(6, 1);
  }
}
