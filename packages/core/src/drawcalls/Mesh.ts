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
} from '@antv/g-device-api';
import {
  Path,
  RoughCircle,
  RoughEllipse,
  RoughPath,
  RoughRect,
  TesselationMethod,
} from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/mesh';
import { isString, paddingMat3, triangulate } from '../utils';
import earcut, { flatten } from 'earcut';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class Mesh extends Drawcall {
  #uniformBuffer: Buffer;
  #texture: Texture;

  points: number[] = [];

  static useDash(shape: Path) {
    const { strokeDasharray } = shape;
    return (
      strokeDasharray.length > 0 && strokeDasharray.some((dash) => dash > 0)
    );
  }

  validate(shape: Path) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    if ((this.shapes[0] as Path).d !== (shape as Path).d) {
      return false;
    }

    const isInstanceFillImage = !isString(this.shapes[0].fill);
    const isShapeFillImage = !isString(shape.fill);

    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].fill === shape.fill;
    }

    return true;
  }

  createGeometry(): void {
    // Don't support instanced rendering for now.
    this.instanced = false;
    const instance = this.shapes[0];

    let rawPoints: [number, number][][];
    let tessellationMethod: TesselationMethod;

    if (instance instanceof Path) {
      rawPoints = instance.points;
      tessellationMethod = instance.tessellationMethod;
    } else if (
      instance instanceof RoughCircle ||
      instance instanceof RoughEllipse ||
      instance instanceof RoughRect ||
      instance instanceof RoughPath
    ) {
      rawPoints = instance.fillPathPoints;
      tessellationMethod = TesselationMethod.EARCUT;
    }

    const points = rawPoints.flat(2);

    if (points.length === 0) {
      return;
    }

    if (tessellationMethod === TesselationMethod.EARCUT) {
      const { vertices, holes, dimensions } = flatten(rawPoints);
      const indices = earcut(vertices, holes, dimensions);
      this.indexBufferData = new Uint32Array(indices);
      this.points = points;
      // const err = deviation(vertices, holes, dimensions, indices);
    } else if (tessellationMethod === TesselationMethod.LIBTESS) {
      const newPoints = triangulate(rawPoints);
      this.indexBufferData = new Uint32Array(
        new Array(newPoints.length / 2).fill(undefined).map((_, i) => i),
      );
      this.points = newPoints;
    }

    if (this.vertexBuffers[0]) {
      this.vertexBuffers[0].destroy();
    }
    this.vertexBufferDatas[0] = new Float32Array(this.points);
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION, // a_Position
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];
  }

  createMaterial(uniformBuffer: Buffer): void {
    if (this.points.length === 0) {
      return;
    }

    let defines = '';
    if (this.useFillImage) {
      defines += '#define USE_FILLIMAGE\n';
    }
    if (this.useWireframe) {
      defines += '#define USE_WIREFRAME\n';
    }

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

    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: this.vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });
    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
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
    this.device.setResourceName(this.pipeline, 'MeshPipeline');

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

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (this.points.length === 0) {
      return;
    }

    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      const { worldTransform } = this.shapes[0];
      const [buffer, legacyObject] = this.generateBuffer(
        this.shapes[0] as Path,
      );
      const u_ModelMatrix = worldTransform.toArray(true);
      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([...paddingMat3(u_ModelMatrix), ...buffer]).buffer,
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

      if (this.useWireframe) {
        this.generateWireframe();
      }
    }

    this.program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexInput(
      this.inputLayout,
      this.vertexBuffers.map((buffer) => ({ buffer })),
      {
        buffer: this.indexBuffer,
      },
    );
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(this.indexBufferData.length, this.shapes.length);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }
  }

  private generateBuffer(shape: Path): [number[], Record<string, unknown>] {
    const {
      fillRGB,
      strokeRGB: { r: sr, g: sg, b: sb, opacity: so },
      strokeWidth,
      strokeAlignment,
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation,
    } = shape;

    const { r: fr, g: fg, b: fb, opacity: fo } = fillRGB || {};

    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      Mesh.useDash(shape) ? 0 : strokeWidth,
      0,
      strokeAlignmentMap[strokeAlignment],
    ];
    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation ? 1 : 0,
    ];

    return [
      [...u_FillColor, ...u_StrokeColor, ...u_ZIndexStrokeWidth, ...u_Opacity],
      {
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
      },
    ];
  }
}
