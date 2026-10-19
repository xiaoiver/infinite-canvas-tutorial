import type {
  Bindings,
  Buffer,
  Device,
  RenderPipeline,
  Sampler,
  Texture,
} from '@infinite-canvas-tutorial/device-api';

/** Owned by one mesh allocation; release before its buffers and textures. */
export class MeshDrawBindings {
  private bindings?: Bindings;
  private inputs: unknown[] = [];
  private disposed = false;

  constructor(
    private readonly device: Device,
    private readonly modelBuffer: Buffer,
  ) {}

  get(
    pipeline: RenderPipeline,
    sceneBuffer: Buffer,
    sampler: Sampler,
    baseColor: Texture,
    specular: Texture,
    bump: Texture,
    environment: Texture,
    shadow0: Texture,
    shadow1: Texture,
    shadowSampler: Sampler,
    environmentBrdf: Texture,
    brdfSampler: Sampler,
  ): Bindings {
    if (this.disposed) throw new Error('Mesh draw bindings have been disposed');
    const inputs = [
      pipeline,
      sceneBuffer,
      sampler,
      baseColor,
      specular,
      bump,
      environment,
      shadow0,
      shadow1,
      shadowSampler,
      environmentBrdf,
      brdfSampler,
    ];
    if (this.bindings && inputs.every((value, i) => value === this.inputs[i]))
      return this.bindings;

    // Allocate first: a failure must leave the last complete binding retryable.
    const next = this.device.createBindings({
      pipeline,
      uniformBufferBindings: [
        { buffer: sceneBuffer },
        { buffer: this.modelBuffer },
      ],
      samplerBindings: [
        { texture: baseColor, sampler },
        { texture: specular, sampler },
        { texture: bump, sampler },
        { texture: environment, sampler },
        { texture: shadow0, sampler: shadowSampler },
        { texture: shadow1, sampler: shadowSampler },
        { texture: environmentBrdf, sampler: brdfSampler },
      ],
    });
    const previous = this.bindings;
    this.bindings = next;
    this.inputs = inputs;
    previous?.destroy();
    return next;
  }

  destroy(): void {
    this.disposed = true;
    const previous = this.bindings;
    this.bindings = undefined;
    this.inputs = [];
    previous?.destroy();
  }
}
