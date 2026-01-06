import { vert as bigTriangleVert } from '../shaders/post-processing/big-triangle';
import { frag as fxaaFrag } from '../shaders/post-processing/fxaa';
// import { frag as giFrag } from '../shaders/post-processing/gi';
import {
  Buffer,
  Device,
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
  MipmapFilterMode,
  AddressMode,
  FilterMode,
} from '@antv/g-device-api';
import { RenderCache } from '../utils';
import { TexturePool } from '../resources';
import { API } from '..';

export class PostProcessingRenderer {
  #bigTriangleProgram: Program;
  #bigTrianglePipeline: RenderPipeline;
  #bigTriangleInputLayout: InputLayout;
  #bigTriangleVertexBuffer: Buffer;
  #bigTriangleTexture: Texture;
  #bigTriangleRenderTarget: RenderTarget;
  #bigTriangleBindings: Bindings;
  // #bigTriangleUniformBuffer: Buffer;

  constructor(
    private readonly device: Device,
    private readonly swapChain: SwapChain,
    private readonly renderCache: RenderCache,
    private readonly texturePool: TexturePool,
    private readonly api: API,
  ) {}

  render(renderPass: RenderPass, texture: Texture) {
    if (!this.#bigTriangleProgram) {
      // this.#bigTriangleUniformBuffer = this.device.createBuffer({
      //   viewOrSize: Float32Array.BYTES_PER_ELEMENT * (4 * 3),
      //   usage: BufferUsage.UNIFORM,
      //   hint: BufferFrequencyHint.DYNAMIC,
      // });

      const diagnosticDerivativeUniformityHeader =
        this.device.queryVendorInfo().platformString === 'WebGPU'
          ? 'diagnostic(off,derivative_uniformity);\n'
          : '';

      this.#bigTriangleProgram = this.renderCache.createProgram({
        vertex: {
          glsl: bigTriangleVert,
        },
        fragment: {
          glsl: fxaaFrag,
          postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
        },
      });

      this.#bigTriangleVertexBuffer = this.device.createBuffer({
        viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      this.#bigTriangleInputLayout = this.device.createInputLayout({
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
        program: this.#bigTriangleProgram,
      });

      this.#bigTrianglePipeline = this.device.createRenderPipeline({
        inputLayout: this.#bigTriangleInputLayout,
        program: this.#bigTriangleProgram,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
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

      this.#bigTriangleBindings = this.renderCache.createBindings({
        pipeline: this.#bigTrianglePipeline,
        samplerBindings: [
          {
            texture,
            sampler,
          },
        ],
        // uniformBufferBindings: [
        //   {
        //     buffer: this.#bigTriangleUniformBuffer,
        //   },
        // ],
      });
    }

    const { width, height } = this.swapChain.getCanvas();
    renderPass.setViewport(0, 0, width, height);
    renderPass.setPipeline(this.#bigTrianglePipeline);
    renderPass.setVertexInput(
      this.#bigTriangleInputLayout,
      [{ buffer: this.#bigTriangleVertexBuffer }],
      null,
    );
    renderPass.setBindings(this.#bigTriangleBindings);
    renderPass.draw(3);
  }

  destroy(): void {
    this.#bigTriangleProgram?.destroy();
    this.#bigTriangleVertexBuffer?.destroy();
    this.#bigTriangleInputLayout?.destroy();
    this.#bigTrianglePipeline?.destroy();
    this.#bigTriangleBindings?.destroy();
    this.#bigTriangleRenderTarget?.destroy();
    this.#bigTriangleTexture?.destroy();
  }
}
