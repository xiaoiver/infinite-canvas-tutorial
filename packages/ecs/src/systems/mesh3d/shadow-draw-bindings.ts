import type {
  Bindings,
  Buffer,
  Device,
  RenderPipeline,
  Sampler,
  Texture,
} from '@infinite-canvas-tutorial/device-api';

/** Per-mesh shadow bindings reuse the model UBO already owned by MeshGPUCache. */
export class ShadowDrawBindings {
  private bindings = new Map<
    Buffer,
    { bindings: Bindings; texture: Texture; sampler: Sampler }
  >();
  private pipeline?: RenderPipeline;

  constructor(
    private readonly device: Device,
    private readonly modelBuffer: Buffer,
  ) {}

  get(
    pipeline: RenderPipeline,
    sceneBuffer: Buffer,
    texture: Texture,
    sampler: Sampler,
  ): Bindings {
    const cached = this.bindings.get(sceneBuffer);
    if (
      this.pipeline === pipeline &&
      cached?.texture === texture &&
      cached.sampler === sampler
    )
      return cached.bindings;
    const next = this.device.createBindings({
      pipeline,
      uniformBufferBindings: [
        { buffer: sceneBuffer },
        { buffer: this.modelBuffer },
      ],
      samplerBindings: [{ texture, sampler }],
    });
    if (this.pipeline !== pipeline) {
      for (const { bindings } of this.bindings.values()) bindings.destroy();
      this.bindings.clear();
    }
    if (this.pipeline === pipeline) cached?.bindings.destroy();
    this.bindings.set(sceneBuffer, { bindings: next, texture, sampler });
    this.pipeline = pipeline;
    return next;
  }

  destroy(): void {
    for (const { bindings } of this.bindings.values()) bindings.destroy();
    this.bindings.clear();
  }
}
