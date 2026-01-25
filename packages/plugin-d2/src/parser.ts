import { D2 } from '@terrastruct/d2';
import { LineSerializedNode, SerializedNode, TextSerializedNode } from '@infinite-canvas-tutorial/ecs';

export const parseD2ToSerializedNodes = async (definition: string) => {
  const d2 = new D2();
  const { diagram, graph } = await d2.compile(definition);
  const { connections, shapes } = diagram;
  const { theme: { colors } } = graph;

  const nodes: SerializedNode[] = [];
  shapes.forEach((shape) => {
    // @ts-expect-error D2 types are not fully compatible with our types
    const { id, type, pos, width, height, fill, stroke, strokeWidth, opacity, label, fontSize, color } = shape;
    const node: SerializedNode = {
      id,
      type: type === 'rectangle' ? 'rect' : type as SerializedNode['type'],
      x: pos.x,
      y: pos.y,
      width,
      height,
      fill: colors[fill.toLowerCase()],
      stroke: colors[stroke.toLowerCase()],
      strokeWidth,
      opacity,
    };
    nodes.push(node);

    if (label) {
      const labelNode: TextSerializedNode = {
        id: id + '-text',
        parentId: id,
        type: 'text',
        anchorX: width / 2,
        anchorY: height / 2,
        content: label,
        fontSize,
        fontFamily: 'sans-serif',
        fill: colors.neutrals[color.toLowerCase()],
        textAlign: 'center',
        textBaseline: 'middle',
      };
      nodes.push(labelNode);
    }
  })

  connections.forEach((connection) => {
    const { id, src, dst, stroke, strokeWidth } = connection;
    const edge: LineSerializedNode = {
      id,
      type: 'line',
      fromId: src,
      toId: dst,
      stroke: colors[stroke.toLowerCase()],
      strokeWidth,
      markerEnd: 'line',
    };
    nodes.push(edge);
  });
  return nodes;
}