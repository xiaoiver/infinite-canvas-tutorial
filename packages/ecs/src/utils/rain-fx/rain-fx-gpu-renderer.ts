/**
 * Full raindrop-fx GPU pipeline (blur, droplets, mist, instanced raindrops, compose).
 */
import type {
  Bindings,
  Buffer,
  Device,
  InputLayout,
  Program,
  RenderPass,
  RenderPipeline,
  RenderTarget,
  Sampler,
  Texture,
} from '@infinite-canvas-tutorial/device-api';
import {
  AddressMode,
  BlendFactor,
  BlendMode,
  BufferFrequencyHint,
  BufferUsage,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  FilterMode,
  MipmapFilterMode,
  StencilOp,
  Format,
  TextureUsage,
  TransparentBlack,
  TransparentWhite,
  VertexStepMode,
  type MegaStateDescriptor,
} from '@infinite-canvas-tutorial/device-api';
import { vert as fsVert } from '../../shaders/rain-fx/rainFxFullscreen';
import { frag as blurFrag } from '../../shaders/rain-fx/rainFxBlur';
import {
  frag as raindropFrag,
  vert as raindropVert,
  RainFxRaindropLocation,
} from '../../shaders/rain-fx/rainFxRaindrop';
import {
  frag as dropletFrag,
  vert as dropletVert,
  RainFxDropletLocation,
} from '../../shaders/rain-fx/rainFxDroplet';
import { frag as eraseFrag } from '../../shaders/rain-fx/rainFxErase';
import {
  fragAccum as mistAccumFrag,
  fragBg as mistBgFrag,
} from '../../shaders/rain-fx/rainFxMist';
import {
  frag as composeFrag,
  fragCopy as copyFrag,
} from '../../shaders/rain-fx/rainFxCompose';
import { frag as blitCoverFrag } from '../../shaders/rain-fx/rainFxBlitCover';
import type { RainDrop } from '../raindrop-sim/raindrop';
import {
  RAINDROP_FX_COMPOSE_DEFAULTS,
  RAINDROP_FX_RENDER_DEFAULTS,
  type RaindropFxBackgroundWrapMode,
  type RaindropFxComposeMode,
} from '../raindrop-sim/defaults';
import type { RenderCache } from '../render-cache';
import { randomRange } from '../raindrop-sim/random';

const MAX_RAINDROPS = 3000;
const INSTANCE_FLOATS = 6;
const QUAD_STRIDE = 20;

const BASE_MEGA: MegaStateDescriptor = {
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

function megaExclusion(): MegaStateDescriptor {
  return {
    ...BASE_MEGA,
    attachmentsState: [
      {
        channelWriteMask: ChannelWriteMask.ALL,
        rgbBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE_MINUS_DST,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC,
        },
        alphaBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE_MINUS_DST,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC,
        },
      },
    ],
  };
}

function megaNormalBlend(): MegaStateDescriptor {
  return {
    ...BASE_MEGA,
    attachmentsState: [
      {
        channelWriteMask: ChannelWriteMask.ALL,
        rgbBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
        },
        alphaBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
        },
      },
    ],
  };
}

function megaErase(): MegaStateDescriptor {
  return {
    ...BASE_MEGA,
    attachmentsState: [
      {
        channelWriteMask: ChannelWriteMask.ALL,
        rgbBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ZERO,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
        },
        alphaBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ZERO,
          blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
        },
      },
    ],
  };
}

function megaCompose(): MegaStateDescriptor {
  return {
    ...BASE_MEGA,
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
  };
}

function megaMistAccum(): MegaStateDescriptor {
  return {
    ...BASE_MEGA,
    attachmentsState: [
      {
        channelWriteMask: ChannelWriteMask.RED,
        rgbBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE,
          blendDstFactor: BlendFactor.ONE,
        },
        alphaBlendState: {
          blendMode: BlendMode.ADD,
          blendSrcFactor: BlendFactor.ONE,
          blendDstFactor: BlendFactor.ONE,
        },
      },
    ],
  };
}

/** Cover UV rect (min.xy, max.zw) for scene → filter blit. */
function coverSrcRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): [number, number, number, number] {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const w = dstAspect / srcAspect;
    const x = (1 - w) * 0.5;
    return [x, 0, x + w, 1];
  }
  const h = srcAspect / dstAspect;
  const y = (1 - h) * 0.5;
  return [0, y, 1, y + h];
}

export interface RainFxRenderOptions {
  backgroundBlurSteps?: number;
  backgroundWrapMode?: RaindropFxBackgroundWrapMode;
  mist?: boolean;
  mistColor?: [number, number, number, number];
  mistTime?: number;
  mistBlurStep?: number;
  dropletsPerSecond?: number;
  dropletSize?: [number, number];
  smoothRaindrop?: [number, number];
  refractBase?: number;
  refractScale?: number;
  raindropCompose?: RaindropFxComposeMode;
  raindropEraserSize?: [number, number];
  raindropLightPos?: [number, number, number, number];
  raindropDiffuseLight?: [number, number, number];
  raindropShadowOffset?: number;
  raindropSpecularLight?: [number, number, number];
  raindropSpecularShininess?: number;
  raindropLightBump?: number;
  /** 1 = raindrop-fx original (clear compose RT each frame). */
  composeDecay?: number;
}

export class RainFxGpuRenderer {
  private width = 1;
  private height = 1;
  private readonly fsVb: Buffer;
  private readonly quadVb: Buffer;
  private readonly quadIb: Buffer;
  private readonly instanceBuffer: Buffer;
  private readonly raindropUbo: Buffer;
  private readonly dropletUbo: Buffer;
  private readonly blurUbo: Buffer;
  private readonly eraseUbo: Buffer;
  private readonly blitCoverUbo: Buffer;
  private readonly mistAccumUbo: Buffer;
  private readonly mistBgUbo: Buffer;
  private readonly composeUbo: Buffer;

  private copyProgram!: Program;
  private blurProgram!: Program;
  private blitCoverProgram!: Program;
  private raindropProgram!: Program;
  private dropletProgram!: Program;
  private eraseProgram!: Program;
  private mistAccumProgram!: Program;
  private mistBgProgram!: Program;
  private composeProgram!: Program;
  private copyPipeline!: RenderPipeline;
  private blurPipeline!: RenderPipeline;
  private raindropPipeline!: RenderPipeline;
  private dropletPipeline!: RenderPipeline;
  private erasePipeline!: RenderPipeline;
  private blitCoverPipeline!: RenderPipeline;
  private mistAccumPipeline!: RenderPipeline;
  private mistBgPipeline!: RenderPipeline;
  private composePipeline!: RenderPipeline;
  private fsInputLayout!: InputLayout;
  private rainInputLayout!: InputLayout;
  private dropInputLayout!: InputLayout;

  private background!: Texture;
  private raindropComposeTex!: Texture;
  private dropletTex!: Texture;
  private mistTex!: Texture;
  private blurryBackground!: Texture;
  private mistBackground!: Texture;
  private readonly blurStepTextures: Texture[] = [];

  private bgRT!: RenderTarget;
  private raindropComposeRT!: RenderTarget;
  private dropletRT!: RenderTarget;
  private mistRT!: RenderTarget;
  private blurryBgRT!: RenderTarget;
  private mistBgRT!: RenderTarget;
  private readonly blurStepRTs: RenderTarget[] = [];
  private readonly blurStepSizes: { w: number; h: number }[] = [];

  private spriteTex: Texture | null = null;
  private readonly samplerClamp: Sampler;
  private readonly samplerRepeat: Sampler;
  private readonly samplerMirror: Sampler;
  private composeMode: RaindropFxComposeMode = 'smoother';

  constructor(
    private readonly device: Device,
    private readonly renderCache: RenderCache,
    width: number,
    height: number,
  ) {
    const mkSampler = (u: AddressMode, v: AddressMode) =>
      this.renderCache.createSampler({
        addressModeU: u,
        addressModeV: v,
        minFilter: FilterMode.BILINEAR,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
    this.samplerClamp = mkSampler(
      AddressMode.CLAMP_TO_EDGE,
      AddressMode.CLAMP_TO_EDGE,
    );
    this.samplerRepeat = mkSampler(AddressMode.REPEAT, AddressMode.REPEAT);
    this.samplerMirror = mkSampler(
      AddressMode.MIRRORED_REPEAT,
      AddressMode.MIRRORED_REPEAT,
    );
    this.fsVb = device.createBuffer({
      viewOrSize: new Float32Array([-1, -1, 3, -1, -1, 3]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.quadVb = device.createBuffer({
      viewOrSize: new Float32Array([
        -0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, 0.5, 0.5, 0, 1, 1, -0.5,
        0.5, 0, 0, 1,
      ]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.quadIb = device.createBuffer({
      viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.instanceBuffer = device.createBuffer({
      viewOrSize:
        Float32Array.BYTES_PER_ELEMENT * INSTANCE_FLOATS * MAX_RAINDROPS,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      hint: BufferFrequencyHint.DYNAMIC,
    });
    const ubo = (floats: number) =>
      device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * floats,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    this.raindropUbo = ubo(16);
    this.dropletUbo = ubo(28);
    this.blurUbo = ubo(8);
    this.eraseUbo = ubo(4);
    this.blitCoverUbo = ubo(4);
    this.mistAccumUbo = ubo(4);
    this.mistBgUbo = ubo(4);
    this.composeUbo = ubo(32);
    this.resize(width, height);
    this.rebuildPipelines();
  }

  destroy(): void {
    this.destroyTextures();
    this.spriteTex?.destroy();
    this.spriteTex = null;
    this.fsVb.destroy();
    this.quadVb.destroy();
    this.quadIb.destroy();
    this.instanceBuffer.destroy();
    this.raindropUbo.destroy();
    this.dropletUbo.destroy();
    this.blurUbo.destroy();
    this.eraseUbo.destroy();
    this.blitCoverUbo.destroy();
    this.mistAccumUbo.destroy();
    this.mistBgUbo.destroy();
    this.composeUbo.destroy();
  }

  setSpriteBitmap(bmp: ImageBitmap): void {
    this.spriteTex?.destroy();
    this.spriteTex = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: bmp.width,
      height: bmp.height,
      usage: TextureUsage.SAMPLED,
    });
    this.spriteTex.setImageData([bmp]);
    this.rebuildPipelines();
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this.width && h === this.height) {
      return;
    }
    this.width = w;
    this.height = h;
    this.destroyTextures();
    this.createTextures();
  }

  render(
    sceneTexture: Texture,
    outputTarget: RenderTarget,
    raindrops: RainDrop[],
    dt: number,
    options: RainFxRenderOptions = {},
  ): void {
    if (!this.spriteTex) {
      return;
    }

    const R = RAINDROP_FX_RENDER_DEFAULTS;
    const C = RAINDROP_FX_COMPOSE_DEFAULTS;
    const blurSteps = options.backgroundBlurSteps ?? R.backgroundBlurSteps;
    const mist = options.mist ?? R.mist;
    const mistBlurStep = options.mistBlurStep ?? R.mistBlurStep;
    const dropletsPerSecond = options.dropletsPerSecond ?? R.dropletsPerSecond;
    const dropletSize = options.dropletSize ?? R.dropletSize;
    const smoothRaindrop = options.smoothRaindrop ?? C.smoothRaindrop;
    const refractBase = options.refractBase ?? C.refractBase;
    const refractScale = options.refractScale ?? C.refractScale;
    this.composeMode = options.raindropCompose ?? R.raindropCompose;
    const eraser = options.raindropEraserSize ?? R.raindropEraserSize;
    const lightPos = options.raindropLightPos ?? C.raindropLightPos;
    const diffuse = options.raindropDiffuseLight ?? C.raindropDiffuseLight;
    const shadow = options.raindropShadowOffset ?? C.raindropShadowOffset;
    const spec = options.raindropSpecularLight ?? C.raindropSpecularLight;
    const shininess =
      options.raindropSpecularShininess ?? C.raindropSpecularShininess;
    const mistColor = options.mistColor ?? R.mistColor;
    const mistTime = options.mistTime ?? R.mistTime;
    const wrapMode = options.backgroundWrapMode ?? R.backgroundWrapMode;
    const lightBump = options.raindropLightBump ?? C.raindropLightBump;
    const bgSampler = this.samplerForWrap(wrapMode);

    // raindrop-fx order: droplet → mist → raindrops (+ erase) → bg → compose.
    // Droplet/mist RTs accumulate across frames (demo does not clear them each tick).
    this.blitSceneCover(sceneTexture, this.bgRT);
    this.blurBackground(blurSteps, mist, mistBlurStep);

    this.drawDroplets(Math.max(0, dropletsPerSecond * dt), dropletSize);
    if (mist) {
      this.accumulateMist(dt / mistTime);
    }

    this.clearRaindropComposeRT();
    const count = this.uploadRaindropInstances(raindrops);
    this.drawRaindrops(count);

    this.eraseTo(this.dropletRT, eraser);
    if (mist) {
      this.eraseTo(this.mistRT, eraser);
    }

    const pass = this.device.createRenderPass({
      colorAttachment: [outputTarget],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    this.runFullscreenOnPass(pass, this.blurryBackground, this.copyPipeline);
    if (mist) {
      this.runMistBackgroundOnPass(pass, mistColor);
    }
    this.runComposeOnPass(
      pass,
      bgSampler,
      smoothRaindrop,
      refractBase,
      refractScale,
      lightPos,
      diffuse,
      shadow,
      spec,
      shininess,
      lightBump,
    );
    this.device.submitPass(pass);
  }

  private fsHeader(): string {
    return this.device.queryVendorInfo().platformString === 'WebGPU'
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';
  }

  private createFsProgram(frag: string): Program {
    return this.renderCache.createProgram({
      vertex: { glsl: fsVert },
      fragment: { glsl: frag, postprocess: (fs) => this.fsHeader() + fs },
    });
  }

  private rebuildPipelines(): void {
    const copyProg = this.createFsProgram(copyFrag);
    const blurProg = this.createFsProgram(blurFrag);
    const rainProg = this.renderCache.createProgram({
      vertex: { glsl: raindropVert },
      fragment: {
        glsl: raindropFrag,
        postprocess: (fs) => this.fsHeader() + fs,
      },
    });
    const dropProg = this.renderCache.createProgram({
      vertex: { glsl: dropletVert },
      fragment: {
        glsl: dropletFrag,
        postprocess: (fs) => this.fsHeader() + fs,
      },
    });
    const eraseProg = this.createFsProgram(eraseFrag);
    const blitCoverProg = this.createFsProgram(blitCoverFrag);
    const mistAccumProg = this.createFsProgram(mistAccumFrag);
    const mistBgProg = this.createFsProgram(mistBgFrag);
    const composeProg = this.createFsProgram(composeFrag);

    this.fsInputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 8,
          stepMode: VertexStepMode.VERTEX,
          attributes: [{ shaderLocation: 0, offset: 0, format: Format.F32_RG }],
        },
      ],
      indexBufferFormat: null,
      program: copyProg,
    });

    this.rainInputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: QUAD_STRIDE,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              shaderLocation: RainFxRaindropLocation.POS,
              offset: 0,
              format: Format.F32_RGB,
            },
            {
              shaderLocation: RainFxRaindropLocation.UV,
              offset: 12,
              format: Format.F32_RG,
            },
          ],
        },
        {
          arrayStride: INSTANCE_FLOATS * 4,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: RainFxRaindropLocation.INST,
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: RainFxRaindropLocation.SIZE_NORM,
              offset: 16,
              format: Format.F32_R,
            },
          ],
        },
      ],
      indexBufferFormat: Format.U32_R,
      program: rainProg,
    });

    this.dropInputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: QUAD_STRIDE,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              shaderLocation: RainFxDropletLocation.POS,
              offset: 0,
              format: Format.F32_RGB,
            },
            {
              shaderLocation: RainFxDropletLocation.UV,
              offset: 12,
              format: Format.F32_RG,
            },
          ],
        },
      ],
      indexBufferFormat: Format.U32_R,
      program: dropProg,
    });

    const rainMega =
      this.composeMode === 'harder' ? megaNormalBlend() : megaExclusion();

    this.copyProgram = copyProg;
    this.blurProgram = blurProg;
    this.raindropProgram = rainProg;
    this.dropletProgram = dropProg;
    this.eraseProgram = eraseProg;
    this.blitCoverProgram = blitCoverProg;
    this.mistAccumProgram = mistAccumProg;
    this.mistBgProgram = mistBgProg;
    this.composeProgram = composeProg;

    this.copyPipeline = this.mkFsPipeline(copyProg, BASE_MEGA);
    this.blurPipeline = this.mkFsPipeline(blurProg, BASE_MEGA);
    this.raindropPipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.rainInputLayout,
      program: rainProg,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: rainMega,
    });
    this.dropletPipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.dropInputLayout,
      program: dropProg,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: rainMega,
    });
    this.erasePipeline = this.mkFsPipeline(eraseProg, megaErase());
    this.blitCoverPipeline = this.mkFsPipeline(blitCoverProg, BASE_MEGA);
    this.mistAccumPipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.fsInputLayout,
      program: mistAccumProg,
      colorAttachmentFormats: [Format.F16_R],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: megaMistAccum(),
    });
    this.mistBgPipeline = this.mkFsPipeline(mistBgProg, megaCompose());
    this.composePipeline = this.mkFsPipeline(composeProg, megaCompose());
  }

  private mkFsPipeline(
    program: Program,
    mega: MegaStateDescriptor,
  ): RenderPipeline {
    return this.renderCache.createRenderPipeline({
      inputLayout: this.fsInputLayout,
      program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: null,
      megaStateDescriptor: mega,
    });
  }

  private createTextures(): void {
    const mk = (w: number, h: number) => {
      const tex = this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width: w,
        height: h,
        usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
      });
      return {
        tex,
        rt: this.device.createRenderTargetFromTexture(tex),
      };
    };

    const full = mk(this.width, this.height);
    this.background = full.tex;
    this.bgRT = full.rt;

    const rain = mk(this.width, this.height);
    this.raindropComposeTex = rain.tex;
    this.raindropComposeRT = rain.rt;

    const drop = mk(this.width, this.height);
    this.dropletTex = drop.tex;
    this.dropletRT = drop.rt;

    const mistTex = this.device.createTexture({
      format: Format.F16_R,
      width: this.width,
      height: this.height,
      usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
    });
    this.mistTex = mistTex;
    this.mistRT = this.device.createRenderTargetFromTexture(mistTex);

    const blurry = mk(this.width, this.height);
    this.blurryBackground = blurry.tex;
    this.blurryBgRT = blurry.rt;

    const mistBg = mk(this.width, this.height);
    this.mistBackground = mistBg.tex;
    this.mistBgRT = mistBg.rt;

    this.blurStepTextures.length = 0;
    this.blurStepRTs.length = 0;
    this.blurStepSizes.length = 0;
    let w = this.width;
    let h = this.height;
    for (let i = 0; i <= 8; i++) {
      const step = mk(w, h);
      this.blurStepTextures[i] = step.tex;
      this.blurStepRTs[i] = step.rt;
      this.blurStepSizes[i] = { w, h };
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
  }

  private destroyTextures(): void {
    const textures = [
      this.background,
      this.raindropComposeTex,
      this.dropletTex,
      this.mistTex,
      this.blurryBackground,
      this.mistBackground,
      ...this.blurStepTextures,
    ];
    for (const t of textures) {
      t?.destroy();
    }
    const rts = [
      this.bgRT,
      this.raindropComposeRT,
      this.dropletRT,
      this.mistRT,
      this.blurryBgRT,
      this.mistBgRT,
      ...this.blurStepRTs,
    ];
    for (const rt of rts) {
      rt?.destroy();
    }
    this.blurStepTextures.length = 0;
    this.blurStepRTs.length = 0;
    this.blurStepSizes.length = 0;
  }

  /**
   * Column-major ortho for sim space (Y-up, gravity −y) → filter texture (Y-down, origin top-left).
   * Same as {@link RaindropNormalMapCanvas} `setTransform(1,0,0,-1,0,h)`; raindrop-fx demo uses Y-up GL framebuffer.
   */
  private samplerForWrap(mode: RaindropFxBackgroundWrapMode): Sampler {
    if (mode === 'repeat') {
      return this.samplerRepeat;
    }
    if (mode === 'mirror') {
      return this.samplerMirror;
    }
    return this.samplerClamp;
  }

  private blitSceneCover(sceneTexture: Texture, target: RenderTarget): void {
    const rect = coverSrcRect(this.width, this.height, this.width, this.height);
    this.writeUbo(this.blitCoverUbo, new Float32Array(rect));
    const pass = this.device.createRenderPass({
      colorAttachment: [target],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    this.drawFullscreen(
      pass,
      this.blitCoverPipeline,
      [{ texture: sceneTexture, sampler: this.samplerClamp }],
      this.blitCoverUbo,
    );
    this.device.submitPass(pass);
  }

  private orthoVp(): Float32Array {
    const w = this.width;
    const h = this.height;
    const vp = new Float32Array(16);
    vp[0] = 2 / w;
    vp[5] = -2 / h;
    vp[10] = 1;
    vp[12] = -1;
    vp[13] = 1;
    vp[15] = 1;
    return vp;
  }

  private writeUbo(buffer: Buffer, data: Float32Array): void {
    buffer.setSubData(0, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  private blurBackground(
    steps: number,
    mist: boolean,
    mistBlurStep: number,
  ): void {
    const n = Math.max(0, Math.min(8, Math.floor(steps)));
    const mSteps = Math.max(0, Math.min(8, Math.floor(mistBlurStep)));
    if (n === 0) {
      this.blitTexture(this.background, this.blurryBgRT);
      if (mist) {
        this.blitTexture(this.blurryBackground, this.mistBgRT);
      }
      return;
    }

    const downSteps = mist ? Math.max(n, mSteps) : n;
    let input = this.background;
    for (let i = 1; i <= downSteps; i++) {
      this.runBlurPass(input, this.blurStepRTs[i]!, i);
      input = this.blurStepTextures[i]!;
    }

    const upsampleTo = (fromLevel: number, outRt: RenderTarget) => {
      let inp = this.blurStepTextures[fromLevel]!;
      for (let i = fromLevel - 1; i >= 0; i--) {
        const isFinal = i === 0;
        const rt = isFinal ? outRt : this.blurStepRTs[i]!;
        this.runBlurPass(inp, rt, i);
        inp = isFinal ? this.blurryBackground : this.blurStepTextures[i]!;
      }
    };

    if (!mist) {
      upsampleTo(n, this.blurryBgRT);
      return;
    }

    const bgSteps = n;
    const mistUpSteps = Math.max(mSteps, n);
    if (bgSteps === mistUpSteps) {
      upsampleTo(mistUpSteps, this.blurryBgRT);
      this.blitTexture(this.blurryBackground, this.mistBgRT);
    } else if (mistUpSteps > bgSteps) {
      upsampleTo(bgSteps, this.blurryBgRT);
      upsampleTo(mistUpSteps, this.mistBgRT);
    } else {
      upsampleTo(mistUpSteps, this.mistBgRT);
      upsampleTo(bgSteps, this.blurryBgRT);
    }
  }

  private runBlurPass(
    input: Texture,
    target: RenderTarget,
    level: number,
  ): void {
    const size =
      level === 0
        ? { w: this.width, h: this.height }
        : this.blurStepSizes[level] ?? { w: this.width, h: this.height };
    const tw = size.w;
    const th = size.h;
    const pass = this.device.createRenderPass({
      colorAttachment: [target],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, tw, th);
    this.writeUbo(
      this.blurUbo,
      new Float32Array([tw, th, 1 / tw, 1 / th, 1, 0, 0, 0]),
    );
    this.drawFullscreen(
      pass,
      this.blurPipeline,
      [{ texture: input, sampler: this.samplerClamp }],
      this.blurUbo,
    );
    this.device.submitPass(pass);
  }

  private blitTexture(input: Texture, target: RenderTarget): void {
    const pass = this.device.createRenderPass({
      colorAttachment: [target],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    this.drawFullscreen(pass, this.copyPipeline, [
      { texture: input, sampler: this.samplerClamp },
    ]);
    this.device.submitPass(pass);
  }

  private runFullscreenOnPass(
    pass: RenderPass,
    input: Texture,
    pipeline: RenderPipeline,
  ): void {
    this.drawFullscreen(pass, pipeline, [
      { texture: input, sampler: this.samplerClamp },
    ]);
  }

  private drawFullscreen(
    pass: RenderPass,
    pipeline: RenderPipeline,
    samplers: { texture: Texture; sampler: Sampler }[],
    uniformBuffer?: Buffer,
  ): void {
    const bindings = this.renderCache.createBindings({
      pipeline,
      uniformBufferBindings: uniformBuffer ? [{ buffer: uniformBuffer }] : [],
      samplerBindings: samplers,
    });
    pass.setPipeline(pipeline);
    pass.setVertexInput(this.fsInputLayout, [{ buffer: this.fsVb }], null);
    pass.setBindings(bindings);
    pass.draw(3);
    bindings.destroy();
  }

  private drawDroplets(count: number, sizeRange: [number, number]): void {
    const n = Math.floor(count);
    if (n <= 0) {
      return;
    }
    const du = new Float32Array(28);
    du.set(this.orthoVp(), 0);
    du[16] = randomRange(0, 133);
    du[20] = 0;
    du[21] = 0;
    du[22] = this.width;
    du[23] = this.height;
    du[24] = sizeRange[0];
    du[25] = sizeRange[1];
    this.writeUbo(this.dropletUbo, du);

    const pass = this.device.createRenderPass({
      colorAttachment: [this.dropletRT],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    const bindings = this.renderCache.createBindings({
      pipeline: this.dropletPipeline,
      uniformBufferBindings: [{ buffer: this.dropletUbo }],
      samplerBindings: this.spriteTex
        ? [{ texture: this.spriteTex, sampler: this.samplerClamp }]
        : [],
    });
    pass.setPipeline(this.dropletPipeline);
    pass.setVertexInput(
      this.dropInputLayout,
      [{ buffer: this.quadVb }],
      { buffer: this.quadIb },
    );
    pass.setBindings(bindings);
    pass.drawIndexed(6, n);
    bindings.destroy();
    this.device.submitPass(pass);
  }

  private accumulateMist(alpha: number): void {
    this.writeUbo(this.mistAccumUbo, new Float32Array([alpha, 0, 0, 0]));
    const pass = this.device.createRenderPass({
      colorAttachment: [this.mistRT],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    const bindings = this.renderCache.createBindings({
      pipeline: this.mistAccumPipeline,
      uniformBufferBindings: [{ buffer: this.mistAccumUbo }],
      samplerBindings: [],
    });
    pass.setPipeline(this.mistAccumPipeline);
    pass.setVertexInput(this.fsInputLayout, [{ buffer: this.fsVb }], null);
    pass.setBindings(bindings);
    pass.draw(3);
    bindings.destroy();
    this.device.submitPass(pass);
  }

  private clearRaindropComposeRT(): void {
    const pass = this.device.createRenderPass({
      colorAttachment: [this.raindropComposeRT],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    this.device.submitPass(pass);
  }

  private uploadRaindropInstances(raindrops: RainDrop[]): number {
    const data = new Float32Array(MAX_RAINDROPS * INSTANCE_FLOATS);
    let n = 0;
    for (let i = 0; i < raindrops.length && n < MAX_RAINDROPS; i++) {
      const d = raindrops[i]!;
      if (d.destroied) {
        continue;
      }
      const w = d.size.x;
      const h = d.size.y;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        continue;
      }
      const o = n * INSTANCE_FLOATS;
      data[o] = d.pos.x;
      data[o + 1] = d.pos.y;
      data[o + 2] = w;
      data[o + 3] = h;
      data[o + 4] = w / 100;
      data[o + 5] = 0;
      n++;
    }
    if (n > 0) {
      this.instanceBuffer.setSubData(
        0,
        new Uint8Array(data.buffer, 0, n * INSTANCE_FLOATS * 4),
      );
    }
    return n;
  }

  private drawRaindrops(count: number): void {
    if (count <= 0 || !this.spriteTex) {
      return;
    }
    this.writeUbo(this.raindropUbo, this.orthoVp());
    const pass = this.device.createRenderPass({
      colorAttachment: [this.raindropComposeRT],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    const bindings = this.renderCache.createBindings({
      pipeline: this.raindropPipeline,
      uniformBufferBindings: [{ buffer: this.raindropUbo }],
      samplerBindings: [{ texture: this.spriteTex, sampler: this.samplerClamp }],
    });
    pass.setPipeline(this.raindropPipeline);
    pass.setVertexInput(
      this.rainInputLayout,
      [{ buffer: this.quadVb }, { buffer: this.instanceBuffer }],
      { buffer: this.quadIb },
    );
    pass.setBindings(bindings);
    pass.drawIndexed(6, count);
    bindings.destroy();
    this.device.submitPass(pass);
  }

  private eraseTo(target: RenderTarget, eraser: [number, number]): void {
    const pass = this.device.createRenderPass({
      colorAttachment: [target],
      colorResolveTo: [null],
      colorStore: [true],
    });
    pass.setViewport(0, 0, this.width, this.height);
    this.writeUbo(this.eraseUbo, new Float32Array([eraser[0], eraser[1], 0, 0]));
    this.drawFullscreen(
      pass,
      this.erasePipeline,
      [{ texture: this.raindropComposeTex, sampler: this.samplerClamp }],
      this.eraseUbo,
    );
    this.device.submitPass(pass);
  }

  private runMistBackgroundOnPass(
    pass: RenderPass,
    mistColor: [number, number, number, number],
  ): void {
    this.writeUbo(
      this.mistBgUbo,
      new Float32Array(mistColor),
    );
    const bindings = this.renderCache.createBindings({
      pipeline: this.mistBgPipeline,
      uniformBufferBindings: [{ buffer: this.mistBgUbo }],
      samplerBindings: [
        { texture: this.mistBackground, sampler: this.samplerClamp },
        { texture: this.mistTex, sampler: this.samplerClamp },
      ],
    });
    pass.setPipeline(this.mistBgPipeline);
    pass.setVertexInput(this.fsInputLayout, [{ buffer: this.fsVb }], null);
    pass.setBindings(bindings);
    pass.draw(3);
    bindings.destroy();
  }

  private runComposeOnPass(
    pass: RenderPass,
    bgSampler: Sampler,
    smoothRaindrop: [number, number],
    refractBase: number,
    refractScale: number,
    lightPos: [number, number, number, number],
    diffuse: [number, number, number],
    shadow: number,
    spec: [number, number, number],
    shininess: number,
    lightBump: number,
  ): void {
    const cu = new Float32Array(32);
    cu[0] = this.width;
    cu[1] = this.height;
    cu[2] = 1 / this.width;
    cu[3] = 1 / this.height;
    cu[4] = smoothRaindrop[0];
    cu[5] = smoothRaindrop[1];
    cu[6] = refractBase;
    cu[7] = refractScale;
    cu.set(lightPos, 8);
    cu[12] = diffuse[0];
    cu[13] = diffuse[1];
    cu[14] = diffuse[2];
    cu[15] = shadow;
    cu[16] = spec[0];
    cu[17] = spec[1];
    cu[18] = spec[2];
    cu[19] = shininess;
    cu[20] = lightBump;
    this.writeUbo(this.composeUbo, cu);
    const bindings = this.renderCache.createBindings({
      pipeline: this.composePipeline,
      uniformBufferBindings: [{ buffer: this.composeUbo }],
      samplerBindings: [
        { texture: this.blurryBackground, sampler: bgSampler },
        { texture: this.raindropComposeTex, sampler: this.samplerClamp },
        { texture: this.dropletTex, sampler: this.samplerClamp },
        { texture: this.mistTex, sampler: this.samplerClamp },
      ],
    });
    pass.setPipeline(this.composePipeline);
    pass.setVertexInput(this.fsInputLayout, [{ buffer: this.fsVb }], null);
    pass.setBindings(bindings);
    pass.draw(3);
    bindings.destroy();
  }
}
