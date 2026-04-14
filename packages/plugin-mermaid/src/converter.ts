import { v4 as uuidv4 } from 'uuid';
import {
  EdgeStyle,
  EllipseSerializedNode,
  GSerializedNode,
  LineSerializedNode,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import {
  Edge,
  Flowchart,
} from '@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart';
import { Sequence } from '@excalidraw/mermaid-to-excalidraw/dist/parser/sequence';
import {
  Vertex,
  VERTEX_TYPE,
} from '@excalidraw/mermaid-to-excalidraw/dist/interfaces';
import { getText } from '@excalidraw/mermaid-to-excalidraw/dist/converter/helpers';
import { normalizeText } from '@excalidraw/mermaid-to-excalidraw/dist/converter/transformToExcalidrawSkeleton';
import {
  Arrow,
  Container,
  Line,
  Node,
  Text,
} from '@excalidraw/mermaid-to-excalidraw/dist/elementSkeleton';

/** Mermaid FlowEdge.type：双向为 double_arrow_point / double_arrow_circle / double_arrow_cross 等 */
function markersFromMermaidFlowEdgeType(
  edgeType: string | undefined,
): Pick<PolylineSerializedNode, 'markerStart' | 'markerEnd' | 'markerFactor'> {
  if (edgeType?.startsWith('double_arrow')) {
    return {
      markerStart: 'line',
      markerEnd: 'line',
      markerFactor: 4,
    };
  }
  return {
    markerEnd: 'line',
  };
}

export function convertParsedMermaidDataToSerializedNodes(
  parsedMermaidData: Flowchart | Sequence,
  options: { fontSize: number },
): SerializedNode[] {
  const { type } = parsedMermaidData;
  switch (type) {
    case 'flowchart': {
      const flowchart = parsedMermaidData as Flowchart;
      const { vertices, edges } = flowchart;
      // TODO: render subGraphs
      return convertFlowchartToSerializedNodes(vertices, edges, options);
    }
    case 'sequence': {
      const sequence = parsedMermaidData as Sequence;
      const { nodes, lines, arrows, loops, groups } = sequence;
      return convertSequenceToSerializedNodes(nodes, lines, arrows, loops, groups, options);
    }
    default: {
      throw new Error(`Unsupported diagram type: ${type}`);
    }
  }
}

function convertFlowchartToSerializedNodes(
  vertices: {
    [key: string]: Vertex;
  },
  edges: Edge[],
  options: { fontSize: number },
): SerializedNode[] {
  const { fontSize } = options;

  const root: GSerializedNode = {
    id: uuidv4(),
    type: 'g',
    zIndex: 0,
  }
  const serializedNodes: SerializedNode[] = [root];
  // Vertices (ParsedMermaidData uses Map; Object.values(Map) is always [].)
  Object.values(vertices).forEach((vertex: Vertex) => {
    if (!vertex) {
      return;
    }

    const serializedNode: SerializedNode = {
      id: vertex.id,
      parentId: root.id,
      type: 'rect',
      x: vertex.x,
      y: vertex.y,
      width: vertex.width,
      height: vertex.height,
      stroke: 'black',
      strokeWidth: 2,
      fill: 'transparent',
      zIndex: 0,
    };

    switch (vertex.type) {
      case VERTEX_TYPE.STADIUM: {
        (serializedNode as RectSerializedNode).cornerRadius = 3;
        break;
      }
      case VERTEX_TYPE.ROUND: {
        (serializedNode as RectSerializedNode).cornerRadius = 3;
        break;
      }
      case VERTEX_TYPE.DOUBLECIRCLE:
      case VERTEX_TYPE.CIRCLE: {
        (serializedNode as unknown as EllipseSerializedNode).type = 'ellipse';
        break;
      }
      case VERTEX_TYPE.DIAMOND: {
        const width = vertex.width;
        const height = vertex.height;
        const pathSerializedNode =
          serializedNode as unknown as PathSerializedNode;
        pathSerializedNode.type = 'path';
        pathSerializedNode.d = `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2
          } ${height} L 0 ${height / 2} Z`;
        break;
      }
    }

    serializedNodes.push(serializedNode);

    // Text
    const text = getText(vertex);
    const textSerializedNode: TextSerializedNode = {
      id: vertex.id + '-text',
      parentId: vertex.id,
      type: 'text',
      anchorX: vertex.width / 2,
      anchorY: vertex.height / 2,
      content: text,
      fontSize,
      fontFamily: 'sans-serif',
      fill: 'black',
      textAlign: 'center',
      textBaseline: 'middle',
      zIndex: 0,
    };
    serializedNodes.push(textSerializedNode);
  });

  // Edges (bound polylines + optional Excalidraw-style text labels as children)
  edges.forEach((edge) => {
    // let groupIds: string[] = [];
    // const startParentId = getParentId(edge.start);
    // const endParentId = getParentId(edge.end);
    // if (startParentId && startParentId === endParentId) {
    //   groupIds = getGroupIds(startParentId);
    // }

    // // Get arrow position data
    // const { startX, startY, reflectionPoints } = edge;

    // // Calculate Excalidraw arrow's points
    // const points = reflectionPoints.map((point) => [
    //   point.x - reflectionPoints[0].x,
    //   point.y - reflectionPoints[0].y,
    // ]);

    const serializedNode: PolylineSerializedNode = {
      id: edge.id,
      parentId: root.id,
      type: 'polyline',
      fromId: edge.start,
      toId: edge.end,
      stroke: 'black',
      strokeWidth: 2,
      hitStrokeWidth: 2 * 4,
      ...markersFromMermaidFlowEdgeType(edge.type),
      edgeStyle: EdgeStyle.ORTHOGONAL,
      zIndex: 0,
    };

    serializedNodes.push(serializedNode);

    const labelText = getText(edge).trim();
    if (!labelText) {
      return;
    }

    const textSerializedNode: TextSerializedNode = {
      id: `${serializedNode.id}-label`,
      parentId: serializedNode.id,
      type: 'text',
      content: labelText,
      fontSize,
      fontFamily: 'sans-serif',
      fill: 'black',
      stroke: 'white',
      strokeWidth: 4,
      textAlign: 'center',
      textBaseline: 'middle',
      edgeLabelPosition: 0.5,
      edgeLabelOffset: -10,
      zIndex: 1,
    };
    serializedNodes.push(textSerializedNode);
  });

  return serializedNodes;
}

function convertSequenceToSerializedNodes(
  nodes: Node[][],
  lines: Line[],
  arrows: Arrow[],
  loops: any,
  groups: any,
  options: { fontSize: number },
): SerializedNode[] {
  const { fontSize } = options;

  const root: GSerializedNode = {
    id: uuidv4(),
    type: 'g',
    zIndex: 0,
  }
  const serializedNodes: SerializedNode[] = [root];

  Object.values(nodes).forEach((node) => {
    if (!node || !node.length) {
      return;
    }
    node.forEach((element) => {
      switch (element.type) {
        case "line":
          transformToLine(element, serializedNodes);
          break;

        case "rectangle":
        case "ellipse":
          transformToContainer(element, serializedNodes);
          break;

        case "text":
          transformToText(element, serializedNodes);
          break;
        default:
          throw `unknown type ${element.type}`;
          break;
      }
      if (element.type === "rectangle" && element?.subtype === "activation") {
        // activations.push(excalidrawElement);
      }
    });
  });

  Object.values(lines).forEach((line) => {
    if (!line) {
      return;
    }
    transformToLine(line, serializedNodes);
  });

  Object.values(arrows).forEach((arrow) => {
    if (!arrow) {
      return;
    }

    transformToArrow(arrow, serializedNodes);
    if (arrow.sequenceNumber) {
      transformToContainer(arrow.sequenceNumber, serializedNodes);
    }
  });

  return serializedNodes;
}

const transformToLine = (
  element: Line,
  serializedNodes: SerializedNode[]
) => {
  const line: LineSerializedNode = {
    id: element.id ?? uuidv4(),
    type: "line",
    x1: element.startX,
    y1: element.startY,
    x2: element.endX,
    y2: element.endY,
    stroke: element.strokeColor || "#000",
    strokeWidth: element.strokeWidth || 1,
    hitStrokeWidth: (element.strokeWidth || 1) * 4,
    zIndex: 0,
  };
  toParent(line, element.groupId, serializedNodes);
  serializedNodes.push(line);
};

const toParent = (node: SerializedNode, parentId: string, serializedNodes: SerializedNode[]) => {
  if (parentId) {
    let parent = serializedNodes.find((node) => node.id === parentId);
    if (!parent) {
      parent = {
        id: parentId,
        type: "g",
      } as GSerializedNode;
      serializedNodes.push(parent);
    }
    node.parentId = parentId;
  }
}

const transformToContainer = (
  element: Exclude<Node, Line | Arrow | Text>,
  serializedNodes: SerializedNode[]
) => {
  let extraProps = {};
  if (element.type === "rectangle" && element.subtype === "activation") {
    extraProps = {
      fill: "#e9ecef",
    };
  }
  const container: RectSerializedNode | EllipseSerializedNode = {
    id: element.id,
    type: element.type === "rectangle" ? "rect" : "ellipse",
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    // strokeStyle: element?.strokeStyle,
    strokeWidth: (element as Container)?.strokeWidth ?? 1,
    stroke: (element as Container)?.strokeColor ?? '#000',
    fill: (element as Container)?.bgColor,
    zIndex: 0,
    ...extraProps,
  };

  toParent(container, element.groupId, serializedNodes);

  serializedNodes.push(container);

  if ((element as Container).label) {
    const label: TextSerializedNode = {
      id: element.id + "-label",
      parentId: element.id,
      type: "text",
      fontFamily: 'sans-serif',
      content: normalizeText((element as Container)?.label?.text || ""),
      fontSize: (element as Container)?.label?.fontSize,
      textAlign: (element as Container)?.label?.textAlign || "center",
      textBaseline: (element as Container)?.label?.verticalAlign || "middle",
      fill: (element as Container)?.label?.color || "#000",
      anchorX: element.width / 2,
      anchorY: element.height / 2,
      zIndex: 0,
    };
    serializedNodes.push(label);
  }
};

const transformToText = (
  element: Text,
  serializedNodes: SerializedNode[]
) => {
  const text: TextSerializedNode = {
    id: element.id,
    type: "text",
    fontFamily: 'sans-serif',
    content: normalizeText(element.text) || "",
    fontSize: element.fontSize,
    textBaseline: 'top',
    fill: element.color || "#000",
    anchorX: element.x,
    anchorY: element.y,
    zIndex: 0,
  };

  toParent(text, element.groupId, serializedNodes);
  serializedNodes.push(text);
};

const transformToArrow = (arrow: Arrow, serializedNodes: SerializedNode[]) => {
  const arrowElement: LineSerializedNode = {
    id: arrow.id ?? uuidv4(),
    type: "line",
    x1: arrow.startX,
    y1: arrow.startY,
    x2: arrow.endX,
    y2: arrow.endY,
    zIndex: 0,
    stroke: arrow.strokeColor || "#000",
    strokeWidth: arrow.strokeWidth || 1,
    hitStrokeWidth: (arrow.strokeWidth || 1) * 4,
    markerStart: arrow.startArrowhead ? 'line' : undefined,
    markerEnd: arrow.endArrowhead ? 'line' : undefined,
    markerFactor: 4,
    // fromId: arrow.start.id,
    // toId: arrow.end.id,
    // endArrowhead: (arrow?.endArrowhead || null) as any,
    // startArrowhead: (arrow?.startArrowhead || null) as any,
    // label: {
    //   text: normalizeText(arrow?.label?.text || ""),
    //   fontSize: 16,
    //   textAlign: arrow?.label?.textAlign,
    //   verticalAlign: arrow?.label?.verticalAlign,
    // },
    // start: arrow.start,
    // end: arrow.end,
  };

  if (arrow.strokeStyle === 'dotted') {
    arrowElement.strokeDasharray = '10 4';
  }

  if (arrow.label) {
    const label: TextSerializedNode = {
      id: arrowElement.id + "-label",
      parentId: arrowElement.id,
      type: "text",
      content: normalizeText(arrow.label.text || ""),
      fontFamily: 'sans-serif',
      fontSize: arrow.label.fontSize ?? 16,
      textAlign: arrow.label.textAlign || "center",
      textBaseline: arrow.label.verticalAlign || "bottom",
      fill: "#000",
      zIndex: 0,
      anchorX: Math.abs(arrowElement.x2 - arrowElement.x1) / 2,
      anchorY: Math.abs(arrowElement.y2 - arrowElement.y1) / 2,
    };
    serializedNodes.push(label);
  }

  // if (arrow.groupId) {
  //   Object.assign(arrowElement, { groupIds: [arrow.groupId] });
  // }

  serializedNodes.push(arrowElement);
};

// function convertStateToSerializedNodes(vertices: Map<string, Vertex>, edges: Edge[], options: { fontSize: number }): SerializedNode[] {
//   const { fontSize } = options;

//   const serializedNodes: SerializedNode[] = [];
//   return serializedNodes;
// }
