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
  type Buffer,
  type RenderPass,
} from '@infinite-canvas-tutorial/device-api';
import { Mesh } from './Mesh';
import {
  ComputedTextMetrics,
  Text,
  GlobalTransform,
  GlobalRenderOrder,
} from '../components';
import type { Entity } from '@lastolivegames/becsy';
import { ZINDEX_FACTOR } from './Drawcall';
import {
  getEnabledFillLayers,
  getFirstSolidFillLayerValue,
  fillLayerOpacity,
} from '../utils/fillLayers';
import { parseColor } from '../utils/color';
import {
  TextProxyLocation,
  textProxyVert,
  textProxyFrag,
} from '../shaders/text-proxy';
import { Location } from '../shaders/mesh';
import { textProxyLines } from '../utils/text-lod';

/** Maximum native line instances per ordered page; oversized objects use Mesh. */
export const TEXT_PROXY_PAGE_SIZE = 4096;
const LINE_STRIDE = 16;

/** Private Mesh fallback and opt-in ordered line instancing share the same layout. */
export class TextProxy extends Mesh {
  protected maxInstances = TEXT_PROXY_PAGE_SIZE;
  #capacity = 0;
  #lineCount = 0;
  #rows = new WeakMap<Entity, { start: number; count: number }>();

  constructor(...args: ConstructorParameters<typeof Mesh>) {
    super(...args);
    // Mesh's independent renderer initializes this field to false.
    this.instanced = args[4];
  }

  static override instanceCount(shape: Entity): number {
    return shape.has(Text) && shape.has(ComputedTextMetrics)
      ? textProxyLines(shape.read(Text), shape.read(ComputedTextMetrics)).length
      : 0;
  }

  static override batchKey(shape: Entity): string | null {
    const count = this.instanceCount(shape);
    const fills = getEnabledFillLayers(shape);
    return count > 0 &&
      count <= TEXT_PROXY_PAGE_SIZE &&
      fills.length === 1 &&
      fills[0].type === 'solid' &&
      (!fills[0].blendMode || fills[0].blendMode === 'normal')
      ? 'solid-lines'
      : null;
  }

  get lineInstanceCount() {
    return this.instanced
      ? this.#lineCount
      : (this.indexBufferData?.length ?? 0) / 6;
  }

  private createInstanceGeometry() {
    if (!this.indexBuffer) {
      this.indexBufferData = new Uint32Array([0, 2, 1, 2, 0, 3]);
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: this.indexBufferData,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
      this.vertexBuffers[0] = this.device.createBuffer({
        viewOrSize: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }
    this.#rows = new WeakMap();
    this.#lineCount = 0;
    for (const shape of this.shapes) {
      const count = TextProxy.instanceCount(shape);
      this.#rows.set(shape, { start: this.#lineCount, count });
      this.#lineCount += count;
      this.dirtyInstances.add(shape);
    }
    const capacity = Math.max(
      16,
      2 ** Math.ceil(Math.log2(this.#lineCount || 1)),
    );
    if (capacity > this.#capacity) {
      this.vertexBuffers[1]?.destroy();
      this.#capacity = capacity;
      this.vertexBufferDatas[1] = new Float32Array(capacity * LINE_STRIDE);
      this.vertexBuffers[1] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[1],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }
    this.vertexBufferDescriptors = [
      {
        arrayStride: 8,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: TextProxyLocation.POSITION,
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
      {
        arrayStride: LINE_STRIDE * 4,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            shaderLocation: TextProxyLocation.RECT,
            offset: 0,
            format: Format.F32_RGBA,
          },
          {
            shaderLocation: TextProxyLocation.TRANSFORM,
            offset: 16,
            format: Format.F32_RGBA,
          },
          {
            shaderLocation: TextProxyLocation.STATE,
            offset: 32,
            format: Format.F32_RGBA,
          },
          {
            shaderLocation: TextProxyLocation.COLOR,
            offset: 48,
            format: Format.F32_RGBA,
          },
        ],
      },
    ];
  }

  override createMaterial(defines: string, uniformBuffer: Buffer) {
    if (!this.instanced) return super.createMaterial(defines, uniformBuffer);
    this.createProgram(textProxyVert, textProxyFrag, defines);
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
        ...this.stencilDescriptor,
      },
    });
    // Each page owns its bindings; no cached descriptor can retain retired buffers.
    this.bindings?.destroy();
    this.bindings = this.device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [{ buffer: uniformBuffer }],
    });
  }

  override render(
    pass: RenderPass,
    uniformBuffer: Buffer,
    scene: Record<string, unknown>,
  ) {
    if (!this.instanced) return super.render(pass, uniformBuffer, scene);
    const ranges: [number, number][] = [];
    for (const shape of this.dirtyInstances) {
      const row = this.#rows.get(shape);
      if (!row) continue;
      const lines = textProxyLines(
        shape.read(Text),
        shape.read(ComputedTextMetrics),
      );
      const { matrix: m } = shape.read(GlobalTransform);
      const fill = getEnabledFillLayers(shape)[0];
      const color = parseColor(
        getFirstSolidFillLayerValue(shape) ?? 'transparent',
      );
      const z = shape.has(GlobalRenderOrder)
        ? shape.read(GlobalRenderOrder).value / ZINDEX_FACTOR
        : 0;
      lines.forEach((line, i) =>
        this.vertexBufferDatas[1].set(
          [
            line.x,
            line.y,
            line.width,
            line.height,
            m.m00,
            m.m01,
            m.m10,
            m.m11,
            m.m20,
            m.m21,
            z,
            this.getOpacity(shape),
            color.r / 255,
            color.g / 255,
            color.b / 255,
            color.opacity * fillLayerOpacity(fill.opacity),
          ],
          (row.start + i) * LINE_STRIDE,
        ),
      );
      ranges.push([row.start, row.start + row.count]);
    }
    ranges.sort(([a], [b]) => a - b);
    const merged: [number, number][] = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && last[1] === range[0]) last[1] = range[1];
      else merged.push(range);
    }
    const data = this.vertexBufferDatas[1];
    for (const [start, end] of merged)
      this.vertexBuffers[1].setSubData(
        start * LINE_STRIDE * 4,
        new Uint8Array(
          data.buffer,
          start * LINE_STRIDE * 4,
          (end - start) * LINE_STRIDE * 4,
        ),
      );
    this.dirtyInstances.clear();
    this.program.setUniformsLegacy(scene);
    pass.setPipeline(this.pipeline);
    pass.setVertexInput(
      this.inputLayout,
      this.vertexBuffers.map((buffer) => ({ buffer })),
      { buffer: this.indexBuffer },
    );
    pass.setBindings(this.bindings);
    pass.drawIndexed(6, this.#lineCount);
  }

  override destroy() {
    if (this.destroyed) return;
    if (this.instanced) {
      this.bindings?.destroy();
      this.bindings = undefined;
    }
    // Geometry may have been allocated before program creation failed.
    if (!this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
    }
    super.destroy();
    this.#rows = new WeakMap();
  }

  // Eligible text has exactly one solid paint: no raster fill texture is needed.
  protected override get useFillImage() {
    return false;
  }

  override validate() {
    return false;
  }

  override createGeometry() {
    if (this.instanced) return this.createInstanceGeometry();
    const shape = this.shapes[0];
    const points: number[] = [];
    const indices: number[] = [];
    for (const { x, y, width, height } of textProxyLines(
      shape.read(Text),
      shape.read(ComputedTextMetrics),
    )) {
      const i = points.length / 2;
      points.push(x, y, x + width, y, x + width, y + height, x, y + height);
      indices.push(i, i + 2, i + 1, i + 2, i, i + 3);
    }
    this.points = points;
    this.indexBufferData = new Uint32Array(indices);
    this.vertexBufferDatas[0] = new Float32Array(points);
    this.vertexBuffers[0]?.destroy();
    this.indexBuffer?.destroy();
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.vertexBufferDescriptors = [
      {
        arrayStride: 8,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION,
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];
  }
}
