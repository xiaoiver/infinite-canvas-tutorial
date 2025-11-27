import {
  Buffer,
  Device,
  InputLayoutBufferDescriptor,
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
  TextureUsage,
  TransparentWhite,
} from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import { RenderCache, uid } from '../utils';
import { Location } from '../shaders/wireframe';
import { TexturePool } from '../resources';
import {
  FillGradient,
  FillImage,
  FillPattern,
  FillTexture,
  Filter,
  Rect,
  Wireframe,
} from '../components';

// TODO: Use a more efficient way to manage Z index.
export const ZINDEX_FACTOR = 100000;

export abstract class Drawcall {
  uid = uid();

  shapes: Entity[] = [];

  /**
   * Create a new batch if the number of instances exceeds.
   */
  protected maxInstances = Infinity;

  geometryDirty = true;
  materialDirty = true;
  destroyed = false;

  protected program: Program;
  protected pipeline: RenderPipeline;
  protected inputLayout: InputLayout;
  protected bindings: Bindings;

  protected indexBuffer: Buffer;
  protected indexBufferData: Uint32Array;

  protected vertexBuffers: Buffer[] = [];
  protected vertexBufferDatas: Float32Array[] = [];
  protected vertexBufferOffsets: number[] = [];
  protected vertexBufferDescriptors: InputLayoutBufferDescriptor[];

  protected barycentricBuffer: Buffer;
  protected barycentricBufferDescriptor: InputLayoutBufferDescriptor = {
    arrayStride: 4 * 3,
    stepMode: VertexStepMode.VERTEX,
    attributes: [
      {
        shaderLocation: Location.BARYCENTRIC, // a_Barycentric
        offset: 0,
        format: Format.F32_RGB,
      },
    ],
  };

  #filterProgram: Program;
  #filterPipeline: RenderPipeline;
  #filterInputLayout: InputLayout;
  #filterVertexBuffer: Buffer;
  #filterTexture: Texture;
  #filterRenderTarget: RenderTarget;
  #filterBindings: Bindings;
  #filterTextureWidth: number;
  #filterTextureHeight: number;
  // #inputTexture: Texture;
  // #inputRenderTarget: RenderTarget;

  constructor(
    protected device: Device,
    protected swapChain: SwapChain,
    protected renderCache: RenderCache,
    protected texturePool: TexturePool,
    protected instanced: boolean,
    protected index: number,
  ) {}

  abstract createGeometry(): void;
  abstract createMaterial(define: string, uniformBuffer: Buffer): void;
  abstract render(
    renderPass: RenderPass,
    uniformLegacyObject: Record<string, unknown>,
  ): void;

  destroy() {
    if (this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
      this.vertexBufferDatas = [];
      this.vertexBufferDescriptors = [];
    }
    this.destroyed = true;
  }

  validate(shape: Entity) {
    if (
      (this.shapes[0]?.has(Wireframe) &&
        this.shapes[0]?.read(Wireframe).enabled) !==
      (shape.has(Wireframe) && shape.read(Wireframe).enabled)
    ) {
      return false;
    }

    return this.count() <= this.maxInstances - 1;
  }

  submit(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.geometryDirty) {
      this.createGeometry();
    }

    if (this.materialDirty) {
      let defines = '';
      if (this.instanced) {
        defines += '#define USE_INSTANCES\n';
      }
      if (this.useFillImage) {
        defines += '#define USE_FILLIMAGE\n';
      }
      if (this.useWireframe) {
        defines += '#define USE_WIREFRAME\n';
      }
      this.createMaterial(defines, uniformBuffer);
    }

    this.render(renderPass, uniformLegacyObject);

    if (this.geometryDirty) {
      this.geometryDirty = false;
    }

    if (this.materialDirty) {
      this.materialDirty = false;
    }
  }

  add(shape: Entity) {
    if (!this.shapes.includes(shape)) {
      this.shapes.push(shape);
      this.geometryDirty = true;
    }
  }

  remove(shape: Entity) {
    if (this.shapes.includes(shape)) {
      const index = this.shapes.indexOf(shape);
      this.shapes.splice(index, 1);
      this.geometryDirty = true;
    }
  }

  count() {
    return this.shapes.length;
  }

  protected get useWireframe() {
    return (
      this.shapes[0]?.has(Wireframe) && this.shapes[0]?.read(Wireframe).enabled
    );
  }

  protected get useFillImage() {
    return (
      this.shapes[0]?.hasSomeOf(
        FillImage,
        FillTexture,
        FillGradient,
        FillPattern,
      ) || this.shapes[0]?.has(Filter)
    );
  }

  protected createProgram(vert: string, frag: string, defines: string) {
    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    const vertexBufferDescriptors = this.vertexBufferDescriptors;
    if (this.useWireframe) {
      vertexBufferDescriptors.push(this.barycentricBufferDescriptor);
    }
    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });
  }

  protected generateWireframe() {
    const indiceNum = this.indexBufferData.length;
    const originalVertexBuffers = this.vertexBufferDatas.map((buffer) => {
      return buffer.slice();
    });

    for (let i = 0; i < this.vertexBufferDatas.length; i++) {
      const { arrayStride, stepMode } = this.vertexBufferDescriptors[i];
      if (stepMode === VertexStepMode.VERTEX) {
        this.vertexBufferDatas[i] = new Float32Array(
          (arrayStride / Float32Array.BYTES_PER_ELEMENT) * indiceNum,
        );
      } else {
        this.vertexBufferDatas[i] = originalVertexBuffers[i];
      }
    }

    // reallocate attribute data
    let cursor = 0;
    const uniqueIndices = new Uint32Array(indiceNum);
    for (let i = 0; i < indiceNum; i++) {
      const ii = this.indexBufferData[i];
      for (let j = 0; j < this.vertexBufferDatas.length; j++) {
        const { arrayStride, stepMode } = this.vertexBufferDescriptors[j];

        if (stepMode === VertexStepMode.VERTEX) {
          const size = arrayStride / Float32Array.BYTES_PER_ELEMENT;
          for (let k = 0; k < size; k++) {
            this.vertexBufferDatas[j][cursor * size + k] =
              originalVertexBuffers[j][ii * size + k];
          }
        }
      }
      uniqueIndices[i] = cursor;
      cursor++;
    }

    for (let i = 0; i < this.vertexBuffers.length; i++) {
      this.vertexBuffers[i].destroy();
      this.vertexBuffers[i] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[i],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    // create barycentric attributes
    const barycentricBufferData = new Float32Array(indiceNum * 3);
    for (let i = 0; i < indiceNum; ) {
      for (let j = 0; j < 3; j++) {
        const ii = uniqueIndices[i++];
        barycentricBufferData[ii * 3 + j] = 1;
      }
    }

    this.barycentricBuffer = this.device.createBuffer({
      viewOrSize: barycentricBufferData,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: uniqueIndices,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
  }

  protected createPostProcessing(
    vert: string,
    frag: string,
    inputTexture: Texture,
    width: number,
    height: number,
  ) {
    this.#filterTextureWidth = width;
    this.#filterTextureHeight = height;
    this.#filterTexture = this.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    this.#filterRenderTarget = this.device.createRenderTargetFromTexture(
      this.#filterTexture,
    );

    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.#filterProgram = this.renderCache.createProgram({
      vertex: {
        glsl: vert,
      },
      fragment: {
        glsl: frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.#filterVertexBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#filterInputLayout = this.device.createInputLayout({
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
      program: this.#filterProgram,
    });

    this.#filterPipeline = this.device.createRenderPipeline({
      inputLayout: this.#filterInputLayout,
      program: this.#filterProgram,
      colorAttachmentFormats: [Format.U8_RGBA_NORM],
    });

    this.#filterBindings = this.renderCache.createBindings({
      pipeline: this.#filterPipeline,
      samplerBindings: [
        {
          texture: inputTexture,
          sampler: this.createSampler(),
        },
      ],
    });

    return {
      texture: this.#filterTexture,
      renderTarget: this.#filterRenderTarget,
    };
  }

  protected renderPostProcessing() {
    const filterRenderPass = this.device.createRenderPass({
      colorAttachment: [this.#filterRenderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });
    // this.program.setUniformsLegacy(sceneUniformLegacyObject);
    filterRenderPass.setViewport(
      0,
      0,
      this.#filterTextureWidth,
      this.#filterTextureHeight,
    );
    filterRenderPass.setPipeline(this.#filterPipeline);
    filterRenderPass.setVertexInput(
      this.#filterInputLayout,
      [{ buffer: this.#filterVertexBuffer }],
      null,
    );
    filterRenderPass.setBindings(this.#filterBindings);
    filterRenderPass.draw(3);
    this.device.submitPass(filterRenderPass);
  }

  protected createSampler() {
    return this.renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.POINT,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });
  }
}
