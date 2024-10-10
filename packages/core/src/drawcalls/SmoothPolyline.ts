import {
  type RenderPass,
  Bindings,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  InputLayout,
  RenderPipeline,
  VertexStepMode,
  Program,
  CompareFunction,
  TransparentBlack,
  InputLayoutBufferDescriptor,
  StencilOp,
} from '@antv/g-device-api';
import { Polyline, Shape } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location, JointType } from '../shaders/polyline';
import { paddingMat3 } from '../utils';

const stridePoints = 2;
const strideFloats = 3;
const strokeAlignmentMap = {
  inner: 0,
  center: 0.5,
  outer: 1,
} as const;

export class SmoothPolyline extends Drawcall {
  static check(shape: Shape) {
    return (
      shape instanceof Polyline
      // || (shape instanceof Rect && shape.strokeDasharray.length > 0)
    );
  }

  #program: Program;
  #vertexNumBuffer: Buffer;
  #travelBuffer: Buffer;
  #segmentsBuffer: Buffer;
  #instancedBuffer: Buffer;
  #instancedMatrixBuffer: Buffer;
  #indexBuffer: Buffer;
  #uniformBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;

  get instanceCount() {
    return (this.shapes[0] as Polyline).points.length;
  }

  createGeometry(): void {
    // Don't support instanced rendering for now.
    this.instanced = false;

    if (this.#segmentsBuffer) {
      this.#segmentsBuffer.destroy();
    }
    this.#segmentsBuffer = this.device.createBuffer({
      viewOrSize:
        Float32Array.BYTES_PER_ELEMENT *
        15 *
        this.instanceCount *
        this.shapes.length,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.#vertexNumBuffer) {
      this.#vertexNumBuffer.destroy();
    }
    this.#vertexNumBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.#travelBuffer) {
      this.#travelBuffer.destroy();
    }
    this.#travelBuffer = this.device.createBuffer({
      viewOrSize: Float32Array.BYTES_PER_ELEMENT * this.instanceCount,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
  }

  createMaterial(uniformBuffer: Buffer): void {
    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }

    if (this.#program) {
      this.#program.destroy();
      this.#inputLayout.destroy();
      this.#pipeline.destroy();
    }

    this.#program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
      },
    });

    const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RG,
            offset: 4 * 0,
            shaderLocation: Location.PREV,
          },
          {
            format: Format.F32_RG,
            offset: 4 * 3,
            shaderLocation: Location.POINTA,
          },
          {
            format: Format.F32_R,
            offset: 4 * 5,
            shaderLocation: Location.VERTEX_JOINT,
          },
          {
            format: Format.F32_RG,
            offset: 4 * 6,
            shaderLocation: Location.POINTB,
          },
          {
            format: Format.F32_RG,
            offset: 4 * 9,
            shaderLocation: Location.NEXT,
          },
        ],
      },
      {
        arrayStride: 4 * 0,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            format: Format.F32_R,
            offset: 4 * 0,
            shaderLocation: Location.VERTEX_NUM,
          },
        ],
      },
      {
        arrayStride: 4 * 1,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_R,
            offset: 4 * 0,
            shaderLocation: Location.TRAVEL,
          },
        ],
      },
    ];

    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.#inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.#program,
    });

    this.#pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.#inputLayout,
      program: this.#program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      megaStateDescriptor: {
        attachmentsState: [
          {
            channelWriteMask: ChannelWriteMask.ALL,
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

    this.#bindings = this.device.createBindings({
      pipeline: this.#pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
        {
          buffer: this.#uniformBuffer,
        },
      ],
    });
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    const indices: number[] = [];
    const pointsBuffer: number[] = [];
    const travelBuffer: number[] = [];
    let offset = 0;

    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      const { worldTransform } = this.shapes[0];
      const [buffer, legacyObject] = this.generateBuffer(
        this.shapes[0] as Polyline,
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
      this.#program.setUniformsLegacy(uniformLegacyObject);

      this.shapes.forEach((shape: Polyline) => {
        const { pointsBuffer: pBuffer, travelBuffer: tBuffer } = updateBuffer(
          shape,
          false,
        );

        pointsBuffer.push(...pBuffer);
        travelBuffer.push(...tBuffer);

        indices.push(
          0 + offset,
          1 + offset,
          2 + offset,
          0 + offset,
          2 + offset,
          3 + offset,
          4 + offset,
          5 + offset,
          6 + offset,
          4 + offset,
          6 + offset,
          7 + offset,
          4 + offset,
          7 + offset,
          8 + offset,
        );
        offset += 9;
      });

      this.#segmentsBuffer.setSubData(
        0,
        new Uint8Array(new Float32Array(pointsBuffer).buffer),
      );

      this.#travelBuffer.setSubData(
        0,
        new Uint8Array(new Float32Array(travelBuffer).buffer),
      );
    }

    const buffers = [
      {
        buffer: this.#segmentsBuffer,
      },
      {
        buffer: this.#vertexNumBuffer,
      },
      {
        buffer: this.#travelBuffer,
      },
    ];

    if (!this.#indexBuffer) {
      this.#indexBuffer = this.device.createBuffer({
        viewOrSize: new Uint32Array(indices),
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }

    this.#program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(this.#inputLayout, buffers, {
      buffer: this.#indexBuffer,
    });
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(15, this.instanceCount);
  }

  destroy(): void {
    if (this.#program) {
      this.#program.destroy();
      this.#vertexNumBuffer?.destroy();
      this.#travelBuffer?.destroy();
      this.#segmentsBuffer?.destroy();
      this.#instancedMatrixBuffer?.destroy();
      this.#instancedBuffer?.destroy();
      this.#indexBuffer?.destroy();
      this.#uniformBuffer?.destroy();
      this.#pipeline?.destroy();
      this.#inputLayout?.destroy();
      this.#bindings?.destroy();
    }
  }

  private generateBuffer(shape: Polyline): [number[], Record<string, unknown>] {
    const {
      strokeRGB: { r: sr, g: sg, b: sb, opacity: so },
      strokeWidth,
      opacity,
      fillOpacity,
      strokeOpacity,
      strokeAlignment,
      strokeMiterlimit,
      strokeDasharray,
      strokeDashoffset,
    } = shape;

    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      strokeWidth,
      strokeMiterlimit,
      strokeAlignmentMap[strokeAlignment],
    ];
    const u_Opacity = [opacity, fillOpacity, strokeOpacity, 0];
    const u_StrokeDash = [
      (strokeDasharray && strokeDasharray[0]) || 0, // DASH
      (strokeDasharray && strokeDasharray[1]) || 0, // GAP
      strokeDashoffset || 0,
      0,
    ];

    return [
      [...u_StrokeColor, ...u_ZIndexStrokeWidth, ...u_Opacity, ...u_StrokeDash],
      {
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_StrokeDash,
      },
    ];
  }
}

function getJointType(lineJoin: CanvasLineJoin) {
  let joint: number;

  switch (lineJoin) {
    case 'bevel':
      joint = JointType.JOINT_BEVEL;
      break;
    case 'round':
      joint = JointType.JOINT_ROUND;
      break;
    default:
      joint = JointType.JOINT_MITER;
      break;
  }

  return joint;
}

function getCapType(lineCap: CanvasLineCap) {
  let cap: number;

  switch (lineCap) {
    case 'square':
      cap = JointType.CAP_SQUARE;
      break;
    case 'round':
      cap = JointType.CAP_ROUND;
      break;
    default:
      cap = JointType.CAP_BUTT;
      break;
  }

  return cap;
}

export function updateBuffer(
  object: Polyline,
  needEarcut = false,
  segmentNum?: number,
  subPathIndex = 0,
) {
  const {
    strokeLinecap: lineCap,
    strokeLinejoin: lineJoin,
    points: polylineControlPoints,
  } = object;

  const points: number[][] = [];
  const triangles: number[] = [];

  const length = polylineControlPoints.length;
  const startOffsetX = 0;
  const startOffsetY = 0;
  const endOffsetX = 0;
  const endOffsetY = 0;

  points[0] = polylineControlPoints.reduce((prev, cur, i) => {
    let offsetX = 0;
    let offsetY = 0;
    if (i === 0) {
      offsetX = startOffsetX;
      offsetY = startOffsetY;
    } else if (i === length - 1) {
      offsetX = endOffsetX;
      offsetY = endOffsetY;
    }

    prev.push(cur[0] + offsetX, cur[1] + offsetY);
    return prev;
  }, [] as number[]);

  const jointType = getJointType(lineJoin);
  const capType = getCapType(lineCap);
  let endJoint = capType;
  if (capType === JointType.CAP_ROUND) {
    endJoint = JointType.JOINT_CAP_ROUND;
  }
  if (capType === JointType.CAP_BUTT) {
    endJoint = JointType.JOINT_CAP_BUTT;
  }
  if (capType === JointType.CAP_SQUARE) {
    endJoint = JointType.JOINT_CAP_SQUARE;
  }

  const subPath = points[subPathIndex];
  {
    const points = subPath;
    let j = (Math.round(0 / stridePoints) + 2) * strideFloats;
    // const needDash = !isNil(lineDash);
    let dist = 0;
    const pointsBuffer: number[] = [];
    const travelBuffer: number[] = [];
    for (let i = 0; i < points.length; i += stridePoints) {
      // calc travel
      if (i > 1) {
        dist += Math.sqrt(
          Math.pow(points[i] - points[i - stridePoints], 2) +
            Math.pow(points[i + 1] - points[i + 1 - stridePoints], 2),
        );
      }
      travelBuffer.push(dist);

      pointsBuffer[j++] = points[i];
      pointsBuffer[j++] = points[i + 1];

      if (isNaN(points[i]) || isNaN(points[i + 1])) {
        // find prev non-nan
        pointsBuffer[j - 2] = (points[i + 2] + points[i - 2]) * 0.5;
        pointsBuffer[j - 1] = (points[i + 3] + points[i - 1]) * 0.5;
        pointsBuffer[j] = 0;
        j++;
        continue;
      }

      pointsBuffer[j] = jointType;
      if (i == 0) {
        if (capType !== JointType.CAP_ROUND) {
          pointsBuffer[j] += capType;
        }
      } else {
        if (isNaN(points[i - 2]) || isNaN(points[i - 1])) {
          pointsBuffer[j] += JointType.CAP_BUTT;
        }
      }
      if (
        i + stridePoints * 2 >= points.length ||
        isNaN(points[i + 4]) ||
        isNaN(points[i + 5])
      ) {
        pointsBuffer[j] += endJoint - jointType;
      } else if (
        i + stridePoints >= points.length ||
        isNaN(points[i + 2]) ||
        isNaN(points[i + 3])
      ) {
        pointsBuffer[j] = 0;
      }
      j++;
    }
    pointsBuffer[j++] = points[points.length - 4];
    pointsBuffer[j++] = points[points.length - 3];
    pointsBuffer[j++] = 0;
    pointsBuffer[0] = points[0];
    pointsBuffer[1] = points[1];
    pointsBuffer[2] = 0;
    pointsBuffer[3] = points[2];
    pointsBuffer[4] = points[3];
    pointsBuffer[5] = capType === JointType.CAP_ROUND ? capType : 0;

    const instancedCount = Math.round(points.length / stridePoints);

    return {
      pointsBuffer,
      travelBuffer,
      triangles,
      instancedCount,
    };
  }
}
