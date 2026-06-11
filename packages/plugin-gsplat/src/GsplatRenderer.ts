import {
  AddressMode,
  BlendFactor,
  BlendMode,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  Device,
  Format,
  InputLayout,
  PrimitiveTopology,
  Program,
  RenderPipeline,
  RenderTarget,
  Texture,
  TextureUsage,
  TransparentBlack,
  VertexStepMode,
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import { GsplatData } from './GsplatData';
import { computeCovariance3D } from './math/covariance';
import { sortByDepth } from './math/sort';
import { frag, vert } from './shaders/gsplat';

/** Floats per instance: center(3) + color(4) + covA(3) + covB(3). */
const INSTANCE_FLOATS = 13;
const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;
/** GsplatUniforms: 2 × mat4 + 1 × vec4 (std140). */
const UNIFORM_FLOATS = 16 + 16 + 4;

/** Camera matrices and target size for a single {@link GsplatRenderer.render}. */
export interface GsplatCamera {
  /** Column-major 4×4 view matrix (camera looks down `-z`). */
  viewMatrix: ArrayLike<number>;
  /** Column-major 4×4 perspective projection matrix. */
  projectionMatrix: ArrayLike<number>;
  /** Output width in pixels. */
  width: number;
  /** Output height in pixels. */
  height: number;
}

/**
 * Standalone 3D Gaussian Splatting renderer built on `device-api`.
 *
 * Renders gaussians as instanced EWA-splatted quads into an owned color
 * render target and returns the resulting texture (mirroring the
 * `@infinite-canvas-tutorial/particle` standalone-class pattern). Gaussians are
 * depth-sorted on the CPU each frame and composited back-to-front with
 * premultiplied alpha.
 *
 * Works on both WebGL2 and WebGPU because the shaders are GLSL transpiled by
 * device-api. The CPU sort path targets small/medium scenes; a WebGPU GPU
 * radix sort is planned for very large captures.
 *
 * @example
 * ```ts
 * const renderer = new GsplatRenderer(device);
 * renderer.setData(parsePly(buffer));
 * const texture = renderer.render({ viewMatrix, projectionMatrix, width, height });
 * ```
 */
export class GsplatRenderer {
  private device: Device;

  private program: Program;
  private inputLayout: InputLayout;
  private pipeline: RenderPipeline;

  private quadBuffer: Buffer;
  private indexBuffer: Buffer;
  private uniformBuffer: Buffer;

  private instanceBuffer: Buffer | null = null;
  private texture: Texture | null = null;
  private renderTarget: RenderTarget | null = null;

  private width = 0;
  private height = 0;

  private count = 0;
  /** Unsorted interleaved per-instance source data. */
  private source: Float32Array = new Float32Array(0);
  /** Reused scratch for the depth-sorted instance upload. */
  private sorted: Float32Array = new Float32Array(0);
  /** Reused scratch for sorted indices. */
  private order: Uint32Array = new Uint32Array(0);
  private uniforms = new Float32Array(UNIFORM_FLOATS);

  constructor(device: Device) {
    this.device = device;

    this.program = device.createProgram({
      vertex: { glsl: vert, entryPoint: 'main' },
      fragment: { glsl: frag, entryPoint: 'main' },
    });

    this.inputLayout = device.createInputLayout({
      vertexBufferDescriptors: [
        {
          // Per-vertex quad corner.
          arrayStride: 2 * 4,
          stepMode: VertexStepMode.VERTEX,
          attributes: [{ format: Format.F32_RG, offset: 0, shaderLocation: 0 }],
        },
        {
          // Per-instance gaussian attributes.
          arrayStride: INSTANCE_STRIDE,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            { format: Format.F32_RGB, offset: 0, shaderLocation: 1 }, // center
            { format: Format.F32_RGBA, offset: 3 * 4, shaderLocation: 2 }, // color
            { format: Format.F32_RGB, offset: 7 * 4, shaderLocation: 3 }, // covA
            { format: Format.F32_RGB, offset: 10 * 4, shaderLocation: 4 }, // covB
          ],
        },
      ],
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });

    this.pipeline = device.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_NORM],
      depthStencilAttachmentFormat: null,
      topology: PrimitiveTopology.TRIANGLES,
      megaStateDescriptor: makeMegaState({
        attachmentsState: [
          {
            channelWriteMask: ChannelWriteMask.ALL,
            // Premultiplied-alpha "over" for back-to-front compositing.
            rgbBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
            alphaBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.ONE,
              blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
            },
          },
        ],
        blendConstant: TransparentBlack,
        depthWrite: false,
        depthCompare: CompareFunction.ALWAYS,
        cullMode: CullMode.NONE,
      }),
    });

    // Quad corners in [-2, 2]; the fragment shader's gaussian cutoff trims them.
    const quad = new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]);
    this.quadBuffer = device.createBuffer({
      viewOrSize: quad,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    const indices = new Uint32Array([0, 1, 2, 2, 1, 3]);
    this.indexBuffer = device.createBuffer({
      viewOrSize: indices,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.uniformBuffer = device.createBuffer({
      viewOrSize: UNIFORM_FLOATS * 4,
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });
  }

  /** Number of gaussians currently uploaded. */
  getCount(): number {
    return this.count;
  }

  /** The most recently rendered output texture, or `null` before first render. */
  getTexture(): Texture | null {
    return this.texture;
  }

  /**
   * Upload a gaussian scene. Precomputes each gaussian's 3D covariance and packs
   * the per-instance attribute buffer (rebuilt only when the count changes).
   */
  setData(data: GsplatData): void {
    const { count, centers, scales, rotations, colors } = data;
    const source = new Float32Array(count * INSTANCE_FLOATS);

    for (let i = 0; i < count; i++) {
      const o = i * INSTANCE_FLOATS;
      source[o + 0] = centers[i * 3 + 0];
      source[o + 1] = centers[i * 3 + 1];
      source[o + 2] = centers[i * 3 + 2];

      source[o + 3] = colors[i * 4 + 0];
      source[o + 4] = colors[i * 4 + 1];
      source[o + 5] = colors[i * 4 + 2];
      source[o + 6] = colors[i * 4 + 3];

      const cov = computeCovariance3D(
        [scales[i * 3 + 0], scales[i * 3 + 1], scales[i * 3 + 2]],
        [
          rotations[i * 4 + 0],
          rotations[i * 4 + 1],
          rotations[i * 4 + 2],
          rotations[i * 4 + 3],
        ],
      );
      source[o + 7] = cov[0]; // σxx
      source[o + 8] = cov[1]; // σxy
      source[o + 9] = cov[2]; // σxz
      source[o + 10] = cov[3]; // σyy
      source[o + 11] = cov[4]; // σyz
      source[o + 12] = cov[5]; // σzz
    }

    this.count = count;
    this.source = source;
    this.sorted = new Float32Array(count * INSTANCE_FLOATS);
    this.order = new Uint32Array(count);

    this.instanceBuffer?.destroy();
    this.instanceBuffer =
      count > 0
        ? this.device.createBuffer({
            viewOrSize: count * INSTANCE_STRIDE,
            usage: BufferUsage.VERTEX,
            hint: BufferFrequencyHint.DYNAMIC,
          })
        : null;
  }

  private ensureRenderTarget(width: number, height: number): void {
    if (this.texture && this.width === width && this.height === height) {
      return;
    }
    this.renderTarget?.destroy();
    this.texture?.destroy();

    this.texture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.renderTarget = this.device.createRenderTargetFromTexture(this.texture);
    this.width = width;
    this.height = height;
  }

  /** Depth-sort the gaussians for {@link camera} and upload the instance buffer. */
  private uploadSorted(camera: GsplatCamera): void {
    if (!this.instanceBuffer || this.count === 0) {
      return;
    }
    const order = sortByDepth(
      // Centers live at the start of each interleaved instance record.
      this.extractCenters(),
      this.count,
      camera.viewMatrix,
      this.order,
    );
    const src = this.source;
    const dst = this.sorted;
    for (let i = 0; i < this.count; i++) {
      const from = order[i] * INSTANCE_FLOATS;
      const to = i * INSTANCE_FLOATS;
      for (let k = 0; k < INSTANCE_FLOATS; k++) {
        dst[to + k] = src[from + k];
      }
    }
    this.instanceBuffer.setSubData(0, new Uint8Array(dst.buffer, 0, this.count * INSTANCE_STRIDE));
  }

  private centersCache: Float32Array | null = null;
  /** View-independent centers extracted from the interleaved source (cached). */
  private extractCenters(): Float32Array {
    if (this.centersCache && this.centersCache.length === this.count * 3) {
      return this.centersCache;
    }
    const out = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      out[i * 3 + 0] = this.source[i * INSTANCE_FLOATS + 0];
      out[i * 3 + 1] = this.source[i * INSTANCE_FLOATS + 1];
      out[i * 3 + 2] = this.source[i * INSTANCE_FLOATS + 2];
    }
    this.centersCache = out;
    return out;
  }

  /**
   * Render the gaussian scene for {@link camera}.
   *
   * When {@link target} is omitted the scene is drawn into the renderer's owned
   * offscreen render target and that texture is returned (RGBA, premultiplied
   * alpha). When {@link target} is provided (e.g. a swap-chain on-screen render
   * target) the scene is drawn directly into it and `null` is returned.
   * Returns `null` when there is nothing to draw.
   */
  render(camera: GsplatCamera, target?: RenderTarget): Texture | null {
    const { width, height } = camera;
    if (width <= 0 || height <= 0 || this.count === 0) {
      return target ? null : this.texture;
    }
    if (!target) {
      this.ensureRenderTarget(width, height);
    }
    this.uploadSorted(camera);

    this.uniforms.set(camera.projectionMatrix as ArrayLike<number>, 0);
    this.uniforms.set(camera.viewMatrix as ArrayLike<number>, 16);
    this.uniforms[32] = width;
    this.uniforms[33] = height;
    this.uniforms[34] = 0;
    this.uniforms[35] = 0;
    this.uniformBuffer.setSubData(0, new Uint8Array(this.uniforms.buffer));

    const bindings = this.device.createBindings({
      pipeline: this.pipeline,
      uniformBufferBindings: [{ buffer: this.uniformBuffer }],
    });

    this.device.submitRenderPassImmediate(
      {
        colorAttachment: [target ?? this.renderTarget],
        colorResolveTo: [null],
        colorClearColor: [TransparentBlack],
        colorStore: [true],
        depthStencilAttachment: null,
        depthStencilResolveTo: null,
      },
      (renderPass) => {
        renderPass.setPipeline(this.pipeline);
        renderPass.setViewport(0, 0, width, height);
        renderPass.setBindings(bindings);
        renderPass.setVertexInput(
          this.inputLayout,
          [{ buffer: this.quadBuffer }, { buffer: this.instanceBuffer! }],
          { buffer: this.indexBuffer },
        );
        renderPass.drawIndexed(6, this.count);
      },
    );

    bindings.destroy();
    return target ? null : this.texture;
  }

  /** Release all GPU resources owned by this renderer. */
  destroy(): void {
    this.instanceBuffer?.destroy();
    this.renderTarget?.destroy();
    this.texture?.destroy();
    this.quadBuffer.destroy();
    this.indexBuffer.destroy();
    this.uniformBuffer.destroy();
    this.pipeline.destroy();
    this.inputLayout.destroy();
    this.program.destroy();
  }
}
