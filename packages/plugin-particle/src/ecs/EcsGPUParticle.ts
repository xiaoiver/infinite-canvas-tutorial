import {
  Bindings,
  Buffer,
  BufferUsage,
  ComputePass,
  Device,
  Format,
  RenderPipeline,
  RenderTarget,
  Texture,
  TextureDimension,
  TextureUsage,
  TransparentWhite,
} from '@infinite-canvas-tutorial/device-api';
import { createBlitPipelineAndBindings } from './shaderUtils';
import { avg, max } from '../math';

export interface EcsGPUParticleInit {
  device: Device;
  canvas: HTMLCanvasElement;
}

export interface EcsParticleMouse {
  pos: { x: number; y: number };
  click: number;
}

/**
 * WebGPU compute + blit for ECS / device-api canvas. No `@infinite-canvas-tutorial/core` dependency.
 * Call {@link renderFrame} each animation frame after {@link frame}.
 */
export abstract class EcsGPUParticle {
  protected device!: Device;
  protected canvas!: HTMLCanvasElement;
  protected renderTarget!: RenderTarget;
  protected timeBuffer!: Buffer;
  protected mouseBuffer!: Buffer;
  protected screen!: Texture;
  protected texture!: Texture;
  private blitPipeline!: RenderPipeline;
  private blitBindings!: Bindings;
  private resized = false;
  private inited = false;

  #frame = 0;
  #elapsed = 0;
  #mouse: EcsParticleMouse = {
    pos: { x: 0, y: 0 },
    click: 0,
  };
  #buffer: Uint8Array = new Uint8Array(0);

  protected abstract registerShaderModule(): void;

  async init(opts: EcsGPUParticleInit): Promise<void> {
    this.device = opts.device;
    this.canvas = opts.canvas;
    const $canvas = opts.canvas;

    const screen = this.device.createTexture({
      format: Format.F16_RGBA,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.STORAGE,
    });
    this.screen = screen;

    const { pipeline: blitPipeline, bindings: blitBindings } =
      createBlitPipelineAndBindings(this.device, screen);

    const texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.RENDER_TARGET,
    });
    const renderTarget = this.device.createRenderTargetFromTexture(texture);

    const timeBuffer = this.device.createBuffer({
      viewOrSize: 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });
    timeBuffer.setSubData(0, new Uint8Array(new Float32Array([0, 0]).buffer));
    const mouseBuffer = this.device.createBuffer({
      viewOrSize: 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });
    mouseBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array([0, 0, 0]).buffer),
    );

    this.timeBuffer = timeBuffer;
    this.mouseBuffer = mouseBuffer;
    this.blitPipeline = blitPipeline;
    this.blitBindings = blitBindings;
    this.renderTarget = renderTarget;
    this.texture = texture;

    this.registerShaderModule();

    this.inited = true;
  }

  /**
   * Recreate intermediate textures when the backing canvas size changes.
   */
  protected rebuildScreenAndOutput(): void {
    this.screen.destroy();
    this.texture.destroy();
    this.renderTarget.destroy();
    this.blitPipeline.destroy();

    const $canvas = this.canvas;
    const screen = this.device.createTexture({
      format: Format.F16_RGBA,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.STORAGE,
    });
    this.screen = screen;

    const { pipeline: blitPipeline, bindings: blitBindings } =
      createBlitPipelineAndBindings(this.device, screen);
    this.blitPipeline = blitPipeline;
    this.blitBindings = blitBindings;

    const texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.texture = texture;
    this.renderTarget = this.device.createRenderTargetFromTexture(texture);
  }

  resize(_width: number, _height: number): void {
    this.resized = true;
  }

  /** Upload uniforms / CPU-side state before GPU encoding (subclass). */
  protected prepareCompute(_audio: {
    lowerMaxFr: number;
    lowerAvgFr: number;
    upperMaxFr: number;
    upperAvgFr: number;
    overallAvg: number;
  }): void {}

  /** Record compute work (subclass); default is no-op. */
  protected encodeComputePasses(_pass: ComputePass): void {}

  /**
   * Subclass hook after {@link rebuildScreenAndOutput} (e.g. resize storage buffers).
   */
  protected onAfterResize(): void { }

  renderFrame(): void {
    if (!this.inited || this.#buffer.length === 0) {
      return;
    }

    const $canvas = this.canvas;
    if (this.resized) {
      this.rebuildScreenAndOutput();
      this.onAfterResize();
      this.resized = false;
    }

    /** Split FFT bins once; avoids empty halves (crash in {@link avg}/{@link max}) on tiny lengths. */
    const n = this.#buffer.length;
    const mid = Math.max(1, Math.ceil(n / 2));
    const lowerHalfArray = this.#buffer.slice(0, mid);
    const upperHalfArray = this.#buffer.slice(mid);
    const lowerLen = Math.max(1, lowerHalfArray.length);
    const upperLen = Math.max(1, upperHalfArray.length);

    const overallAvg = avg(this.#buffer);
    const lowerMax = lowerHalfArray.length ? max(lowerHalfArray) : 0;
    const lowerAvg = lowerHalfArray.length ? avg(lowerHalfArray) : 0;
    const upperMax = upperHalfArray.length ? max(upperHalfArray) : 0;
    const upperAvg = upperHalfArray.length ? avg(upperHalfArray) : 0;

    const lowerMaxFr = lowerMax / lowerLen;
    const lowerAvgFr = lowerAvg / lowerLen;
    const upperMaxFr = upperMax / upperLen;
    const upperAvgFr = upperAvg / upperLen;

    this.timeBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array([this.#frame, this.#elapsed]).buffer),
    );
    this.mouseBuffer.setSubData(
      0,
      new Uint8Array(
        new Uint32Array([
          this.#mouse.pos.x,
          this.#mouse.pos.y,
          this.#mouse.click,
        ]).buffer,
      ),
    );

    this.prepareCompute({
      lowerMaxFr,
      lowerAvgFr,
      upperMaxFr,
      upperAvgFr,
      overallAvg,
    });

    this.device.submitComputeImmediate((pass) => this.encodeComputePasses(pass));

    this.device.submitRenderPassImmediate(
      {
        colorAttachment: [this.renderTarget],
        colorResolveTo: [null],
        colorClearColor: [TransparentWhite],
        colorStore: [true],
        depthStencilAttachment: null,
        depthStencilResolveTo: null,
      },
      (renderPass) => {
        renderPass.setPipeline(this.blitPipeline);
        renderPass.setBindings(this.blitBindings);
        renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
        renderPass.draw(3);
      },
    );
  }

  getTexture(): Texture {
    return this.texture;
  }

  frame(
    frame: number,
    elapsed: number,
    mouse: EcsParticleMouse,
    buffer: Uint8Array,
  ) {
    this.#frame = frame;
    this.#elapsed = elapsed;
    this.#mouse = mouse;
    this.#buffer = buffer;
  }

  destroy(): void {
    if (!this.inited) {
      return;
    }
    this.screen.destroy();
    this.texture.destroy();
    this.renderTarget.destroy();
    this.timeBuffer.destroy();
    this.mouseBuffer.destroy();
    this.blitPipeline.destroy();
    this.inited = false;
  }
}
