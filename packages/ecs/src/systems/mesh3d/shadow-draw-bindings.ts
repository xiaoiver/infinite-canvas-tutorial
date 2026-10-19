import type { Bindings, Buffer, Device, RenderPipeline } from '@infinite-canvas-tutorial/device-api';

/** Per-mesh shadow bindings reuse the model UBO already owned by MeshGPUCache. */
export class ShadowDrawBindings {
  private bindings?: Bindings;
  private pipeline?: RenderPipeline;
  private sceneBuffer?: Buffer;

  constructor(private readonly device: Device, private readonly modelBuffer: Buffer) {}

  get(pipeline: RenderPipeline, sceneBuffer: Buffer): Bindings {
    if (this.bindings && this.pipeline === pipeline && this.sceneBuffer === sceneBuffer)
      return this.bindings;
    const next = this.device.createBindings({
      pipeline,
      uniformBufferBindings: [{ buffer: sceneBuffer }, { buffer: this.modelBuffer }],
      samplerBindings: [],
    });
    this.bindings?.destroy();
    this.bindings = next;
    this.pipeline = pipeline;
    this.sceneBuffer = sceneBuffer;
    return next;
  }

  destroy(): void {
    this.bindings?.destroy();
    this.bindings = undefined;
  }
}
