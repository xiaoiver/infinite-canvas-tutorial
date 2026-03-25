import {
  EdgeStyle,
  EllipseSerializedNode,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
  TextSerializedNode,
} from "@infinite-canvas-tutorial/ecs";
import { VERTEX_TYPE, type Edge, type ParsedMermaidData, type Vertex } from "./interfaces";
import { getText } from "./utils";

export function convertParsedMermaidDataToSerializedNodes(parsedMermaidData: ParsedMermaidData, options: { fontSize: number }): SerializedNode[] {
  const { type, vertices, edges } = parsedMermaidData;
  switch (type) {
    case "flowchart": {
      return convertFlowchartToSerializedNodes(vertices, edges, options);
    }
    default: {
      throw new Error(`Unsupported diagram type: ${type}`);
    }
  }
}

function convertFlowchartToSerializedNodes(vertices: Map<string, Vertex>, edges: Edge[], options: { fontSize: number }): SerializedNode[] {
  const { fontSize } = options;

  const serializedNodes: SerializedNode[] = [];
  // Vertices (ParsedMermaidData uses Map; Object.values(Map) is always [].)
  Array.from(vertices.values()).forEach((vertex: Vertex) => {
    if (!vertex) {
      return;
    }

    const serializedNode: SerializedNode = {
      id: vertex.id,
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
        (serializedNode as unknown as EllipseSerializedNode).type = "ellipse";
        break;
      }
      case VERTEX_TYPE.DIAMOND: {
        const width = vertex.width;
        const height = vertex.height;
        const pathSerializedNode = serializedNode as unknown as PathSerializedNode;
        pathSerializedNode.type = "path";
        pathSerializedNode.d = `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`;
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
      type: 'polyline',
      fromId: edge.start,
      toId: edge.end,
      stroke: 'black',
      strokeWidth: 2,
      hitStrokeWidth: 2 * 4,
      markerEnd: 'line',
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