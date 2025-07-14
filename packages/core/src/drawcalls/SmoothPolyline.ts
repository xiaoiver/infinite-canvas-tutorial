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
import {
  Circle,
  Ellipse,
  Path,
  Polyline,
  Rect,
  RoughCircle,
  RoughEllipse,
  RoughRect,
  RoughPolyline,
  Shape,
  hasValidStroke,
  RoughPath,
  hasValidDecoration,
  Text,
} from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location, JointType } from '../shaders/polyline';
import { paddingMat3, parsePath } from '../utils';

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
  static check(shape: Shape) {
    return (
      shape instanceof Polyline ||
      shape instanceof RoughCircle ||
      shape instanceof RoughEllipse ||
      shape instanceof RoughRect ||
      shape instanceof RoughPolyline ||
      shape instanceof RoughPath ||
      ((shape instanceof Rect ||
        shape instanceof Circle ||
        shape instanceof Ellipse) &&
        shape.strokeDasharray.length > 0 &&
        shape.strokeDasharray.some((dash) => dash > 0)) ||
      (shape instanceof Path &&
        hasValidStroke(shape.stroke, shape.strokeWidth)) ||
      (shape instanceof Text && hasValidDecoration(shape as Text))
    );
  }

  validate(_: Shape) {
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
      instance instanceof Polyline ||
      instance instanceof Path ||
      instance instanceof RoughCircle ||
      instance instanceof RoughEllipse ||
      instance instanceof RoughRect ||
      instance instanceof RoughPolyline ||
      instance instanceof RoughPath ||
      instance instanceof Text
    ) {
      return this.pointsBuffer.length / strideFloats - 3;
    } else if (instance instanceof Rect) {
      return 6;
    } else if (instance instanceof Circle || instance instanceof Ellipse) {
      return circleEllipsePointsNum + 1;
    }
  }

  createGeometry(): void {
    const indices: number[] = [];
    const pointsBuffer: number[] = [];
    const travelBuffer: number[] = [];
    let offset = 0;
    this.shapes.forEach((shape: Polyline) => {
      const { pointsBuffer: pBuffer, travelBuffer: tBuffer } = updateBuffer(
        shape,
        ((shape instanceof RoughCircle ||
          shape instanceof RoughEllipse ||
          shape instanceof RoughPath) &&
          this.index === 2) ||
          (shape instanceof RoughRect && this.index !== 2) ||
          shape instanceof RoughPolyline,
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

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (this.instanceCount <= 0) {
      return;
    }

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
      this.program.setUniformsLegacy(uniformLegacyObject);

      if (this.useWireframe && this.geometryDirty) {
        this.generateWireframe();
      }
    }

    this.program.setUniformsLegacy(uniformLegacyObject);
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

  private generateBuffer(shape: Polyline): [number[], Record<string, unknown>] {
    const {
      fillRGB: { r: fr, g: fg, b: fb, opacity: fo },
      strokeRGB: { r: sr, g: sg, b: sb, opacity: so },
      strokeWidth,
      opacity,
      fillOpacity,
      strokeOpacity,
      strokeAlignment,
      strokeMiterlimit,
      strokeDasharray,
      strokeDashoffset,
      sizeAttenuation,
    } = shape;

    const instance = this.shapes[0];
    let u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      // Polyline should render after SDF
      (shape.globalRenderOrder + 0.1) / ZINDEX_FACTOR,
      strokeWidth,
      strokeMiterlimit,
      strokeAlignmentMap[strokeAlignment],
    ];
    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation ? 1 : 0,
    ];
    const u_StrokeDash = [
      (strokeDasharray && strokeDasharray[0]) || 0, // DASH
      (strokeDasharray && strokeDasharray[1]) || 0, // GAP
      strokeDashoffset || 0,
      0,
    ];

    if (
      ((instance instanceof RoughCircle ||
        instance instanceof RoughEllipse ||
        instance instanceof RoughPath) &&
        this.index === 1) ||
      (instance instanceof RoughRect && this.index === 2)
    ) {
      u_StrokeColor = [fr / 255, fg / 255, fb / 255, fo];
      u_Opacity[2] = fillOpacity;
    } else if (instance instanceof Text) {
      const {
        decorationColorRGB,
        decorationThickness,
        decorationStyle,
        metrics,
      } = instance;
      u_StrokeColor = [
        decorationColorRGB.r / 255,
        decorationColorRGB.g / 255,
        decorationColorRGB.b / 255,
        fo,
      ];
      u_ZIndexStrokeWidth[1] = decorationThickness;

      const scaleFactor = metrics.fontMetrics.fontSize / 14;
      // @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L187-L213
      if (decorationStyle === 'dotted') {
        u_StrokeDash[0] = scaleFactor * 1.5;
        u_StrokeDash[1] = scaleFactor;
      } else if (decorationStyle === 'dashed') {
        u_StrokeDash[0] = scaleFactor * 4;
        u_StrokeDash[1] = scaleFactor * 2;
      } else if (decorationStyle === 'wavy') {
      } else if (decorationStyle === 'double') {
        // TODO: use two lines to render double decoration
      }
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

export function updateBuffer(object: Shape, useRoughStroke = true) {
  const { strokeLinecap: lineCap, strokeLinejoin: lineJoin } = object;

  let points: number[] = [];
  // const triangles: number[] = [];

  if (
    object instanceof RoughCircle ||
    object instanceof RoughEllipse ||
    object instanceof RoughRect ||
    object instanceof RoughPolyline ||
    object instanceof RoughPath
  ) {
    const { strokePoints, fillPoints } = object;
    points = (useRoughStroke ? strokePoints : fillPoints)
      .map((subPathPoints, i) => {
        return [...subPathPoints].concat(
          i !== strokePoints.length - 1 ? [NaN, NaN] : [],
        );
      })
      .flat(2);
  } else if (object instanceof Polyline) {
    points = object.points.reduce((prev, cur) => {
      prev.push(cur[0], cur[1]);
      return prev;
    }, [] as number[]);
  } else if (object instanceof Path) {
    points = object.points
      .map((subPathPoints, i) => {
        return [...subPathPoints].concat(
          i !== object.points.length - 1 ? [NaN, NaN] : [],
        );
      })
      .flat(2);
  } else if (object instanceof Rect) {
    const { x, y, width, height } = object;
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
  } else if (object instanceof Circle) {
    const { cx, cy, r } = object;
    for (let i = 0; i < circleEllipsePointsNum; i++) {
      const angle = (i / circleEllipsePointsNum) * Math.PI * 2;
      points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    points.push(cx + r, cy);
  } else if (object instanceof Ellipse) {
    const { cx, cy, rx, ry } = object;
    for (let i = 0; i < circleEllipsePointsNum; i++) {
      const angle = (i / circleEllipsePointsNum) * Math.PI * 2;
      points.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
    }
    points.push(cx + rx, cy);
  } else if (object instanceof Text) {
    const {
      decorationLine,
      decorationStyle,
      decorationThickness,
      x,
      y,
      metrics,
    } = object;

    metrics.lineMetrics.forEach((line, index) => {
      const linePoints: number[] = [];
      let wave_count = 0;
      let x_start = 0;
      const quarterWave = decorationThickness;
      if (decorationStyle === 'wavy') {
        // Calculate wave. @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L215
        let d = 'M 0 0';
        while (x_start + quarterWave * 2 < line.width) {
          // fPath.rQuadTo(quarterWave,
          //   wave_count % 2 != 0 ? quarterWave : -quarterWave,
          //   quarterWave * 2,
          //   0);
          d += ` Q ${x_start + quarterWave} ${
            wave_count % 2 != 0 ? quarterWave : -quarterWave
          } ${x_start + quarterWave * 2} 0`;

          x_start += quarterWave * 2;
          ++wave_count;
        }

        const { subPaths } = parsePath(d);
        const points = subPaths.map((subPath) =>
          subPath
            .getPoints()
            .map((point) => [point[0], point[1]] as [number, number]),
        );
        linePoints.push(...points.flat(2));
      } else {
        linePoints.push(0, 0, line.width, 0);
      }

      let offsetY = 0;
      // Calculate the position of the decoration line with offsetY.
      // @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L161-L185
      if (decorationLine === 'underline') {
        offsetY = metrics.height;
      } else if (decorationLine === 'overline') {
        offsetY = metrics.height;
      } else if (decorationLine === 'line-through') {
        offsetY = metrics.height / 2;
      }

      linePoints.forEach((_, i) => {
        if (i % 2 === 0) {
          linePoints[i] += x + line.x;
        } else {
          linePoints[i] += y + line.y + offsetY;
        }
      });

      if (index !== metrics.lineMetrics.length - 1) {
        linePoints.push(NaN, NaN);
      }

      points.push(...linePoints);
    });
  }

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
