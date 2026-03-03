import { isNil } from '@antv/util';
import { EdgeStyle, PathSerializedNode, PolylineSerializedNode, RectSerializedNode, SerializedNode, TextSerializedNode } from '@infinite-canvas-tutorial/ecs';
import { mxGraphModel, parseDrawIO, parseDictionary } from 'mxgraphdata';

export const parseMxgraphDataToSerializedNodes = async (definition: string) => {
  const result = (await parseDrawIO(definition)) as mxGraphModel;

  const nodes: SerializedNode[] = [];
  result.root.mxCell.forEach((mxCell) => {
    const node: SerializedNode = {
      id: `drawio-${mxCell._id}`,
      zIndex: 0,
    };

    const style = parseDictionary(mxCell._style as string);
    // vertex
    if (Number(mxCell._vertex) === 1) {
      const { _x: x, _y: y, _width: width, _height: height } = mxCell.mxGeometry as any;

      if (mxCell._style.includes('ellipse')) {
        node.type = 'ellipse';
      } else if (mxCell._style.includes('rhombus')) {
        node.type = 'path';
        (node as PathSerializedNode).d = `M ${0} ${height/2} L ${width/2} ${0} L ${width} ${height/2} L ${width/2} ${height} Z`;
      } else {
        node.type = 'rect';
      }

      const { fillColor, strokeColor, rounded } = style;
      if (fillColor) {
        (node as RectSerializedNode).fill = fillColor;
      }
      if (strokeColor) {
        (node as RectSerializedNode).stroke = strokeColor;
      }
      if (rounded) {
        (node as RectSerializedNode).cornerRadius = 10;
      }
      (node as RectSerializedNode).x = x;
      (node as RectSerializedNode).y = y;
      (node as RectSerializedNode).width = width;
      (node as RectSerializedNode).height = height;
      (node as RectSerializedNode).zIndex = 1; // higher than edges
    } else if (Number(mxCell._edge) === 1) {
      const { edgeStyle, exitX, exitY, entryX, entryY, exitDx, exitDy, entryDx, entryDy } = style;
      /**
       * {
        "edgeStyle": "orthogonalEdgeStyle",
        "exitX": 1,
        "exitY": 0.5,
        "exitDx": 0,
        "exitDy": 0,
        "entryX": 0,
        "entryY": 0.5,
        "entryDx": 0,
        "entryDy": 0,
        "rounded": 0,
        "orthogonalLoop": 1,
        "jettySize": "auto",
        "html": 1,
        "endArrow": "classic"
        }
        */
      node.type = 'polyline';

      if (edgeStyle === 'orthogonalEdgeStyle') {
        (node as PolylineSerializedNode).edgeStyle = EdgeStyle.ORTHOGONAL;
      }

      (node as PolylineSerializedNode).fromId = `drawio-${mxCell._source}`;
      (node as PolylineSerializedNode).toId = `drawio-${mxCell._target}`;
      (node as PolylineSerializedNode).stroke = 'black';
      (node as PolylineSerializedNode).strokeWidth = 2;
      (node as PolylineSerializedNode).markerEnd = 'line';
      (node as PolylineSerializedNode).exitX = exitX;
      (node as PolylineSerializedNode).exitY = exitY;
      (node as PolylineSerializedNode).entryX = entryX;
      (node as PolylineSerializedNode).entryY = entryY;
      (node as PolylineSerializedNode).exitDx = exitDx;
      (node as PolylineSerializedNode).exitDy = exitDy;
      (node as PolylineSerializedNode).entryDx = entryDx;
      (node as PolylineSerializedNode).entryDy = entryDy;
    } else {
      node.type = 'g';
    }

    if (mxCell._value) {
      const labelNode: TextSerializedNode = {
        id: node.id + '-text',
        parentId: node.id,
        type: 'text',
        anchorX: node.width / 2,
        anchorY: node.height / 2,
        content: mxCell._value.replaceAll('&#xa;', '\n'),
        fontSize: style.fontSize ?? 12,
        fontFamily: 'sans-serif',
        fill: 'black',
        textAlign: 'center',
        textBaseline: 'middle',
        zIndex: 0,
      };
      nodes.push(labelNode);
    }

    if (!isNil(mxCell._parent)) {
      node.parentId = `drawio-${mxCell._parent}`;
    }

    if (node) {
      nodes.push(node);
    }
  });

  return nodes;
}