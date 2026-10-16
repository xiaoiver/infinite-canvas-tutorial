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
import { clipFilledContoursToPolygon } from '../geometry3d/extrude-path';
import { extrudeSvgPrimitive } from './svg-extrusion-primitive';
import { positivePixelLength, sliceAspectRatio, viewBoxMatrix } from './svg-viewbox';

type Point = [number, number];
type ProjectedPath = {
  d: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type ClipResult =
  | { kind: 'inside' | 'empty' | 'invalid' }
  | { kind: 'clipped'; path: ProjectedPath };
type ViewportResult =
  | { kind: 'none' | 'empty' | 'invalid' }
  | { kind: 'polygon'; polygon: Point[] };

const isIdentity = (m: Matrix) =>
  m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;

function transformAttribute(element: SVGElement): Matrix {
  const value = element.getAttribute('transform');
  return value ? compose(fromDefinition(fromTransformAttribute(value))) : identity();
}

/** SVG's viewBox-to-viewport transform for explicit pixel dimensions. */
function rootViewBox(root: SVGSVGElement): Matrix {
  const width = positivePixelLength(root.getAttribute('width'));
  const height = positivePixelLength(root.getAttribute('height'));
  return width && height ? viewBoxMatrix(root, width, height) ?? identity() : identity();
}

/** The root viewport itself is transformed by the root SVG transform. */
function sliceViewport(root: SVGSVGElement): Point[] | undefined {
  if (!sliceAspectRatio(root)) return;
  const width = positivePixelLength(root.getAttribute('width'));
  const height = positivePixelLength(root.getAttribute('height'));
  if (!width || !height) return;
  const { a, b, c, d, e, f } = transformAttribute(root);
  return [[0, 0], [width, 0], [width, height], [0, height]].map(
    ([x, y]): Point => [a * x + c * y + e, b * x + d * y + f],
  );
}

function sourceTransform(
  element: SVGElement,
  root: SVGSVGElement | undefined,
): { matrix: Matrix; hasShear: boolean; clipViewports: Point[][] } {
  const chain: SVGElement[] = [];
  let current: SVGElement | null = element;
  while (current && (root ? current !== root : current.localName !== 'svg')) {
    chain.unshift(current);
    current = current.parentElement as unknown as SVGElement | null;
  }
  if (root) chain.unshift(root);
  let matrix = identity();
  let hasShear = false;
  const clipViewports: Point[][] = [];
  for (const item of chain) {
    const nestedViewport = item.getAttribute('data-svg-viewport');
    if (nestedViewport) {
      const [width, height] = nestedViewport.split(' ').map(Number);
      const outerTransform = item.getAttribute('data-svg-viewport-transform');
      const outerMatrix = outerTransform
        ? compose([matrix, compose(fromDefinition(fromTransformAttribute(outerTransform)))])
        : matrix;
      const { a, b, c, d, e, f } = outerMatrix;
      clipViewports.push(
        [[0, 0], [width, 0], [width, height], [0, height]].map(
          ([x, y]): Point => [a * x + c * y + e, b * x + d * y + f],
        ),
      );
    }
    const part = transformAttribute(item);
    const x = Math.hypot(part.a, part.b), y = Math.hypot(part.c, part.d);
    if (x && y && Math.abs(part.a * part.c + part.b * part.d) > x * y * 1e-8)
      hasShear = true;
    matrix = item === root
      ? compose([matrix, part, rootViewBox(root)])
      : compose([matrix, part]);
  }
  return { matrix, hasShear, clipViewports };
}

function intersectViewports(viewports: Point[][]): ViewportResult {
  if (!viewports.length) return { kind: 'none' };
  let polygon = viewports[0];
  for (const viewport of viewports.slice(1)) {
    const intersection = clipFilledContoursToPolygon([polygon], 'nonzero', viewport);
    if (!intersection) return { kind: 'invalid' };
    if (!intersection.length) return { kind: 'empty' };
    if (intersection.length !== 1) return { kind: 'invalid' };
    polygon = intersection[0];
  }
  return { kind: 'polygon', polygon };
}

function pathForSource(node: SerializedNode, depth: number, radii?: { rx: number; ry: number }): string | undefined {
  if (node.type === 'path') return node.d;
  if (node.type !== 'rect' && node.type !== 'ellipse' && node.type !== 'polyline') return;
  const converted = extrudeSvgPrimitive(node, depth, true, radii);
  if (converted.type === 'path') return converted.d;
  if (converted.type === 'rect' && converted.width! > 0 && converted.height! > 0) {
    const { width, height } = converted;
    return 'M0 0 H' + width + ' V' + height + ' H0 Z';
  }
}

function projectContours(
  d: string,
  x: number,
  y: number,
  matrix: Matrix,
): Point[][] | undefined {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return;
  const scale = 2 * Math.max(1, Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
  const contours = flattenPath(parsePath(d).subPaths, scale).map((contour) =>
    contour.map(([px, py]) => [
      matrix.a * (px + x) + matrix.c * (py + y) + matrix.e,
      matrix.b * (px + x) + matrix.d * (py + y) + matrix.f,
    ] as Point),
  );
  if (contours.some((contour) => contour.length < 3)) return;
  return contours;
}

function pathFromContours(
  contours: Point[][],
): ProjectedPath | undefined {
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

function projectPath(
  d: string,
  x: number,
  y: number,
  matrix: Matrix,
): ProjectedPath | undefined {
  const contours = projectContours(d, x, y, matrix);
  return contours && pathFromContours(contours);
}

function withinViewport(point: Point, polygon: Point[]): boolean {
  const area = polygon.reduce((sum, [x, y], index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + x * next[1] - next[0] * y;
  }, 0);
  const sign = area >= 0 ? 1 : -1;
  return polygon.every(([x, y], index) => {
    const next = polygon[(index + 1) % polygon.length];
    const cross = (next[0] - x) * (point[1] - y) -
      (next[1] - y) * (point[0] - x);
    return cross * sign >= -1e-7;
  });
}

function clipProjectedPath(
  d: string,
  x: number,
  y: number,
  matrix: Matrix,
  viewport: Point[],
  fillRule: CanvasFillRule,
): ClipResult {
  const contours = projectContours(d, x, y, matrix);
  if (!contours) return { kind: 'invalid' };
  if (contours.every((contour) => contour.every((point) =>
    withinViewport(point, viewport))))
    return { kind: 'inside' };
  const clipped = clipFilledContoursToPolygon(contours, fillRule, viewport);
  if (!clipped) return { kind: 'invalid' };
  if (!clipped.length) return { kind: 'empty' };
  const path = pathFromContours(clipped);
  return path ? { kind: 'clipped', path } : { kind: 'invalid' };
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
  const slice = root ? sliceViewport(root) : undefined;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let plainNodes: SerializedNode[] | undefined;
  return nodes.map((node, index) => {
    if (!('extrude3d' in node) || !node.extrude3d) return node;
    const element = nodeElements.get(node.id);
    if (!element) return node;
    const { matrix, hasShear, clipViewports } = sourceTransform(element, root);
    if (!hasShear && isIdentity(viewport) && !slice && !clipViewports.length) return node;
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
      const fillRule = node.type === 'path' ? node.fillRule ?? 'nonzero' : 'nonzero';
      const clippedViewport = intersectViewports([
        ...(slice ? [slice] : []), ...clipViewports,
      ]);
      if (clippedViewport.kind === 'empty')
        return { ...node, visibility: 'hidden', extrude3d: undefined };
      if (clippedViewport.kind === 'invalid')
        return { ...node, extrude3d: undefined };
      if (clippedViewport.kind === 'polygon') {
        const clipped = clipProjectedPath(
          source, plain.x ?? 0, plain.y ?? 0, matrix,
          clippedViewport.polygon, fillRule,
        );
        if (clipped.kind === 'empty')
          return { ...node, visibility: 'hidden', extrude3d: undefined };
        if (clipped.kind === 'invalid') return { ...node, extrude3d: undefined };
        // Fully contained shapes can keep their editable group hierarchy when
        // no root transform or shear needs to be baked into the source.
        if (clipped.kind === 'inside' && !hasShear && isIdentity(viewport) &&
          (!root || isIdentity(transformAttribute(root)))) return node;
        if (clipped.kind === 'clipped') {
          const path = clipped.path;
          if (!buildPathExtrusionMesh(path.d, 'evenodd'))
            return { ...node, extrude3d: undefined };
          const { cornerRadius: _cornerRadius, ...rest } = node as typeof node & { cornerRadius?: number };
          return {
            ...rest,
            ...inherited.get(node.id),
            visibility,
            ...path,
            type: 'path',
            fillRule: 'evenodd',
            parentId: undefined,
            zIndex: index,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            extrude3d: depth,
          } as PathSerializedNode;
        }
      }
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
      if (!projected || !buildPathExtrusionMesh(projected.d, fillRule))
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
