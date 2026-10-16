import {
  compose,
  fromDefinition,
  fromTransformAttribute,
  identity,
  type Matrix,
} from 'transformation-matrix';
import type { PathSerializedNode, SerializedNode } from '../../types/serialized-node';
import { flattenPath } from '../curve/adaptive';
import { parsePath } from '../curve/shape-path';
import { buildPathExtrusionMesh } from '../path-extrusion-mesh';
import { extrudeSvgPrimitive } from './svg-extrusion-primitive';

const isIdentity = (m: Matrix) =>
  m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;

function transformAttribute(element: SVGElement): Matrix {
  const value = element.getAttribute('transform');
  return value ? compose(fromDefinition(fromTransformAttribute(value))) : identity();
}

function pixelLength(value: string | null): number | undefined {
  if (!value || !/^\s*[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?\s*$/.test(value))
    return;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

/** SVG's viewBox-to-viewport transform for explicit pixel dimensions. */
function rootViewBox(root: SVGSVGElement): Matrix {
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const width = pixelLength(root.getAttribute('width'));
  const height = pixelLength(root.getAttribute('height'));
  if (!viewBox || viewBox.length !== 4 || !width || !height) return identity();
  const [x, y, vw, vh] = viewBox;
  if (![x, y, vw, vh].every(Number.isFinite) || vw <= 0 || vh <= 0)
    return identity();

  const preserve = root.getAttribute('preserveAspectRatio')?.trim() || 'xMidYMid meet';
  const tokens = preserve.replace(/^defer\s+/, '').split(/\s+/);
  if (tokens[0] === 'none') {
    const sx = width / vw, sy = height / vh;
    return { a: sx, b: 0, c: 0, d: sy, e: -x * sx, f: -y * sy };
  }
  const align = /^(xMin|xMid|xMax)(YMin|YMid|YMax)$/.exec(tokens[0]);
  if (!align) return identity();
  const scale = tokens[1] === 'slice'
    ? Math.max(width / vw, height / vh)
    : Math.min(width / vw, height / vh);
  const dx = (width - vw * scale) * ({ xMin: 0, xMid: 0.5, xMax: 1 }[align[1]] ?? 0.5);
  const dy = (height - vh * scale) * ({ YMin: 0, YMid: 0.5, YMax: 1 }[align[2]] ?? 0.5);
  return { a: scale, b: 0, c: 0, d: scale, e: dx - x * scale, f: dy - y * scale };
}

function sourceTransform(
  element: SVGElement,
  root: SVGSVGElement | undefined,
): { matrix: Matrix; hasShear: boolean } {
  const chain: SVGElement[] = [];
  let current: SVGElement | null = element;
  while (current && (root ? current !== root : current.localName !== 'svg')) {
    chain.unshift(current);
    current = current.parentElement as unknown as SVGElement | null;
  }
  if (root) chain.unshift(root);
  let matrix = identity();
  let hasShear = false;
  for (const item of chain) {
    const part = transformAttribute(item);
    const x = Math.hypot(part.a, part.b), y = Math.hypot(part.c, part.d);
    if (x && y && Math.abs(part.a * part.c + part.b * part.d) > x * y * 1e-8)
      hasShear = true;
    matrix = item === root
      ? compose([matrix, part, rootViewBox(root)])
      : compose([matrix, part]);
  }
  return { matrix, hasShear };
}

function pathForSource(node: SerializedNode, depth: number, radii?: { rx: number; ry: number }): string | undefined {
  if (node.type === 'path') return node.d;
  if (node.type !== 'rect' && node.type !== 'ellipse') return;
  const converted = extrudeSvgPrimitive(node, depth, true, radii);
  if (converted.type === 'path') return converted.d;
  if (converted.type === 'rect' && converted.width! > 0 && converted.height! > 0) {
    const { width, height } = converted;
    return 'M0 0 H' + width + ' V' + height + ' H0 Z';
  }
}

function projectPath(
  d: string,
  x: number,
  y: number,
  matrix: Matrix,
): { d: string; x: number; y: number; width: number; height: number } | undefined {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return;
  const scale = 2 * Math.max(1, Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
  const contours = flattenPath(parsePath(d).subPaths, scale).map((contour) =>
    contour.map(([px, py]) => [
      matrix.a * (px + x) + matrix.c * (py + y) + matrix.e,
      matrix.b * (px + x) + matrix.d * (py + y) + matrix.f,
    ] as [number, number]),
  );
  if (contours.some((contour) => contour.length < 3)) return;
  const points = contours.flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
  const round = (value: number) => Number(value.toFixed(5));
  const local = contours.map((contour) => {
    const distinct = contour.slice();
    const first = distinct[0], last = distinct[distinct.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-8)
      distinct.pop();
    return distinct.map(([px, py], index) =>
      (index ? 'L' : 'M') + round(px - minX) + ' ' + round(py - minY),
    ).join(' ') + ' Z';
  }).join(' ');
  return { d: local, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Reproject only SVG extrusions whose source transform contains shear or whose
 * root viewBox has an explicit viewport. Other nodes keep the normal 2D importer.
 */
export function reprojectSvgExtrusion(
  nodes: SerializedNode[],
  getPlainNodes: () => SerializedNode[],
  root: SVGSVGElement | undefined,
  nodeElements: Map<string, SVGElement>,
  inherited: Map<string, Record<string, unknown>>,
  depth: number,
  rectRadii: Map<string, { rx: number; ry: number }>,
): SerializedNode[] {
  const viewport = root ? rootViewBox(root) : identity();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let plainNodes: SerializedNode[] | undefined;
  return nodes.map((node, index) => {
    if (!('extrude3d' in node) || !node.extrude3d) return node;
    const element = nodeElements.get(node.id);
    if (!element) return node;
    const { matrix, hasShear } = sourceTransform(element, root);
    if (!hasShear && isIdentity(viewport)) return node;
    // Baked coordinates leave the SVG group hierarchy, so carry inherited
    // visibility and paint onto the detached source node.
    let visibility = node.visibility;
    let ancestor = byId.get(node.parentId ?? '');
    while ((!visibility || visibility === 'inherited') && ancestor) {
      visibility = ancestor.visibility;
      ancestor = byId.get(ancestor.parentId ?? '');
    }
    try {
      plainNodes ??= getPlainNodes();
      const plain = plainNodes[index];
      if (!plain) return node;
      const source = pathForSource(plain, depth, rectRadii.get(node.id));
      if (!source) return node;
      const scaleX = Math.hypot(matrix.a, matrix.b);
      const scaleY = (matrix.a * matrix.d - matrix.b * matrix.c) / scaleX;
      const otherLength = Math.hypot(matrix.c, matrix.d);
      if (
        scaleX > 0 && Number.isFinite(scaleY) &&
        Math.abs(matrix.a * matrix.c + matrix.b * matrix.d) <=
          scaleX * otherLength * 1e-8
      ) {
        const x = matrix.a * (plain.x ?? 0) + matrix.c * (plain.y ?? 0) + matrix.e;
        const y = matrix.b * (plain.x ?? 0) + matrix.d * (plain.y ?? 0) + matrix.f;
        const pose = {
          ...node,
          ...inherited.get(node.id),
          visibility,
          x, y,
          width: plain.width,
          height: plain.height,
          rotation: Math.atan2(matrix.b, matrix.a),
          scaleX,
          scaleY,
          parentId: undefined,
          zIndex: index,
        };
        if (node.type === 'rect') return pose;
        return { ...pose, type: 'path', d: source } as PathSerializedNode;
      }
      const projected = projectPath(source, plain.x ?? 0, plain.y ?? 0, matrix);
      if (!projected || !buildPathExtrusionMesh(projected.d, node.type === 'path' ? node.fillRule : 'nonzero'))
        return { ...node, extrude3d: undefined };
      const { cornerRadius: _cornerRadius, ...rest } = node as typeof node & { cornerRadius?: number };
      return {
        ...rest,
        ...inherited.get(node.id),
        visibility,
        ...projected,
        type: 'path',
        parentId: undefined,
        zIndex: index,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        extrude3d: depth,
      } as PathSerializedNode;
    } catch {
      return { ...node, extrude3d: undefined };
    }
  });
}
