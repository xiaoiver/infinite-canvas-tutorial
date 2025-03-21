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
} from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import earcut from 'earcut';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/mesh';
import { isClockWise, paddingMat3, parseColor, triangulate } from '../utils';
import {
  ComputedPoints,
  Ellipse,
  FillImage,
  FillSolid,
  GlobalRenderOrder,
  GlobalTransform,
  Opacity,
  Path,
  Rect,
  Rough,
  Stroke,
  TesselationMethod,
  Circle,
  ComputedRough,
  Mat3,
} from '../components';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class Mesh extends Drawcall {
  #uniformBuffer: Buffer;
  #texture: Texture;

  points: number[] = [];

  instanced = false;

  static useDash(shape: Entity) {
    const { dasharray = [] } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { dasharray: [] };
    return dasharray[0] > 0 && dasharray[1] > 0;
  }

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    if (this.shapes[0].read(Path).d !== shape.read(Path).d) {
      return false;
    }

    const isInstanceFillImage = this.shapes[0].has(FillImage);
    const isShapeFillImage = shape.has(FillImage);

    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].read(FillImage).src === shape.read(FillImage).src;
    }

    return true;
  }

  createGeometry(): void {
    const instance = this.shapes[0];

    let rawPoints: [number, number][][];
    let tessellationMethod: TesselationMethod;

    if (instance.has(Path)) {
      rawPoints = instance.read(ComputedPoints).points;
      tessellationMethod = instance.read(Path).tessellationMethod;
    } else if (
      instance.has(Rough) &&
      instance.has(ComputedRough) &&
      instance.hasSomeOf(Circle, Ellipse, Rect, Path)
    ) {
      rawPoints = instance.read(ComputedRough).fillPathPoints;
      tessellationMethod = TesselationMethod.EARCUT;
    }

    const points = rawPoints.flat(2);

    if (points.length === 0) {
      return;
    }

    if (tessellationMethod === TesselationMethod.EARCUT) {
      let holes = [];
      let contours = [];
      const indices = [];
      let indexOffset = 0;

      let firstClockWise = isClockWise(rawPoints[0]);

      rawPoints.forEach((points) => {
        const isHole = isClockWise(points) !== firstClockWise;
        if (isHole) {
          holes.push(contours.length);
        } else {
          firstClockWise = isClockWise(points);

          if (holes.length > 0) {
            indices.push(
              ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
            );
            indexOffset += contours.length;
            holes = [];
            contours = [];
          }
        }
        contours.push(...points);
      });

      if (contours.length) {
        indices.push(
          ...earcut(contours.flat(), holes).map((i) => i + indexOffset),
        );
      }

      this.indexBufferData = new Uint32Array(indices);
      this.points = points;
      // const err = deviation(vertices, holes, dimensions, indices);
    } else if (tessellationMethod === TesselationMethod.LIBTESS) {
      const newPoints = triangulate(rawPoints, instance.read(Path).fillRule);
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

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    if (this.points.length === 0) {
      return;
    }

    this.createProgram(vert, frag, defines);
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

  render(
    renderPass: RenderPass,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.points.length === 0) {
      return;
    }

    // if (
    //   this.shapes.some((shape) => shape.renderDirtyFlag) ||
    //   this.geometryDirty
    // ) {
    const { matrix } = this.shapes[0].read(GlobalTransform);
    const [buffer, legacyObject] = this.generateBuffer(this.shapes[0]);
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

    if (this.useWireframe) {
      this.generateWireframe();
    }
    // }

    this.program.setUniformsLegacy(sceneUniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    const vertexBuffers = this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
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

  private generateBuffer(shape: Entity): [number[], Record<string, unknown>] {
    const sizeAttenuation = 0;
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: null };
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);

    const { opacity, strokeOpacity, fillOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1, fillOpacity: 1 };

    const {
      color: strokeColor,
      width,
      alignment,
    } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { color: null, width: 0, alignment: 'center' };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);

    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      Mesh.useDash(shape) ? 0 : width,
      0,
      strokeAlignmentMap[alignment],
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
