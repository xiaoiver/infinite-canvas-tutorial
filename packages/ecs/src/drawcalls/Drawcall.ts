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
  RenderTarget,
  Texture,
  Readback,
  MipmapFilterMode,
  AddressMode,
  FilterMode,
  TextureUsage,
  TransparentWhite,
  TransparentBlack,
  StencilOp,
  CompareFunction,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  CullMode,
  type MegaStateDescriptor,
} from '@infinite-canvas-tutorial/device-api';
import { Entity } from '@lastolivegames/becsy';
import {
  RenderCache,
  Effect,
  uid,
  halftoneDotsUniformValues,
  flutedGlassUniformValues,
  tsunamiUniformValues,
  burnUniformValues,
  crtUniformValues,
  vignetteUniformValues,
  asciiUniformValues,
  glitchUniformValues,
  liquidGlassUniformValues,
  heatmapUniformValues,
  imageDataToHeatmapProcessed,
  gemSmokeUniformValues,
  liquidMetalUniformValues,
  imageDataToLiquidMetalPoissonMap,
} from '../utils';
import {
  getCubeLutGpu,
  warnMissingCubeLutOnce,
} from '../utils/cube-lut-cache';
import { Location } from '../shaders/wireframe';
import { TexturePool } from '../resources';
import {
  Children,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  ClipMode,
  Wireframe,
} from '../components';
import {
  filterStringUsesEngineTimePost,
  getRasterFilterValueForShape,
  hasRasterPostEffects,
} from '../utils/filter';
import { API } from '../API';
import { MeshGradientPass } from '../render-graph/MeshGradientPass';
import type { MeshGradient } from '../utils/gradient';
import { vert as postProcessingVert } from '../shaders/post-processing/fullscreen';
import { vert as bigTriangleVert } from '../shaders/post-processing/big-triangle';
import { frag as copyFrag } from '../shaders/post-processing/copy';
import { frag as noiseFrag } from '../shaders/post-processing/noise';
import { frag as brightnessContrastFrag } from '../shaders/post-processing/brightnessContrast';
import { frag as hueSaturationFrag } from '../shaders/post-processing/hueSaturation';
import { frag as pixelateFrag } from '../shaders/post-processing/pixelate';
import { frag as dotFrag } from '../shaders/post-processing/dot';
import { frag as colorHalftoneFrag } from '../shaders/post-processing/colorHalftone';
import { frag as halftoneDotsFrag } from '../shaders/post-processing/halftoneDots';
import { frag as flutedGlassFrag } from '../shaders/post-processing/flutedGlass';
import { frag as tsunamiFrag } from '../shaders/post-processing/tsunami';
import { frag as burnFrag } from '../shaders/post-processing/burn';
import { frag as crtFrag } from '../shaders/post-processing/crt';
import { frag as vignetteFrag } from '../shaders/post-processing/vignette';
import { frag as asciiFrag } from '../shaders/post-processing/ascii';
import { frag as glitchFrag } from '../shaders/post-processing/glitch';
import { frag as liquidGlassFrag } from '../shaders/post-processing/liquidGlass';
import { frag as liquidMetalFrag } from '../shaders/post-processing/liquidMetal';
import { frag as heatmapFrag } from '../shaders/post-processing/heatmap';
import { frag as gemSmokeFrag } from '../shaders/post-processing/gemSmoke';
import { frag as lutFrag } from '../shaders/post-processing/lut';
import type { RGGraphBuilder } from '../render-graph/interface';

const FRAG_MAP: Record<
  string,
  { shader: string }
> = {
  noise: {
    shader: noiseFrag,
  },
  brightness: {
    shader: brightnessContrastFrag,
  },
  contrast: {
    shader: brightnessContrastFrag,
  },
  hueSaturation: {
    shader: hueSaturationFrag,
  },
  pixelate: {
    shader: pixelateFrag,
  },
  dot: {
    shader: dotFrag,
  },
  colorHalftone: {
    shader: colorHalftoneFrag,
  },
  halftoneDots: {
    shader: halftoneDotsFrag,
  },
  flutedGlass: {
    shader: flutedGlassFrag,
  },
  tsunami: {
    shader: tsunamiFrag,
  },
  burn: {
    shader: burnFrag,
  },
  crt: {
    shader: crtFrag,
  },
  vignette: {
    shader: vignetteFrag,
  },
  ascii: {
    shader: asciiFrag,
  },
  glitch: {
    shader: glitchFrag,
  },
  liquidGlass: {
    shader: liquidGlassFrag,
  },
  liquidMetal: {
    shader: liquidMetalFrag,
  },
  heatmap: {
    shader: heatmapFrag,
  },
  gemSmoke: {
    shader: gemSmokeFrag,
  },
  lut: {
    shader: lutFrag,
  },
};

function postEffectUniformFloatCount(effect: Effect): number {
  switch (effect.type) {
    case 'brightness':
    case 'contrast':
    case 'hueSaturation':
    case 'pixelate':
      return 4;
    case 'dot':
    case 'colorHalftone':
      return 8;
    case 'halftoneDots':
      return 20;
    case 'flutedGlass':
      return 36;
    case 'tsunami':
      return 16;
    case 'burn':
      return 16;
    case 'crt':
      return 12;
    case 'vignette':
      return 4;
    case 'ascii':
      return 12;
    case 'glitch':
      return 8;
    case 'liquidGlass':
      return 20;
    case 'liquidMetal':
      return 24;
    case 'heatmap':
      return 56;
    case 'gemSmoke':
      return 48;
    case 'lut':
      return 4;
    case 'drop-shadow':
      return 2;
    case 'fxaa':
      return 1;
    default:
      return 1;
  }
}

/** Required by {@link RenderCache.createRenderPipeline} (descriptor hash reads `attachmentsState`). */
const POST_PROCESS_FULLSCREEN_MEGA: MegaStateDescriptor = {
  attachmentsState: [
    {
      channelWriteMask: ChannelWriteMask.ALL,
      rgbBlendState: {
        blendMode: BlendMode.ADD,
        blendSrcFactor: BlendFactor.ONE,
        blendDstFactor: BlendFactor.ZERO,
      },
      alphaBlendState: {
        blendMode: BlendMode.ADD,
        blendSrcFactor: BlendFactor.ONE,
        blendDstFactor: BlendFactor.ZERO,
      },
    },
  ],
  blendConstant: TransparentBlack,
  cullMode: CullMode.NONE,
  depthWrite: false,
  depthCompare: CompareFunction.ALWAYS,
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
};

/** `u_LM5` y component in std140 block (24 floats for liquid metal). */
const LIQUID_METAL_U_LM5_Y_OFFSET_FLOATS = 21;
/** `u_HM2.z` in std140 block (56 floats for heatmap: third vec4, .z). */
const HEATMAP_U_HM2_Z_OFFSET_FLOATS = 10;
/** `u_GS5.z` in std140 (48 floats for gem-smoke: sixth vec4, .z). */
const GEM_SMOKE_U_GS5_Z_OFFSET_FLOATS = 22;

function setPostEffectUniformData(
  effect: Effect,
  buffer: Buffer,
  textureWidth?: number,
  textureHeight?: number,
  device?: Device,
): void {
  const count = postEffectUniformFloatCount(effect);
  const data = new Float32Array(count);
  let i = 0;
  switch (effect.type) {
    case 'brightness':
      data[i++] = effect.value;
      data[i++] = 0;
      data[i++] = 0;
      data[i++] = 0;
      break;
    case 'contrast':
      data[i++] = 0;
      data[i++] = effect.value;
      data[i++] = 0;
      data[i++] = 0;
      break;
    case 'hueSaturation': {
      let h = effect.hue;
      let s = effect.saturation;
      if (!Number.isFinite(h)) {
        h = 0;
      } else {
        h = Math.max(-1, Math.min(1, h));
      }
      if (!Number.isFinite(s)) {
        s = 0;
      } else {
        s = Math.max(-1, Math.min(1, s));
        if (s > 0.999) {
          s = 0.999;
        }
      }
      data[i++] = h;
      data[i++] = s;
      data[i++] = 0;
      data[i++] = 0;
      break;
    }
    case 'pixelate': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      let bw = effect.size;
      let bh = effect.size;
      if (!Number.isFinite(bw)) {
        bw = 1;
      }
      if (!Number.isFinite(bh)) {
        bh = 1;
      }
      bw = Math.max(1, Math.min(bw, tw));
      bh = Math.max(1, Math.min(bh, th));
      data[i++] = bw;
      data[i++] = bh;
      data[i++] = tw;
      data[i++] = th;
      break;
    }
    case 'dot': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      data[i++] = Number.isFinite(effect.angle) ? effect.angle : 5;
      data[i++] = Number.isFinite(effect.scale) ? effect.scale : 1;
      data[i++] = effect.grayscale > 0.5 ? 1 : 0;
      data[i++] = 0;
      data[i++] = tw;
      data[i++] = th;
      data[i++] = 0;
      data[i++] = 0;
      break;
    }
    case 'colorHalftone': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      let cx = effect.centerX;
      let cy = effect.centerY;
      if (
        cx === undefined ||
        cy === undefined ||
        !Number.isFinite(cx) ||
        !Number.isFinite(cy)
      ) {
        cx = tw * 0.5;
        cy = th * 0.5;
      }
      const angle = Number.isFinite(effect.angle) ? effect.angle : 0;
      let size = effect.size;
      if (!Number.isFinite(size) || size <= 0) {
        size = 4;
      }
      const scale = Math.PI / size;
      data[i++] = cx;
      data[i++] = cy;
      data[i++] = angle;
      data[i++] = scale;
      data[i++] = tw;
      data[i++] = th;
      data[i++] = 0;
      data[i++] = 0;
      break;
    }
    case 'halftoneDots': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = halftoneDotsUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'flutedGlass': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = flutedGlassUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'tsunami': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = tsunamiUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'burn': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = burnUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'crt': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = crtUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'vignette': {
      const u = vignetteUniformValues(effect);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'ascii': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = asciiUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'glitch': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = glitchUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'liquidGlass': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = liquidGlassUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'liquidMetal': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = liquidMetalUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'heatmap': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = heatmapUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'gemSmoke': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = gemSmokeUniformValues(effect, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
      break;
    }
    case 'lut': {
      if (!device) {
        break;
      }
      const g = getCubeLutGpu(device, effect.lutKey);
      if (!g) {
        break;
      }
      const str = Math.max(
        0,
        Math.min(1, Number.isFinite(effect.strength) ? effect.strength : 1),
      );
      data[i++] = g.size;
      data[i++] = str;
      data[i++] = 0;
      data[i++] = 0;
      break;
    }
    case 'drop-shadow':
      data[i++] = effect.x;
      data[i++] = effect.y;
      break;
    case 'fxaa':
      data[i++] = 0;
      break;
    default:
      if ('value' in effect) {
        data[i++] = effect.value;
      }
      break;
  }
  buffer.setSubData(0, new Uint8Array(data.buffer));
}

// TODO: Use a more efficient way to manage Z index.
export const ZINDEX_FACTOR = 100000;

/** Stencil reference value for clipChildren: write (useStencil) and test (parentAsStencil) must use the same value. 0–255 for 8-bit stencil. */
export const STENCIL_CLIP_REF = 1;

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

  #filterProgram: Program;
  #filterPipeline: RenderPipeline;
  #filterInputLayout: InputLayout;
  #filterVertexBuffer: Buffer;
  #filterIndexBuffer: Buffer;
  #filterUniformBuffer: Buffer;
  #filterTexture: Texture;
  #filterRenderTarget: RenderTarget;
  #filterBindings: Bindings;
  #filterWidth: number;
  #filterHeight: number;

  /** Ping-pong: copy writes T0 (#filterTexture), passes alternate T0→T1→T0… */
  #pingPongTexture: Texture;
  #pingPongRenderTarget: RenderTarget;

  #postEffectPasses: {
    program: Program;
    pipeline: RenderPipeline;
    inputLayout: InputLayout;
    vertexBuffer: Buffer;
    uniformBuffer: Buffer;
    bindings: Bindings;
    /** Sample from #filterTexture when true, else #pingPongTexture */
    srcIsT0: boolean;
    effect: Effect;
    /**
     * When true, try WebGL readback + CPU Poisson before this pass (see
     * {@link #prepareLiquidMetalPoissonForPass}).
     */
    liquidMetalPoissonAttempt?: boolean;
    /**
     * When true, try WebGL readback + `imageDataToHeatmapProcessed` before this pass
     * (see {@link #prepareHeatmapForPass}).
     */
    heatmapPreprocessAttempt?: boolean;
    /** Same R/G CPU map as liquid metal ({@link imageDataToLiquidMetalPoissonMap}). */
    gemSmokePoissonAttempt?: boolean;
    /** Second sampler for `lut` pass (atlas texture). */
    lutAtlasTexture?: Texture;
  }[] = [];

  /** GPU upload target for Poisson R/G; same size as the post chain. */
  #liquidMetalPoissonTexture: Texture | null = null;
  #liquidMetalPoissonWidth = 0;
  #liquidMetalPoissonHeight = 0;
  #readback: Readback | null = null;

  /**
   * When true, the post chain has exactly one pass that uses CPU Poisson, so a single
   * `#liquidMetalPoissonTexture` is unambiguous. If 2+ Poisson passes existed, reusing
   * one buffer between passes would be wrong — always recompute each pass.
   */
  #liquidMetalPoissonEngineTimeCacheAllowed = false;
  /**
   * After first successful Poisson upload for `useEngineTime` (single pass only), skip
   * readback + `imageDataToLiquidMetalPoissonMap` (Poisson field does not depend on time).
   */
  #liquidMetalPoissonEngineTimeCacheValid = false;

  #heatmapProcessedTexture: Texture | null = null;
  #heatmapWidth = 0;
  #heatmapHeight = 0;
  #heatmapEngineTimeCacheAllowed = false;
  #heatmapEngineTimeCacheValid = false;

  /** True after {@link createPostProcessing} completes; drives teardown in {@link destroyFullPostProcessingChain}. */
  #filterChainReady = false;

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
    if (this.geometryDirty) {
      // CPU Poisson / heatmap preprocess are derived from the rasterized shape; `useEngineTime`
      // otherwise skips readback assuming only time changes — invalidate when geometry changes.
      this.#liquidMetalPoissonEngineTimeCacheValid = false;
      this.#heatmapEngineTimeCacheValid = false;
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
      this.useFillImage &&
      this.shapes.length > 0 &&
      this.#filterChainReady
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
    const parent = this.shapes[0].has(Children) ? this.shapes[0].read(Children).parent : null;
    return parent?.has(ClipMode) ? parent.read(ClipMode).value : null;
  }

  /** When parent ClipMode is 'soft', alpha for content outside the mask (0–1). */
  protected get parentOutsideAlpha() {
    const parent = this.shapes[0].has(Children) ? this.shapes[0].read(Children).parent : null;
    return parent?.has(ClipMode) ? parent.read(ClipMode).outsideAlpha : 0.5;
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
    if (
      s.hasSomeOf(FillImage, FillTexture, FillGradient, FillPattern)
    ) {
      return true;
    }
    return (
      s.has(FillSolid) &&
      hasRasterPostEffects(getRasterFilterValueForShape(s))
    );
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

  #destroyPostEffectPasses(): void {
    for (const pass of this.#postEffectPasses) {
      // Program / pipeline / inputLayout / bindings come from {@link RenderCache} — do not
      // `destroy()` them or the cache will later return deleted WebGL objects.
      pass.vertexBuffer.destroy();
      pass.uniformBuffer.destroy();
    }
    this.#postEffectPasses = [];
  }

  /**
   * Frees GPU resources created by {@link createPostProcessing} (copy pass + ping-pong + effect passes).
   * Safe to call when no chain was allocated.
   */
  protected destroyFullPostProcessingChain(): void {
    if (!this.#filterChainReady) {
      this.#destroyPostEffectPasses();
      return;
    }
    this.#filterChainReady = false;
    this.#destroyPostEffectPasses();
    // Copy-pass program/pipeline/layout/bindings are cached — only destroy GPU buffers
    // and non-cached textures / render targets owned by this chain.
    this.#filterVertexBuffer.destroy();
    this.#filterIndexBuffer.destroy();
    this.#filterUniformBuffer.destroy();
    this.#filterRenderTarget.destroy();
    this.#filterTexture.destroy();
    this.#pingPongRenderTarget.destroy();
    this.#pingPongTexture.destroy();
    this.#destroyLiquidMetalPoissonTexture();
    this.#destroyHeatmapProcessedTexture();
  }

  #rebuildPostEffectPassBindings(): void {
    const t0 = this.#filterTexture;
    const t1 = this.#pingPongTexture;
    for (const pass of this.#postEffectPasses) {
      const sceneTex = pass.srcIsT0 ? t0 : t1;
      if (pass.effect.type === 'lut' && pass.lutAtlasTexture) {
        pass.bindings = this.renderCache.createBindings({
          pipeline: pass.pipeline,
          samplerBindings: [
            {
              texture: sceneTex,
              sampler: this.createLutPassInputSampler(),
            },
            {
              texture: pass.lutAtlasTexture,
              sampler: this.createLutSampler(),
            },
          ],
          uniformBufferBindings: [
            {
              buffer: pass.uniformBuffer,
            },
          ],
        });
      } else {
        pass.bindings = this.renderCache.createBindings({
          pipeline: pass.pipeline,
          samplerBindings: [
            {
              texture: sceneTex,
              sampler: this.createSampler(),
            },
          ],
          uniformBufferBindings: [
            {
              buffer: pass.uniformBuffer,
            },
          ],
        });
      }
    }
  }

  #getReadback(): Readback {
    if (!this.#readback) {
      this.#readback = this.device.createReadback();
    }
    return this.#readback;
  }

  #ensureLiquidMetalPoissonTexture(width: number, height: number): Texture {
    if (
      this.#liquidMetalPoissonTexture &&
      this.#liquidMetalPoissonWidth === width &&
      this.#liquidMetalPoissonHeight === height
    ) {
      return this.#liquidMetalPoissonTexture;
    }
    this.#liquidMetalPoissonTexture?.destroy();
    this.#liquidMetalPoissonWidth = width;
    this.#liquidMetalPoissonHeight = height;
    this.#liquidMetalPoissonTexture = this.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    return this.#liquidMetalPoissonTexture;
  }

  #createPostEffectPassSamplerBindings(
    pipeline: RenderPipeline,
    uniformBuffer: Buffer,
    sampleTexture: Texture,
  ): Bindings {
    return this.renderCache.createBindings({
      pipeline,
      samplerBindings: [
        {
          texture: sampleTexture,
          sampler: this.createSampler(),
        },
      ],
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
      ],
    });
  }

  #patchLiquidMetalPoissonMode(uniformBuffer: Buffer, y: number): void {
    uniformBuffer.setSubData(
      LIQUID_METAL_U_LM5_Y_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([y]).buffer),
    );
  }

  #patchGemSmokePoissonMode(uniformBuffer: Buffer, z: number): void {
    uniformBuffer.setSubData(
      GEM_SMOKE_U_GS5_Z_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([z]).buffer),
    );
  }

  /**
   * Per pass: read scene texture, build Poisson R/G map (liquid metal + gem-smoke), or fall back.
   */
  #prepareLiquidMetalPoissonForPass(
    pass: {
      effect: Effect;
      liquidMetalPoissonAttempt?: boolean;
      gemSmokePoissonAttempt?: boolean;
      pipeline: RenderPipeline;
      uniformBuffer: Buffer;
      bindings: Bindings;
    },
    srcTex: Texture,
    isWebGPU: boolean,
  ): void {
    if (!pass.liquidMetalPoissonAttempt && !pass.gemSmokePoissonAttempt) {
      return;
    }
    if (isWebGPU) {
      if (pass.liquidMetalPoissonAttempt) {
        this.#patchLiquidMetalPoissonMode(pass.uniformBuffer, 0);
      }
      if (pass.gemSmokePoissonAttempt) {
        this.#patchGemSmokePoissonMode(pass.uniformBuffer, 0);
      }
      return;
    }
    const w = this.#filterWidth;
    const h = this.#filterHeight;
    const eff = pass.effect;
    const poissonForEffect =
      (eff.type === 'liquidMetal' && (eff as { usePoisson?: boolean }).usePoisson !== false) ||
      (eff.type === 'gemSmoke' && (eff as { usePoisson?: boolean }).usePoisson !== false);
    const canReuseEngineTimePoisson =
      (eff.type === 'liquidMetal' || eff.type === 'gemSmoke') &&
      eff.useEngineTime === true &&
      poissonForEffect &&
      (eff as { useImage: boolean }).useImage &&
      this.#liquidMetalPoissonEngineTimeCacheAllowed &&
      this.#liquidMetalPoissonEngineTimeCacheValid &&
      this.#liquidMetalPoissonTexture != null &&
      this.#liquidMetalPoissonWidth === w &&
      this.#liquidMetalPoissonHeight === h;
    if (canReuseEngineTimePoisson) {
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        this.#liquidMetalPoissonTexture!,
      );
      if (eff.type === 'liquidMetal') {
        this.#patchLiquidMetalPoissonMode(pass.uniformBuffer, 1);
      }
      if (eff.type === 'gemSmoke') {
        this.#patchGemSmokePoissonMode(pass.uniformBuffer, 1);
      }
      return;
    }
    try {
      const data = new Uint8Array(w * h * 4);
      this.#getReadback().readTextureSync(srcTex, 0, 0, w, h, data);
      const imageData = new ImageData(
        new Uint8ClampedArray(
          data.buffer,
          data.byteOffset,
          w * h * 4,
        ),
        w,
        h,
      );
      const poisson = imageDataToLiquidMetalPoissonMap(imageData);
      const dest = this.#ensureLiquidMetalPoissonTexture(w, h);
      dest.setImageData([poisson], 0);
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        dest,
      );
      if (eff.type === 'liquidMetal') {
        this.#patchLiquidMetalPoissonMode(pass.uniformBuffer, 1);
      }
      if (eff.type === 'gemSmoke') {
        this.#patchGemSmokePoissonMode(pass.uniformBuffer, 1);
      }
      this.#liquidMetalPoissonEngineTimeCacheValid =
        (eff.type === 'liquidMetal' || eff.type === 'gemSmoke') &&
        eff.useEngineTime === true &&
        this.#liquidMetalPoissonEngineTimeCacheAllowed;
    } catch {
      this.#liquidMetalPoissonEngineTimeCacheValid = false;
      if (eff.type === 'liquidMetal') {
        this.#patchLiquidMetalPoissonMode(pass.uniformBuffer, 0);
      }
      if (eff.type === 'gemSmoke') {
        this.#patchGemSmokePoissonMode(pass.uniformBuffer, 0);
      }
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        srcTex,
      );
    }
  }

  #destroyLiquidMetalPoissonTexture(): void {
    this.#liquidMetalPoissonTexture?.destroy();
    this.#liquidMetalPoissonTexture = null;
    this.#liquidMetalPoissonWidth = 0;
    this.#liquidMetalPoissonHeight = 0;
    this.#liquidMetalPoissonEngineTimeCacheValid = false;
  }

  #patchHeatmapPreprocessed(uniformBuffer: Buffer, z: number): void {
    uniformBuffer.setSubData(
      HEATMAP_U_HM2_Z_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([z]).buffer),
    );
  }

  #ensureHeatmapProcessedTexture(width: number, height: number): Texture {
    if (
      this.#heatmapProcessedTexture &&
      this.#heatmapWidth === width &&
      this.#heatmapHeight === height
    ) {
      return this.#heatmapProcessedTexture;
    }
    this.#heatmapProcessedTexture?.destroy();
    this.#heatmapWidth = width;
    this.#heatmapHeight = height;
    this.#heatmapProcessedTexture = this.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    return this.#heatmapProcessedTexture;
  }

  #prepareHeatmapForPass(
    pass: {
      effect: Effect;
      heatmapPreprocessAttempt?: boolean;
      pipeline: RenderPipeline;
      uniformBuffer: Buffer;
      bindings: Bindings;
    },
    srcTex: Texture,
    isWebGPU: boolean,
  ): void {
    if (!pass.heatmapPreprocessAttempt) {
      return;
    }
    if (isWebGPU) {
      this.#patchHeatmapPreprocessed(pass.uniformBuffer, 0);
      return;
    }
    const w = this.#filterWidth;
    const h = this.#filterHeight;
    const eff = pass.effect;
    const canReuseEngineTime =
      eff.type === 'heatmap' &&
      eff.useEngineTime === true &&
      (eff.usePreprocess !== false) &&
      eff.useImage &&
      this.#heatmapEngineTimeCacheAllowed &&
      this.#heatmapEngineTimeCacheValid &&
      this.#heatmapProcessedTexture != null &&
      this.#heatmapWidth === w &&
      this.#heatmapHeight === h;
    if (canReuseEngineTime) {
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        this.#heatmapProcessedTexture!,
      );
      this.#patchHeatmapPreprocessed(pass.uniformBuffer, 1);
      return;
    }
    try {
      const data = new Uint8Array(w * h * 4);
      this.#getReadback().readTextureSync(srcTex, 0, 0, w, h, data);
      const imageData = new ImageData(
        new Uint8ClampedArray(
          data.buffer,
          data.byteOffset,
          w * h * 4,
        ),
        w,
        h,
      );
      const processed = imageDataToHeatmapProcessed(imageData);
      const dest = this.#ensureHeatmapProcessedTexture(w, h);
      dest.setImageData([processed], 0);
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        dest,
      );
      this.#patchHeatmapPreprocessed(pass.uniformBuffer, 1);
      this.#heatmapEngineTimeCacheValid =
        eff.type === 'heatmap' &&
        eff.useEngineTime === true &&
        this.#heatmapEngineTimeCacheAllowed;
    } catch {
      this.#heatmapEngineTimeCacheValid = false;
      this.#patchHeatmapPreprocessed(pass.uniformBuffer, 0);
      pass.bindings = this.#createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        srcTex,
      );
    }
  }

  #destroyHeatmapProcessedTexture(): void {
    this.#heatmapProcessedTexture?.destroy();
    this.#heatmapProcessedTexture = null;
    this.#heatmapWidth = 0;
    this.#heatmapHeight = 0;
    this.#heatmapEngineTimeCacheValid = false;
  }

  protected createPostProcessing(
    effects: Effect[],
    inputTexture: Texture,
    width: number,
    height: number,
  ) {
    this.destroyFullPostProcessingChain();

    this.#filterWidth = width;
    this.#filterHeight = height;
    this.#filterTexture = this.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.#filterRenderTarget = this.device.createRenderTargetFromTexture(
      this.#filterTexture,
    );

    this.#pingPongTexture = this.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.#pingPongRenderTarget = this.device.createRenderTargetFromTexture(
      this.#pingPongTexture,
    );

    const isWebGPU = this.device.queryVendorInfo().platformString === 'WebGPU';
    const diagnosticDerivativeUniformityHeader = isWebGPU
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';

    this.#filterProgram = this.renderCache.createProgram({
      vertex: {
        glsl: postProcessingVert,
      },
      fragment: {
        glsl: copyFrag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.#filterUniformBuffer = this.device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * (4 * 3),
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#filterIndexBuffer = this.device.createBuffer({
      viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.#filterVertexBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#filterInputLayout = this.device.createInputLayout({
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
      ],
      indexBufferFormat: Format.U32_R,
      program: this.#filterProgram,
    });

    this.#filterPipeline = this.device.createRenderPipeline({
      inputLayout: this.#filterInputLayout,
      program: this.#filterProgram,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: POST_PROCESS_FULLSCREEN_MEGA,
    });
    this.device.setResourceName(this.#filterPipeline, 'FilterPipeline');

    this.#filterBindings = this.renderCache.createBindings({
      pipeline: this.#filterPipeline,
      uniformBufferBindings: [
        {
          buffer: this.#filterUniformBuffer,
        },
      ],
      samplerBindings: [
        {
          texture: inputTexture,
          sampler: this.createSampler(),
        },
      ],
    });

    const t0 = this.#filterTexture;
    const t1 = this.#pingPongTexture;

    const usableEffects: Effect[] = [];
    for (const e of effects) {
      if (e.type !== 'lut') {
        usableEffects.push(e);
        continue;
      }
      if (getCubeLutGpu(this.device, e.lutKey)) {
        usableEffects.push(e);
      } else {
        warnMissingCubeLutOnce(e.lutKey);
      }
    }

    for (let ei = 0; ei < usableEffects.length; ei++) {
      const effect = usableEffects[ei]!;
      const entry = FRAG_MAP[effect.type];
      if (!entry) {
        console.warn(
          `Unsupported post-processing effect: ${(effect as Effect).type}`,
        );
        continue;
      }
      const frag = entry.shader;
      const srcIsT0 = this.#postEffectPasses.length % 2 === 0;

      const uniformBuffer = this.device.createBuffer({
        viewOrSize:
          Float32Array.BYTES_PER_ELEMENT * postEffectUniformFloatCount(effect),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      setPostEffectUniformData(
        effect,
        uniformBuffer,
        width,
        height,
        this.device,
      );

      const program = this.renderCache.createProgram({
        vertex: {
          glsl: bigTriangleVert,
        },
        fragment: {
          glsl: frag,
          postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
        },
      });

      const vertexBuffer = this.device.createBuffer({
        viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      const inputLayout = this.renderCache.createInputLayout({
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
        ],
        indexBufferFormat: null,
        program,
      });

      const pipeline = this.renderCache.createRenderPipeline({
        inputLayout,
        program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: null,
        megaStateDescriptor: POST_PROCESS_FULLSCREEN_MEGA,
      });

      const srcTexture = srcIsT0 ? t0 : t1;
      const liquidMetalPoissonAttempt =
        effect.type === 'liquidMetal' &&
        effect.useImage &&
        effect.usePoisson !== false;
      const heatmapPreprocessAttempt =
        effect.type === 'heatmap' &&
        effect.useImage &&
        effect.usePreprocess !== false;
      const gemSmokePoissonAttempt =
        effect.type === 'gemSmoke' &&
        effect.useImage &&
        effect.usePoisson !== false;
      const lutGpu =
        effect.type === 'lut' ? getCubeLutGpu(this.device, effect.lutKey) : undefined;
      const lutAtlasTexture = lutGpu?.texture;
      const bindings =
        effect.type === 'lut' && lutAtlasTexture
          ? this.renderCache.createBindings({
              pipeline,
              samplerBindings: [
                {
                  texture: srcTexture,
                  sampler: this.createLutPassInputSampler(),
                },
                {
                  texture: lutAtlasTexture,
                  sampler: this.createLutSampler(),
                },
              ],
              uniformBufferBindings: [
                {
                  buffer: uniformBuffer,
                },
              ],
            })
          : this.renderCache.createBindings({
              pipeline,
              samplerBindings: [
                {
                  texture: srcTexture,
                  sampler: this.createSampler(),
                },
              ],
              uniformBufferBindings: [
                {
                  buffer: uniformBuffer,
                },
              ],
            });

      this.#postEffectPasses.push({
        program,
        pipeline,
        inputLayout,
        vertexBuffer,
        uniformBuffer,
        bindings,
        srcIsT0,
        effect,
        liquidMetalPoissonAttempt,
        heatmapPreprocessAttempt,
        gemSmokePoissonAttempt,
        lutAtlasTexture,
      });
    }

    let nPoissonRgPass = 0;
    for (const p of this.#postEffectPasses) {
      if (p.liquidMetalPoissonAttempt || p.gemSmokePoissonAttempt) {
        nPoissonRgPass++;
      }
    }
    this.#liquidMetalPoissonEngineTimeCacheAllowed = nPoissonRgPass === 1;
    this.#liquidMetalPoissonEngineTimeCacheValid = false;

    let nHeatmap = 0;
    for (const p of this.#postEffectPasses) {
      if (p.heatmapPreprocessAttempt) {
        nHeatmap++;
      }
    }
    this.#heatmapEngineTimeCacheAllowed = nHeatmap === 1;
    this.#heatmapEngineTimeCacheValid = false;

    const n = this.#postEffectPasses.length;
    const lastTexture =
      n === 0
        ? this.#filterTexture
        : (n - 1) % 2 === 0
          ? this.#pingPongTexture
          : this.#filterTexture;

    this.#filterChainReady = true;

    return {
      texture: lastTexture,
    };
  }

  /**
   * Run the post-processing chain for an input texture that already matches `width`×`height`
   * (no canvas-sized crop). Used for per-shape FillImage filter in texture space.
   */
  protected renderPostProcessingTextureSpace(width: number, height: number) {
    const isWebGPU = this.device.queryVendorInfo().platformString === 'WebGPU';
    return this.#runPostProcessingWithUniforms(width, height, () => {
      const inputSize: number[] = [];
      const outputFrame: number[] = [];
      const outputTexture: number[] = [];
      // Must match canvas crop path convention: v_Uv = a_Position * (outputFrame.zw / u_InputSize.xy).
      // For full WxH input → WxH output, use u_InputSize.xy = (W,H), not (W/2,H/2).
      inputSize[0] = width;
      inputSize[1] = height;
      inputSize[2] = 1 / width;
      inputSize[3] = 1 / height;
      outputFrame[0] = 0;
      outputFrame[1] = 0;
      outputFrame[2] = width;
      outputFrame[3] = height;
      outputTexture[0] = width;
      outputTexture[1] = height;
      outputTexture[2] = 1;
      // fullscreen.frag: u_OutputTexture.w flips v_Uv.y for sampling. WebGL full-texture path uses 0;
      // WebGPU needs 1 so UV matches NDC/texture row order (same idea as renderPostProcessing).
      outputTexture[3] = isWebGPU ? 1 : 0;
      return { inputSize, outputFrame, outputTexture };
    });
  }

  /**
   * 将 `mesh-gradient` 全屏光栅化到 GPU 纹理（与 FillGradient 的 128×128 贴图策略一致）。
   * `width`/`height` 若无效会在 {@link MeshGradientPass} 内夹紧，避免 WebGL 0×0 附件。
   */
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

  #runPostProcessingWithUniforms(
    width: number,
    height: number,
    buildUniforms: () => {
      inputSize: number[];
      outputFrame: number[];
      outputTexture: number[];
    },
  ): { resized: boolean; texture: Texture } {
    let resized = false;
    if (this.#filterWidth !== width || this.#filterHeight !== height) {
      if (this.#filterChainReady) {
        this.#filterRenderTarget.destroy();
        this.#filterTexture.destroy();
        this.#pingPongRenderTarget.destroy();
        this.#pingPongTexture.destroy();

        this.#filterTexture = this.device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        });
        this.#filterRenderTarget = this.device.createRenderTargetFromTexture(
          this.#filterTexture,
        );
        this.#pingPongTexture = this.device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        });
        this.#pingPongRenderTarget = this.device.createRenderTargetFromTexture(
          this.#pingPongTexture,
        );

        this.#rebuildPostEffectPassBindings();
        this.#destroyLiquidMetalPoissonTexture();
        this.#destroyHeatmapProcessedTexture();
      }
      this.#filterWidth = width;
      this.#filterHeight = height;
      resized = true;
    }

    const { inputSize, outputFrame, outputTexture } = buildUniforms();
    const buffer = [...inputSize, ...outputFrame, ...outputTexture];
    this.#filterUniformBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array([...buffer]).buffer),
    );

    this.#filterProgram.setUniformsLegacy({
      u_InputSize: inputSize,
      u_OutputFrame: outputFrame,
      u_OutputTexture: outputTexture,
    });

    for (const pass of this.#postEffectPasses) {
      setPostEffectUniformData(
        pass.effect,
        pass.uniformBuffer,
        width,
        height,
        this.device,
      );
    }

    const isWebGPU =
      this.device.queryVendorInfo().platformString === 'WebGPU';

    const filterRenderPass = this.device.createRenderPass({
      colorAttachment: [this.#filterRenderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });

    filterRenderPass.setViewport(0, 0, width, height);
    filterRenderPass.setPipeline(this.#filterPipeline);
    filterRenderPass.setVertexInput(
      this.#filterInputLayout,
      [{ buffer: this.#filterVertexBuffer }],
      { buffer: this.#filterIndexBuffer },
    );
    filterRenderPass.setBindings(this.#filterBindings);
    filterRenderPass.drawIndexed(6, 1);
    this.device.submitPass(filterRenderPass);

    const t0 = this.#filterTexture;
    const t1 = this.#pingPongTexture;
    for (let pi = 0; pi < this.#postEffectPasses.length; pi++) {
      const pass = this.#postEffectPasses[pi]!;
      this.#prepareLiquidMetalPoissonForPass(
        pass,
        pass.srcIsT0 ? t0 : t1,
        isWebGPU,
      );
      this.#prepareHeatmapForPass(
        pass,
        pass.srcIsT0 ? t0 : t1,
        isWebGPU,
      );
      const dstRT =
        pi % 2 === 0 ? this.#pingPongRenderTarget : this.#filterRenderTarget;
      const effectPass = this.device.createRenderPass({
        colorAttachment: [dstRT],
        colorResolveTo: [null],
        colorClearColor: [TransparentWhite],
        colorStore: [true],
        depthStencilAttachment: null,
        depthStencilResolveTo: null,
      });
      effectPass.setViewport(0, 0, width, height);
      effectPass.setPipeline(pass.pipeline);
      effectPass.setVertexInput(
        pass.inputLayout,
        [{ buffer: pass.vertexBuffer }],
        null,
      );
      effectPass.setBindings(pass.bindings);
      effectPass.draw(3);
      this.device.submitPass(effectPass);
    }

    const n = this.#postEffectPasses.length;
    const outTexture =
      n === 0
        ? this.#filterTexture
        : (n - 1) % 2 === 0
          ? this.#pingPongTexture
          : this.#filterTexture;

    return { resized, texture: outTexture };
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
}
