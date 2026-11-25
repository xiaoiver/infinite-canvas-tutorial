import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  VertexStepMode,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  TransparentBlack,
  StencilOp,
  type Buffer,
  type RenderPass,
} from '@antv/g-device-api';
import { Mesh } from './Mesh';
import { ZINDEX_FACTOR } from './Drawcall';
import { Path, type Shape } from '../shapes';
import { PathGeometryCache, pathScreenMetrics } from '../utils/path-rendering';
import type { PathPoints } from '../utils/curve/adaptive';
import {
  PathInstanceLocation as Location,
  pathInstanceVert,
  pathInstanceFrag,
} from '../shaders/path-instances';

const STRIDE = 12;
export const PATH_INSTANCE_PAGE_SIZE = 4096;

/** One ordered page of ordinary solid Path fills. Never used by raster capture. */
export class PathInstances extends Mesh {
  protected maxInstances = PATH_INSTANCE_PAGE_SIZE;
  #capacity = 0;
  #geometry = new PathGeometryCache();
  #points: PathPoints | undefined;
  #uploadedPoints: PathPoints | undefined;
  #pendingRows = new Set<number>();

  constructor(...args: ConstructorParameters<typeof Mesh>) {
    super(...args);
    this.instanced = true;
  }

  static batchKey(shape: Shape): string | null {
    if (
      Object.getPrototypeOf(shape) !== Path.prototype ||
      !shape.batchable ||
      typeof shape.fill !== 'string' ||
      shape.fill === 'none' ||
      (shape.stroke !== 'none' && shape.strokeWidth > 0) ||
      shape.wireframe ||
      shape.sizeAttenuation ||
      shape.useFillImage ||
      shape.innerShadowBlurRadius > 0 ||
      shape.dropShadowBlurRadius > 0
    )
      return null;
    const path = shape as Path;
    const m = shape.worldTransform;
    const color = shape.fillRGB;
    if (
      !path.d ||
      !path.points.some((p) => p.length >= 3) ||
      !color ||
      ![
        m.a,
        m.b,
        m.c,
        m.d,
        m.tx,
        m.ty,
        color.r,
        color.g,
        color.b,
        color.opacity,
        shape.opacity,
        shape.fillOpacity,
      ].every(Number.isFinite) ||
      Math.abs(m.a * m.d - m.b * m.c) <= 1e-12
    )
      return null;
    return JSON.stringify([
      path.d,
      path.fillRule,
      path.tessellationMethod,
      m.a,
      m.b,
      m.c,
      m.d,
    ]);
  }

  override validate(shape: Shape) {
    return (
      this.shapes.length < PATH_INSTANCE_PAGE_SIZE &&
      PathInstances.batchKey(this.shapes[0]) === PathInstances.batchKey(shape)
    );
  }

  protected override prepareGeometry(scene: Record<string, unknown>) {
    const shape = this.shapes[0] as Path;
    const { scale } = pathScreenMetrics(scene, shape.worldTransform);
    const points = this.#geometry.get(shape.d, scale);
    this.pathPoints.set(shape, points);
    if (points !== this.#points) {
      this.#points = points;
      this.geometryDirty = true;
    }
  }

  override createGeometry() {
    if (!this.indexBuffer || this.#uploadedPoints !== this.#points) {
      super.createGeometry();
      if (!this.vertexBufferDescriptors) return;
      this.vertexBufferDescriptors[0].attributes[0].shaderLocation =
        Location.POSITION;
      this.#uploadedPoints = this.#points;
    }
    const capacity = Math.max(
      16,
      2 ** Math.ceil(Math.log2(this.shapes.length || 1)),
    );
    if (capacity > this.#capacity) {
      const data = new Float32Array(capacity * STRIDE);
      data.fill(NaN);
      const buffer = this.device.createBuffer({
        viewOrSize: data,
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.vertexBuffers[1]?.destroy();
      this.#capacity = capacity;
      this.vertexBufferDatas[1] = data;
      this.vertexBuffers[1] = buffer;
      this.#pendingRows.clear();
    }
    for (const row of this.#pendingRows)
      if (row >= this.shapes.length) this.#pendingRows.delete(row);
    this.vertexBufferDescriptors[1] = {
      arrayStride: STRIDE * 4,
      stepMode: VertexStepMode.INSTANCE,
      attributes: [
        {
          shaderLocation: Location.TRANSFORM,
          offset: 0,
          format: Format.F32_RGBA,
        },
        { shaderLocation: Location.STATE, offset: 16, format: Format.F32_RGBA },
        { shaderLocation: Location.COLOR, offset: 32, format: Format.F32_RGBA },
      ],
    };
  }

  override createMaterial(defines: string, uniformBuffer: Buffer) {
    this.createProgram(pathInstanceVert, pathInstanceFrag, defines);
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
    this.bindings?.destroy();
    this.bindings = this.device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [{ buffer: uniformBuffer }],
    });
  }

  override render(pass: RenderPass, scene: Record<string, unknown>) {
    const data = this.vertexBufferDatas[1];
    this.shapes.forEach((shape, row) => {
      const m = shape.worldTransform,
        c = shape.fillRGB;
      const values = [
        m.a,
        m.b,
        m.c,
        m.d,
        m.tx,
        m.ty,
        shape.globalRenderOrder / ZINDEX_FACTOR,
        shape.opacity,
        c.r / 255,
        c.g / 255,
        c.b / 255,
        c.opacity * shape.fillOpacity,
      ];
      for (let i = 0; i < STRIDE; i++) {
        const value = Math.fround(values[i]);
        if (!Object.is(data[row * STRIDE + i], value)) {
          data[row * STRIDE + i] = value;
          this.#pendingRows.add(row);
        }
      }
    });
    const rows = [...this.#pendingRows].sort((a, b) => a - b);
    for (let i = 0; i < rows.length; ) {
      const start = rows[i++];
      let end = start + 1;
      while (i < rows.length && rows[i] === end) {
        end++;
        i++;
      }
      this.vertexBuffers[1].setSubData(
        start * STRIDE * 4,
        new Uint8Array(
          data.buffer,
          start * STRIDE * 4,
          (end - start) * STRIDE * 4,
        ),
      );
      for (let row = start; row < end; row++) this.#pendingRows.delete(row);
    }
    this.program.setUniformsLegacy(scene);
    pass.setPipeline(this.pipeline);
    pass.setVertexInput(
      this.inputLayout,
      this.vertexBuffers.map((buffer) => ({ buffer })),
      { buffer: this.indexBuffer },
    );
    pass.setBindings(this.bindings);
    if (this.indexBufferData.length)
      pass.drawIndexed(this.indexBufferData.length, this.shapes.length);
  }

  protected override get useFillImage() {
    return false;
  }

  override destroy() {
    if (this.destroyed) return;
    this.bindings?.destroy();
    this.bindings = undefined;
    super.destroy();
    this.#points = this.#uploadedPoints = undefined;
    this.#pendingRows.clear();
    this.shapes = [];
  }
}
