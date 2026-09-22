import {
  Buffer,
  Device,
  InputLayoutBufferDescriptor,
  Program,
  RenderPass,
  RenderPipeline,
  InputLayout,
  Bindings,
  BufferUsage,
  BufferFrequencyHint,
  VertexStepMode,
  Format,
  SwapChain,
  Texture,
  Readback,
  MipmapFilterMode,
  AddressMode,
  FilterMode,
  CompareFunction,
  StencilOp,
} from '@infinite-canvas-tutorial/device-api';
import { Entity } from '@lastolivegames/becsy';
import {
  RenderCache,
  Effect,
  fillLayersNeedFillImage,
  fillLayersShouldPrecompose,
  getEnabledFillLayers,
  uid,
  getNodeLayerBlendMode,
  isNonNormalNodeLayerBlend,
} from '../utils';
import { Location } from '../shaders/wireframe';
import { TexturePool } from '../resources';
import {
  Children,
  FillLayers,
  FillTexture,
  ClipMode,
  type ClipModeValue,
  Wireframe,
} from '../components';
import {
  filterStringUsesEngineTimePost,
  getRasterFilterValueForShape,
  hasRasterPostEffects,
} from '../utils/filter';
import { shouldBakeStrokeIntoRasterFilterTexture } from '../utils/solidShapeRasterForFilter';
import { API } from '../API';
import { MeshGradientPass } from '../render-graph/MeshGradientPass';
import type { MeshGradient } from '../utils/gradient';
import type { RGGraphBuilder } from '../render-graph/interface';
import {
  createDrawcallPostChain,
  getFilterBackend,
  type DrawcallPostChain,
} from '../filter/api';

// TODO: Use a more efficient way to manage Z index.
export const ZINDEX_FACTOR = 100000;

/** Stencil reference value for clipChildren: write (useStencil) and test (parentAsStencil) must use the same value. 0–255 for 8-bit stencil. */
export const STENCIL_CLIP_REF = 1;

/**
 * 沿 ECS 父链查找最近的 {@link ClipMode}（例如裁剪 rect → iconfont 根 → path，path 应对 rect 做 stencil 测试）。
 */
function nearestAncestorClipMode(shape: Entity): ClipModeValue | null {
  let ancestor = shape.has(Children) ? shape.read(Children).parent : null;
  while (ancestor) {
    if (ancestor.has(ClipMode)) {
      return ancestor.read(ClipMode).value;
    }
    ancestor = ancestor.has(Children) ? ancestor.read(Children).parent : null;
  }
  return null;
}

function nearestAncestorClipOutsideAlpha(shape: Entity): number {
  let ancestor = shape.has(Children) ? shape.read(Children).parent : null;
  while (ancestor) {
    if (ancestor.has(ClipMode)) {
      return ancestor.read(ClipMode).outsideAlpha;
    }
    ancestor = ancestor.has(Children) ? ancestor.read(Children).parent : null;
  }
  return 0.5;
}

export abstract class Drawcall {
  uid = uid();

  shapes: Entity[] = [];

  /**
   * Create a new batch if the number of instances exceeds.
   */
  protected maxInstances = Infinity;

  geometryDirty = true;
  materialDirty = true;
  destroyed = false;

  protected program: Program;
  protected pipeline: RenderPipeline;
  /** When parent ClipMode is 'soft': program/pipeline for drawing outside the mask at reduced alpha. */
  protected programSoftClipOutside: Program | null = null;
  protected pipelineSoftClipOutside: RenderPipeline | null = null;
  protected inputLayoutSoftClipOutside: InputLayout | null = null;
  protected bindingsSoftClipOutside: Bindings | null = null;

  protected inputLayout: InputLayout;
  protected bindings: Bindings;

  protected indexBuffer: Buffer;
  protected indexBufferData: Uint32Array;

  protected vertexBuffers: Buffer[] = [];
  protected vertexBufferDatas: Float32Array[] = [];
  protected vertexBufferOffsets: number[] = [];
  protected vertexBufferDescriptors: InputLayoutBufferDescriptor[];

  protected barycentricBuffer: Buffer;
  protected barycentricBufferDescriptor: InputLayoutBufferDescriptor = {
    arrayStride: 4 * 3,
    stepMode: VertexStepMode.VERTEX,
    attributes: [
      {
        shaderLocation: Location.BARYCENTRIC, // a_Barycentric
        offset: 0,
        format: Format.F32_RGB,
      },
    ],
  };

  #postChain: DrawcallPostChain | null = null;
  #readback: Readback | null = null;
  #filterWidth = 0;
  #filterHeight = 0;
  /** Render-graph 离屏 pass 输出的形状纹理（由 {@link setNodeLayerBlendSrcTexture} 注入，勿 destroy）。 */
  #layerBlendSrcTexture: Texture | null = null;

  static #meshGradientPassByDevice = new WeakMap<Device, MeshGradientPass>();

  constructor(
    protected device: Device,
    protected swapChain: SwapChain,
    protected renderCache: RenderCache,
    protected texturePool: TexturePool,
    protected instanced: boolean,
    protected index: number,
    protected api: API,
  ) { }

  abstract createGeometry(): void;
  abstract createMaterial(define: string, uniformBuffer: Buffer): void;
  abstract render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ): void;

  /**
   * Scene `u_ZoomScale` from the current frame's {@link submit} (set before `createMaterial`).
   * Used by off-screen raster bakes so glyph size attenuation matches the main pass.
   */
  protected sceneZoomScale = 1;

  protected getPostChain(): DrawcallPostChain | null {
    if (!this.#postChain && getFilterBackend()) {
      this.#postChain = createDrawcallPostChain(this as unknown as import('../filter/drawcall-host').DrawcallFilterHost);
    }
    return this.#postChain;
  }

  /** GIF/WebM: reuse post chain across frames when size unchanged. */
  protected isPostProcessingChainReadyForSize(width: number, height: number): boolean {
    const chain = this.getPostChain();
    return chain?.isReadyForSize(width, height) ?? false;
  }

  protected destroyFullPostProcessingChain(): void {
    this.#postChain?.destroy();
    this.#postChain = null;
  }

  destroy() {
    if (this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
      this.vertexBufferDatas = [];
      this.vertexBufferDescriptors = [];
    }
    this.#readback?.destroy();
    this.#readback = null;
    this.clearNodeLayerBlendSrcTextureReference();
    this.destroyFullPostProcessingChain();
    this.destroyed = true;
  }

  validate(shape: Entity) {
    if (
      this.useStencil ||
      this.useWireframe
    ) {
      return false;
    }

    return this.count() <= this.maxInstances - 1;
  }

  submit(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
    builder: RGGraphBuilder,
  ) {
    const zs = uniformLegacyObject['u_ZoomScale'];
    this.sceneZoomScale =
      typeof zs === 'number' && Number.isFinite(zs) && zs > 0 ? zs : 1;

    if (this.geometryDirty) {
      this.getPostChain()?.invalidateEngineTimeCaches();
      this.createGeometry();
    }

    if (this.materialDirty) {
      let defines = '';
      if (this.instanced) {
        defines += '#define USE_INSTANCES\n';
      }
      if (this.useFillImage) {
        defines += '#define USE_FILLIMAGE\n';
      }
      if (this.useWireframe) {
        defines += '#define USE_WIREFRAME\n';
      }
      if (this.useStencil) {
        defines += '#define USE_STENCIL\n';
      }
      defines += this.extraShaderDefines;
      this.createMaterial(defines, uniformBuffer);
      // Nested texture-space filter passes set the viewport to the texture size; restore the
      // main pass viewport so subsequent draws use the full backbuffer (WebGL may not restore).
      const { width, height } = this.swapChain.getCanvas();
      renderPass.setViewport(0, 0, width, height);
    } else if (
      (this.useFillImage || this.useRasterFilterEngineTimeRefresh) &&
      this.shapes.length > 0 &&
      this.isPostProcessingChainReadyForSize(this.#filterWidth, this.#filterHeight)
    ) {
      const shape = this.shapes[0];
      const fv = getRasterFilterValueForShape(shape);
      if (fv && filterStringUsesEngineTimePost(fv)) {
        this.renderPostProcessingTextureSpace(this.#filterWidth, this.#filterHeight);
        const { width, height } = this.swapChain.getCanvas();
        renderPass.setViewport(0, 0, width, height);
      }
    }

    void builder;

    this.render(renderPass, uniformBuffer, uniformLegacyObject);

    if (this.geometryDirty) {
      this.geometryDirty = false;
    }

    if (this.materialDirty) {
      this.materialDirty = false;
    }
  }

  add(shape: Entity) {
    if (!this.shapes.includes(shape)) {
      this.shapes.push(shape);
      this.geometryDirty = true;
    }
  }

  remove(shape: Entity) {
    if (this.shapes.includes(shape)) {
      const index = this.shapes.indexOf(shape);
      this.shapes.splice(index, 1);
      this.geometryDirty = true;
    }
  }

  count() {
    return this.shapes.length;
  }

  /** 节点级 mix-blend-mode（CSS `mix-blend-mode`）；仅非 instanced 单形状 drawcall 可启用。 */
  needsNodeLayerBlend(): boolean {
    if (this.instanced || this.shapes.length !== 1) {
      return false;
    }
    return isNonNormalNodeLayerBlend(
      getNodeLayerBlendMode(this.api, this.shapes[0]),
    );
  }

  setNodeLayerBlendSrcTexture(tex: Texture | null): void {
    this.#layerBlendSrcTexture = tex;
  }

  protected getNodeLayerBlendSrcTexture(): Texture | null {
    return this.#layerBlendSrcTexture;
  }

  protected clearNodeLayerBlendSrcTextureReference(): void {
    this.#layerBlendSrcTexture = null;
  }

  /** 在 render graph 离屏 pass 内绘制节点 layer-blend 源形状（与 {@link submit} 相同准备逻辑）。 */
  renderNodeLayerBlendSrcInPass(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ): void {
    const { width, height } = this.swapChain.getCanvas();
    renderPass.setViewport(0, 0, width, height);
    this.submit(renderPass, uniformBuffer, uniformLegacyObject, null!);
  }

  /**
   * 将预渲染纹理与 resolve 得到的 backdrop 按节点 blendMode 合成到主 RT。
   */
  submitNodeLayerBlendComposite(
    _renderPass: RenderPass,
    _backdrop: Texture,
    _src: Texture,
    _uniformBuffer: Buffer,
    _sceneUniformLegacyObject: Record<string, unknown>,
    _width: number,
    _height: number,
  ): void {}

  protected get stencilDescriptor() {
    return {
      stencilWrite: this.useStencil,
      stencilFront: this.useStencil ? {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
      } : this.parentClipMode ? {
        compare: this.parentClipMode === 'erase' ? CompareFunction.NOTEQUAL : CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
      } : {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.KEEP,
        failOp: StencilOp.KEEP,
        depthFailOp: StencilOp.KEEP,
      },
      stencilBack: this.useStencil ? {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.REPLACE,
      } : this.parentClipMode ? {
        compare: this.parentClipMode === 'erase' ? CompareFunction.NOTEQUAL : CompareFunction.EQUAL,
        passOp: StencilOp.KEEP,
      } : {
        compare: CompareFunction.ALWAYS,
        passOp: StencilOp.KEEP,
        failOp: StencilOp.KEEP,
        depthFailOp: StencilOp.KEEP,
      },
    };
  }

  /** Stencil descriptor for the second pass when parent ClipMode is 'soft' (draw outside at reduced alpha). */
  protected get stencilDescriptorForSoftOutside() {
    return {
      stencilWrite: false,
      stencilFront: {
        compare: CompareFunction.NOTEQUAL,
        passOp: StencilOp.KEEP,
      },
      stencilBack: {
        compare: CompareFunction.NOTEQUAL,
        passOp: StencilOp.KEEP,
      },
    };
  }

  protected get useStencil() {
    return this.shapes[0]?.has(ClipMode);
  }

  protected get parentClipMode() {
    const s = this.shapes[0];
    return s ? nearestAncestorClipMode(s) : null;
  }

  /** When parent ClipMode is 'soft', alpha for content outside the mask (0–1). */
  protected get parentOutsideAlpha() {
    const s = this.shapes[0];
    return s ? nearestAncestorClipOutsideAlpha(s) : 0.5;
  }

  protected get useWireframe() {
    return (
      this.shapes[0]?.has(Wireframe) ? this.shapes[0]?.read(Wireframe).enabled : false
    );
  }

  protected get useFillImage() {
    const s = this.shapes[0];
    if (!s) {
      return false;
    }
    if (s.has(FillTexture)) {
      return true;
    }
    if (s.has(FillLayers)) {
      const enabled = getEnabledFillLayers(s);
      if (enabled.length >= 2 && fillLayersNeedFillImage(enabled)) {
        return true;
      }
      if (enabled.length >= 2 && fillLayersShouldPrecompose(enabled)) {
        return true;
      }
      if (enabled.length === 1) {
        return true;
      }
    }
    if (
      s.has(FillLayers) &&
      getEnabledFillLayers(s).length >= 1 &&
      hasRasterPostEffects(getRasterFilterValueForShape(s))
    ) {
      return true;
    }
    return !this.instanced && shouldBakeStrokeIntoRasterFilterTexture(s);
  }

  /**
   * When true (and filter chain is ready), re-run texture-space post passes each frame for
   * `useEngineTime` filters — same branch as {@link useFillImage}. {@link SmoothPolyline} stroke
   * textures use this for animated liquid-metal, etc.
   */
  protected get useRasterFilterEngineTimeRefresh(): boolean {
    return false;
  }

  /** Subclasses (e.g. {@link SmoothPolyline}) append shader `#define`s beyond {@link useFillImage}. */
  protected get extraShaderDefines(): string {
    return '';
  }

  protected createProgram(vert: string, frag: string, defines: string) {
    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    const vertexBufferDescriptors = this.vertexBufferDescriptors;
    if (this.useWireframe) {
      vertexBufferDescriptors.push(this.barycentricBufferDescriptor);
    }
    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });
  }

  protected generateWireframe() {
    const indiceNum = this.indexBufferData.length;
    const originalVertexBuffers = this.vertexBufferDatas.map((buffer) => {
      return buffer.slice();
    });

    for (let i = 0; i < this.vertexBufferDatas.length; i++) {
      const { arrayStride, stepMode } = this.vertexBufferDescriptors[i];
      if (stepMode === VertexStepMode.VERTEX) {
        this.vertexBufferDatas[i] = new Float32Array(
          (arrayStride / Float32Array.BYTES_PER_ELEMENT) * indiceNum,
        );
      } else {
        this.vertexBufferDatas[i] = originalVertexBuffers[i];
      }
    }

    // reallocate attribute data
    let cursor = 0;
    const uniqueIndices = new Uint32Array(indiceNum);
    for (let i = 0; i < indiceNum; i++) {
      const ii = this.indexBufferData[i];
      for (let j = 0; j < this.vertexBufferDatas.length; j++) {
        const { arrayStride, stepMode } = this.vertexBufferDescriptors[j];

        if (stepMode === VertexStepMode.VERTEX) {
          const size = arrayStride / Float32Array.BYTES_PER_ELEMENT;
          for (let k = 0; k < size; k++) {
            this.vertexBufferDatas[j][cursor * size + k] =
              originalVertexBuffers[j][ii * size + k];
          }
        }
      }
      uniqueIndices[i] = cursor;
      cursor++;
    }

    for (let i = 0; i < this.vertexBuffers.length; i++) {
      this.vertexBuffers[i].destroy();
      this.vertexBuffers[i] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[i],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    // create barycentric attributes
    const barycentricBufferData = new Float32Array(indiceNum * 3);
    for (let i = 0; i < indiceNum;) {
      for (let j = 0; j < 3; j++) {
        const ii = uniqueIndices[i++];
        barycentricBufferData[ii * 3 + j] = 1;
      }
    }

    this.barycentricBuffer = this.device.createBuffer({
      viewOrSize: barycentricBufferData,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: uniqueIndices,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
  }

  protected createSampler() {
    return this.renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.POINT,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });
  }

  /** LINEAR clamp for 3D LUT (`sampler3D`); W clamp matches three.js `ClampToEdgeWrapping`. */
  protected createLutSampler() {
    return this.renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      addressModeW: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.BILINEAR,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });
  }

  /**
   * LUT pass samples the ping-pong scene with bilinear min+mag.
   * {@link createSampler} uses POINT min (pixel-crisp for other filters); LUT grading
   * amplifies that blockiness — this sampler avoids visible grain/banding on the input.
   */
  protected createLutPassInputSampler() {
    return this.renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.BILINEAR,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });
  }

  #getReadback(): Readback {
    if (!this.#readback) {
      this.#readback = this.device.createReadback();
    }
    return this.#readback;
  }

  protected readTextureRgba8Sync(
    texture: Texture,
    width: number,
    height: number,
  ): Uint8Array {
    const data = new Uint8Array(width * height * 4);
    this.#getReadback().readTextureSync(texture, 0, 0, width, height, data);
    return data;
  }

  protected createPostProcessing(
    effects: Effect[],
    inputTexture: Texture,
    width: number,
    height: number,
  ) {
    const chain = this.getPostChain();
    this.#filterWidth = width;
    this.#filterHeight = height;
    if (!chain) {
      return { texture: inputTexture };
    }
    return chain.createPostProcessing(effects, inputTexture, width, height);
  }

  protected renderPostProcessingTextureSpace(width: number, height: number) {
    const chain = this.getPostChain();
    if (!chain) {
      throw new Error('Filter plugin not registered');
    }
    this.#filterWidth = width;
    this.#filterHeight = height;
    return chain.renderPostProcessingTextureSpace(width, height);
  }

  protected renderMeshGradientTexture(
    gradient: MeshGradient,
    width: number,
    height: number,
  ): Texture {
    let pass = Drawcall.#meshGradientPassByDevice.get(this.device);
    if (!pass) {
      pass = new MeshGradientPass(this.device, this.renderCache);
      Drawcall.#meshGradientPassByDevice.set(this.device, pass);
    }
    return pass.render(gradient, width, height);
  }
}
