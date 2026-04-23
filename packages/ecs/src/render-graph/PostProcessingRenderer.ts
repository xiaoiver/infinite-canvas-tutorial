import { vert as bigTriangleVert } from '../shaders/post-processing/big-triangle';
import * as postProcessingShaders from '../shaders/post-processing';
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
} from '@infinite-canvas-tutorial/device-api';
import {
  Effect,
  crtUniformValues,
  flutedGlassUniformValues,
  tsunamiUniformValues,
  halftoneDotsUniformValues,
  vignetteUniformValues,
  asciiUniformValues,
  glitchUniformValues,
  liquidGlassUniformValues,
  RenderCache,
} from '../utils';

/**
 * Use big triangle to render post processing effects.
 *
 * @see https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
 */

export class PostProcessingRenderer {
  #bigTriangleProgram: Program;
  #bigTrianglePipeline: RenderPipeline;
  #bigTriangleInputLayout: InputLayout;
  #bigTriangleVertexBuffer: Buffer;
  #bigTriangleTexture: Texture;
  #bigTriangleRenderTarget: RenderTarget;
  #bigTriangleBindings: Bindings;
  #bigTriangleUniformBuffer: Buffer;

  constructor(
    private readonly device: Device,
    private readonly swapChain: SwapChain,
    private readonly renderCache: RenderCache,
  ) { }

  render(renderPass: RenderPass, texture: Texture, effect: Effect) {
    if (!this.#bigTriangleProgram) {
      this.#bigTriangleUniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 36,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      const diagnosticDerivativeUniformityHeader =
        this.device.queryVendorInfo().platformString === 'WebGPU'
          ? 'diagnostic(off,derivative_uniformity);\n'
          : '';

      this.#bigTriangleProgram = this.renderCache.createProgram({
        vertex: {
          glsl: bigTriangleVert,
        },
        fragment: {
          glsl: postProcessingShaders[effect.type],
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
        uniformBufferBindings: [
          {
            buffer: this.#bigTriangleUniformBuffer,
          },
        ],
      });
    }

    const uniformLegacyObject: Record<string, unknown> = {};
    const uniformBuffer: number[] = [];
    if (effect.type === 'noise') {
      uniformLegacyObject.u_Noise = effect.value;
      uniformBuffer.push(effect.value);
    } else if (effect.type === 'brightness') {
      uniformLegacyObject.u_BrightnessContrast = [
        effect.value,
        0,
        0,
        0,
      ];
      uniformBuffer.push(effect.value, 0, 0, 0);
    } else if (effect.type === 'contrast') {
      uniformLegacyObject.u_BrightnessContrast = [
        0,
        effect.value,
        0,
        0,
      ];
      uniformBuffer.push(0, effect.value, 0, 0);
    } else if (effect.type === 'hueSaturation') {
      uniformLegacyObject.u_HueSaturation = [
        effect.hue,
        effect.saturation,
        0,
        0,
      ];
      uniformBuffer.push(effect.hue, effect.saturation, 0, 0);
    } else if (effect.type === 'pixelate') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
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
      uniformLegacyObject.u_Pixelate = [bw, bh, tw, th];
      uniformBuffer.push(bw, bh, tw, th);
    } else if (effect.type === 'dot') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      const a = Number.isFinite(effect.angle) ? effect.angle : 5;
      const sc = Number.isFinite(effect.scale) ? effect.scale : 1;
      const g = effect.grayscale > 0.5 ? 1 : 0;
      uniformLegacyObject.u_Dot = [a, sc, g, 0];
      uniformLegacyObject.u_InputSize = [tw, th, 0, 0];
      uniformBuffer.push(a, sc, g, 0, tw, th, 0, 0);
    } else if (effect.type === 'colorHalftone') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
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
      uniformLegacyObject.u_CH0 = [cx, cy, angle, scale];
      uniformLegacyObject.u_CH1 = [tw, th, 0, 0];
      uniformBuffer.push(cx, cy, angle, scale, tw, th, 0, 0);
    } else if (effect.type === 'halftoneDots') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...halftoneDotsUniformValues(effect, tw, th));
    } else if (effect.type === 'flutedGlass') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...flutedGlassUniformValues(effect, tw, th));
    } else if (effect.type === 'tsunami') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...tsunamiUniformValues(effect, tw, th));
    } else if (effect.type === 'crt') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...crtUniformValues(effect, tw, th));
    } else if (effect.type === 'vignette') {
      const u = vignetteUniformValues(effect);
      uniformLegacyObject.u_Vignette = u;
      uniformBuffer.push(...u);
    } else if (effect.type === 'ascii') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...asciiUniformValues(effect, tw, th));
    } else if (effect.type === 'glitch') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...glitchUniformValues(effect, tw, th));
    } else if (effect.type === 'liquidGlass') {
      const { width, height } = this.swapChain.getCanvas();
      const tw = Math.max(1, width);
      const th = Math.max(1, height);
      uniformBuffer.push(...liquidGlassUniformValues(effect, tw, th));
    } else if (effect.type === 'adjustment') {
      uniformLegacyObject.u_Gamma = effect.gamma;
      uniformLegacyObject.u_Contrast = effect.contrast;
      uniformLegacyObject.u_Saturation = effect.saturation;
      uniformLegacyObject.u_Brightness = effect.brightness;
      uniformLegacyObject.u_Color = [
        effect.red,
        effect.green,
        effect.blue,
        effect.alpha,
      ];
      uniformBuffer.push(
        effect.gamma,
        effect.contrast,
        effect.saturation,
        effect.brightness,
        effect.red,
        effect.green,
        effect.blue,
        effect.alpha,
      );
    }

    this.#bigTriangleUniformBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array(uniformBuffer).buffer),
    );
    this.#bigTriangleProgram.setUniformsLegacy(uniformLegacyObject);

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
