import {
  compose,
  fromDefinition,
  fromTransformAttribute,
  identity,
  type Matrix,
} from 'transformation-matrix';
import { flattenPath } from '../curve/adaptive';
import { parsePath } from '../curve/shape-path';
import type { FilledContourShape } from '../geometry3d/extrude-path';
import { deserializePoints } from './points';

type Point = [number, number];

export type SvgClipDefinition = {
  units: 'userSpaceOnUse' | 'objectBoundingBox';
  shapes: FilledContourShape[];
};

function pixel(
  value: string | null,
  fallback = 0,
  percentages = false,
): number | undefined {
  if (value === null) return fallback;
  if (
    !/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:px|%)?\s*$/.test(
      value,
    )
  )
    return;
  if (value.trim().endsWith('%') && !percentages) return;
  const result = Number.parseFloat(value);
  return Number.isFinite(result)
    ? value.trim().endsWith('%')
      ? result / 100
      : result
    : undefined;
}

function shapePath(
  element: SVGElement,
  objectBounds: boolean,
): { d: string; x: number; y: number } | undefined {
  const kind = element.localName;
  if (kind === 'path')
    return { d: element.getAttribute('d') || '', x: 0, y: 0 };
  if (kind === 'polygon' || kind === 'polyline') {
    const points = deserializePoints(element.getAttribute('points') || '');
    if (
      points.length < 3 ||
      points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))
    )
      return;
    return {
      d:
        points
          .map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`)
          .join(' ') + ' Z',
      x: 0,
      y: 0,
    };
  }
  if (kind === 'rect') {
    const x = pixel(element.getAttribute('x'), 0, objectBounds);
    const y = pixel(element.getAttribute('y'), 0, objectBounds);
    const width = pixel(element.getAttribute('width'), 0, objectBounds);
    const height = pixel(element.getAttribute('height'), 0, objectBounds);
    if (
      x === undefined ||
      y === undefined ||
      !width ||
      !height ||
      width < 0 ||
      height < 0
    )
      return;
    const rawRx = pixel(element.getAttribute('rx'), NaN, objectBounds);
    const rawRy = pixel(element.getAttribute('ry'), NaN, objectBounds);
    if (rawRx === undefined || rawRy === undefined) return;
    const rx = Math.min(
      Number.isNaN(rawRx) ? (Number.isNaN(rawRy) ? 0 : rawRy) : rawRx,
      width / 2,
    );
    const ry = Math.min(
      Number.isNaN(rawRy) ? (Number.isNaN(rawRx) ? 0 : rawRx) : rawRy,
      height / 2,
    );
    if (rx < 0 || ry < 0) return;
    const d =
      !rx || !ry
        ? `M0 0 H${width} V${height} H0 Z`
        : `M${rx} 0 H${width - rx} A${rx} ${ry} 0 0 1 ${width} ${ry} ` +
          `V${height - ry} A${rx} ${ry} 0 0 1 ${width - rx} ${height} ` +
          `H${rx} A${rx} ${ry} 0 0 1 0 ${height - ry} ` +
          `V${ry} A${rx} ${ry} 0 0 1 ${rx} 0 Z`;
    return { d, x, y };
  }
  if (kind === 'circle' || kind === 'ellipse') {
    const cx = pixel(element.getAttribute('cx'), 0, objectBounds);
    const cy = pixel(element.getAttribute('cy'), 0, objectBounds);
    const rx = pixel(
      element.getAttribute(kind === 'circle' ? 'r' : 'rx'),
      0,
      objectBounds,
    );
    const ry = pixel(
      element.getAttribute(kind === 'circle' ? 'r' : 'ry'),
      0,
      objectBounds,
    );
    if (cx === undefined || cy === undefined || !rx || !ry || rx < 0 || ry < 0)
      return;
    return {
      d: `M${2 * rx} ${ry} A${rx} ${ry} 0 0 1 0 ${ry} A${rx} ${ry} 0 0 1 ${
        2 * rx
      } ${ry} Z`,
      x: cx - rx,
      y: cy - ry,
    };
  }
}

function localTransform(element: SVGElement): Matrix | undefined {
  const value = element.getAttribute('transform');
  try {
    return value
      ? compose(fromDefinition(fromTransformAttribute(value)))
      : identity();
  } catch {
    return;
  }
}

/** Resolve the supported clipPath geometry in its own local user space. */
export function parseSvgClipPath(
  element: SVGElement,
  definitions: Map<string, SVGElement> = new Map(),
): SvgClipDefinition | undefined {
  const units = element.getAttribute('clipPathUnits') || 'userSpaceOnUse';
  if (units !== 'userSpaceOnUse' && units !== 'objectBoundingBox') return;
  const shapes: FilledContourShape[] = [];
  function visit(
    node: SVGElement,
    parent: Matrix,
    inheritedRule: CanvasFillRule,
    inheritedVisibility: string,
    referenced: Set<string>,
  ): boolean {
    if (
      node.getAttribute('display') === 'none' ||
      node.style?.display === 'none'
    )
      return true;
    if (
      ['mask', 'filter'].some((name) => {
        const value =
          node.style?.getPropertyValue(name) || node.getAttribute(name);
        return value && value.trim() !== 'none';
      })
    )
      return false;
    const transform = localTransform(node);
    if (!transform) return false;
    const matrix = compose([parent, transform]);
    const ownRule =
      node.style?.getPropertyValue('clip-rule') ||
      node.getAttribute('clip-rule');
    const rule =
      ownRule && !['inherit', 'unset'].includes(ownRule)
        ? ownRule
        : inheritedRule;
    const ownVisibility =
      node.style?.getPropertyValue('visibility') ||
      node.getAttribute('visibility');
    const visibility =
      ownVisibility && !['inherit', 'unset'].includes(ownVisibility)
        ? ownVisibility
        : inheritedVisibility;
    if (node.localName === 'use') {
      if (visibility === 'hidden' || visibility === 'collapse') return true;
      const href = node.getAttribute('href') ||
        node.getAttribute('xlink:href');
      if (!href?.startsWith('#') || referenced.has(href)) return false;
      const target = definitions.get(href.slice(1));
      if (!target || !['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'g', 'use']
        .includes(target.localName)) return false;
      const x = pixel(node.getAttribute('x'), 0, units === 'objectBoundingBox');
      const y = pixel(node.getAttribute('y'), 0, units === 'objectBoundingBox');
      if (x === undefined || y === undefined) return false;
      return visit(target, compose([matrix, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }]),
        rule as CanvasFillRule, visibility, new Set(referenced).add(href));
    }
    if (node.localName === 'g' || node.localName === 'clipPath')
      return Array.from(node.children).every((child) =>
        visit(child as SVGElement, matrix, rule as CanvasFillRule, visibility, referenced),
      );
    if (visibility === 'hidden' || visibility === 'collapse') return true;
    let path: ReturnType<typeof shapePath>;
    try {
      path = shapePath(node, units === 'objectBoundingBox');
    } catch {
      return false;
    }
    if (!path?.d) return false;
    try {
      // Definitions can be reused at different scales; sample object-bounds
      // coordinates finely before their eventual width/height is known.
      const scale =
        (units === 'objectBoundingBox' ? 512 : 16) *
        Math.max(
          1,
          Math.hypot(matrix.a, matrix.b),
          Math.hypot(matrix.c, matrix.d),
        );
      const contours = flattenPath(parsePath(path.d).subPaths, scale).map(
        (contour) =>
          contour.map(
            ([px, py]): Point => [
              matrix.a * (px + path.x) + matrix.c * (py + path.y) + matrix.e,
              matrix.b * (px + path.x) + matrix.d * (py + path.y) + matrix.f,
            ],
          ),
      );
      if (!contours.length || contours.some((contour) => contour.length < 3))
        return false;
      if (rule !== 'nonzero' && rule !== 'evenodd') return false;
      shapes.push({ contours, fillRule: rule });
      return true;
    } catch {
      return false;
    }
  }
  return visit(element, identity(), 'nonzero', 'visible', new Set())
    ? { units, shapes }
    : undefined;
}

export function svgClipReference(element: SVGElement): string | undefined {
  const value =
    element.style?.getPropertyValue('clip-path') ||
    element.getAttribute('clip-path');
  if (!value || value.trim() === 'none') return;
  const match = /^url\(\s*['"]?#([^'"\s)]+)['"]?\s*\)$/.exec(value.trim());
  return match?.[1] || '';
}
