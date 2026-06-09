import type {
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

class NodeLayerBlendCompositor {
  #ubuf;
  #vb;
  #sampler;
  #pipBlend;
  #ilBlend;
  #compositeBindings: ReturnType<RenderCache['createBindings']> | null = null;
  #compositeBindingsKey = '';

  constructor(
    private device: Device,
    private renderCache: RenderCache,
  ) {
    const diagnosticDerivativeUniformityHeader =
      device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    const progBlend = renderCache.createProgram({
      vertex: { glsl: composeVert },
      fragment: {
        glsl: fragBlendLayer,
        postprocess: (fs: string) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

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

    this.#ubuf = device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
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

  composite(
    renderPass: RenderPass,
    backdrop: Texture,
    src: Texture,
    blendMode: FillLayerBlendMode | undefined,
    width: number,
    height: number,
  ): void {
    const d = new Float32Array(4);
    d[0] = fillLayerBlendModeToIndex(blendMode);
    d[1] = 1;
    this.#ubuf.setSubData(0, new Uint8Array(d.buffer));

    const bindingsKey = `${backdrop.id}:${src.id}:${d[0]}`;
    if (this.#compositeBindingsKey !== bindingsKey) {
      this.#compositeBindings?.destroy();
      this.#compositeBindings = this.renderCache.createBindings({
        pipeline: this.#pipBlend,
        uniformBufferBindings: [{ buffer: this.#ubuf }],
        samplerBindings: [
          { texture: backdrop, sampler: this.#sampler },
          { texture: src, sampler: this.#sampler },
        ],
      });
      this.#compositeBindingsKey = bindingsKey;
    }

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
    this.#ubuf.destroy();
    this.#vb.destroy();
  }
}

const compositorByDevice = new WeakMap<Device, NodeLayerBlendCompositor>();

function getCompositor(
  device: Device,
  renderCache: RenderCache,
): NodeLayerBlendCompositor {
  let c = compositorByDevice.get(device);
  if (!c) {
    c = new NodeLayerBlendCompositor(device, renderCache);
    compositorByDevice.set(device, c);
  }
  return c;
}

export function compositeNodeLayerBlendOnRenderPass(
  renderPass: RenderPass,
  device: Device,
  renderCache: RenderCache,
  backdrop: Texture,
  src: Texture,
  blendMode: FillLayerBlendMode | undefined,
  width: number,
  height: number,
): void {
  getCompositor(device, renderCache).composite(
    renderPass,
    backdrop,
    src,
    blendMode,
    width,
    height,
  );
}
