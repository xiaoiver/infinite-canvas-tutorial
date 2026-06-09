import type {
  Device,
  RenderPass,
  RenderPassDescriptor,
  Texture,
} from '@infinite-canvas-tutorial/device-api';
import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  TextureUsage,
  VertexStepMode,
  TransparentBlack,
  fullscreenMegaState,
} from '@infinite-canvas-tutorial/device-api';
import type { FillLayerItem } from '../components/renderable/Fill';
import {
  vert as composeVert,
  fragBlitFirstLayer,
  fragBlendLayer,
} from '../shaders/fill-layer-compose';
import type { FillLayerBlendMode } from '../types/fill-layer-blend';
import { fillLayerOpacity } from './fillLayers';
import type { RenderCache } from './render-cache';

/** 与 {@link fragBlitFirstLayer} / {@link fragBlendLayer} 中 mode 分支一致 */
export function fillLayerBlendModeToIndex(
  m: FillLayerBlendMode | undefined,
): number {
  switch (m ?? 'normal') {
    case 'normal':
      return 0;
    case 'darken':
      return 1;
    case 'multiply':
      return 2;
    case 'linearBurn':
      return 3;
    case 'colorBurn':
      return 4;
    case 'light':
      return 5;
    case 'screen':
      return 6;
    case 'linearDodge':
      return 7;
    case 'colorDodge':
      return 8;
    case 'overlay':
      return 9;
    case 'softLight':
      return 10;
    case 'hardLight':
      return 11;
    case 'difference':
      return 12;
    case 'exclusion':
      return 13;
    case 'hue':
      return 14;
    case 'saturation':
      return 15;
    case 'color':
      return 16;
    case 'luminosity':
      return 17;
    default:
      return 0;
  }
}

type SamplerLike = ReturnType<Device['createSampler']>;

function submitOffscreenPass(
  device: Device,
  descriptor: RenderPassDescriptor,
  draw: (pass: RenderPass) => void,
): void {
  device.submitRenderPassImmediate(descriptor, draw);
}

/**
 * 将多层纹理按 blendMode + opacity 预合成一张 premul RGBA。
 */
export function composeFillLayerTexturesOnGpu(
  device: Device,
  renderCache: RenderCache,
  layers: FillLayerItem[],
  textures: Texture[],
  width: number,
  height: number,
  createSampler: () => SamplerLike,
): Texture {
  const n = layers.length;
  if (textures.length !== n || n < 2) {
    throw new Error('composeFillLayerTexturesOnGpu: invalid layers/textures');
  }

  const diagnosticDerivativeUniformityHeader =
    device.queryVendorInfo().platformString === 'WebGPU'
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';

  const progBlit = renderCache.createProgram({
    vertex: { glsl: composeVert },
    fragment: {
      glsl: fragBlitFirstLayer,
      postprocess: (fs: string) => diagnosticDerivativeUniformityHeader + fs,
    },
  });
  const progBlend = renderCache.createProgram({
    vertex: { glsl: composeVert },
    fragment: {
      glsl: fragBlendLayer,
      postprocess: (fs: string) => diagnosticDerivativeUniformityHeader + fs,
    },
  });

  const vb = device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.STATIC,
  });

  const ilBlit = renderCache.createInputLayout({
    vertexBufferDescriptors: [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [{ shaderLocation: 0, offset: 0, format: Format.F32_RG }],
      },
    ],
    indexBufferFormat: null,
    program: progBlit,
  });
  const ilBlend = renderCache.createInputLayout({
    vertexBufferDescriptors: [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [{ shaderLocation: 0, offset: 0, format: Format.F32_RG }],
      },
    ],
    indexBufferFormat: null,
    program: progBlend,
  });

  const pipBlit = renderCache.createRenderPipeline({
    inputLayout: ilBlit,
    program: progBlit,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    depthStencilAttachmentFormat: null,
    megaStateDescriptor: fullscreenMegaState,
  });
  const pipBlend = renderCache.createRenderPipeline({
    inputLayout: ilBlend,
    program: progBlend,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    depthStencilAttachmentFormat: null,
    megaStateDescriptor: fullscreenMegaState,
  });

  const ubuf = device.createBuffer({
    viewOrSize: Float32Array.BYTES_PER_ELEMENT * 4,
    usage: BufferUsage.UNIFORM,
    hint: BufferFrequencyHint.DYNAMIC,
  });

  const texA = device.createTexture({
    format: Format.U8_RGBA_RT,
    width,
    height,
    usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
  });
  const texB = device.createTexture({
    format: Format.U8_RGBA_RT,
    width,
    height,
    usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
  });
  const rtA = device.createRenderTargetFromTexture(texA);
  const rtB = device.createRenderTargetFromTexture(texB);

  const samp = createSampler();

  const setUniform = (mode: number, opacity: number) => {
    const d = new Float32Array(4);
    d[0] = mode;
    d[1] = opacity;
    ubuf.setSubData(0, new Uint8Array(d.buffer));
  };

  setUniform(0, fillLayerOpacity(layers[0]!.opacity));
  const bindBlit0 = renderCache.createBindings({
    pipeline: pipBlit,
    uniformBufferBindings: [{ buffer: ubuf }],
    samplerBindings: [{ texture: textures[0]!, sampler: samp }],
  });
  submitOffscreenPass(
    device,
    {
      colorAttachment: [rtA],
      colorClearColor: [TransparentBlack],
      colorResolveTo: [null],
      colorStore: [true],
    },
    (rpass) => {
      rpass.setViewport(0, 0, width, height);
      rpass.setPipeline(pipBlit);
      rpass.setBindings(bindBlit0);
      rpass.setVertexInput(ilBlit, [{ buffer: vb }], null);
      rpass.draw(3);
    },
  );
  bindBlit0.destroy();

  let accTex = texA;
  let writeToB = true;

  for (let i = 1; i < n; i++) {
    const layer = layers[i]!;
    setUniform(
      fillLayerBlendModeToIndex(layer.blendMode),
      fillLayerOpacity(layer.opacity),
    );
    const targetRt = writeToB ? rtB : rtA;
    const bindBlend = renderCache.createBindings({
      pipeline: pipBlend,
      uniformBufferBindings: [{ buffer: ubuf }],
      samplerBindings: [
        { texture: accTex, sampler: samp },
        { texture: textures[i]!, sampler: samp },
      ],
    });
    submitOffscreenPass(
      device,
      {
        colorAttachment: [targetRt],
        colorClearColor: [TransparentBlack],
        colorResolveTo: [null],
        colorStore: [true],
      },
      (rpass) => {
        rpass.setViewport(0, 0, width, height);
        rpass.setPipeline(pipBlend);
        rpass.setBindings(bindBlend);
        rpass.setVertexInput(ilBlend, [{ buffer: vb }], null);
        rpass.draw(3);
      },
    );
    bindBlend.destroy();

    accTex = writeToB ? texB : texA;
    writeToB = !writeToB;
  }

  ubuf.destroy();
  vb.destroy();
  // rtA/rtB wrap the same gpuTexture as texA/texB — do not destroy them here.

  const discardTex = accTex === texA ? texB : texA;
  discardTex.destroy?.();

  return accTex;
}
