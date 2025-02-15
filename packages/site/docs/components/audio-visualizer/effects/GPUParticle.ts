import { Canvas, Custom } from '@infinite-canvas-tutorial/core';
import {
  Bindings,
  Buffer,
  BufferUsage,
  Device,
  Format,
  RenderPipeline,
  RenderTarget,
  SwapChain,
  Texture,
  TextureDimension,
  TextureUsage,
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
  protected swapChain: SwapChain;
  protected renderTarget: RenderTarget;
  protected timeBuffer: Buffer;
  protected mouseBuffer: Buffer;
  protected screen: Texture;
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

    const renderTarget = device.createRenderTarget({
      format: Format.U8_RGBA_RT,
      width: $canvas.width,
      height: $canvas.height,
    });

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

    this.registerShaderModule();

    this.inited = true;

    this.custom = new Custom({
      render: (renderPass, uniformLegacyObject) => {
        if (!this.inited || !this.#buffer) {
          return;
        }

        const {
          device,
          swapChain,
          timeBuffer,
          mouseBuffer,
          canvas,
          blitPipeline,
          blitBindings,
        } = this;
        const $canvas = canvas.getDOM() as HTMLCanvasElement;
        // if (this.resized) {
        //   swapChain.configureSwapChain($canvas.width, $canvas.height);
        //   if (this.renderTarget) {
        //     this.renderTarget.destroy();
        //     this.renderTarget = device.createRenderTarget({
        //       format: Format.U8_RGBA_RT,
        //       width: $canvas.width,
        //       height: $canvas.height,
        //     });
        //     this.resized = false;
        //   }
        // }

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

        renderPass.setPipeline(blitPipeline);
        renderPass.setBindings(blitBindings);
        renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
        renderPass.draw(3);
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

  frame(frame: number, elapsed: number, mouse: any, buffer: Uint8Array) {
    this.#frame = frame;
    this.#elapsed = elapsed;
    this.#mouse = mouse;
    this.#buffer = buffer;
    /**
     * An application should call getCurrentTexture() in the same task that renders to the canvas texture.
     * Otherwise, the texture could get destroyed by these steps before the application is finished rendering to it.
     */
    // const onscreenTexture = swapChain.getOnscreenTexture();
    // const renderPass = device.createRenderPass({
    //   colorAttachment: [this.renderTarget],
    //   // colorResolveTo: [onscreenTexture],
    //   colorResolveTo: [null],
    //   colorClearColor: [TransparentWhite],
    // });
    // renderPass.setPipeline(blitPipeline);
    // renderPass.setBindings(blitBindings);
    // renderPass.setViewport(0, 0, $canvas.width, $canvas.height);
    // renderPass.draw(3);

    // device.submitPass(renderPass);
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
