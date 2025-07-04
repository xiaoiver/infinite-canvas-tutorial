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
  TransparentBlack,
  StencilOp,
} from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location, JointType } from '../shaders/polyline';
import { hasValidStroke, paddingMat3, parseColor } from '../utils';
import {
  Circle,
  ComputedPoints,
  ComputedRough,
  Ellipse,
  FillSolid,
  GlobalRenderOrder,
  GlobalTransform,
  Mat3,
  Opacity,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
  StrokeAttenuation,
} from '../components';

const epsilon = 1e-4;
const circleEllipsePointsNum = 64;
const stridePoints = 2;
const strideFloats = 3;
const strokeAlignmentMap = {
  inner: 0,
  center: 0.5,
  outer: 1,
} as const;

export class SmoothPolyline extends Drawcall {
  static check(shape: Entity) {
    return (
      shape.has(Polyline) ||
      (shape.has(Rough) &&
        shape.hasSomeOf(Circle, Ellipse, Rect, Polyline, Path)) ||
      (shape.hasSomeOf(Rect, Circle, Ellipse) &&
        shape.has(Stroke) &&
        shape.read(Stroke).dasharray[0] > 0 &&
        shape.read(Stroke).dasharray[1] > 0) ||
      (shape.has(Path) &&
        shape.has(Stroke) &&
        hasValidStroke(shape.read(Stroke)))
    );
  }

  validate(_: Entity) {
    return false;
  }

  #vertexNumBuffer: Buffer;
  #travelBuffer: Buffer;
  #segmentsBuffer: Buffer;
  #uniformBuffer: Buffer;

  instanced = false;
  pointsBuffer: number[] = [];
  travelBuffer: number[] = [];

  get instanceCount() {
    const instance = this.shapes[0];
    if (
      instance.hasSomeOf(Polyline, Path) ||
      (instance.has(Rough) &&
        instance.hasSomeOf(Circle, Ellipse, Rect, Polyline, Path))
    ) {
      return this.pointsBuffer.length / strideFloats - 3;
    } else if (instance.has(Rect)) {
      return 6;
    } else if (instance.hasSomeOf(Circle, Ellipse)) {
      return circleEllipsePointsNum + 1;
    }
  }

  createGeometry(): void {
    const indices: number[] = [];
    const pointsBuffer: number[] = [];
    const travelBuffer: number[] = [];
    let offset = 0;
    this.shapes.forEach((shape: Entity) => {
      const { pointsBuffer: pBuffer, travelBuffer: tBuffer } = updateBuffer(
        shape,
        shape.has(Rough) &&
          ((shape.hasSomeOf(Circle, Ellipse, Path) && this.index === 2) ||
            (shape.has(Rect) && this.index !== 2) ||
            shape.has(Polyline)),
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
    this.indexBufferData = new Uint32Array(indices);
    this.pointsBuffer = pointsBuffer;
    this.travelBuffer = travelBuffer;

    if (this.instanceCount <= 0) {
      return;
    }

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

    this.#segmentsBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array(this.pointsBuffer).buffer),
    );

    this.#travelBuffer.setSubData(
      0,
      new Uint8Array(new Float32Array(this.travelBuffer).buffer),
    );

    this.vertexBufferOffsets = [0, 4 * 3, 4 * 5, 4 * 6, 4 * 9, 0, 0];
    this.vertexBuffers = [
      this.#segmentsBuffer,
      this.#segmentsBuffer,
      this.#segmentsBuffer,
      this.#segmentsBuffer,
      this.#segmentsBuffer,
      this.#vertexNumBuffer,
      this.#travelBuffer,
    ];
    this.vertexBufferDatas = [
      new Float32Array(this.pointsBuffer),
      new Float32Array(this.pointsBuffer),
      new Float32Array(this.pointsBuffer),
      new Float32Array(this.pointsBuffer),
      new Float32Array(this.pointsBuffer),
      new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      new Float32Array(this.travelBuffer),
    ];

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RG,
            offset: 4 * 0,
            shaderLocation: Location.PREV,
          },
        ],
      },
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RG,
            offset: 4 * 0,
            shaderLocation: Location.POINTA,
          },
        ],
      },
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_R,
            offset: 4 * 0,
            shaderLocation: Location.VERTEX_JOINT,
          },
        ],
      },
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RG,
            offset: 4 * 0,
            shaderLocation: Location.POINTB,
          },
        ],
      },
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
          {
            format: Format.F32_RG,
            offset: 4 * 0,
            shaderLocation: Location.NEXT,
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

    if (!this.indexBuffer) {
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: this.indexBufferData,
        usage: BufferUsage.INDEX,
        hint: BufferFrequencyHint.STATIC,
      });
    }
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    if (this.instanceCount <= 0) {
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

    this.inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors: this.vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.program,
    });

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

    this.bindings = this.device.createBindings({
      pipeline: this.pipeline,
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

  render(
    renderPass: RenderPass,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.instanceCount <= 0) {
      return;
    }

    // if (
    //   this.shapes.some((shape) => shape.renderDirtyFlag) ||
    //   this.geometryDirty
    // ) {
    const { matrix } = this.shapes[0].read(GlobalTransform);
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
    const [buffer, legacyObject] = this.generateBuffer(this.shapes[0]);
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
    this.program.setUniformsLegacy(uniformLegacyObject);

    if (this.useWireframe) {
      this.generateWireframe();
    }
    // }

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
    renderPass.drawIndexed(15, this.instanceCount);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
    }
  }

  private generateBuffer(shape: Entity): [number[], Record<string, unknown>] {
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: null };
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);

    const {
      color: strokeColor,
      width,
      alignment,
      miterlimit,
      dasharray,
      dashoffset,
    } = shape.has(Stroke)
      ? shape.read(Stroke)
      : {
          color: null,
          width: 0,
          alignment: 'center',
          miterlimit: 10,
          dasharray: [],
          dashoffset: 0,
        };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);

    const { opacity, strokeOpacity, fillOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1, fillOpacity: 1 };

    let u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      // Polyline should render after SDF
      (globalRenderOrder + 0.1) / ZINDEX_FACTOR,
      width,
      miterlimit,
      strokeAlignmentMap[alignment],
    ];
    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
      shape.has(StrokeAttenuation) ? 1 : 0,
    ];
    const u_StrokeDash = [
      (dasharray && dasharray[0]) || 0, // DASH
      (dasharray && dasharray[1]) || 0, // GAP
      dashoffset || 0,
      0,
    ];

    const instance = this.shapes[0];
    if (
      instance.has(Rough) &&
      ((instance.hasSomeOf(Circle, Ellipse, Path) && this.index === 1) ||
        (instance.has(Rect) && this.index === 2))
    ) {
      u_StrokeColor = [fr / 255, fg / 255, fb / 255, fo];
      u_Opacity[2] = fillOpacity;
    }

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

export function updateBuffer(object: Entity, useRoughStroke = true) {
  const { linecap, linejoin } = object.has(Stroke)
    ? object.read(Stroke)
    : ({ linecap: 'butt', linejoin: 'miter' } as const);

  let points: number[] = [];

  if (
    object.has(Rough) &&
    object.has(ComputedRough) &&
    object.hasSomeOf(Circle, Ellipse, Rect, Polyline, Path)
  ) {
    const { strokePoints, fillPoints } = object.read(ComputedRough);
    points = (useRoughStroke ? strokePoints : fillPoints)
      .map((subPathPoints, i) => {
        return [...subPathPoints].concat(
          i !== strokePoints.length - 1 ? [NaN, NaN] : [],
        );
      })
      .flat(2);
  } else if (object.has(Polyline)) {
    points = object.read(Polyline).points.reduce((prev, cur) => {
      prev.push(cur[0], cur[1]);
      return prev;
    }, [] as number[]);
  } else if (object.has(Path)) {
    const computed = object.read(ComputedPoints).points;
    points = computed
      .map((subPathPoints, i) => {
        return [...subPathPoints].concat(
          i !== computed.length - 1 ? [NaN, NaN] : [],
        );
      })
      .flat(2);
  } else if (object.has(Rect)) {
    const { x, y, width, height } = object.read(Rect);
    points = [
      x,
      y,
      x + width,
      y,
      x + width,
      y + height,
      x,
      y + height,
      x,
      y,
      x + epsilon,
      y,
    ];
  } else if (object.has(Circle)) {
    const { cx, cy, r } = object.read(Circle);
    for (let i = 0; i < circleEllipsePointsNum; i++) {
      const angle = (i / circleEllipsePointsNum) * Math.PI * 2;
      points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    points.push(cx + r, cy);
  } else if (object.has(Ellipse)) {
    const { cx, cy, rx, ry } = object.read(Ellipse);
    for (let i = 0; i < circleEllipsePointsNum; i++) {
      const angle = (i / circleEllipsePointsNum) * Math.PI * 2;
      points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
    }
    points.push(cx + rx, cy);
  }

  const jointType = getJointType(linejoin);
  const capType = getCapType(linecap);
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

  // Split subpath by [NaN, NaN]
  const subPaths = [];
  let lastNaNIndex = 0;
  for (let i = 0; i < points.length; i += stridePoints) {
    if (isNaN(points[i]) || isNaN(points[i + 1])) {
      subPaths.push(points.slice(lastNaNIndex, i));
      lastNaNIndex = i + 2;
    }
  }
  subPaths.push(points.slice(lastNaNIndex));

  const pointsBufferTotal: number[] = [];
  const travelBufferTotal: number[] = [];

  subPaths.forEach((points) => {
    const pointsBuffer: number[] = [];
    const travelBuffer: number[] = [0];
    let j = (Math.round(0 / stridePoints) + 2) * strideFloats;
    let dist = 0;

    // Account for Z command in path
    let zCommand = false;
    if (
      points.length >= 6 &&
      points[0] === points[points.length - 2] &&
      points[1] === points[points.length - 1]
    ) {
      const dir = [points[2] - points[0], points[3] - points[1]];
      points.push(points[0] + epsilon * dir[0], points[1] + epsilon * dir[1]);
      zCommand = true;
    }

    for (let i = 0; i < points.length; i += stridePoints) {
      // calc travel
      if (i > 1) {
        if (!(zCommand && i >= points.length - stridePoints)) {
          dist += Math.sqrt(
            Math.pow(points[i] - points[i - stridePoints], 2) +
              Math.pow(points[i + 1] - points[i + 1 - stridePoints], 2),
          );
          travelBuffer.push(dist);
        }
      }

      pointsBuffer[j++] = points[i];
      pointsBuffer[j++] = points[i + 1];
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

    // instancedCount += Math.round(points.length / stridePoints);

    pointsBufferTotal.push(...pointsBuffer);
    travelBufferTotal.push(...travelBuffer);
  });

  return {
    pointsBuffer: pointsBufferTotal,
    travelBuffer: travelBufferTotal,
  };
}
