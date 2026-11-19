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
import type { Entity } from '@lastolivegames/becsy';
import { Mesh } from './Mesh';
import { ZINDEX_FACTOR } from './Drawcall';
import {
  Path,
  Stroke,
  Rough,
  UI,
  FillTexture,
  Wireframe,
  SizeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
  GlobalTransform,
  GlobalRenderOrder,
} from '../components';
import {
  getEnabledFillLayers,
  fillLayerOpacity,
  getFirstSolidFillLayerValue,
} from '../utils/fillLayers';
import { PathGeometryCache, pathScreenMetrics } from '../utils/path-rendering';
import type { PathPoints } from '../utils/curve/adaptive';
import {
  PathInstanceLocation as Location,
  pathInstanceVert,
  pathInstanceFrag,
} from '../shaders/path-instances';

const STRIDE = 12;
export const PATH_INSTANCE_PAGE_SIZE = 4096;

/** Opt-in, screen-only repeated fill meshes. Full/export geometry stays in Mesh. */
export class PathInstances extends Mesh {
  static override retainEmptyPage = false;
  protected maxInstances = PATH_INSTANCE_PAGE_SIZE;
  #capacity = 0;
  #rows = new WeakMap<Entity, number>();
  #geometry = new PathGeometryCache();
  #points: PathPoints | undefined;
  #uploadedPoints: PathPoints | undefined;
  #members: Entity[] = [];
  #pendingRows = new Set<number>();

  constructor(...args: ConstructorParameters<typeof Mesh>) {
    super(...args);
    this.instanced = args[4];
  }

  static override batchKey(shape: Entity): string | null {
    if (
      !shape.has(Path) ||
      !shape.has(GlobalTransform) ||
      shape.hasSomeOf(
        Rough,
        UI,
        FillTexture,
        Wireframe,
        SizeAttenuation,
        Filter,
        DropShadow,
        InnerShadow,
        ClipMode,
        NodeLayerBlendMode,
        Extrude3D,
      ) ||
      (shape.has(Stroke) && shape.read(Stroke).width > 0)
    )
      return null;
    const fills = getEnabledFillLayers(shape);
    if (
      fills.length !== 1 ||
      fills[0].type !== 'solid' ||
      typeof fills[0].value !== 'string' ||
      (fills[0].blendMode && fills[0].blendMode !== 'normal')
    )
      return null;
    const { matrix: m } = shape.read(GlobalTransform);
    if (
      ![m.m00, m.m01, m.m10, m.m11, m.m20, m.m21].every(Number.isFinite) ||
      m.m02 !== 0 ||
      m.m12 !== 0 ||
      m.m22 !== 1 ||
      Math.abs(m.m00 * m.m11 - m.m01 * m.m10) <= 1e-12
    )
      return null;
    const p = shape.read(Path);
    // Equal linear transforms give equal projected precision even under parent
    // shear/reflection. Only translation and paint vary within an ordered page.
    return JSON.stringify([
      p.d,
      p.fillRule,
      p.tessellationMethod,
      m.m00,
      m.m01,
      m.m10,
      m.m11,
    ]);
  }

  protected override prepareGeometry(scene: Record<string, unknown>) {
    if (!this.instanced) return super.prepareGeometry(scene);
    const shape = this.shapes[0];
    const { matrix: m } = shape.read(GlobalTransform);
    const { scale } = pathScreenMetrics(scene, {
      a: m.m00,
      b: m.m01,
      c: m.m10,
      d: m.m11,
    });
    const points = this.#geometry.get(shape.read(Path).d, scale);
    this.pathPoints.set(shape, points);
    if (points !== this.#points) {
      this.#points = points;
      this.geometryDirty = true;
    }
  }

  override createGeometry() {
    if (!this.instanced) return super.createGeometry();
    if (!this.indexBuffer || this.#uploadedPoints !== this.#points) {
      super.createGeometry();
      this.vertexBufferDescriptors[0].attributes[0].shaderLocation =
        Location.POSITION;
      this.#uploadedPoints = this.#points;
    }
    if (
      this.#members.length !== this.shapes.length ||
      this.shapes.some((shape, i) => shape !== this.#members[i])
    ) {
      this.#members = [...this.shapes];
      this.#rows = new WeakMap();
      this.shapes.forEach((shape, i) => {
        this.#rows.set(shape, i);
        this.dirtyInstances.add(shape);
      });
      for (const row of this.#pendingRows)
        if (row >= this.shapes.length) this.#pendingRows.delete(row);
    }
    const capacity = Math.max(
      16,
      2 ** Math.ceil(Math.log2(this.shapes.length || 1)),
    );
    if (capacity > this.#capacity) {
      const data = new Float32Array(capacity * STRIDE);
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
      for (const shape of this.shapes) this.dirtyInstances.add(shape);
    }
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
    if (!this.instanced) return super.createMaterial(defines, uniformBuffer);
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
        ...this.stencilDescriptor,
      },
    });
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
    const data = this.vertexBufferDatas[1];
    for (const shape of this.dirtyInstances) {
      const row = this.#rows.get(shape);
      if (row === undefined) continue;
      const { matrix: m } = shape.read(GlobalTransform);
      const fill = getEnabledFillLayers(shape)[0];
      const c = this.getUniformColor(
        getFirstSolidFillLayerValue(shape) ?? 'transparent',
      );
      const z = shape.has(GlobalRenderOrder)
        ? shape.read(GlobalRenderOrder).value / ZINDEX_FACTOR
        : 0;
      const values = [
        m.m00,
        m.m01,
        m.m10,
        m.m11,
        m.m20,
        m.m21,
        z,
        this.getOpacity(shape),
        c.r / 255,
        c.g / 255,
        c.b / 255,
        c.opacity * fillLayerOpacity(fill.opacity),
      ];
      for (let i = 0; i < STRIDE; i++) {
        const value = Math.fround(values[i]);
        if (!Object.is(data[row * STRIDE + i], value)) {
          data[row * STRIDE + i] = value;
          this.#pendingRows.add(row);
        }
      }
    }
    const rows = [...this.#pendingRows];
    rows.sort((a, b) => a - b);
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
      // A failed upload leaves rows pending, including an identical retry.
      for (let row = start; row < end; row++) this.#pendingRows.delete(row);
    }
    this.dirtyInstances.clear();
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
    if (this.instanced) {
      this.bindings?.destroy();
      this.bindings = undefined;
    }
    if (!this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((b) => b.destroy());
      this.vertexBuffers = [];
    }
    super.destroy();
    this.#rows = new WeakMap();
    this.#points = undefined;
    this.#uploadedPoints = undefined;
    this.#members = [];
    this.#pendingRows.clear();
  }
}
