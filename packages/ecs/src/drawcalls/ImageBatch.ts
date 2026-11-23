import {
  BufferUsage,
  BufferFrequencyHint,
  Format,
  VertexStepMode,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  StencilOp,
  TransparentBlack,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  type Buffer,
  type RenderPass,
  type Texture,
} from '@infinite-canvas-tutorial/device-api';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { InstanceBuffer } from '../utils/instance-buffer';
import { imageBatchVert, imageBatchFrag } from '../shaders/image-batch';
import {
  IMAGE_BATCH_SIZE,
  ImageBatchTextures,
  IMAGE_BATCH_TEXTURES,
  IMAGE_BATCH_STRIDE,
  eligibleImageRect,
  imageBatchRow,
  imagePageAccepts,
  imageRectTexture,
} from '../utils/image-batching';
import { type ImageTextureLease } from '../utils/image-texture-pool';
import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import {
  Rect,
  GlobalTransform,
  GlobalRenderOrder,
  Stroke,
  Opacity,
} from '../components';
import { getEnabledFillLayers, fillLayerOpacity } from '../utils/fillLayers';

/** Ordered image rectangles: six attributes, eight fixed sampler slots, no atlas copies. */
export class ImageBatch extends Drawcall {
  protected maxInstances = IMAGE_BATCH_SIZE;
  static override retainEmptyPage = false;
  #capacity = 0;
  #instances?: InstanceBuffer;
  #rows: number[][] = [];
  #textures: { token: string; acquire(): ImageTextureLease<Texture> }[] = [];
  #images = new ImageBatchTextures<Texture>();
  #tokens: string[] = [];

  constructor(...args: ConstructorParameters<typeof Drawcall>) {
    super(...args);
    this.instanced = true;
  }
  protected override get useFillImage() {
    return true;
  }
  static batchKey(shape: Entity): string | null {
    return eligibleImageRect(shape) ? 'images' : null;
  }
  static canAppend(shapes: readonly Entity[], shape: Entity, api: API) {
    return imagePageAccepts(
      shapes,
      shape,
      (s) => imageRectTexture(s, api).token,
    );
  }

  protected override prepareGeometry() {
    const changed =
      this.geometryDirty ||
      this.materialDirty ||
      this.dirtyInstances.size > 0 ||
      this.shapes.some((shape, i) => {
        const row = this.#rows[i],
          m = shape.read(GlobalTransform).matrix;
        const order = shape.has(GlobalRenderOrder)
          ? shape.read(GlobalRenderOrder).value
          : 0;
        return (
          !row ||
          row[0] !== m.m00 ||
          row[1] !== m.m01 ||
          row[2] !== m.m10 ||
          row[3] !== m.m11 ||
          row[4] !== m.m20 ||
          row[5] !== m.m21 ||
          row[12] !== order / ZINDEX_FACTOR
        );
      });
    if (!changed) return;
    const slots = new Map<string, number>();
    const textures: { token: string; acquire(): ImageTextureLease<Texture> }[] =
      [];
    this.#rows = this.shapes.map((shape) => {
      const described = imageRectTexture(shape, this.api);
      const texture = {
        token: described.token,
        acquire: () => described.acquire(this.device),
      };
      let slot = slots.get(texture.token);
      if (slot === undefined) {
        slot = textures.length;
        if (slot >= IMAGE_BATCH_TEXTURES)
          throw new Error('Image page exceeds sampler budget');
        slots.set(texture.token, slot);
        textures.push(texture);
      }
      const r = shape.read(Rect),
        m = shape.read(GlobalTransform).matrix;
      const stroke = shape.has(Stroke) ? shape.read(Stroke) : undefined;
      return imageBatchRow(
        [m.m00, m.m01, m.m10, m.m11, m.m20, m.m21],
        [r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2],
        shape.has(Opacity) ? shape.read(Opacity).opacity : 1,
        slot,
        (shape.has(GlobalRenderOrder)
          ? shape.read(GlobalRenderOrder).value
          : 0) / ZINDEX_FACTOR,
        stroke?.width ?? 0,
        fillLayerOpacity(getEnabledFillLayers(shape)[0].opacity),
        { center: 0, inner: 1, outer: 2 }[stroke?.alignment ?? 'center'],
      );
    });
    const tokens = textures.map((t) => t.token);
    if (
      tokens.length !== this.#tokens.length ||
      tokens.some((t, i) => t !== this.#tokens[i])
    )
      this.materialDirty = true;
    this.#tokens = tokens;
    this.#textures = textures;
  }

  createGeometry() {
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
    const capacity = Math.max(
      16,
      2 ** Math.ceil(Math.log2(this.shapes.length || 1)),
    );
    if (capacity > this.#capacity) {
      this.#instances?.dispose();
      this.vertexBuffers[1]?.destroy();
      this.#capacity = capacity;
      this.vertexBufferDatas[1] = new Float32Array(
        capacity * IMAGE_BATCH_STRIDE,
      );
      this.vertexBuffers[1] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[1],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#instances = new InstanceBuffer(
        this.vertexBufferDatas[1],
        this.vertexBuffers[1],
        IMAGE_BATCH_STRIDE,
      );
    }
    this.vertexBufferDescriptors = [
      {
        arrayStride: 8,
        stepMode: VertexStepMode.VERTEX,
        attributes: [{ shaderLocation: 1, format: Format.F32_RG, offset: 0 }],
      },
      {
        arrayStride: IMAGE_BATCH_STRIDE * 4,
        stepMode: VertexStepMode.INSTANCE,
        attributes: Array.from({ length: 5 }, (_, i) => ({
          shaderLocation: i + 2,
          format: Format.F32_RGBA,
          offset: i * 16,
        })),
      },
    ];
  }
  createMaterial(defines: string, uniformBuffer: Buffer) {
    // Private bindings must retire before their pooled textures can be released.
    this.bindings?.destroy();
    this.bindings = undefined;
    this.#images.sync(this.#textures, (leases) => {
      this.createProgram(
        imageBatchVert,
        imageBatchFrag,
        defines + '#define USE_IMAGE_BATCH\n',
      );
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
      const sampler = this.renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
      this.bindings = this.device.createBindings({
        pipeline: this.pipeline,
        uniformBufferBindings: [{ buffer: uniformBuffer }],
        samplerBindings: Array.from(
          { length: IMAGE_BATCH_TEXTURES },
          (_, i) => ({
            texture: (leases[i] ?? leases[0]).texture,
            sampler,
          }),
        ),
      });
    });
  }
  render(
    renderPass: RenderPass,
    _uniformBuffer: Buffer,
    uniforms: Record<string, unknown>,
  ) {
    if (this.destroyed) return;
    this.#rows.forEach((row, i) => this.#instances.write(i, row));
    this.#instances.flush(this.shapes.length);
    this.program.setUniformsLegacy(uniforms);
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexInput(
      this.inputLayout,
      this.vertexBuffers.map((buffer) => ({ buffer })),
      { buffer: this.indexBuffer },
    );
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(6, this.shapes.length);
    this.dirtyInstances.clear();
  }
  override destroy() {
    if (this.destroyed) return;
    this.bindings?.destroy();
    this.bindings = undefined;
    this.#images.dispose();
    this.#instances?.dispose();
    if (!this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
    }
    super.destroy();
    this.#instances = undefined;
    this.indexBuffer = undefined;
    this.vertexBufferDatas = [];
    this.vertexBufferDescriptors = [];
    this.#textures = [];
    this.#tokens = [];
    this.#rows = [];
    this.shapes = [];
  }
}
