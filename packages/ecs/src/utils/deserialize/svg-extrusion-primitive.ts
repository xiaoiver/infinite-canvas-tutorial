import type {
  PathSerializedNode,
  SerializedNode,
} from '../../types/serialized-node';
import { buildPathExtrusionMesh } from '../path-extrusion-mesh';

function roundedRectPath(
  width: number,
  height: number,
  radiusX: number,
  radiusY: number,
): string {
  const rx = Math.min(radiusX, width / 2);
  const ry = Math.min(radiusY, height / 2);
  return (
    `M${rx} 0 H${width - rx} A${rx} ${ry} 0 0 1 ${width} ${ry} ` +
    `V${height - ry} A${rx} ${ry} 0 0 1 ${width - rx} ${height} ` +
    `H${rx} A${rx} ${ry} 0 0 1 0 ${height - ry} ` +
    `V${ry} A${rx} ${ry} 0 0 1 ${rx} 0 Z`
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
  rectRadii?: { rx: number; ry: number },
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
    const { rx, ry } = rectRadii ?? { rx: radius, ry: radius };
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx < 0 || ry < 0)
      return node;
    if (rx === 0 || ry === 0)
      return { ...node, cornerRadius: 0, extrude3d: depth };

    const d = roundedRectPath(width, height, rx, ry);
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
