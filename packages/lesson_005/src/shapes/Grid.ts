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
import { vec2 } from 'gl-matrix';
import { Color } from './Color';
import { DataArray } from '../utils/converter';
import { vert, frag } from '../shaders/grid';
import { Camera } from '../Camera';

const linePoints = [vec2.create(), vec2.create()];

/**
 * Draw grid with line geometries.
 * @see https://github.com/evanw/theta
 */
export class Grid {
  #program: Program;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;
  #buffer: Buffer;

  #vertices = new DataArray();
  #previousColor = Color.TRANSPARENT;
  #previousU = 0;
  #previousV = 0;
  #previousX = 0;
  #previousY = 0;

  constructor(private pixelScale: number) {}

  render(
    device: Device,
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    camera: Camera,
  ) {
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
            arrayStride: 4 * 5,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              {
                format: Format.F32_RGBA,
                offset: 0,
                shaderLocation: 0,
              },
              {
                format: Format.U8_RGBA_NORM,
                offset: 4 * 4,
                shaderLocation: 1,
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
        topology: PrimitiveTopology.TRIANGLE_STRIP,
      });
    }

    const { height, width, zoom } = camera;

    const [ox, oy] = vec2.transformMat3(
      vec2.create(),
      [0, 0],
      camera.viewMatrix,
    );

    const step = Math.pow(10, Math.round(Math.log(zoom / 32) / Math.log(10)));
    const ratio = step / zoom;
    const left = Math.ceil(-ox * ratio);
    const top = Math.ceil((height - oy) * -ratio);
    const right = Math.ceil((width - ox) * ratio);
    const bottom = Math.ceil(-oy * -ratio);
    const isDark = false;

    // Horizontal axis
    for (let x = left; x < right; x++) {
      const tx = ox + (x * zoom) / step;
      this.strokeLine(
        tx,
        0,
        tx,
        height,
        x == 0
          ? isDark
            ? Color.WHITE
            : Color.BLACK
          : x % 10 == 0
          ? isDark
            ? 255 | (255 << 8) | (255 << 16) | (127 << 24)
            : 0 | (0 << 8) | (0 << 16) | (127 << 24)
          : isDark
          ? 255 | (255 << 8) | (255 << 16) | (31 << 24)
          : 0 | (0 << 8) | (0 << 16) | (31 << 24),
        x == 0 ? 2 : 1,
      );
    }

    for (let y = top; y < bottom; y++) {
      const ty = oy - (y * zoom) / step;
      this.strokeLine(
        0,
        ty,
        width,
        ty,
        y == 0
          ? isDark
            ? Color.WHITE
            : Color.BLACK
          : y % 10 == 0
          ? isDark
            ? 255 | (255 << 8) | (255 << 16) | (127 << 24)
            : 0 | (0 << 8) | (0 << 16) | (127 << 24)
          : isDark
          ? 255 | (255 << 8) | (255 << 16) | (31 << 24)
          : 0 | (0 << 8) | (0 << 16) | (31 << 24),
        y == 0 ? 2 : 1,
      );
    }

    const data = this.#vertices.bytes();

    if (this.#buffer) {
      this.#buffer.destroy();
    }
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

    renderPass.setBindings(this.#bindings);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(
      this.#inputLayout,
      [
        {
          buffer,
        },
      ],
      null,
    );
    renderPass.draw(data.length / 20);
  }

  reset() {
    this.#vertices.clear();
  }

  destroy(): void {
    this.#program.destroy();
    this.#buffer.destroy();
    this.#pipeline.destroy();
    this.#inputLayout.destroy();
    this.#bindings.destroy();
  }

  private appendVertex(
    x: number,
    y: number,
    u: number,
    v: number,
    color: number,
  ) {
    this.#previousX = x;
    this.#previousY = y;
    this.#previousU = u;
    this.#previousV = v;
    this.#previousColor = color;

    this.#vertices
      .appendFloat(x)
      .appendFloat(y)
      .appendFloat(u)
      .appendFloat(v)
      .appendByte(color & 255)
      .appendByte((color >> 8) & 255)
      .appendByte((color >> 16) & 255)
      .appendByte(color >>> 24);
  }

  private appendPreviousVertex() {
    this.appendVertex(
      this.#previousX,
      this.#previousY,
      this.#previousU,
      this.#previousV,
      this.#previousColor,
    );
  }

  private strokeLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number,
    thickness: number,
  ) {
    linePoints[0][0] = startX;
    linePoints[0][1] = startY;
    linePoints[1][0] = endX;
    linePoints[1][1] = endY;
    this.strokeNonOverlappingPolyline(linePoints, color, thickness);
  }

  private strokeNonOverlappingPolyline(
    points: vec2[],
    color: number,
    thickness: number,
  ) {
    // Need to draw the line wider by one pixel for anti-aliasing
    const aa = (thickness + this.pixelScale) / this.pixelScale;
    const halfWidth = (thickness + this.pixelScale) / 2;
    const n = points.length;

    if (n < 2) {
      return;
    }

    // Emit the start cap
    const v0 = points[0];
    const v1 = points[1];
    const dx = v1[0] - v0[0];
    const dy = v1[1] - v0[1];
    const d = vec2.len([dx, dy]);
    const v = halfWidth / d;
    const vx = -dy * v;
    const vy = dx * v;

    this.appendVertex(v0[0] - vx, v0[1] - vy, 0, aa, color);
    this.appendPreviousVertex();
    this.appendVertex(v0[0] + vx, v0[1] + vy, aa, 0, color);

    // Emit the end cap
    const v02 = points[(n - 2) | 0];
    const v12 = points[(n - 1) | 0];
    const dx2 = v12[0] - v02[0];
    const dy2 = v12[1] - v02[1];
    const d1 = vec2.len([dx2, dy2]);
    const v3 = halfWidth / d1,
      vx1 = -dy2 * v3,
      vy1 = dx2 * v3;

    this.appendVertex(v12[0] - vx1, v12[1] - vy1, 0, aa, color);
    this.appendVertex(v12[0] + vx1, v12[1] + vy1, aa, 0, color);

    this.appendPreviousVertex();
  }
}
