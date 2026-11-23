import {
  BufferUsage,
  BufferFrequencyHint,
  Format,
  VertexStepMode,
  TextureUsage,
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
} from '@antv/g-device-api';
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
  coreImageToken,
} from '../utils/image-batching';
import {
  imageTextures,
  type ImageTextureLease,
} from '../utils/image-texture-pool';
import { Rect, type Shape } from '../shapes';

/** Ordered image rectangles: six attributes, eight fixed sampler slots, no atlas copies. */
export class ImageBatch extends Drawcall {
  protected maxInstances = IMAGE_BATCH_SIZE;

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
  static batchKey(shape: Shape): string | null {
    return eligibleImageRect(shape) ? 'images' : null;
  }
  override validate(shape: Shape) {
    return (
      ImageBatch.batchKey(shape) !== null &&
      imagePageAccepts(this.shapes, shape, coreImageToken)
    );
  }

  protected override prepareGeometry() {
    const changed =
      this.geometryDirty ||
      this.materialDirty ||
      this.shapes.some((shape, i) => {
        const row = this.#rows[i],
          m = shape.worldTransform;
        return (
          shape.renderDirtyFlag ||
          !row ||
          row[0] !== m.a ||
          row[1] !== m.b ||
          row[2] !== m.c ||
          row[3] !== m.d ||
          row[4] !== m.tx ||
          row[5] !== m.ty ||
          row[12] !== shape.globalRenderOrder / ZINDEX_FACTOR
        );
      });
    if (!changed) return;
    const slots = new Map<string, number>();
    const textures: { token: string; acquire(): ImageTextureLease<Texture> }[] =
      [];
    this.#rows = this.shapes.map((shape) => {
      const source = shape.fill as ImageBitmap;
      const key = JSON.stringify([source.width, source.height]);
      const texture = {
        token: coreImageToken(shape),
        acquire: () =>
          imageTextures.acquire(this.device, source, key, () => {
            const t = this.device.createTexture({
              format: Format.U8_RGBA_NORM,
              width: source.width,
              height: source.height,
              usage: TextureUsage.SAMPLED,
            });
            try {
              t.setImageData([source]);
            } catch (error) {
              t.destroy();
              throw error;
            }
            return t;
          }),
      };
      let slot = slots.get(texture.token);
      if (slot === undefined) {
        slot = textures.length;
        if (slot >= IMAGE_BATCH_TEXTURES)
          throw new Error('Image page exceeds sampler budget');
        slots.set(texture.token, slot);
        textures.push(texture);
      }
      const r = shape as Rect,
        m = shape.worldTransform;
      return imageBatchRow(
        [m.a, m.b, m.c, m.d, m.tx, m.ty],
        [r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2],
        shape.opacity,
        slot,
        shape.globalRenderOrder / ZINDEX_FACTOR,
        shape.strokeWidth,
        shape.fillOpacity,
        { center: 0, inner: 1, outer: 2 }[shape.strokeAlignment],
        [
          shape.strokeRGB.r / 255,
          shape.strokeRGB.g / 255,
          shape.strokeRGB.b / 255,
          shape.strokeRGB.opacity * shape.strokeOpacity,
        ],
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
  render(renderPass: RenderPass, uniforms: Record<string, unknown>) {
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
  }
  override destroy() {
    if (this.destroyed) return;
    this.bindings?.destroy();
    this.bindings = undefined;
    this.#images.dispose();
    this.#instances?.dispose();

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
