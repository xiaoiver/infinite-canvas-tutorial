import type {
  Bindings,
  Buffer,
  Device,
  RenderPipeline,
} from '@infinite-canvas-tutorial/device-api';

/** Per-mesh shadow bindings reuse the model UBO already owned by MeshGPUCache. */
export class ShadowDrawBindings {
  private bindings = new Map<Buffer, Bindings>();
  private pipeline?: RenderPipeline;

  constructor(
    private readonly device: Device,
    private readonly modelBuffer: Buffer,
  ) {}

  get(pipeline: RenderPipeline, sceneBuffer: Buffer): Bindings {
    if (this.pipeline === pipeline && this.bindings.has(sceneBuffer))
      return this.bindings.get(sceneBuffer)!;
    const next = this.device.createBindings({
      pipeline,
      uniformBufferBindings: [
        { buffer: sceneBuffer },
        { buffer: this.modelBuffer },
      ],
      samplerBindings: [],
    });
    if (this.pipeline !== pipeline) {
      for (const bindings of this.bindings.values()) bindings.destroy();
      this.bindings.clear();
    }
    this.bindings.set(sceneBuffer, next);
    this.pipeline = pipeline;
    return next;
  }

  destroy(): void {
    for (const bindings of this.bindings.values()) bindings.destroy();
    this.bindings.clear();
  }
}
