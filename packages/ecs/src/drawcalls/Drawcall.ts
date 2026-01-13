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
import { RenderCache, Effect, uid } from '../utils';
import { Location } from '../shaders/wireframe';
import { TexturePool } from '../resources';
import {
  ComputedBounds,
  FillGradient,
  FillImage,
  FillPattern,
  FillTexture,
  Filter,
  Wireframe,
} from '../components';
import { API } from '../API';
import { vert as postProcessingVert } from '../shaders/post-processing/fullscreen';
import { vert as bigTriangleVert } from '../shaders/post-processing/big-triangle';
import { frag as copyFrag } from '../shaders/post-processing/copy';
import { frag as noiseFrag } from '../shaders/post-processing/noise';
import { frag as brightnessFrag } from '../shaders/post-processing/brightness';
import { frag as contrastFrag } from '../shaders/post-processing/contrast';
import {
  AntialiasingMode,
  makeAttachmentClearDescriptor,
  makeBackbufferDescSimple,
  opaqueWhiteFullClearRenderPassDescriptor,
} from '../render-graph/utils';
import { RGAttachmentSlot, RGGraphBuilder } from '../render-graph/interface';

const FRAG_MAP = {
  noise: {
    shader: noiseFrag,
  },
  brightness: {
    shader: brightnessFrag,
  },
  contrast: {
    shader: contrastFrag,
  },
};

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
  #filterIndexBuffer: Buffer;
  #filterUniformBuffer: Buffer;
  #filterTexture: Texture;
  #filterRenderTarget: RenderTarget;
  #filterBindings: Bindings;
  #filterWidth: number;
  #filterHeight: number;

  #bigTriangleProgram: Program;
  #bigTrianglePipeline: RenderPipeline;
  #bigTriangleInputLayout: InputLayout;
  #bigTriangleVertexBuffer: Buffer;
  #bigTriangleTexture: Texture;
  #bigTriangleRenderTarget: RenderTarget;
  #bigTriangleBindings: Bindings;
  #bigTriangleUniformBuffer: Buffer;

  constructor(
    protected device: Device,
    protected swapChain: SwapChain,
    protected renderCache: RenderCache,
    protected texturePool: TexturePool,
    protected instanced: boolean,
    protected index: number,
    protected api: API,
  ) {}

  abstract createGeometry(): void;
  abstract createMaterial(define: string, uniformBuffer: Buffer): void;
  abstract render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
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
    builder: RGGraphBuilder,
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

    // Handle post processing effects
    const hasFilter = this.shapes[0]?.has(Filter);
    if (hasFilter) {
      const { width, height } = this.swapChain.getCanvas();
      const renderInput = {
        backbufferWidth: width,
        backbufferHeight: height,
        antialiasingMode: AntialiasingMode.None,
      };
      const mainColorDesc = makeBackbufferDescSimple(
        RGAttachmentSlot.Color0,
        renderInput,
        makeAttachmentClearDescriptor(TransparentWhite),
      );
      const mainDepthDesc = makeBackbufferDescSimple(
        RGAttachmentSlot.DepthStencil,
        renderInput,
        opaqueWhiteFullClearRenderPassDescriptor,
      );
      const mainColorTargetID = builder.createRenderTargetID(
        mainColorDesc,
        'Main Color',
      );
      const mainDepthTargetID = builder.createRenderTargetID(
        mainDepthDesc,
        'Main Depth',
      );
      // TODO: one or multiple passes per effect
      builder.pushPass((pass) => {
        pass.setDebugName('Offscreen Pass');
        pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
        pass.attachRenderTargetID(
          RGAttachmentSlot.DepthStencil,
          mainDepthTargetID,
        );
        pass.exec((renderPass) => {
          // this.render(renderPass, uniformBuffer, uniformLegacyObject);
        });
      });

      builder.pushPass((pass) => {
        const { minX, minY, maxX, maxY } =
          this.shapes[0].read(ComputedBounds).renderWorldBounds;

        const tl = this.api.canvas2Viewport({ x: minX, y: minY });
        const br = this.api.canvas2Viewport({ x: maxX, y: maxY });
      });

      // Use Sprite

      // drawcall.submit(renderPass, uniformBuffer, uniformLegacyObject);
    }

    this.render(renderPass, uniformBuffer, uniformLegacyObject);

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
    return this.shapes[0]?.hasSomeOf(
      FillImage,
      FillTexture,
      FillGradient,
      FillPattern,
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
    effects: Effect[],
    inputTexture: Texture,
    width: number,
    height: number,
  ) {
    this.#filterWidth = width;
    this.#filterHeight = height;
    this.#filterTexture = this.device.createTexture({
      format: Format.U8_RGBA_RT,
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
        glsl: postProcessingVert,
      },
      fragment: {
        glsl: copyFrag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    this.#filterUniformBuffer = this.device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * (4 * 3),
      usage: BufferUsage.UNIFORM,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    this.#filterIndexBuffer = this.device.createBuffer({
      viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.#filterVertexBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
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
      indexBufferFormat: Format.U32_R,
      program: this.#filterProgram,
    });

    this.#filterPipeline = this.device.createRenderPipeline({
      inputLayout: this.#filterInputLayout,
      program: this.#filterProgram,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
    });
    this.device.setResourceName(this.#filterPipeline, 'FilterPipeline');

    this.#filterBindings = this.renderCache.createBindings({
      pipeline: this.#filterPipeline,
      uniformBufferBindings: [
        {
          buffer: this.#filterUniformBuffer,
        },
      ],
      samplerBindings: [
        {
          texture: inputTexture,
          sampler: this.createSampler(),
        },
      ],
    });

    effects.forEach((effect) => {
      const frag = FRAG_MAP[effect.type].shader;
      const params: number[] = [];
      if (effect.type === 'drop-shadow') {
        // FIXME: color, spread, blur
        params.push(effect.x, effect.y);
      } else if (effect.type === 'fxaa') {
        params.push(0);
      } else {
        params.push(effect.value);
      }

      this.#bigTriangleUniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 4,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
      this.#bigTriangleUniformBuffer.setSubData(
        0,
        new Uint8Array(new Float32Array([...params]).buffer),
      );

      this.#bigTriangleTexture = this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      });
      this.#bigTriangleRenderTarget = this.device.createRenderTargetFromTexture(
        this.#bigTriangleTexture,
      );

      this.#bigTriangleProgram = this.renderCache.createProgram({
        vertex: {
          glsl: bigTriangleVert,
        },
        fragment: {
          glsl: frag,
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

      this.#bigTriangleBindings = this.renderCache.createBindings({
        pipeline: this.#bigTrianglePipeline,
        samplerBindings: [
          {
            texture: this.#filterTexture,
            sampler: this.createSampler(),
          },
        ],
        uniformBufferBindings: [
          {
            buffer: this.#bigTriangleUniformBuffer,
          },
        ],
      });
    });

    return {
      texture: this.#bigTriangleTexture,
    };
  }

  protected renderPostProcessing(
    x: number,
    y: number,
    width: number,
    height: number,
    widthInCanvasCoords: number,
    heightInCanvasCoords: number,
    zoomScale: number,
  ) {
    console.log('render post..');

    let resized = false;
    if (this.#filterWidth !== width || this.#filterHeight !== height) {
      this.#filterRenderTarget.destroy();
      this.#filterTexture.destroy();
      this.#filterTexture = this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      });
      this.#filterRenderTarget = this.device.createRenderTargetFromTexture(
        this.#filterTexture,
      );
      this.#bigTriangleRenderTarget.destroy();
      this.#bigTriangleTexture.destroy();
      this.#bigTriangleBindings.destroy();
      this.#bigTriangleTexture = this.device.createTexture({
        format: Format.U8_RGBA_RT,
        width,
        height,
        usage: TextureUsage.RENDER_TARGET,
      });
      this.#bigTriangleRenderTarget = this.device.createRenderTargetFromTexture(
        this.#bigTriangleTexture,
      );
      this.#bigTriangleBindings = this.renderCache.createBindings({
        pipeline: this.#bigTrianglePipeline,
        samplerBindings: [
          {
            texture: this.#filterTexture,
            sampler: this.createSampler(),
          },
        ],
        uniformBufferBindings: [
          {
            buffer: this.#bigTriangleUniformBuffer,
          },
        ],
      });
      this.#filterWidth = width;
      this.#filterHeight = height;
      resized = true;
    }

    const { width: canvasWidth, height: canvasHeight } =
      this.swapChain.getCanvas();

    const inputSize: number[] = [];
    const outputFrame: number[] = [];
    const outputTexture: number[] = [];
    inputSize[0] = canvasWidth / 2;
    inputSize[1] = canvasHeight / 2;
    inputSize[2] = 1 / inputSize[0];
    inputSize[3] = 1 / inputSize[1];

    outputFrame[0] = x;
    outputFrame[1] = y;
    outputFrame[2] = width;
    outputFrame[3] = height;

    outputTexture[0] = widthInCanvasCoords;
    outputTexture[1] = heightInCanvasCoords;
    outputTexture[2] = zoomScale;
    const buffer = [...inputSize, ...outputFrame, ...outputTexture];
    this.#filterUniformBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array([...buffer]).buffer),
    );

    this.#filterProgram.setUniformsLegacy({
      u_InputSize: inputSize,
      u_OutputFrame: outputFrame,
      u_OutputTexture: outputTexture,
    });
    const filterRenderPass = this.device.createRenderPass({
      colorAttachment: [this.#filterRenderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });

    filterRenderPass.setViewport(0, 0, width, height);
    filterRenderPass.setPipeline(this.#filterPipeline);
    filterRenderPass.setVertexInput(
      this.#filterInputLayout,
      [{ buffer: this.#filterVertexBuffer }],
      { buffer: this.#filterIndexBuffer },
    );
    filterRenderPass.setBindings(this.#filterBindings);
    filterRenderPass.drawIndexed(6, 1);
    this.device.submitPass(filterRenderPass);

    const bigTriangleRenderPass = this.device.createRenderPass({
      colorAttachment: [this.#bigTriangleRenderTarget],
      colorResolveTo: [null],
      colorClearColor: [TransparentWhite],
      colorStore: [true],
      depthStencilAttachment: null,
      depthStencilResolveTo: null,
    });
    bigTriangleRenderPass.setViewport(0, 0, width, height);
    bigTriangleRenderPass.setPipeline(this.#bigTrianglePipeline);
    bigTriangleRenderPass.setVertexInput(
      this.#bigTriangleInputLayout,
      [{ buffer: this.#bigTriangleVertexBuffer }],
      null,
    );
    bigTriangleRenderPass.setBindings(this.#bigTriangleBindings);
    bigTriangleRenderPass.draw(3);
    this.device.submitPass(bigTriangleRenderPass);

    return { resized, texture: this.#bigTriangleTexture };
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
