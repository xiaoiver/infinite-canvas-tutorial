import type {
  Buffer,
  Device,
  RenderPass,
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
  Format,
  MipmapFilterMode,
  TransparentBlack,
  VertexStepMode,
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  vert as composeVert,
  fragBlendLayer,
} from '../shaders/fill-layer-compose';
import type { RenderCache } from './render-cache';
import { fillLayerBlendModeToIndex } from './fillLayerComposeGpu';
import type { FillLayerBlendMode } from '../types/fill-layer-blend';

/** fragBlendLayer 已输出最终预乘颜色；须 REPLACE 写入，不能再用 SRC_ALPHA 二次混合。 */
const nodeLayerBlendMegaState = makeMegaState({
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
  depthCompare: CompareFunction.ALWAYS,
  depthWrite: false,
});

export class NodeLayerBlendCompositor {
  #uniforms: Buffer[] = [];
  #uniformIndex = 0;
  #vb;
  #sampler;
  #pipBlend;
  #program;
  #ilBlend;
  #compositeBindings: ReturnType<RenderCache['createBindings']> | null = null;
  #compositeBindingsKey = '';

  constructor(private device: Device, private renderCache: RenderCache) {
    const diagnosticDerivativeUniformityHeader =
      device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    const progBlend = (this.#program = renderCache.createProgram({
      vertex: { glsl: composeVert },
      fragment: {
        glsl: fragBlendLayer,
        postprocess: (fs: string) => diagnosticDerivativeUniformityHeader + fs,
      },
    }));

    this.#vb = device.createBuffer({
      viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.#ilBlend = renderCache.createInputLayout({
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

    this.#pipBlend = renderCache.createRenderPipeline({
      inputLayout: this.#ilBlend,
      program: progBlend,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      megaStateDescriptor: nodeLayerBlendMegaState,
    });

    this.#sampler = renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.POINT,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });
  }

  beginFrame(): void {
    this.#uniformIndex = 0;
  }

  composite(
    renderPass: RenderPass,
    backdrop: Texture,
    src: Texture,
    blendMode: FillLayerBlendMode | undefined,
    width: number,
    height: number,
    opacity = 1,
  ): void {
    const mode = fillLayerBlendModeToIndex(blendMode);
    const index = this.#uniformIndex++;
    let uniform = this.#uniforms[index];
    if (!uniform) {
      // One buffer per pass: WebGPU submits all passes after their uniform uploads.
      uniform = this.device.createBuffer({
        viewOrSize: 16,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#uniforms[index] = uniform;
    }
    const params = new Float32Array([mode, opacity, 0, 0]);
    uniform.setSubData(0, new Uint8Array(params.buffer));

    const bindingsKey = `${backdrop.id}:${src.id}:${uniform.id}`;
    if (this.#compositeBindingsKey !== bindingsKey) {
      this.#compositeBindings?.destroy();
      this.#compositeBindings = this.device.createBindings({
        pipeline: this.#pipBlend,
        uniformBufferBindings: [{ buffer: uniform }],
        samplerBindings: [
          { texture: backdrop, sampler: this.#sampler },
          { texture: src, sampler: this.#sampler },
        ],
      });
      this.#compositeBindingsKey = bindingsKey;
    }

    this.#program.setUniformsLegacy({
      u_BlendParams: params,
      u_Backdrop: 0,
      u_Src: 1,
    });
    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.#pipBlend);
    renderPass.setBindings(this.#compositeBindings!);
    renderPass.setVertexInput(this.#ilBlend, [{ buffer: this.#vb }], null);
    renderPass.draw(3);
  }

  destroy(): void {
    this.#compositeBindings?.destroy();
    this.#compositeBindings = null;
    this.#compositeBindingsKey = '';
    this.#uniforms.forEach((buffer) => buffer.destroy());
    this.#uniforms = [];
    this.#vb.destroy();
  }
}
