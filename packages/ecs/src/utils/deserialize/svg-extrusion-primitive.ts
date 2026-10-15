import type {
  PathSerializedNode,
  SerializedNode,
} from '../../types/serialized-node';
import { buildPathExtrusionMesh } from '../path-extrusion-mesh';

function roundedRectPath(
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.min(radius, width / 2, height / 2);
  return (
    `M${r} 0 H${width - r} A${r} ${r} 0 0 1 ${width} ${r} ` +
    `V${height - r} A${r} ${r} 0 0 1 ${width - r} ${height} ` +
    `H${r} A${r} ${r} 0 0 1 0 ${height - r} ` +
    `V${r} A${r} ${r} 0 0 1 ${r} 0 Z`
  );
}

function ellipsePath(width: number, height: number): string {
  const rx = width / 2;
  const ry = height / 2;
  return `M${width} ${ry} A${rx} ${ry} 0 0 1 0 ${ry} A${rx} ${ry} 0 0 1 ${width} ${ry} Z`;
}

/** Keep unsupported SVG primitives in their original 2D node type. */
export function extrudeSvgPrimitive(
  node: SerializedNode,
  depth: number,
  paintSupported: boolean,
): SerializedNode {
  if ((node.type !== 'rect' && node.type !== 'ellipse') || !paintSupported)
    return node;

  const { width, height } = node;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return node;

  if (node.type === 'rect') {
    const radius = node.cornerRadius ?? 0;
    if (!Number.isFinite(radius) || radius < 0) return node;
    if (radius === 0) return { ...node, extrude3d: depth };

    const d = roundedRectPath(width, height, radius);
    if (!buildPathExtrusionMesh(d)) return node;
    const { cornerRadius: _cornerRadius, ...rest } = node;
    return {
      ...rest,
      type: 'path',
      d,
      fillRule: 'nonzero',
      extrude3d: depth,
    } as PathSerializedNode;
  }

  const d = ellipsePath(width, height);
  if (!buildPathExtrusionMesh(d)) return node;
  const { cx: _cx, cy: _cy, rx: _rx, ry: _ry, ...rest } = node;
  return {
    ...rest,
    type: 'path',
    d,
    fillRule: 'nonzero',
    extrude3d: depth,
  } as PathSerializedNode;
}
