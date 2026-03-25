import { D2, Shape, Text } from '@terrastruct/d2';
import {
  EdgeStyle,
  PathSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';

const D2_LABEL_PADDING = 5;
const D2_LEFT_LABEL_POSITION = 1 / 4;
const D2_CENTER_LABEL_POSITION = 2 / 4;
const D2_RIGHT_LABEL_POSITION = 3 / 4;

const D2_ARROW_HEAD_MAP = {
  arrow: 'line',
  'unfilled-triangle': 'triangle',
  triangle: 'triangle',
  diamond: 'diamond',
  'filled-diamond': 'diamond',
  circle: 'circle',
  'filled-circle': 'circle',
  box: 'box',
  'filled-box': 'box',
  line: 'line',
  'cf-one': 'cf-one',
};

const getShapeLabelAnchor = (
  labelPosition: string | undefined,
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
) => {
  const boxCenterX = width / 2;
  const boxCenterY = height / 2;
  const safeLabelWidth = labelWidth || 0;
  const safeLabelHeight = labelHeight || 0;

  switch (labelPosition) {
    case 'OUTSIDE_TOP_LEFT':
      return {
        anchorX: -D2_LABEL_PADDING,
        anchorY: -(D2_LABEL_PADDING + safeLabelHeight),
      };
    case 'OUTSIDE_TOP_CENTER':
      return {
        anchorX: boxCenterX,
        anchorY: -(D2_LABEL_PADDING + safeLabelHeight / 2),
      };
    case 'OUTSIDE_TOP_RIGHT':
      return {
        anchorX: width - D2_LABEL_PADDING,
        anchorY: -(D2_LABEL_PADDING + safeLabelHeight),
      };
    case 'OUTSIDE_LEFT_TOP':
      return {
        anchorX: -(D2_LABEL_PADDING + safeLabelWidth),
        anchorY: D2_LABEL_PADDING,
      };
    case 'OUTSIDE_LEFT_MIDDLE':
      return {
        anchorX: -(D2_LABEL_PADDING + safeLabelWidth),
        anchorY: boxCenterY,
      };
    case 'OUTSIDE_LEFT_BOTTOM':
      return {
        anchorX: -(D2_LABEL_PADDING + safeLabelWidth),
        anchorY: height - D2_LABEL_PADDING,
      };
    case 'OUTSIDE_RIGHT_TOP':
      return { anchorX: width + D2_LABEL_PADDING, anchorY: D2_LABEL_PADDING };
    case 'OUTSIDE_RIGHT_MIDDLE':
      return { anchorX: width + D2_LABEL_PADDING, anchorY: boxCenterY };
    case 'OUTSIDE_RIGHT_BOTTOM':
      return {
        anchorX: width + D2_LABEL_PADDING,
        anchorY: height - D2_LABEL_PADDING,
      };
    case 'OUTSIDE_BOTTOM_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: height + D2_LABEL_PADDING };
    case 'OUTSIDE_BOTTOM_CENTER':
      return { anchorX: boxCenterX, anchorY: height + D2_LABEL_PADDING };
    case 'OUTSIDE_BOTTOM_RIGHT':
      return {
        anchorX: width - D2_LABEL_PADDING,
        anchorY: height + D2_LABEL_PADDING,
      };
    case 'INSIDE_TOP_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: D2_LABEL_PADDING };
    case 'INSIDE_TOP_CENTER':
      return { anchorX: boxCenterX, anchorY: D2_LABEL_PADDING };
    case 'INSIDE_TOP_RIGHT':
      return { anchorX: width - D2_LABEL_PADDING, anchorY: D2_LABEL_PADDING };
    case 'INSIDE_MIDDLE_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: boxCenterY };
    case 'INSIDE_MIDDLE_CENTER':
      return { anchorX: boxCenterX, anchorY: boxCenterY };
    case 'INSIDE_MIDDLE_RIGHT':
      return { anchorX: width - D2_LABEL_PADDING, anchorY: boxCenterY };
    case 'INSIDE_BOTTOM_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: height - D2_LABEL_PADDING };
    case 'INSIDE_BOTTOM_CENTER':
      return { anchorX: boxCenterX, anchorY: height - D2_LABEL_PADDING };
    case 'INSIDE_BOTTOM_RIGHT':
      return {
        anchorX: width - D2_LABEL_PADDING,
        anchorY: height - D2_LABEL_PADDING,
      };
    case 'BORDER_TOP_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: 0 };
    case 'BORDER_TOP_CENTER':
      return { anchorX: boxCenterX, anchorY: 0 };
    case 'BORDER_TOP_RIGHT':
      return { anchorX: width - D2_LABEL_PADDING, anchorY: 0 };
    case 'BORDER_LEFT_TOP':
      return { anchorX: 0, anchorY: D2_LABEL_PADDING };
    case 'BORDER_LEFT_MIDDLE':
      return { anchorX: 0, anchorY: boxCenterY };
    case 'BORDER_LEFT_BOTTOM':
      return { anchorX: 0, anchorY: height - D2_LABEL_PADDING };
    case 'BORDER_RIGHT_TOP':
      return { anchorX: width, anchorY: D2_LABEL_PADDING };
    case 'BORDER_RIGHT_MIDDLE':
      return { anchorX: width, anchorY: boxCenterY };
    case 'BORDER_RIGHT_BOTTOM':
      return { anchorX: width, anchorY: height - D2_LABEL_PADDING };
    case 'BORDER_BOTTOM_LEFT':
      return { anchorX: D2_LABEL_PADDING, anchorY: height };
    case 'BORDER_BOTTOM_CENTER':
      return { anchorX: boxCenterX, anchorY: height };
    case 'BORDER_BOTTOM_RIGHT':
      return { anchorX: width - D2_LABEL_PADDING, anchorY: height };
    default:
      return { anchorX: boxCenterX, anchorY: boxCenterY };
  }
};

const getEdgeLabelPosition = (
  labelPosition: string | undefined,
  labelPercentage: number | undefined,
) => {
  switch (labelPosition) {
    case 'OUTSIDE_TOP_LEFT':
    case 'INSIDE_MIDDLE_LEFT':
    case 'OUTSIDE_BOTTOM_LEFT':
      return D2_LEFT_LABEL_POSITION;
    case 'OUTSIDE_TOP_CENTER':
    case 'INSIDE_MIDDLE_CENTER':
    case 'OUTSIDE_BOTTOM_CENTER':
      return D2_CENTER_LABEL_POSITION;
    case 'OUTSIDE_TOP_RIGHT':
    case 'INSIDE_MIDDLE_RIGHT':
    case 'OUTSIDE_BOTTOM_RIGHT':
      return D2_RIGHT_LABEL_POSITION;
    case 'UNLOCKED_TOP':
    case 'UNLOCKED_MIDDLE':
    case 'UNLOCKED_BOTTOM':
      return labelPercentage ?? D2_CENTER_LABEL_POSITION;
    default:
      return D2_CENTER_LABEL_POSITION;
  }
};

const getEdgeLabelOffset = (
  labelPosition: string | undefined,
  strokeWidth: number,
  labelHeight: number | undefined,
) => {
  const baseOffset = strokeWidth / 2 + D2_LABEL_PADDING + (labelHeight || 0) / 2;
  switch (labelPosition) {
    case 'OUTSIDE_TOP_LEFT':
    case 'OUTSIDE_TOP_CENTER':
    case 'OUTSIDE_TOP_RIGHT':
    case 'UNLOCKED_TOP':
      return -baseOffset;
    case 'OUTSIDE_BOTTOM_LEFT':
    case 'OUTSIDE_BOTTOM_CENTER':
    case 'OUTSIDE_BOTTOM_RIGHT':
    case 'UNLOCKED_BOTTOM':
      return baseOffset;
    default:
      return 0;
  }
};

const getEndpointLabelOffset = (
  strokeWidth: number,
  fontSize: number | undefined,
) => {
  const estimatedLabelHalfHeight = (fontSize || 14) * 0.5;
  return strokeWidth / 2 + D2_LABEL_PADDING + estimatedLabelHalfHeight;
};

export const parseD2ToSerializedNodes = async (definition: string) => {
  const d2 = new D2();
  const { diagram, graph } = await d2.compile(definition);
  const { connections, shapes } = diagram;
  const {
    theme: { colors },
  } = graph;

  const nodes: SerializedNode[] = [];
  shapes.forEach((shape: Shape & Text) => {
    const {
      id,
      type,
      pos,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      opacity,
      label,
      fontSize,
      color,
      italic,
      bold,
      underline,
    } = shape;
    const node: SerializedNode = {
      id,
      type: type === 'rectangle' ? 'rect' : (type as SerializedNode['type']),
      x: pos.x,
      y: pos.y,
      width,
      height,
      fill: colors[fill.toLowerCase()],
      stroke: colors[stroke.toLowerCase()],
      strokeWidth,
      opacity,
      zIndex: 0,
    };
    nodes.push(node);

    if (label) {
      const { labelPosition, labelHeight, labelWidth } = shape;
      const { anchorX, anchorY } = getShapeLabelAnchor(
        labelPosition,
        width,
        height,
        labelWidth,
        labelHeight,
      );

      const labelNode: TextSerializedNode = {
        id: id + '-text',
        parentId: id,
        type: 'text',
        anchorX,
        anchorY,
        content: label,
        fontSize,
        fontFamily: 'sans-serif',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 'bold' : 'normal',
        fill: colors.neutrals[color.toLowerCase()],
        textAlign: 'center',
        textBaseline: 'middle',
        decorationLine: underline ? 'underline' : 'none',
        zIndex: 0,
      };
      nodes.push(labelNode);
    }
  });

  connections.forEach((connection) => {
    const edgeLabelOffset = getEdgeLabelOffset(
      (connection as { labelPosition?: string }).labelPosition,
      connection.strokeWidth,
      (connection as { labelHeight?: number }).labelHeight,
    );
    const edgeLabelPosition = getEdgeLabelPosition(
      (connection as { labelPosition?: string }).labelPosition,
      (connection as { labelPercentage?: number }).labelPercentage,
    );
    const {
      id,
      src,
      dst,
      stroke,
      strokeWidth,
      label,
      fontSize,
      color,
      srcArrow,
      dstArrow,
      italic,
      bold,
      underline,
      isCurve,
      strokeDash,
      opacity,
      dstLabel,
      srcLabel,
    } = connection;
    const edge: PathSerializedNode = {
      id,
      type: 'path',
      fromId: src,
      toId: dst,
      stroke: colors[stroke.toLowerCase()],
      strokeWidth,
      hitStrokeWidth: strokeWidth * 4,
      markerStart: D2_ARROW_HEAD_MAP[srcArrow],
      markerEnd: D2_ARROW_HEAD_MAP[dstArrow],
      curved: isCurve,
      edgeStyle: EdgeStyle.ORTHOGONAL,
      opacity,
      zIndex: 0,
    };
    nodes.push(edge);

    if (strokeDash) {
      edge.strokeDasharray = `${strokeDash} ${strokeDash}`;
    }

    if (label) {
      const labelNode = {
        id: id + '-text',
        parentId: id,
        type: 'text',
        content: label,
        fontSize,
        fontFamily: 'sans-serif',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 'bold' : 'normal',
        fill: colors.neutrals[color.toLowerCase()],
        stroke: 'white',
        strokeWidth: 4,
        edgeLabelPosition,
        edgeLabelOffset,
        textAlign: 'center',
        textBaseline: 'middle',
        decorationLine: underline ? 'underline' : 'none',
        zIndex: 0,
      } as TextSerializedNode;
      nodes.push(labelNode);
    }

    if (srcLabel) {
      const { label, color, italic, bold } = srcLabel;
      const labelNode: TextSerializedNode = {
        id: id + '-src-label',
        parentId: id,
        type: 'text',
        content: label,
        fontSize,
        fontFamily: 'sans-serif',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 'bold' : 'normal',
        fill: colors.neutrals[color.toLowerCase()] ?? 'black',
        stroke: 'white',
        strokeWidth: 4,
        zIndex: 0,
        edgeLabelPosition: 0,
        edgeLabelOffset: -getEndpointLabelOffset(strokeWidth, fontSize),
        textAlign: 'left',
        textBaseline: 'middle',
      };
      nodes.push(labelNode);
    }

    if (dstLabel) {
      const { label, color, italic, bold } = dstLabel;
      const labelNode: TextSerializedNode = {
        id: id + '-dst-label',
        parentId: id,
        type: 'text',
        content: label,
        fontSize,
        fontFamily: 'sans-serif',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 'bold' : 'normal',
        fill: colors.neutrals[color.toLowerCase()] ?? 'black',
        stroke: 'white',
        strokeWidth: 4,
        zIndex: 0,
        edgeLabelPosition: 1,
        edgeLabelOffset: -getEndpointLabelOffset(strokeWidth, fontSize),
        textAlign: 'left',
        textBaseline: 'middle',
      };
      nodes.push(labelNode);
    }
  });
  return nodes;
};
