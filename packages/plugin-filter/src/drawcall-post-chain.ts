/**
 * Fullscreen post-processing chain extracted from Drawcall (optional filter plugin).
 */
import {
  Buffer,
  Device,
  Program,
  RenderPipeline,
  InputLayout,
  Bindings,
  BufferUsage,
  BufferFrequencyHint,
  VertexStepMode,
  Format,
  RenderTarget,
  Texture,
  Readback,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
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
import type { DrawcallFilterHost } from '@infinite-canvas-tutorial/ecs';
import {
  halftoneDotsUniformValues,
  flutedGlassUniformValues,
  tsunamiUniformValues,
  isRainCodropsRainEffect,
  isRainFxEffect,
  type RainEffect,
  rainFxRenderOptionsFromEffect,
  raindropSimulatorOptionsForEffect,
  raindropsSimulatorOptionsForEffect,
  rainUniformValues,
  burnUniformValues,
  crtUniformValues,
  vignetteUniformValues,
  asciiUniformValues,
  glitchUniformValues,
  liquidGlassUniformValues,
  heatmapUniformValues,
  gemSmokeUniformValues,
  liquidMetalUniformValues,
  type Effect,
} from './filter';
import {
  imageDataToHeatmapProcessed,
  imageDataToLiquidMetalPoissonMap,
} from '@infinite-canvas-tutorial/ecs';
import {
  kawaseKernelsForBlurEffect,
  kawaseBlurUniformValues,
} from './utils/kawase-blur';
import { getPostEffectEngineTimeSeconds } from './utils/postEffectEngineTime';
import {
  getRaindropSpriteBitmapIfReady,
  loadRaindropSpriteCached,
  RaindropSimulator,
  RAINDROP_FX_SIM_DT,
} from './utils/raindrop-sim';
import {
  getRainDropTextureBitmapIfReady,
  loadRainDropTextureCached,
} from '@infinite-canvas-tutorial/ecs';
import { RainFxGpuRenderer } from './utils/rain-fx';
import {
  getRainFxAnimationExportContext,
  getRainFxPngExportContext,
  type RainFxPngExportContext,
} from '@infinite-canvas-tutorial/ecs';
import { upload2DRasterCanvasToTexture } from '@infinite-canvas-tutorial/ecs';
import { RaindropsCodropsSimulator } from './utils/raindrops-codrops/raindrops-simulator';
import {
  getCubeLutGpu,
  warnMissingCubeLutOnce,
} from '@infinite-canvas-tutorial/ecs';
import { DOMAdapter } from '@infinite-canvas-tutorial/ecs';
import { vert as postProcessingVert } from './shaders/post-processing/fullscreen';
import { vert as bigTriangleVert } from './shaders/post-processing/big-triangle';
import { frag as copyFrag } from './shaders/post-processing/copy';
import { frag as noiseFrag } from './shaders/post-processing/noise';
import { frag as brightnessContrastFrag } from './shaders/post-processing/brightnessContrast';
import { frag as hueSaturationFrag } from './shaders/post-processing/hueSaturation';
import { frag as pixelateFrag } from './shaders/post-processing/pixelate';
import { frag as dotFrag } from './shaders/post-processing/dot';
import { frag as colorHalftoneFrag } from './shaders/post-processing/colorHalftone';
import { frag as halftoneDotsFrag } from './shaders/post-processing/halftoneDots';
import { frag as flutedGlassFrag } from './shaders/post-processing/flutedGlass';
import { frag as tsunamiFrag } from './shaders/post-processing/tsunami';
import { frag as rainCodropsWaterFrag } from './shaders/post-processing/rainCodropsWater';
import { frag as raindropComposeFrag } from './shaders/post-processing/raindropCompose';
import { frag as burnFrag } from './shaders/post-processing/burn';
import { frag as crtFrag } from './shaders/post-processing/crt';
import { frag as vignetteFrag } from './shaders/post-processing/vignette';
import { frag as asciiFrag } from './shaders/post-processing/ascii';
import { frag as glitchFrag } from './shaders/post-processing/glitch';
import { frag as liquidGlassFrag } from './shaders/post-processing/liquidGlass';
import { frag as liquidMetalFrag } from './shaders/post-processing/liquidMetal';
import { frag as heatmapFrag } from './shaders/post-processing/heatmap';
import { frag as gemSmokeFrag } from './shaders/post-processing/gemSmoke';
import { frag as lutFrag } from './shaders/post-processing/lut';
import { frag as kawaseBlurFrag } from './shaders/post-processing/kawaseBlur';

type PostChainState = {
  filterProgram: Program;
  filterPipeline: RenderPipeline;
  filterInputLayout: InputLayout;
  filterVertexBuffer: Buffer;
  filterIndexBuffer: Buffer;
  filterUniformBuffer: Buffer;
  filterTexture: Texture;
  filterRenderTarget: RenderTarget;
  filterBindings: Bindings;
  filterWidth: number;
  filterHeight: number;
  pingPongTexture: Texture;
  pingPongRenderTarget: RenderTarget;
  postEffectPasses: PostEffectChainPass[];
  rainCodropsShinePlaceholder?: Texture;
  rainFxAuxPlaceholder?: Texture;
  liquidMetalPoissonTexture: Texture | null;
  liquidMetalPoissonWidth: number;
  liquidMetalPoissonHeight: number;
  readback: Readback | null;
  liquidMetalPoissonEngineTimeCacheAllowed: boolean;
  liquidMetalPoissonEngineTimeCacheValid: boolean;
  heatmapProcessedTexture: Texture | null;
  heatmapWidth: number;
  heatmapHeight: number;
  heatmapEngineTimeCacheAllowed: boolean;
  heatmapEngineTimeCacheValid: boolean;
  filterChainReady: boolean;
};

function createInitialState(): PostChainState {
  return {
    filterProgram: null!,
    filterPipeline: null!,
    filterInputLayout: null!,
    filterVertexBuffer: null!,
    filterIndexBuffer: null!,
    filterUniformBuffer: null!,
    filterTexture: null!,
    filterRenderTarget: null!,
    filterBindings: null!,
    filterWidth: 0,
    filterHeight: 0,
    pingPongTexture: null!,
    pingPongRenderTarget: null!,
    postEffectPasses: [],
    liquidMetalPoissonTexture: null,
    liquidMetalPoissonWidth: 0,
    liquidMetalPoissonHeight: 0,
    readback: null,
    liquidMetalPoissonEngineTimeCacheAllowed: false,
    liquidMetalPoissonEngineTimeCacheValid: false,
    heatmapProcessedTexture: null,
    heatmapWidth: 0,
    heatmapHeight: 0,
    heatmapEngineTimeCacheAllowed: false,
    heatmapEngineTimeCacheValid: false,
    filterChainReady: false,
  };
}

const stateByHost = new WeakMap<DrawcallFilterHost, PostChainState>();

function getState(host: DrawcallFilterHost): PostChainState {
  let s = stateByHost.get(host);
  if (!s) {
    s = createInitialState();
    stateByHost.set(host, s);
  }
  return s;
}

/** One pass in {@link Drawcall} fullscreen post chain (copy ping-pong + effect programs). */
type PostEffectChainPass = {
  program: Program;
  pipeline: RenderPipeline;
  inputLayout: InputLayout;
  vertexBuffer: Buffer;
  uniformBuffer: Buffer;
  bindings: Bindings;
  /** Sample from #filterTexture when true, else #pingPongTexture */
  srcIsT0: boolean;
  effect: Effect;
  /** Kawase sub-pass kernel (pixels); only for blur chain steps. */
  kawaseKernel?: number;
  liquidMetalPoissonAttempt?: boolean;
  heatmapPreprocessAttempt?: boolean;
  gemSmokePoissonAttempt?: boolean;
  lutAtlasTexture?: Texture;
  rainWaterTexture?: Texture;
  /** GPU shine sprite for Codrops {@link rainCodropsWaterFrag} (`u_textureShine`). */
  rainShineTexture?: Texture;
  rainSimulator?: RaindropsCodropsSimulator | RaindropSimulator | null;
  rainDropSources?: { color: ImageBitmap; alpha: ImageBitmap };
  rainFxSprite?: ImageBitmap;
  rainFxGpu?: RainFxGpuRenderer | null;
  rainLastEngineT?: number | null;
};

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
  blur: {
    shader: kawaseBlurFrag,
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
    case 'rain':
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
    case 'blur':
      return 8;
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
  kawaseKernel?: number,
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
    case 'rain': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const u = rainUniformValues(effect, tw, th);
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
    case 'blur': {
      const tw = Math.max(1, textureWidth ?? 1);
      const th = Math.max(1, textureHeight ?? 1);
      const kernel =
        kawaseKernel !== undefined && Number.isFinite(kawaseKernel)
          ? kawaseKernel
          : 0;
      const u = kawaseBlurUniformValues(effect, kernel, tw, th);
      for (let j = 0; j < u.length; j++) {
        data[i++] = u[j]!;
      }
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

export class DrawcallPostChain {
  constructor(private readonly host: DrawcallFilterHost) {}

  private state(): PostChainState {
    return getState(this.host);
  }

  invalidateEngineTimeCaches(): void {
    const state = this.state();
    state.liquidMetalPoissonEngineTimeCacheValid = false;
    state.heatmapEngineTimeCacheValid = false;
  }

  isReadyForSize(width: number, height: number): boolean {
    const state = this.state();
    return (
      state.filterChainReady &&
      state.filterWidth === width &&
      state.filterHeight === height &&
      state.postEffectPasses.length > 0
    );
  }

  private destroyPostEffectPasses(): void {
    for (const pass of this.state().postEffectPasses) {
      // Program / pipeline / inputLayout / bindings come from {@link RenderCache} — do not
      // `destroy()` them or the cache will later return deleted WebGL objects.
      pass.vertexBuffer.destroy();
      pass.uniformBuffer.destroy();
      pass.rainWaterTexture?.destroy();
      pass.rainShineTexture?.destroy();
      pass.rainFxGpu?.destroy();
      // Drop sprites are session-cached by URL — do not ImageBitmap.close() here.
      pass.rainDropSources = undefined;
      pass.rainFxGpu = null;
    }
    this.state().postEffectPasses = [];
  }

  /**
   * Frees GPU resources created by {@link createPostProcessing} (copy pass + ping-pong + effect passes).
   * Safe to call when no chain was allocated.
   */
  destroy(): void {
    if (!this.state().filterChainReady) {
      this.destroyPostEffectPasses();
      return;
    }
    this.state().filterChainReady = false;
    this.destroyPostEffectPasses();
    // Copy-pass program/pipeline/layout/bindings are cached — only destroy GPU buffers
    // and non-cached textures / render targets owned by this chain.
    this.state().filterVertexBuffer.destroy();
    this.state().filterIndexBuffer.destroy();
    this.state().filterUniformBuffer.destroy();
    this.state().filterRenderTarget.destroy();
    this.state().filterTexture.destroy();
    this.state().pingPongRenderTarget.destroy();
    this.state().pingPongTexture.destroy();
    this.state().rainCodropsShinePlaceholder?.destroy();
    this.state().rainCodropsShinePlaceholder = undefined;
    this.state().rainFxAuxPlaceholder?.destroy();
    this.state().rainFxAuxPlaceholder = undefined;
    this.destroyLiquidMetalPoissonTexture();
    this.destroyHeatmapProcessedTexture();
  }

  private getRainCodropsShinePlaceholderTexture(): Texture {
    if (!this.state().rainCodropsShinePlaceholder) {
      const tex = this.host.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: 1,
        height: 1,
        usage: TextureUsage.SAMPLED,
      });
      const c = DOMAdapter.get().createCanvas(1, 1);
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 1, 1);
      upload2DRasterCanvasToTexture(tex, c);
      this.state().rainCodropsShinePlaceholder = tex;
    }
    return this.state().rainCodropsShinePlaceholder;
  }

  private createRainCodropsBindings(
    pipeline: RenderPipeline,
    uniformBuffer: Buffer,
    sceneTex: Texture,
    waterTex: Texture,
    shineTex: Texture,
  ): Bindings {
    return this.host.renderCache.createBindings({
      pipeline,
      samplerBindings: [
        {
          texture: sceneTex,
          sampler: this.host.createSampler(),
        },
        {
          texture: waterTex,
          sampler: this.host.createSampler(),
        },
        {
          texture: shineTex,
          sampler: this.host.createSampler(),
        },
      ],
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
      ],
    });
  }

  private createRainCodropsPassBindings(
    pass: PostEffectChainPass,
    sceneTex: Texture,
  ): Bindings {
    const shineTex =
      pass.rainShineTexture ?? this.getRainCodropsShinePlaceholderTexture();
    return this.createRainCodropsBindings(
      pass.pipeline,
      pass.uniformBuffer,
      sceneTex,
      pass.rainWaterTexture!,
      shineTex,
    );
  }

  private getRainFxAuxPlaceholderTexture(): Texture {
    if (!this.state().rainFxAuxPlaceholder) {
      const tex = this.host.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: 1,
        height: 1,
        usage: TextureUsage.SAMPLED,
      });
      const c = DOMAdapter.get().createCanvas(1, 1);
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 1, 1);
      upload2DRasterCanvasToTexture(tex, c);
      this.state().rainFxAuxPlaceholder = tex;
    }
    return this.state().rainFxAuxPlaceholder;
  }

  private createRainFxBindings(
    pipeline: RenderPipeline,
    uniformBuffer: Buffer,
    sceneTex: Texture,
    composeTex: Texture,
  ): Bindings {
    const aux = this.getRainFxAuxPlaceholderTexture();
    return this.host.renderCache.createBindings({
      pipeline,
      samplerBindings: [
        { texture: sceneTex, sampler: this.host.createSampler() },
        { texture: composeTex, sampler: this.host.createSampler() },
        { texture: aux, sampler: this.host.createSampler() },
        { texture: aux, sampler: this.host.createSampler() },
      ],
      uniformBufferBindings: [{ buffer: uniformBuffer }],
    });
  }

  private createRainFxPassBindings(
    pass: PostEffectChainPass,
    sceneTex: Texture,
  ): Bindings {
    return this.createRainFxBindings(
      pass.pipeline,
      pass.uniformBuffer,
      sceneTex,
      pass.rainWaterTexture!,
    );
  }

  private rebuildPostEffectPassBindings(): void {
    const t0 = this.state().filterTexture;
    const t1 = this.state().pingPongTexture;
    for (const pass of this.state().postEffectPasses) {
      const sceneTex = pass.srcIsT0 ? t0 : t1;
      if (pass.effect.type === 'lut' && pass.lutAtlasTexture) {
        pass.bindings = this.host.renderCache.createBindings({
          pipeline: pass.pipeline,
          samplerBindings: [
            {
              texture: sceneTex,
              sampler: this.host.createLutPassInputSampler(),
            },
            {
              texture: pass.lutAtlasTexture,
              sampler: this.host.createLutSampler(),
            },
          ],
          uniformBufferBindings: [
            {
              buffer: pass.uniformBuffer,
            },
          ],
        });
      } else if (
        pass.effect.type === 'rain' &&
        isRainFxEffect(pass.effect) &&
        pass.rainWaterTexture
      ) {
        pass.bindings = this.createRainFxPassBindings(pass, sceneTex);
      } else if (
        pass.effect.type === 'rain' &&
        isRainCodropsRainEffect(pass.effect) &&
        pass.rainWaterTexture
      ) {
        pass.bindings = this.createRainCodropsPassBindings(pass, sceneTex);
      } else {
        pass.bindings = this.host.renderCache.createBindings({
          pipeline: pass.pipeline,
          samplerBindings: [
            {
              texture: sceneTex,
              sampler: this.host.createSampler(),
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

  private getReadback(): Readback {
    if (!this.state().readback) {
      this.state().readback = this.host.device.createReadback();
    }
    return this.state().readback;
  }

  /**
   * Sync readback RGBA8（如 mesh-gradient GPU 纹理）以便与 Canvas 文字遮罩做 CPU 合成。
   */
    private ensureLiquidMetalPoissonTexture(width: number, height: number): Texture {
    if (
      this.state().liquidMetalPoissonTexture &&
      this.state().liquidMetalPoissonWidth === width &&
      this.state().liquidMetalPoissonHeight === height
    ) {
      return this.state().liquidMetalPoissonTexture;
    }
    this.state().liquidMetalPoissonTexture?.destroy();
    this.state().liquidMetalPoissonWidth = width;
    this.state().liquidMetalPoissonHeight = height;
    this.state().liquidMetalPoissonTexture = this.host.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    return this.state().liquidMetalPoissonTexture;
  }

  private createPostEffectPassSamplerBindings(
    pipeline: RenderPipeline,
    uniformBuffer: Buffer,
    sampleTexture: Texture,
  ): Bindings {
    return this.host.renderCache.createBindings({
      pipeline,
      samplerBindings: [
        {
          texture: sampleTexture,
          sampler: this.host.createSampler(),
        },
      ],
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
      ],
    });
  }

  private patchLiquidMetalPoissonMode(uniformBuffer: Buffer, y: number): void {
    uniformBuffer.setSubData(
      LIQUID_METAL_U_LM5_Y_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([y]).buffer),
    );
  }

  private patchGemSmokePoissonMode(uniformBuffer: Buffer, z: number): void {
    uniformBuffer.setSubData(
      GEM_SMOKE_U_GS5_Z_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([z]).buffer),
    );
  }

  /**
   * Per pass: read scene texture, build Poisson R/G map (liquid metal + gem-smoke), or fall back.
   */
  private prepareLiquidMetalPoissonForPass(
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
        this.patchLiquidMetalPoissonMode(pass.uniformBuffer, 0);
      }
      if (pass.gemSmokePoissonAttempt) {
        this.patchGemSmokePoissonMode(pass.uniformBuffer, 0);
      }
      return;
    }
    const w = this.state().filterWidth;
    const h = this.state().filterHeight;
    const eff = pass.effect;
    const poissonForEffect =
      (eff.type === 'liquidMetal' && (eff as { usePoisson?: boolean }).usePoisson !== false) ||
      (eff.type === 'gemSmoke' && (eff as { usePoisson?: boolean }).usePoisson !== false);
    const canReuseEngineTimePoisson =
      (eff.type === 'liquidMetal' || eff.type === 'gemSmoke') &&
      eff.useEngineTime === true &&
      poissonForEffect &&
      (eff as { useImage: boolean }).useImage &&
      this.state().liquidMetalPoissonEngineTimeCacheAllowed &&
      this.state().liquidMetalPoissonEngineTimeCacheValid &&
      this.state().liquidMetalPoissonTexture != null &&
      this.state().liquidMetalPoissonWidth === w &&
      this.state().liquidMetalPoissonHeight === h;
    if (canReuseEngineTimePoisson) {
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        this.state().liquidMetalPoissonTexture!,
      );
      if (eff.type === 'liquidMetal') {
        this.patchLiquidMetalPoissonMode(pass.uniformBuffer, 1);
      }
      if (eff.type === 'gemSmoke') {
        this.patchGemSmokePoissonMode(pass.uniformBuffer, 1);
      }
      return;
    }
    try {
      const data = new Uint8Array(w * h * 4);
      this.getReadback().readTextureSync(srcTex, 0, 0, w, h, data);
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
      const dest = this.ensureLiquidMetalPoissonTexture(w, h);
      dest.setImageData([poisson], 0);
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        dest,
      );
      if (eff.type === 'liquidMetal') {
        this.patchLiquidMetalPoissonMode(pass.uniformBuffer, 1);
      }
      if (eff.type === 'gemSmoke') {
        this.patchGemSmokePoissonMode(pass.uniformBuffer, 1);
      }
      this.state().liquidMetalPoissonEngineTimeCacheValid =
        (eff.type === 'liquidMetal' || eff.type === 'gemSmoke') &&
        eff.useEngineTime === true &&
        this.state().liquidMetalPoissonEngineTimeCacheAllowed;
    } catch {
      this.state().liquidMetalPoissonEngineTimeCacheValid = false;
      if (eff.type === 'liquidMetal') {
        this.patchLiquidMetalPoissonMode(pass.uniformBuffer, 0);
      }
      if (eff.type === 'gemSmoke') {
        this.patchGemSmokePoissonMode(pass.uniformBuffer, 0);
      }
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        srcTex,
      );
    }
  }

  private destroyLiquidMetalPoissonTexture(): void {
    this.state().liquidMetalPoissonTexture?.destroy();
    this.state().liquidMetalPoissonTexture = null;
    this.state().liquidMetalPoissonWidth = 0;
    this.state().liquidMetalPoissonHeight = 0;
    this.state().liquidMetalPoissonEngineTimeCacheValid = false;
  }

  private patchHeatmapPreprocessed(uniformBuffer: Buffer, z: number): void {
    uniformBuffer.setSubData(
      HEATMAP_U_HM2_Z_OFFSET_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      new Uint8Array(new Float32Array([z]).buffer),
    );
  }

  private ensureHeatmapProcessedTexture(width: number, height: number): Texture {
    if (
      this.state().heatmapProcessedTexture &&
      this.state().heatmapWidth === width &&
      this.state().heatmapHeight === height
    ) {
      return this.state().heatmapProcessedTexture;
    }
    this.state().heatmapProcessedTexture?.destroy();
    this.state().heatmapWidth = width;
    this.state().heatmapHeight = height;
    this.state().heatmapProcessedTexture = this.host.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    return this.state().heatmapProcessedTexture;
  }

  private prepareHeatmapForPass(
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
      this.patchHeatmapPreprocessed(pass.uniformBuffer, 0);
      return;
    }
    const w = this.state().filterWidth;
    const h = this.state().filterHeight;
    const eff = pass.effect;
    const canReuseEngineTime =
      eff.type === 'heatmap' &&
      eff.useEngineTime === true &&
      (eff.usePreprocess !== false) &&
      eff.useImage &&
      this.state().heatmapEngineTimeCacheAllowed &&
      this.state().heatmapEngineTimeCacheValid &&
      this.state().heatmapProcessedTexture != null &&
      this.state().heatmapWidth === w &&
      this.state().heatmapHeight === h;
    if (canReuseEngineTime) {
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        this.state().heatmapProcessedTexture!,
      );
      this.patchHeatmapPreprocessed(pass.uniformBuffer, 1);
      return;
    }
    try {
      const data = new Uint8Array(w * h * 4);
      this.getReadback().readTextureSync(srcTex, 0, 0, w, h, data);
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
      const dest = this.ensureHeatmapProcessedTexture(w, h);
      dest.setImageData([processed], 0);
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        dest,
      );
      this.patchHeatmapPreprocessed(pass.uniformBuffer, 1);
      this.state().heatmapEngineTimeCacheValid =
        eff.type === 'heatmap' &&
        eff.useEngineTime === true &&
        this.state().heatmapEngineTimeCacheAllowed;
    } catch {
      this.state().heatmapEngineTimeCacheValid = false;
      this.patchHeatmapPreprocessed(pass.uniformBuffer, 0);
      pass.bindings = this.createPostEffectPassSamplerBindings(
        pass.pipeline,
        pass.uniformBuffer,
        srcTex,
      );
    }
  }

  private destroyHeatmapProcessedTexture(): void {
    this.state().heatmapProcessedTexture?.destroy();
    this.state().heatmapProcessedTexture = null;
    this.state().heatmapWidth = 0;
    this.state().heatmapHeight = 0;
    this.state().heatmapEngineTimeCacheValid = false;
  }

  /** Warm the liquid map so PNG/JPEG export is not a blank first frame. */
  private primeRainCodropsSimulator(sim: RaindropsCodropsSimulator): void {
    sim.update(0);
    for (let i = 0; i < 45; i++) {
      sim.update(1);
    }
  }

  private primeRainFxSimulator(sim: RaindropSimulator): void {
    sim.update({ dt: 0, total: 0 });
    for (let i = 0; i < 45; i++) {
      sim.update({
        dt: RAINDROP_FX_SIM_DT,
        total: (i + 1) * RAINDROP_FX_SIM_DT,
      });
    }
  }

  /** Step raindrop-fx sim by `frameDt` using fixed {@link RAINDROP_FX_SIM_DT} substeps. */
  private advanceRainFxSimulator(
    sim: RaindropSimulator,
    frameDt: number,
    totalAtEnd: number,
  ): void {
    const steps = Math.max(1, Math.ceil(frameDt / RAINDROP_FX_SIM_DT));
    const totalStart = totalAtEnd - steps * RAINDROP_FX_SIM_DT;
    for (let i = 0; i < steps; i++) {
      const total = totalStart + (i + 1) * RAINDROP_FX_SIM_DT;
      sim.update({ dt: RAINDROP_FX_SIM_DT, total: Math.max(0, total) });
    }
  }

  private runRainFxWarmupOnSimulator(sim: RaindropSimulator, warmupSec: number): void {
    sim.update({ dt: 0, total: 0 });
    const steps = Math.max(0, Math.ceil(warmupSec / RAINDROP_FX_SIM_DT));
    for (let i = 0; i < steps; i++) {
      sim.update({
        dt: RAINDROP_FX_SIM_DT,
        total: (i + 1) * RAINDROP_FX_SIM_DT,
      });
    }
  }

  /** Offline sim for PNG/JPEG export ({@link RainFxPngExportContext}). */
  private warmupRainFxSimulatorForExport(
    pass: PostEffectChainPass,
    ctx: RainFxPngExportContext,
  ): void {
    const eff = pass.effect as RainEffect;
    const w = this.state().filterWidth;
    const h = this.state().filterHeight;
    const sim = new RaindropSimulator(
      raindropSimulatorOptionsForEffect(eff, w, h),
    );
    const captureSec = Math.max(
      ctx.warmupSec,
      ctx.captureTimeSec ?? ctx.warmupSec,
    );
    this.runRainFxWarmupOnSimulator(sim, captureSec);
    pass.rainSimulator = sim;
    pass.rainLastEngineT = null;
  }

  private initRainFxPassFromSprite(
    passIndex: number,
    uniformBufferRef: Buffer,
    eff: RainEffect & { dropTextureUrl: string },
    sprite: ImageBitmap,
  ): void {
    const p = this.state().postEffectPasses[passIndex];
    if (!p || p.uniformBuffer !== uniformBufferRef) {
      return;
    }
    const w = this.state().filterWidth;
    const h = this.state().filterHeight;
    p.rainFxSprite = sprite;
    p.rainSimulator = new RaindropSimulator(
      raindropSimulatorOptionsForEffect(eff, w, h),
    );
    p.rainLastEngineT = null;
    if (!p.rainFxGpu) {
      p.rainFxGpu = new RainFxGpuRenderer(
        this.host.device,
        this.host.renderCache,
        w,
        h,
      );
    } else {
      p.rainFxGpu.resize(w, h);
    }
    p.rainFxGpu.setSpriteBitmap(sprite);
    const anim = getRainFxAnimationExportContext();
    if (anim) {
      if (!anim.warmupApplied) {
        if (anim.rainWarmupSec > 0) {
          this.runRainFxWarmupOnSimulator(p.rainSimulator, anim.rainWarmupSec);
        } else {
          p.rainSimulator.update({ dt: 0, total: 0 });
        }
        anim.warmupApplied = true;
        p.rainLastEngineT = anim.rainWarmupSec;
      }
    } else {
      this.primeRainFxSimulator(p.rainSimulator);
    }
  }

  private initRainCodropsPassFromBitmaps(
    passIndex: number,
    uniformBufferRef: Buffer,
    eff: RainEffect & { dropColorUrl: string; dropAlphaUrl: string },
    colorBmp: ImageBitmap,
    alphaBmp: ImageBitmap,
    shineBmp?: ImageBitmap,
  ): void {
    const p = this.state().postEffectPasses[passIndex];
    if (!p || p.uniformBuffer !== uniformBufferRef) {
      return;
    }
    p.rainDropSources = { color: colorBmp, alpha: alphaBmp };
    const w = this.state().filterWidth;
    const h = this.state().filterHeight;
    p.rainSimulator = new RaindropsCodropsSimulator(
      w,
      h,
      eff.rainSimScale ?? 1,
      colorBmp,
      alphaBmp,
      raindropsSimulatorOptionsForEffect(eff),
    );
    p.rainLastEngineT = null;
    this.primeRainCodropsSimulator(p.rainSimulator);
    if (p.rainWaterTexture) {
      upload2DRasterCanvasToTexture(
        p.rainWaterTexture,
        p.rainSimulator.canvas,
      );
    }
    if (shineBmp) {
      p.rainShineTexture?.destroy();
      p.rainShineTexture = this.host.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: shineBmp.width,
        height: shineBmp.height,
        usage: TextureUsage.SAMPLED,
      });
      p.rainShineTexture.setImageData([shineBmp]);
      this.rebuildPostEffectPassBindings();
    }
  }

  private resizeRainFxMaps(width: number, height: number): void {
    for (const pass of this.state().postEffectPasses) {
      if (pass.effect.type !== 'rain' || !isRainFxEffect(pass.effect)) {
        continue;
      }
      pass.rainFxGpu?.resize(width, height);
      const sprite = pass.rainFxSprite;
      if (sprite) {
        pass.rainSimulator = new RaindropSimulator(
          raindropSimulatorOptionsForEffect(pass.effect, width, height),
        );
        pass.rainLastEngineT = null;
        this.primeRainFxSimulator(pass.rainSimulator);
        pass.rainFxGpu?.setSpriteBitmap(sprite);
      } else {
        pass.rainSimulator = null;
        pass.rainLastEngineT = null;
      }
    }
  }

  private resizeRainCodropsWaterMaps(width: number, height: number): void {
    for (const pass of this.state().postEffectPasses) {
      if (pass.effect.type !== 'rain' || !isRainCodropsRainEffect(pass.effect)) {
        continue;
      }
      if (!pass.rainWaterTexture) {
        continue;
      }
      pass.rainWaterTexture.destroy();
      pass.rainWaterTexture = this.host.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width,
        height,
        usage: TextureUsage.SAMPLED,
      });
      const boot = DOMAdapter.get().createCanvas(width, height);
      const bctx = boot.getContext('2d') as CanvasRenderingContext2D;
      bctx.fillStyle = '#000';
      bctx.fillRect(0, 0, width, height);
      upload2DRasterCanvasToTexture(pass.rainWaterTexture, boot);
      const ds = pass.rainDropSources;
      if (ds) {
        pass.rainSimulator = new RaindropsCodropsSimulator(
          width,
          height,
          pass.effect.rainSimScale ?? 1,
          ds.color,
          ds.alpha,
          raindropsSimulatorOptionsForEffect(pass.effect),
        );
        pass.rainLastEngineT = null;
        this.primeRainCodropsSimulator(pass.rainSimulator);
        upload2DRasterCanvasToTexture(
          pass.rainWaterTexture,
          pass.rainSimulator.canvas,
        );
      } else {
        pass.rainSimulator = null;
        pass.rainLastEngineT = null;
      }
    }
  }

  private prepareRainFxForPass(pass: PostEffectChainPass): void {
    if (pass.effect.type !== 'rain' || !isRainFxEffect(pass.effect)) {
      return;
    }
    if (pass.rainFxGpu) {
      return;
    }
    if (
      !pass.rainSimulator ||
      !(pass.rainSimulator instanceof RaindropSimulator) ||
      !pass.rainFxSprite
    ) {
      return;
    }
    const sim = pass.rainSimulator;
    const anim = getRainFxAnimationExportContext();
    const tNow = getPostEffectEngineTimeSeconds();
    const frameDt = anim
      ? anim.invFps
      : pass.rainLastEngineT != null && pass.rainLastEngineT >= 0
        ? Math.max(RAINDROP_FX_SIM_DT, tNow - pass.rainLastEngineT)
        : 1 / 60;
    this.advanceRainFxSimulator(sim, frameDt, tNow);
    pass.rainLastEngineT = tNow;
  }

  private prepareRainCodropsForPass(pass: PostEffectChainPass): void {
    if (pass.effect.type !== 'rain' || !isRainCodropsRainEffect(pass.effect)) {
      return;
    }
    if (!pass.rainWaterTexture || !pass.rainSimulator) {
      return;
    }
    const tNow = getPostEffectEngineTimeSeconds();
    let timeScale = 1;
    if (pass.rainLastEngineT != null && pass.rainLastEngineT >= 0) {
      timeScale = Math.max(0, (tNow - pass.rainLastEngineT) * 60);
    }
    pass.rainLastEngineT = tNow;
    const codrops = pass.rainSimulator as RaindropsCodropsSimulator;
    codrops.update(timeScale);
    upload2DRasterCanvasToTexture(pass.rainWaterTexture, codrops.canvas);
  }

  createPostProcessing(
    effects: Effect[],
    inputTexture: Texture,
    width: number,
    height: number,
  ) {
    this.destroy();

    this.state().filterWidth = width;
    this.state().filterHeight = height;
    this.state().filterTexture = this.host.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.state().filterRenderTarget = this.host.device.createRenderTargetFromTexture(
      this.state().filterTexture,
    );

    this.state().pingPongTexture = this.host.device.createTexture({
      format: Format.U8_RGBA_RT,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.state().pingPongRenderTarget = this.host.device.createRenderTargetFromTexture(
      this.state().pingPongTexture,
    );

    const isWebGPU = this.host.device.queryVendorInfo().platformString === 'WebGPU';
    const diagnosticDerivativeUniformityHeader = isWebGPU
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';

    this.state().filterProgram = this.host.renderCache.createProgram({
      vertex: {
        glsl: postProcessingVert,
      },
      fragment: {
        glsl: copyFrag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.state().filterUniformBuffer = this.host.device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * (4 * 3),
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.state().filterIndexBuffer = this.host.device.createBuffer({
      viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.state().filterVertexBuffer = this.host.device.createBuffer({
      viewOrSize: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.state().filterInputLayout = this.host.device.createInputLayout({
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
      program: this.state().filterProgram,
    });

    this.state().filterPipeline = this.host.device.createRenderPipeline({
      inputLayout: this.state().filterInputLayout,
      program: this.state().filterProgram,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: POST_PROCESS_FULLSCREEN_MEGA,
    });
    this.host.device.setResourceName(this.state().filterPipeline, 'FilterPipeline');

    this.state().filterBindings = this.host.renderCache.createBindings({
      pipeline: this.state().filterPipeline,
      uniformBufferBindings: [
        {
          buffer: this.state().filterUniformBuffer,
        },
      ],
      samplerBindings: [
        {
          texture: inputTexture,
          sampler: this.host.createSampler(),
        },
      ],
    });

    const t0 = this.state().filterTexture;
    const t1 = this.state().pingPongTexture;

    const usableEffects: Effect[] = [];
    for (const e of effects) {
      if (e.type !== 'lut') {
        usableEffects.push(e);
        continue;
      }
      if (getCubeLutGpu(this.host.device, e.lutKey)) {
        usableEffects.push(e);
      } else {
        warnMissingCubeLutOnce(e.lutKey);
      }
    }

    type PostEffectBuildItem = {
      effect: Effect;
      frag: string;
      kawaseKernel?: number;
    };
    const buildItems: PostEffectBuildItem[] = [];
    for (let ei = 0; ei < usableEffects.length; ei++) {
      const effect = usableEffects[ei]!;
      if (effect.type === 'blur') {
        const kernels = kawaseKernelsForBlurEffect(effect);
        if (kernels.every((k) => k <= 0)) {
          continue;
        }
        for (const kernel of kernels) {
          buildItems.push({
            effect,
            frag: kawaseBlurFrag,
            kawaseKernel: kernel,
          });
        }
        continue;
      }
      if (effect.type === 'rain') {
        const frag = isRainCodropsRainEffect(effect)
          ? rainCodropsWaterFrag
          : isRainFxEffect(effect)
            ? copyFrag
            : raindropComposeFrag;
        buildItems.push({ effect, frag });
        continue;
      }
      const entry = FRAG_MAP[effect.type];
      if (!entry) {
        console.warn(
          `Unsupported post-processing effect: ${(effect as Effect).type}`,
        );
        continue;
      }
      buildItems.push({ effect, frag: entry.shader });
    }

    for (const item of buildItems) {
      const { effect, frag, kawaseKernel } = item;
      const srcIsT0 = this.state().postEffectPasses.length % 2 === 0;

      const uniformBuffer = this.host.device.createBuffer({
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
        this.host.device,
        kawaseKernel,
      );

      const program = this.host.renderCache.createProgram({
        vertex: {
          glsl: bigTriangleVert,
        },
        fragment: {
          glsl: frag,
          postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
        },
      });

      const vertexBuffer = this.host.device.createBuffer({
        viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      const inputLayout = this.host.renderCache.createInputLayout({
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

      const pipeline = this.host.renderCache.createRenderPipeline({
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
        effect.type === 'lut' ? getCubeLutGpu(this.host.device, effect.lutKey) : undefined;
      const lutAtlasTexture = lutGpu?.texture;
      let rainWaterTexture: Texture | undefined;
      if (effect.type === 'rain' && isRainCodropsRainEffect(effect)) {
        rainWaterTexture = this.host.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width,
          height,
          usage: TextureUsage.SAMPLED,
        });
        const boot = DOMAdapter.get().createCanvas(width, height);
        const bctx = boot.getContext('2d') as CanvasRenderingContext2D;
        bctx.fillStyle = '#000';
        bctx.fillRect(0, 0, width, height);
        upload2DRasterCanvasToTexture(rainWaterTexture, boot);
      }
      const bindings =
        effect.type === 'lut' && lutAtlasTexture
          ? this.host.renderCache.createBindings({
            pipeline,
            samplerBindings: [
              {
                texture: srcTexture,
                sampler: this.host.createLutPassInputSampler(),
              },
              {
                texture: lutAtlasTexture,
                sampler: this.host.createLutSampler(),
              },
            ],
            uniformBufferBindings: [
              {
                buffer: uniformBuffer,
              },
            ],
          })
          : effect.type === 'rain' &&
              isRainCodropsRainEffect(effect) &&
              rainWaterTexture
              ? this.createRainCodropsBindings(
                pipeline,
                uniformBuffer,
                srcTexture,
                rainWaterTexture,
                this.getRainCodropsShinePlaceholderTexture(),
              )
              : this.host.renderCache.createBindings({
              pipeline,
              samplerBindings: [
                {
                  texture: srcTexture,
                  sampler: this.host.createSampler(),
                },
              ],
              uniformBufferBindings: [
                {
                  buffer: uniformBuffer,
                },
              ],
            });

      const passIndex = this.state().postEffectPasses.length;
      this.state().postEffectPasses.push({
        program,
        pipeline,
        inputLayout,
        vertexBuffer,
        uniformBuffer,
        bindings,
        srcIsT0,
        effect,
        kawaseKernel,
        liquidMetalPoissonAttempt,
        heatmapPreprocessAttempt,
        gemSmokePoissonAttempt,
        lutAtlasTexture,
        rainWaterTexture,
        rainFxGpu:
          effect.type === 'rain' && isRainFxEffect(effect)
            ? new RainFxGpuRenderer(
              this.host.device,
              this.host.renderCache,
              width,
              height,
            )
            : undefined,
        rainSimulator: null,
        rainDropSources: undefined,
        rainLastEngineT: null,
      });

      if (effect.type === 'rain' && isRainFxEffect(effect)) {
        const eff = effect;
        const spriteBmp = getRaindropSpriteBitmapIfReady(eff.dropTextureUrl);
        if (spriteBmp) {
          this.initRainFxPassFromSprite(
            passIndex,
            uniformBuffer,
            eff,
            spriteBmp,
          );
        } else {
          const uniformBufferRef = uniformBuffer;
          void (async () => {
            try {
              const bmp = await loadRaindropSpriteCached(eff.dropTextureUrl);
              const p = this.state().postEffectPasses[passIndex];
              if (!p || p.uniformBuffer !== uniformBufferRef) {
                return;
              }
              this.initRainFxPassFromSprite(
                passIndex,
                uniformBufferRef,
                eff,
                bmp,
              );
            } catch (err) {
              console.warn('rain (raindrop-fx): failed to load drop sprite', err);
            }
          })();
        }
      } else if (
        effect.type === 'rain' &&
        isRainCodropsRainEffect(effect) &&
        rainWaterTexture
      ) {
        const eff = effect;
        const shineUrl = eff.dropShineUrl?.trim() ?? '';
        const colorBmp = getRainDropTextureBitmapIfReady(eff.dropColorUrl);
        const alphaBmp = getRainDropTextureBitmapIfReady(eff.dropAlphaUrl);
        const shineBmpReady = shineUrl
          ? getRainDropTextureBitmapIfReady(shineUrl)
          : undefined;
        if (colorBmp && alphaBmp) {
          this.initRainCodropsPassFromBitmaps(
            passIndex,
            uniformBuffer,
            eff,
            colorBmp,
            alphaBmp,
            shineBmpReady,
          );
        } else {
          const uniformBufferRef = uniformBuffer;
          void (async () => {
            try {
              const loads: Promise<ImageBitmap>[] = [
                loadRainDropTextureCached(eff.dropColorUrl),
                loadRainDropTextureCached(eff.dropAlphaUrl),
              ];
              if (shineUrl) {
                loads.push(loadRainDropTextureCached(shineUrl));
              }
              const bitmaps = await Promise.all(loads);
              const cb = bitmaps[0]!;
              const ab = bitmaps[1]!;
              const shineBmp = shineUrl ? bitmaps[2] : undefined;
              const p = this.state().postEffectPasses[passIndex];
              if (!p || p.uniformBuffer !== uniformBufferRef) {
                return;
              }
              this.initRainCodropsPassFromBitmaps(
                passIndex,
                uniformBufferRef,
                eff,
                cb,
                ab,
                shineBmp,
              );
              // Do not MaterialDirty: rain uses engine-time post refresh each frame;
              // MaterialDirty would rebuild the chain and refetch drop textures in a loop.
            } catch (err) {
              console.warn('rain (codrops): failed to load drop textures', err);
            }
          })();
        }
      }
    }

    let nPoissonRgPass = 0;
    for (const p of this.state().postEffectPasses) {
      if (p.liquidMetalPoissonAttempt || p.gemSmokePoissonAttempt) {
        nPoissonRgPass++;
      }
    }
    this.state().liquidMetalPoissonEngineTimeCacheAllowed = nPoissonRgPass === 1;
    this.state().liquidMetalPoissonEngineTimeCacheValid = false;

    let nHeatmap = 0;
    for (const p of this.state().postEffectPasses) {
      if (p.heatmapPreprocessAttempt) {
        nHeatmap++;
      }
    }
    this.state().heatmapEngineTimeCacheAllowed = nHeatmap === 1;
    this.state().heatmapEngineTimeCacheValid = false;

    const n = this.state().postEffectPasses.length;
    const lastTexture =
      n === 0
        ? this.state().filterTexture
        : (n - 1) % 2 === 0
          ? this.state().pingPongTexture
          : this.state().filterTexture;

    this.state().filterChainReady = true;

    return {
      texture: lastTexture,
    };
  }

  /**
   * Run the post-processing chain for an input texture that already matches `width`×`height`
   * (no canvas-sized crop). Used for per-shape FillImage filter in texture space.
   */
  renderPostProcessingTextureSpace(width: number, height: number) {
    const isWebGPU = this.host.device.queryVendorInfo().platformString === 'WebGPU';
    return this.runPostProcessingWithUniforms(width, height, () => {
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

  private runPostProcessingWithUniforms(
    width: number,
    height: number,
    buildUniforms: () => {
      inputSize: number[];
      outputFrame: number[];
      outputTexture: number[];
    },
  ): { resized: boolean; texture: Texture } {
    let resized = false;
    if (this.state().filterWidth !== width || this.state().filterHeight !== height) {
      if (this.state().filterChainReady) {
        this.state().filterRenderTarget.destroy();
        this.state().filterTexture.destroy();
        this.state().pingPongRenderTarget.destroy();
        this.state().pingPongTexture.destroy();

        this.state().filterTexture = this.host.device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        });
        this.state().filterRenderTarget = this.host.device.createRenderTargetFromTexture(
          this.state().filterTexture,
        );
        this.state().pingPongTexture = this.host.device.createTexture({
          format: Format.U8_RGBA_RT,
          width,
          height,
          usage: TextureUsage.RENDER_TARGET,
        });
        this.state().pingPongRenderTarget = this.host.device.createRenderTargetFromTexture(
          this.state().pingPongTexture,
        );

        this.resizeRainFxMaps(width, height);
        this.resizeRainCodropsWaterMaps(width, height);
        this.rebuildPostEffectPassBindings();
        this.destroyLiquidMetalPoissonTexture();
        this.destroyHeatmapProcessedTexture();
      }
      this.state().filterWidth = width;
      this.state().filterHeight = height;
      resized = true;
    }

    const { inputSize, outputFrame, outputTexture } = buildUniforms();
    const buffer = [...inputSize, ...outputFrame, ...outputTexture];
    this.state().filterUniformBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array([...buffer]).buffer),
    );

    this.state().filterProgram.setUniformsLegacy({
      u_InputSize: inputSize,
      u_OutputFrame: outputFrame,
      u_OutputTexture: outputTexture,
    });

    for (const pass of this.state().postEffectPasses) {
      setPostEffectUniformData(
        pass.effect,
        pass.uniformBuffer,
        width,
        height,
        this.host.device,
        pass.kawaseKernel,
      );
    }

    const isWebGPU =
      this.host.device.queryVendorInfo().platformString === 'WebGPU';

    const filterRenderPass = this.host.device.createRenderPass({
      colorAttachment: [this.state().filterRenderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });

    filterRenderPass.setViewport(0, 0, width, height);
    filterRenderPass.setPipeline(this.state().filterPipeline);
    filterRenderPass.setVertexInput(
      this.state().filterInputLayout,
      [{ buffer: this.state().filterVertexBuffer }],
      { buffer: this.state().filterIndexBuffer },
    );
    filterRenderPass.setBindings(this.state().filterBindings);
    filterRenderPass.drawIndexed(6, 1);
    this.host.device.submitPass(filterRenderPass);

    const t0 = this.state().filterTexture;
    const t1 = this.state().pingPongTexture;
    for (let pi = 0; pi < this.state().postEffectPasses.length; pi++) {
      const pass = this.state().postEffectPasses[pi]!;
      this.prepareLiquidMetalPoissonForPass(
        pass,
        pass.srcIsT0 ? t0 : t1,
        isWebGPU,
      );
      this.prepareHeatmapForPass(
        pass,
        pass.srcIsT0 ? t0 : t1,
        isWebGPU,
      );
      this.prepareRainFxForPass(pass);
      this.prepareRainCodropsForPass(pass);
      const dstRT =
        pi % 2 === 0 ? this.state().pingPongRenderTarget : this.state().filterRenderTarget;
      if (
        pass.effect.type === 'rain' &&
        isRainFxEffect(pass.effect) &&
        pass.rainFxGpu &&
        pass.rainSimulator instanceof RaindropSimulator
      ) {
        const srcTex = pass.srcIsT0 ? t0 : t1;
        const pngCtx = getRainFxPngExportContext();
        const animCtx = getRainFxAnimationExportContext();
        let renderDt = 1 / 60;
        const tNow = getPostEffectEngineTimeSeconds();
        if (pngCtx && pngCtx.warmupSec > 0) {
          this.warmupRainFxSimulatorForExport(pass, pngCtx);
          const tCap =
            pngCtx.captureTimeSec != null &&
            Number.isFinite(pngCtx.captureTimeSec) &&
            pngCtx.captureTimeSec > 0
              ? pngCtx.captureTimeSec
              : pngCtx.warmupSec;
          pass.rainLastEngineT = Math.max(0, tCap - renderDt);
        } else if (animCtx) {
          renderDt = animCtx.invFps;
          this.advanceRainFxSimulator(
            pass.rainSimulator,
            renderDt,
            tNow,
          );
          pass.rainLastEngineT = tNow;
        } else {
          if (pass.rainLastEngineT != null && pass.rainLastEngineT >= 0) {
            renderDt = Math.max(0, tNow - pass.rainLastEngineT);
          }
          pass.rainSimulator.update({ dt: RAINDROP_FX_SIM_DT, total: tNow });
          pass.rainLastEngineT = tNow;
        }
        pass.rainFxGpu.render(
          srcTex,
          dstRT,
          pass.rainSimulator.raindrops,
          renderDt,
          rainFxRenderOptionsFromEffect(pass.effect),
        );
        continue;
      }
      const effectPass = this.host.device.createRenderPass({
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
      this.host.device.submitPass(effectPass);
    }

    const n = this.state().postEffectPasses.length;
    const outTexture =
      n === 0
        ? this.state().filterTexture
        : (n - 1) % 2 === 0
          ? this.state().pingPongTexture
          : this.state().filterTexture;

    return { resized, texture: outTexture };
  }
}
