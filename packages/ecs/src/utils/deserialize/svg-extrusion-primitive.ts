import type {
  PathSerializedNode,
  SerializedNode,
} from '../../types/serialized-node';
import { buildPathExtrusionMesh } from '../path-extrusion-mesh';
import { deserializePoints } from './points';

function closedPolylinePath(points: string | undefined): string | undefined {
  if (!points) return;
  const vertices = deserializePoints(points);
  if (
    vertices.length < 4 ||
    vertices.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))
  ) return;
  const first = vertices[0], last = vertices[vertices.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 1e-8) return;
  return vertices.slice(0, -1).map(([x, y], index) =>
    `${index ? 'L' : 'M'}${x} ${y}`,
  ).join(' ') + ' Z';
}

/** The unfilled centerline/outline used when expanding a SVG stroke. */
export function svgPrimitiveStrokePath(
  node: SerializedNode,
  depth: number,
  rectRadii?: { rx: number; ry: number },
): string | undefined {
  if (node.type === 'path') return node.d;
  if (node.type === 'line') {
    const { x1, y1, x2, y2 } = node;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;
    return `M${x1} ${y1} L${x2} ${y2}`;
  }
  if (node.type === 'polyline') {
    const points = deserializePoints(node.points);
    if (points.length < 2 || points.some(([x, y]) =>
      !Number.isFinite(x) || !Number.isFinite(y))) return;
    const closed = points.length > 2 &&
      Math.hypot(points[0][0] - points[points.length - 1][0],
        points[0][1] - points[points.length - 1][1]) < 1e-8;
    return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`)
      .join(' ') + (closed ? ' Z' : '');
  }
  if (node.type !== 'rect' && node.type !== 'ellipse') return;
  const converted = extrudeSvgPrimitive(node, depth, true, rectRadii);
  if (converted.type === 'path') return converted.d;
  if (converted.type === 'rect' && converted.width! > 0 && converted.height! > 0)
    return `M0 0 H${converted.width} V${converted.height} H0 Z`;
}

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
  if (!paintSupported)
    return node;

  if (node.type === 'polyline') {
    const d = closedPolylinePath(node.points);
    const fillRule = (node as typeof node & { fillRule?: CanvasFillRule }).fillRule ?? 'nonzero';
    if (!d || !buildPathExtrusionMesh(d, fillRule)) return node;
    const { points: _points, ...rest } = node;
    return { ...rest, type: 'path', d, fillRule, extrude3d: depth } as PathSerializedNode;
  }

  if (node.type !== 'rect' && node.type !== 'ellipse') return node;

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
