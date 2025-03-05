import { Canvas, Custom } from '@infinite-canvas-tutorial/core';
import {
  Bindings,
  Buffer,
  BufferUsage,
  Device,
  Format,
  RenderPipeline,
  RenderTarget,
  Texture,
  TextureDimension,
  TextureUsage,
  TransparentWhite,
} from '@antv/g-device-api';
import {
  camera,
  createBlitPipelineAndBindings,
  math,
  prelude,
  registerShaderModule,
} from './utils';
import { Effect } from './interface';
import { avg, max } from '../utils';

/**
 * WebGPU compute shader.
 */
export class GPUParticle implements Effect {
  protected canvas: Canvas;
  protected device: Device;
  protected renderTarget: RenderTarget;
  protected timeBuffer: Buffer;
  protected mouseBuffer: Buffer;
  protected screen: Texture;
  protected texture: Texture;
  protected custom: Custom;
  private blitPipeline: RenderPipeline;
  private blitBindings: Bindings;
  private resized = false;
  private inited = false;

  #frame = 0;
  #elapsed = 0;
  #mouse = {
    pos: {
      x: 0,
      y: 0,
    },
    click: 0,
  };
  #buffer: Uint8Array;

  constructor() {}

  /**
   * Register custom shader module.
   */
  protected registerShaderModule() {}

  async init(canvas: Canvas) {
    this.canvas = canvas;
    const $canvas = canvas.getDOM() as HTMLCanvasElement;
    const device = canvas.getDevice();
    this.device = device;

    const screen = device.createTexture({
      // Use F32_RGBA
      // @see https://www.w3.org/TR/webgpu/#float32-filterable
      // @see https://github.com/compute-toys/wgpu-compute-toy/blob/master/src/bind.rs#L433
      format: Format.F16_RGBA,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.STORAGE,
    });
    this.screen = screen;

    const { pipeline: blitPipeline, bindings: blitBindings } =
      createBlitPipelineAndBindings(device, screen);

    registerShaderModule(device, prelude);
    registerShaderModule(device, math);
    registerShaderModule(device, camera);

    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: $canvas.width,
      height: $canvas.height,
      dimension: TextureDimension.TEXTURE_2D,
      usage: TextureUsage.RENDER_TARGET,
    });
    const renderTarget = device.createRenderTargetFromTexture(texture);

    const timeBuffer = device.createBuffer({
      viewOrSize: 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });
    timeBuffer.setSubData(0, new Uint8Array(new Float32Array([0, 0]).buffer));
    const mouseBuffer = device.createBuffer({
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

    this.custom = new Custom({
      cullable: false,
      render: (_, uniformLegacyObject) => {
        if (!this.inited || !this.#buffer) {
          return;
        }

        const {
          device,
          timeBuffer,
          mouseBuffer,
          canvas,
          blitPipeline,
          blitBindings,
        } = this;
        const $canvas = canvas.getDOM() as HTMLCanvasElement;
        if (this.resized) {
          if (this.renderTarget) {
            this.texture.destroy();
            this.renderTarget.destroy();

            this.texture = device.createTexture({
              format: Format.U8_RGBA_NORM,
              width: $canvas.width,
              height: $canvas.height,
              dimension: TextureDimension.TEXTURE_2D,
              usage: TextureUsage.RENDER_TARGET,
            });
            this.renderTarget = device.createRenderTargetFromTexture(
              this.texture,
            );
            this.resized = false;
          }
        }

        const lowerHalfArray = this.#buffer.slice(
          0,
          this.#buffer.length / 2 - 1,
        );
        const upperHalfArray = this.#buffer.slice(
          this.#buffer.length / 2 - 1,
          this.#buffer.length - 1,
        );

        const overallAvg = avg(this.#buffer);
        const lowerMax = max(lowerHalfArray);
        const lowerAvg = avg(lowerHalfArray);
        const upperMax = max(upperHalfArray);
        const upperAvg = avg(upperHalfArray);

        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const lowerAvgFr = lowerAvg / lowerHalfArray.length;
        const upperMaxFr = upperMax / upperHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        timeBuffer.setSubData(
          0,
          new Uint8Array(new Float32Array([this.#frame, this.#elapsed]).buffer),
        );
        mouseBuffer.setSubData(
          0,
          new Uint8Array(
            new Uint32Array([
              this.#mouse.pos.x,
              this.#mouse.pos.y,
              this.#mouse.click,
            ]).buffer,
          ),
        );

        this.compute({
          lowerMaxFr,
          lowerAvgFr,
          upperMaxFr,
          upperAvgFr,
          overallAvg,
        });

        const renderPass = device.createRenderPass({
          colorAttachment: [this.renderTarget],
          colorResolveTo: [null],
          colorClearColor: [TransparentWhite],
          colorStore: [true],
          depthStencilAttachment: null,
          depthStencilResolveTo: null,
        });

        renderPass.setPipeline(blitPipeline);
        renderPass.setBindings(blitBindings);
        renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
        renderPass.draw(3);
        device.submitPass(renderPass);
      },
    });
    canvas.appendChild(this.custom);
  }

  resize(width: number, height: number) {
    this.resized = true;
  }

  /**
   * Parameter changes
   */
  update(options: any) {}

  protected compute(buffer: {}) {}

  getTexture() {
    return this.texture;
  }

  frame(frame: number, elapsed: number, mouse: any, buffer: Uint8Array) {
    this.custom.renderDirtyFlag = true;
    this.#frame = frame;
    this.#elapsed = elapsed;
    this.#mouse = mouse;
    this.#buffer = buffer;
  }

  destroy() {
    this.screen.destroy();
    this.renderTarget.destroy();
    this.timeBuffer.destroy();
    this.mouseBuffer.destroy();
    this.blitPipeline.destroy();
    this.device.destroy();
  }
}
