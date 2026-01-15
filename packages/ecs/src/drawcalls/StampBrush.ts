import {
  type RenderPass,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  VertexStepMode,
  CompareFunction,
  BindingsDescriptor,
  TransparentBlack,
  Texture,
  StencilOp,
  PrimitiveTopology,
  TextureUsage,
  MipmapFilterMode,
  FilterMode,
  AddressMode,
} from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/brush';
import { distanceBetweenPoints, paddingMat3, parseColor } from '../utils';
import {
  FillImage,
  GlobalRenderOrder,
  GlobalTransform,
  Opacity,
  Stroke,
  Mat3,
  Brush,
  StampMode,
} from '../components';

const brushTypeMap = {
  vanilla: 0,
  stamp: 1,
} as const;

export class StampBrush extends Drawcall {
  #uniformBuffer: Buffer;
  #vertexNumBuffer: Buffer;
  #segmentsBuffer: Buffer;
  #texture: Texture;

  instanced = false;
  pointsBuffer: number[] = [];

  get instanceCount() {
    const instance = this.shapes[0];
    const { points } = instance.read(Brush);
    return points.length;
  }

  validate(_: Entity) {
    return true;
  }

  createGeometry(): void {
    const indices: number[] = [0, 1, 2, 0, 2, 3];
    const pointsBuffer: number[] = [];
    let offset = 0;
    let sumLength = 0;
    this.shapes.forEach((shape) => {
      const { points } = shape.read(Brush);
      points.forEach((point, i) => {
        if (i > 0) {
          sumLength += distanceBetweenPoints(
            points[i - 1].x,
            points[i - 1].y,
            point.x,
            point.y,
          );
        }
        pointsBuffer.push(point.x, point.y, point.radius, sumLength);
      });

      indices.push(
        0 + offset,
        1 + offset,
        2 + offset,
        0 + offset,
        2 + offset,
        3 + offset,
      );
      offset += 4;
    });

    this.indexBufferData = new Uint32Array(indices);
    this.pointsBuffer = pointsBuffer;

    if (this.#segmentsBuffer) {
      this.#segmentsBuffer.destroy();
    }
    this.#segmentsBuffer = this.device.createBuffer({
      viewOrSize:
        Float32Array.BYTES_PER_ELEMENT *
        6 *
        this.instanceCount *
        this.shapes.length,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.#vertexNumBuffer) {
      this.#vertexNumBuffer.destroy();
    }
    this.#vertexNumBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([0, 1, 2, 3]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.#segmentsBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array(this.pointsBuffer).buffer),
    );

    this.vertexBufferOffsets = [0, 4 * 4, 0];
    this.vertexBuffers = [
      this.#segmentsBuffer,
      this.#segmentsBuffer,
      this.#vertexNumBuffer,
    ];
    this.vertexBufferDatas = [
      new Float32Array(this.pointsBuffer),
      new Float32Array(this.pointsBuffer),
      new Float32Array([0, 1, 2, 3]),
    ];

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 4,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RGBA,
            offset: 4 * 0,
            shaderLocation: Location.POINTA,
          },
        ],
      },
      {
        arrayStride: 4 * 4,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RGBA,
            offset: 4 * 0,
            shaderLocation: Location.POINTB,
          },
        ],
      },
      {
        arrayStride: 4 * 1,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            format: Format.F32_R,
            offset: 4 * 0,
            shaderLocation: Location.VERTEX_NUM,
          },
        ],
      },
    ];

    if (!this.indexBuffer) {
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: this.indexBufferData,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    const instance = this.shapes[0];
    const { points } = instance.read(Brush);
    if (points.length === 0) {
      return;
    }

    this.createProgram(vert, frag, defines);
    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      topology: PrimitiveTopology.TRIANGLES,
      megaStateDescriptor: {
        attachmentsState: [
          {
            channelWriteMask: ChannelWriteMask.ALL,
            rgbBlendState: {
              blendMode: BlendMode.ADD,
              blendSrcFactor: BlendFactor.SRC_ALPHA,
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
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
        stencilWrite: false,
        stencilFront: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
        stencilBack: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
      },
    });
    this.device.setResourceName(this.pipeline, 'BrushPipeline');

    const bindings: BindingsDescriptor = {
      pipeline: this.pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
        {
          buffer: this.#uniformBuffer,
        },
      ],
    };

    if (this.useFillImage) {
      if (this.bindings) {
        this.bindings.destroy();
      }

      const instance = this.shapes[0];

      if (instance.has(FillImage)) {
        const src = instance.read(FillImage).src as ImageBitmap;
        const texture = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: src.width,
          height: src.height,
          usage: TextureUsage.SAMPLED,
        });
        texture.setImageData([src]);
        this.#texture = texture;
      }

      const sampler = this.renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
      bindings.samplerBindings = [
        {
          texture: this.#texture,
          sampler,
        },
      ];
    }

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    const instance = this.shapes[0];
    const { points } = instance.read(Brush);
    if (points.length === 0) {
      return;
    }

    const { matrix } = this.shapes[0].read(GlobalTransform);
    const [buffer, legacyObject] = this.generateBuffer(instance);
    const u_ModelMatrix = [
      matrix.m00,
      matrix.m01,
      matrix.m02,
      matrix.m10,
      matrix.m11,
      matrix.m12,
      matrix.m20,
      matrix.m21,
      matrix.m22,
    ] as mat3;
    this.#uniformBuffer.setSubData(
      0,
      new Uint8Array(
        new Float32Array([
          ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
          ...buffer,
        ]).buffer,
      ),
    );
    const uniformLegacyObject: Record<string, unknown> = {
      u_ModelMatrix,
      ...legacyObject,
    };
    if (this.useFillImage) {
      uniformLegacyObject.u_FillImage = this.#texture;
    }
    this.program.setUniformsLegacy(uniformLegacyObject);

    if (this.useWireframe && this.geometryDirty) {
      this.generateWireframe();
    }

    this.program.setUniformsLegacy(sceneUniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    const vertexBuffers = this.vertexBuffers.map((buffer, index) => ({
      buffer,
      offset: this.vertexBufferOffsets[index],
    }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer, offset: 0 });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(6, this.instanceCount);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }
  }

  private generateBuffer(shape: Entity): [number[], Record<string, unknown>] {
    const {
      type,
      stampInterval,
      stampMode,
      stampNoiseFactor,
      stampRotationFactor,
    } = shape.read(Brush);
    const brushType = brushTypeMap[type];

    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    const { opacity, strokeOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1 };

    const { color: strokeColor, width } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { color: null, width: 0 };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);

    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      width,
      brushType,
      0,
    ];
    const u_Opacity = [opacity, 0, strokeOpacity, 0];
    const u_Stamp = [
      stampInterval,
      stampNoiseFactor,
      stampRotationFactor,
      stampMode === StampMode.EQUI_DISTANCE ? 0 : 1,
    ];

    return [
      [...u_StrokeColor, ...u_ZIndexStrokeWidth, ...u_Opacity, ...u_Stamp],
      {
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_Stamp,
      },
    ];
  }
}
