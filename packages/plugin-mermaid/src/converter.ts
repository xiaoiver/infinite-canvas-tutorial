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
  deserializePoints,
  serializePoints,
  TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import {
  Edge,
  Flowchart,
} from '@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart';
import { Sequence } from '@excalidraw/mermaid-to-excalidraw/dist/parser/sequence';
import {
  StateEdge,
  StateNode,
} from '@excalidraw/mermaid-to-excalidraw/dist/parser/state';
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
import { State } from '@excalidraw/mermaid-to-excalidraw/dist/parser/state';
import { ERD } from '@excalidraw/mermaid-to-excalidraw/dist/parser/er';
import { Class } from '@excalidraw/mermaid-to-excalidraw/dist/parser/class';

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
  parsedMermaidData: Flowchart | Sequence | State | ERD | Class,
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
    case 'state': {
      const state = parsedMermaidData as State;
      const { nodes, edges } = state;
      return convertStateToSerializedNodes(nodes, edges, options);
    }
    case 'erd': {
      const erd = parsedMermaidData as ERD;
      return convertERDToSerializedNodes(erd, options);
    }
    default: {
      throw new Error(`Unsupported diagram type: ${type}`);
    }
  }
}

/**
 * @see https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/converter/types/er.ts
 */
function convertERDToSerializedNodes(
  chart: ERD,
  _options: { fontSize: number },
): SerializedNode[] {
  const root: GSerializedNode = {
    id: uuidv4(),
    type: 'g',
    zIndex: 0,
  };
  const serializedNodes: SerializedNode[] = [root];
  /** ER 表：解析器里 entity.id 与 groupId(nanoid) 可能不同，关系边仍引用 entity.id，需映射到画布节点 id（groupId） */
  const erBindingIdRemap = new Map<string, string>();

  chart.nodes.forEach((node) => {
    if (!node || !node.length) {
      return;
    }

    node.forEach((element) => {
      switch (element.type) {
        case 'line':
          transformToLine(element, serializedNodes, root.id);
          break;
        case 'rectangle':
        case 'ellipse':
          transformToContainer(element, serializedNodes, root.id, erBindingIdRemap);
          break;
        case 'text':
          transformToText(element, serializedNodes, root.id);
          break;
        default:
          throw new Error(`unknown type ${(element as Node).type}`);
      }
    });
  });

  chart.lines.forEach((line) => {
    if (!line) {
      return;
    }

    transformToLine(line, serializedNodes, root.id);
  });

  chart.arrows.forEach((arrow) => {
    if (!arrow) {
      return;
    }
    transformToArrow(arrow, serializedNodes, root.id, erBindingIdRemap);
  });

  chart.text.forEach((textElement) => {
    if (!textElement) {
      return;
    }
    transformToText(textElement, serializedNodes, root.id);
  });

  return serializedNodes;
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
          transformToLine(element, serializedNodes, root.id);
          break;

        case "rectangle":
        case "ellipse":
          transformToContainer(element, serializedNodes, root.id);
          break;

        case "text":
          transformToText(element, serializedNodes, root.id);
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
    transformToLine(line, serializedNodes, root.id);
  });

  Object.values(arrows).forEach((arrow) => {
    if (!arrow) {
      return;
    }

    transformToArrow(arrow, serializedNodes, root.id);
    if (arrow.sequenceNumber) {
      transformToContainer(arrow.sequenceNumber, serializedNodes, root.id);
    }
  });

  return serializedNodes;
}

/**
 * 解析器给出的 line/text 多为 SVG 画布坐标；挂到带 x/y 的父节点下时需转为父级局部坐标。
 */
function parentLocalOrigin(parent: SerializedNode | undefined): { ox: number; oy: number } | null {
  if (!parent) {
    return null;
  }
  const n = parent as { x?: number; y?: number };
  if (typeof n.x === 'number' && typeof n.y === 'number') {
    return { ox: n.x, oy: n.y };
  }
  return null;
}

function offsetLineEndpointsToParentLocal(
  line: LineSerializedNode,
  serializedNodes: SerializedNode[],
) {
  if (!line.parentId) {
    return;
  }
  const o = parentLocalOrigin(serializedNodes.find((p) => p.id === line.parentId));
  if (!o) {
    return;
  }
  line.x1 -= o.ox;
  line.y1 -= o.oy;
  line.x2 -= o.ox;
  line.y2 -= o.oy;
}

function offsetTextAnchorsToParentLocal(
  text: TextSerializedNode,
  element: Text,
  serializedNodes: SerializedNode[],
) {
  if (!text.parentId) {
    return;
  }
  const o = parentLocalOrigin(serializedNodes.find((p) => p.id === text.parentId));
  if (!o) {
    return;
  }
  text.anchorX = element.x - o.ox;
  text.anchorY = element.y - o.oy;
}

function offsetPolylinePointsToParentLocal(
  poly: PolylineSerializedNode,
  serializedNodes: SerializedNode[],
) {
  if (!poly.points || !poly.parentId) {
    return;
  }
  const o = parentLocalOrigin(serializedNodes.find((p) => p.id === poly.parentId));
  if (!o) {
    return;
  }
  const pts = deserializePoints(poly.points).map(
    ([x, y]) => [x - o.ox, y - o.oy] as [number, number],
  );
  poly.points = serializePoints(pts);
}

const transformToLine = (
  element: Line,
  serializedNodes: SerializedNode[],
  rootId: string
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

  toParent(line, element.groupId, serializedNodes, rootId);
  offsetLineEndpointsToParentLocal(line, serializedNodes);
  serializedNodes.push(line);
};

const toParent = (node: SerializedNode, parentId: string, serializedNodes: SerializedNode[], rootId: string) => {
  if (parentId) {
    let parent = serializedNodes.find((node) => node.id === parentId);
    if (!parent) {
      parent = {
        id: parentId,
        type: "g",
      } as GSerializedNode;

      if (rootId) {
        parent.parentId = rootId;
      }
      serializedNodes.push(parent);
    }
    node.parentId = parentId;
  }
}

const transformToContainer = (
  element: Exclude<Node, Line | Arrow | Text>,
  serializedNodes: SerializedNode[],
  rootId: string,
  bindingIdRemap?: Map<string, string>,
) => {
  let extraProps = {};
  if (element.type === "rectangle" && element.subtype === "activation") {
    extraProps = {
      fill: "#e9ecef",
    };
  }
  /** 有 groupId 时以组 id 作为节点 id（即「自己就是 group」），不再额外挂一层空 g；无 groupId 时用 element.id */
  const containerId = element.groupId ?? element.id ?? uuidv4();
  if (element.id && containerId !== element.id) {
    bindingIdRemap?.set(element.id, containerId);
  }

  const container: RectSerializedNode | EllipseSerializedNode = {
    id: containerId,
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

  if (rootId) {
    container.parentId = rootId;
  }

  serializedNodes.push(container);

  if ((element as Container).label) {
    const c = element as Container;
    const va = c.label?.verticalAlign ?? 'middle';
    /** ER 表头等：verticalAlign 为 top 时标题应在框顶，而非整框垂直居中 */
    let anchorY: number;
    let textBaseline: TextSerializedNode['textBaseline'];
    if (va === 'top') {
      anchorY = 0;
      textBaseline = 'top';
    } else if (va === 'bottom') {
      anchorY = element.height;
      textBaseline = 'bottom';
    } else {
      anchorY = element.height / 2;
      textBaseline = 'middle';
    }
    const label: TextSerializedNode = {
      id: `${containerId}-label`,
      parentId: containerId,
      type: "text",
      fontFamily: 'sans-serif',
      content: normalizeText(c.label?.text || ''),
      fontSize: c.label?.fontSize,
      textAlign: c.label?.textAlign || 'center',
      textBaseline,
      fill: c.label?.color || '#000',
      anchorX: element.width / 2,
      anchorY,
      zIndex: 0,
    };
    serializedNodes.push(label);
  }
};

const transformToText = (
  element: Text,
  serializedNodes: SerializedNode[],
  rootId: string
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

  toParent(text, element.groupId, serializedNodes, rootId);
  offsetTextAnchorsToParentLocal(text, element, serializedNodes);
  serializedNodes.push(text);
};

/**
 * ER 图中 {@link Arrow} 带实体绑定：parseRelationship 设置 `start`/`end` 为 `{ id, type }`。
 * 有序 id 时与 flowchart 一致走正交绑定边，无需序列化 SVG 采样 points。
 */
function getArrowBindingEndpointIds(arrow: Arrow): { fromId?: string; toId?: string } {
  const s = arrow.start;
  const e = arrow.end;
  const fromId =
    s && typeof s === 'object' && s !== null && 'id' in s
      ? String((s as { id: string }).id)
      : undefined;
  const toId =
    e && typeof e === 'object' && e !== null && 'id' in e
      ? String((e as { id: string }).id)
      : undefined;
  if (!fromId || !toId) {
    return {};
  }
  return { fromId, toId };
}

const transformToArrow = (
  arrow: Arrow,
  serializedNodes: SerializedNode[],
  rootId: string,
  bindingIdRemap?: Map<string, string>,
) => {
  const id = arrow.id ?? uuidv4();

  const pushPolylineArrow = (poly: PolylineSerializedNode) => {
    if (arrow.strokeStyle === 'dotted') {
      poly.strokeDasharray = '10 4';
    }
    if (rootId) {
      poly.parentId = rootId;
    }
    toParent(poly, arrow.groupId, serializedNodes, rootId);
    offsetPolylinePointsToParentLocal(poly, serializedNodes);
    serializedNodes.push(poly);
    if (arrow.label) {
      const label: TextSerializedNode = {
        id: `${id}-label`,
        parentId: id,
        type: 'text',
        content: normalizeText(arrow.label.text || ''),
        fontFamily: 'sans-serif',
        fontSize: arrow.label.fontSize ?? 16,
        textAlign: arrow.label.textAlign || 'center',
        textBaseline: arrow.label.verticalAlign || 'bottom',
        fill: '#000',
        zIndex: 1,
        stroke: 'white',
        strokeWidth: 4,
        edgeLabelPosition: 0.5,
        edgeLabelOffset: -10,
      };
      serializedNodes.push(label);
    }
  };

  if (arrow.points && arrow.points.length >= 2) {
    let { fromId, toId } = getArrowBindingEndpointIds(arrow);
    if (fromId && toId && bindingIdRemap?.size) {
      fromId = bindingIdRemap.get(fromId) ?? fromId;
      toId = bindingIdRemap.get(toId) ?? toId;
    }

    if (fromId && toId) {
      pushPolylineArrow({
        id,
        type: 'polyline',
        fromId,
        toId,
        edgeStyle: EdgeStyle.ORTHOGONAL,
        zIndex: 0,
        stroke: arrow.strokeColor || '#000',
        strokeWidth: arrow.strokeWidth || 1,
        hitStrokeWidth: (arrow.strokeWidth || 1) * 4,
        markerStart: arrow.startArrowhead ? 'line' : undefined,
        markerEnd: arrow.endArrowhead ? 'line' : undefined,
        markerFactor: 4,
      });
      return;
    }

    /** 无实体 id 时（如部分 sequence 箭头）仍用采样点折线 */
    const absPoints: [number, number][] = arrow.points.map(([rx, ry]) => [
      arrow.startX + rx,
      arrow.startY + ry,
    ]);
    pushPolylineArrow({
      id,
      type: 'polyline',
      points: serializePoints(absPoints),
      zIndex: 0,
      stroke: arrow.strokeColor || '#000',
      strokeWidth: arrow.strokeWidth || 1,
      hitStrokeWidth: (arrow.strokeWidth || 1) * 4,
      markerStart: arrow.startArrowhead ? 'line' : undefined,
      markerEnd: arrow.endArrowhead ? 'line' : undefined,
      markerFactor: 4,
    });
    return;
  }

  const arrowElement: LineSerializedNode = {
    id,
    type: 'line',
    x1: arrow.startX,
    y1: arrow.startY,
    x2: arrow.endX,
    y2: arrow.endY,
    zIndex: 0,
    stroke: arrow.strokeColor || '#000',
    strokeWidth: arrow.strokeWidth || 1,
    hitStrokeWidth: (arrow.strokeWidth || 1) * 4,
    markerStart: arrow.startArrowhead ? 'line' : undefined,
    markerEnd: arrow.endArrowhead ? 'line' : undefined,
    markerFactor: 4,
  };

  if (arrow.strokeStyle === 'dotted') {
    arrowElement.strokeDasharray = '10 4';
  }

  if (arrow.label) {
    const label: TextSerializedNode = {
      id: arrowElement.id + '-label',
      parentId: arrowElement.id,
      type: 'text',
      content: normalizeText(arrow.label.text || ''),
      fontFamily: 'sans-serif',
      fontSize: arrow.label.fontSize ?? 16,
      textAlign: arrow.label.textAlign || 'center',
      textBaseline: arrow.label.verticalAlign || 'bottom',
      fill: '#000',
      zIndex: 0,
      anchorX: Math.abs(arrowElement.x2 - arrowElement.x1) / 2,
      anchorY: Math.abs(arrowElement.y2 - arrowElement.y1) / 2,
    };
    serializedNodes.push(label);
  }

  serializedNodes.push(arrowElement);
};

function stateNodeDisplayText(node: StateNode): string {
  const lines = [node.text, ...node.description].filter(
    (line) => line && String(line).trim().length > 0,
  );
  return lines.join('\n');
}

function strokeWidthFromStateContainer(
  containerStyle: StateNode['containerStyle'],
): number {
  const raw = containerStyle['stroke-width'];
  if (!raw) {
    return 2;
  }
  const n = parseFloat(String(raw).replace(/px/gi, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/** 若某 id 被任意节点的 parentId 引用，则该 id 对应复合状态（非叶子） */
function stateIdsOfCompositeNodes(nodes: StateNode[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (n.parentId) {
      ids.add(n.parentId);
    }
  }
  return ids;
}

function convertStateToSerializedNodes(
  nodes: StateNode[],
  edges: StateEdge[],
  options: { fontSize: number },
): SerializedNode[] {
  const { fontSize } = options;

  const compositeStateIds = stateIdsOfCompositeNodes(nodes);

  const root: GSerializedNode = {
    id: uuidv4(),
    type: 'g',
    zIndex: 0,
  };
  const serializedNodes: SerializedNode[] = [root];

  nodes.forEach((node) => {
    if (!node.isRenderable) {
      return;
    }

    const fill = node.containerStyle.fill ?? 'transparent';
    const startFill = node.containerStyle.fill ?? 'black';
    const stroke = node.containerStyle.stroke ?? 'black';
    const strokeWidth = strokeWidthFromStateContainer(node.containerStyle);
    const labelColor = node.labelStyle.color ?? 'black';

    const w = node.width;
    const h = node.height;

    switch (node.shape) {
      case 'stateStart': {
        const ellipse: EllipseSerializedNode = {
          id: node.id,
          parentId: root.id,
          type: 'ellipse',
          x: node.x,
          y: node.y,
          width: w,
          height: h,
          stroke,
          strokeWidth,
          fill: startFill,
          zIndex: 0,
          version: 0,
        };
        serializedNodes.push(ellipse);
        break;
      }
      case 'stateEnd': {
        const outer: EllipseSerializedNode = {
          id: node.id,
          parentId: root.id,
          type: 'ellipse',
          x: node.x,
          y: node.y,
          width: w,
          height: h,
          stroke,
          strokeWidth,
          fill: 'transparent',
          zIndex: 0,
          version: 0,
        };
        serializedNodes.push(outer);
        if (node.endInnerColor) {
          const inset = Math.min(w, h) * 0.22;
          const inner: EllipseSerializedNode = {
            id: `${node.id}-inner`,
            parentId: root.id,
            type: 'ellipse',
            x: node.x + inset,
            y: node.y + inset,
            width: w - inset * 2,
            height: h - inset * 2,
            stroke: 'transparent',
            strokeWidth: 0,
            fill: node.endInnerColor,
            zIndex: 1,
            version: 0,
          };
          serializedNodes.push(inner);
        }
        break;
      }
      case 'choice': {
        const pathNode: PathSerializedNode = {
          id: node.id,
          parentId: root.id,
          type: 'path',
          x: node.x,
          y: node.y,
          width: w,
          height: h,
          d: `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
          stroke,
          strokeWidth,
          fill,
          zIndex: 0,
          version: 0,
        };
        serializedNodes.push(pathNode);
        break;
      }
      default: {
        const cornerRadius =
          node.shape === 'roundedWithTitle' || node.shape === 'rectWithTitle'
            ? 8
            : node.shape === 'note'
              ? 4
              : 0;
        const rect: RectSerializedNode = {
          id: node.id,
          parentId: root.id,
          type: 'rect',
          x: node.x,
          y: node.y,
          width: w,
          height: h,
          stroke,
          strokeWidth,
          fill,
          zIndex: 0,
          version: 0,
        };
        if (cornerRadius > 0) {
          rect.cornerRadius = cornerRadius;
        }
        serializedNodes.push(rect);
      }
    }

    const display = stateNodeDisplayText(node);
    /** 起始/终止圆、choice 菱形等伪状态不画内部标签（Mermaid 仍会解析出 state 名如 Decision） */
    const skipShapeLabel =
      node.shape === 'stateStart' ||
      node.shape === 'stateEnd' ||
      node.shape === 'fork' ||
      node.shape === 'join' ||
      node.shape === 'choice';
    if (!skipShapeLabel && display.trim()) {
      const isLeafState = !compositeStateIds.has(node.id);
      const anchorY = isLeafState ? h / 2 : 0;
      const textBaseline = isLeafState ? 'middle' : 'top';
      const textSerializedNode: TextSerializedNode = {
        id: `${node.id}-text`,
        parentId: node.id,
        type: 'text',
        anchorX: w / 2,
        anchorY,
        content: getText({ text: display, labelType: 'text' } as Vertex),
        fontSize,
        fontFamily: 'sans-serif',
        fill: labelColor,
        textAlign: 'center',
        textBaseline,
        zIndex: 1,
        version: 0,
        wordWrap: true,
        wordWrapWidth: w,
      };
      serializedNodes.push(textSerializedNode);
    }

    if (node.dividerLine) {
      const { startX, startY, endX, endY } = node.dividerLine;
      const divider: LineSerializedNode = {
        id: `${node.id}-divider`,
        parentId: root.id,
        type: 'line',
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        stroke,
        strokeWidth,
        hitStrokeWidth: strokeWidth * 4,
        zIndex: 2,
        version: 0,
      };
      serializedNodes.push(divider);
    }
  });

  edges.forEach((edge) => {
    const pts = edge.reflectionPoints.map((p) => [p.x, p.y] as [number, number]);
    if (pts.length < 2) {
      return;
    }

    const strokeDasharray =
      edge.strokeStyle === 'dashed' ? '10 4' : undefined;

    const path = {
      id: edge.id,
      parentId: root.id,
      type: 'path' as const,
      /** 与 mermaid-to-excalidraw state 转换一致：语义端点 id，见 createArrowElement 的 start/end */
      fromId: edge.start,
      toId: edge.end,
      stroke: edge.strokeColor ?? 'black',
      strokeWidth: edge.strokeWidth ?? 2,
      hitStrokeWidth: (edge.strokeWidth ?? 2) * 4,
      strokeDasharray,
      markerEnd: edge.isNoteEdge ? undefined : 'line',
      markerFactor: 4,
      zIndex: 0,
      version: 0,
      edgeStyle: EdgeStyle.ORTHOGONAL,
      curved: true,
      bezier: true,
    } as PathSerializedNode;
    serializedNodes.push(path);

    const labelText = getText({ text: edge.text, labelType: 'text' } as Vertex).trim();
    if (!labelText) {
      return;
    }

    const textSerializedNode: TextSerializedNode = {
      id: `${edge.id}-label`,
      parentId: path.id,
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
