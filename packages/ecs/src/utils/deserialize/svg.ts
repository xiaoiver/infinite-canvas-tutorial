import { isNil, isNumber } from '@antv/util';
import { v4 as uuidv4 } from 'uuid';
import {
  TextDecorationLine,
  TextDecorationStyle,
  Visibility,
  Path,
} from '../../components';
import { defaultAttributes, fixTransform, shiftPath } from '../serialize';
import type { PathTransformCache } from '../serialize/transform';
import {
  PathSerializedNode,
  SerializedNode,
  TextSerializedNode,
  AttenuationAttributes,
} from '../../types/serialized-node';
import { migrateLegacyFillWireInPlace } from '../normalize-fill-wire';
import { migrateLegacyStrokeWireInPlace } from '../normalize-stroke-wire';
import { deserializePoints } from './points';
import { buildPathExtrusionMesh } from '../path-extrusion-mesh';
import { pathExtrusionPaintSupported } from '../path-extrusion-paint';
import { getEnabledFillLayersFromItems, type FillLayerItem } from '../fillLayers';
import { getEnabledStrokeLayersFromItems } from '../strokeLayers';
import { strokeOutline } from '../stroke-outline';
import { getComputedInheritGroupWireMap } from '../inherit-group-wire';
import { extrudeSvgPrimitive, svgPrimitiveStrokePath } from './svg-extrusion-primitive';
import { reprojectSvgExtrusion, sourceTransform } from './svg-extrusion-affine';
import { sliceAspectRatio } from './svg-viewbox';
import { expandSvgUses } from './svg-use';
import { parseSvgClipPath } from './svg-clip';
import { isPattern, type Pattern } from '../pattern';
import { parseColor } from '../color';
import { deserializePattern } from './svg-pattern';

const DOMINANT_BASELINE_MAP: Record<string, string> = {
  auto: 'alphabetic',
  central: 'middle',
  middle: 'middle',
  alphabetic: 'alphabetic',
  ideographic: 'ideographic',
  hanging: 'hanging',
};

const SVG_PAINT_STYLE_PROPERTIES = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'visibility',
  'vector-effect',
] as const;
const SVG_PAINT_PROPERTIES = new Set<string>(SVG_PAINT_STYLE_PROPERTIES);

type InheritedSvgPattern = { paint: Pattern; fillOpacity?: number };

function svgColor(element: Element | null, fallback = '#000000'): string {
  for (let current = element; current; current = current.parentElement) {
    const color = (current as SVGElement).style?.getPropertyValue('color') ||
      current.getAttribute('color');
    if (color && !['inherit', 'currentcolor'].includes(color.trim().toLowerCase()))
      return color.trim();
  }
  return fallback;
}

function svgPresentationAttributes(
  element: SVGElement,
): { name: string; value: string; owner: SVGElement }[] {
  const attributes = Array.from(element.attributes).map(({ name, value }) => ({
    name, value, owner: element,
  }));
  // CSS declarations have priority over SVG presentation attributes.
  for (const name of SVG_PAINT_STYLE_PROPERTIES) {
    const value = element.style?.getPropertyValue(name);
    if (value) attributes.push({ name, value: value.trim(), owner: element });
  }
  return attributes;
}

function svgHidden(element: SVGElement, fallback: Element | null): boolean {
  let visibility: string | undefined;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const svg = current as SVGElement;
    if (svg.style?.display === 'none' || current.getAttribute('display') === 'none')
      return true;
    const ownVisibility = svg.style?.getPropertyValue('visibility') ||
      current.getAttribute('visibility');
    if (ownVisibility && ownVisibility !== 'inherit' && ownVisibility !== 'unset')
      visibility ??= ownVisibility;
  }
  for (let current = fallback; current; current = current.parentElement) {
    const svg = current as SVGElement;
    if (svg.style?.display === 'none' || current.getAttribute('display') === 'none')
      return true;
    const ownVisibility = svg.style?.getPropertyValue('visibility') ||
      current.getAttribute('visibility');
    if (ownVisibility && ownVisibility !== 'inherit' && ownVisibility !== 'unset')
      visibility ??= ownVisibility;
  }
  return visibility === 'hidden' || visibility === 'collapse';
}

function hasUnsupportedSvgEffects(element: SVGElement, fallback: Element | null): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const svg = current as SVGElement;
    for (const name of ['mask', 'filter']) {
      const value = svg.style?.getPropertyValue(name) || current.getAttribute(name);
      if (value && value.trim() !== 'none') return true;
    }
  }
  for (let current = fallback; current; current = current.parentElement) {
    const svg = current as SVGElement;
    for (const name of ['mask', 'filter']) {
      const value = svg.style?.getPropertyValue(name) || current.getAttribute(name);
      if (value && value.trim() !== 'none') return true;
    }
  }
  return false;
}

function inheritedSvgAttribute(element: SVGElement, name: string, fallback: string): string {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const svg = current as SVGElement;
    const value = svg.style?.getPropertyValue(name) || current.getAttribute(name);
    if (value && value.trim() !== 'inherit') return value.trim();
  }
  return fallback;
}

function solidSvgPaint(value: string): boolean {
  const color = value.trim().toLowerCase();
  return !!color && color !== 'none' && color !== 'transparent' &&
    !/^(?:url\(|var\(|linear-gradient\(|radial-gradient\()/.test(color);
}

function collectSvgDefinitions(elements: SVGElement[]): SVGElement[] {
  const definitions: SVGElement[] = [];
  for (const element of elements) {
    const groups = element.localName === 'defs'
      ? [element, ...Array.from(element.querySelectorAll('defs'))]
      : Array.from(element.querySelectorAll('defs'));
    for (const group of groups) {
      definitions.push(...Array.from(group.children) as SVGElement[]);
    }
  }
  return definitions;
}

function svgStrokeDashes(element: SVGElement): number[] | null {
  const value = inheritedSvgAttribute(element, 'stroke-dasharray', 'none');
  if (value.toLowerCase() === 'none') return [];
  const parts = value.trim().split(/[\s,]+/);
  const dashes = parts.map((part) => Number(part.replace(/px$/, '')));
  if (parts.some((part) => !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:px)?$/i.test(part)) ||
    dashes.some((dash) => !Number.isFinite(dash) || dash < 0)) return null;
  return dashes.every((dash) => dash === 0) ? null : dashes;
}

/** Expand a supported stroke into a second editable extrusion source. */
function expandSvgStrokeNodes(
  nodes: SerializedNode[],
  inherited: Map<string, Record<string, unknown>>,
  nodeElements: Map<string, SVGElement>,
  depth: number,
  rectRadii: Map<string, { rx: number; ry: number }>,
  fallbackParent: Element | null,
  root?: SVGSVGElement,
): { nodes: SerializedNode[]; strokeIds: Map<string, string>; projectedIds: Set<string> } {
  const usedIds = new Set(nodes.map((node) => node.id));
  const strokeIds = new Map<string, string>();
  const projectedIds = new Set<string>();
  const expanded: SerializedNode[] = [];
  for (const node of nodes) {
    const element = nodeElements.get(node.id);
    const paint = inherited.get(node.id);
    const strokes = getEnabledStrokeLayersFromItems(paint?.strokes as FillLayerItem[] | undefined)
      .filter((layer) => String(layer.value ?? '').trim().toLowerCase() !== 'none');
    const fills = paint?.fills as FillLayerItem[] | undefined;
    const visibleFills = getEnabledFillLayersFromItems(fills)
      .filter((layer) => String(layer.value ?? '').trim().toLowerCase() !== 'none');
    if (!element || hasUnsupportedSvgEffects(element, fallbackParent) ||
      strokes.length !== 1 || strokes[0].type !== 'solid' ||
      !solidSvgPaint(String(strokes[0].value ?? '')) ||
      (visibleFills.length > 0 && !pathExtrusionPaintSupported(fills, [{ type: 'solid', value: 'none' }]))) {
      expanded.push(node);
      continue;
    }
    const widthText = inheritedSvgAttribute(element, 'stroke-width', '1');
    const width = /^(?:\d*\.)?\d+(?:px)?$/.test(widthText)
      ? Number(widthText.replace(/px$/, '')) : NaN;
    const dashes = svgStrokeDashes(element);
    const dashOffsetText = inheritedSvgAttribute(element, 'stroke-dashoffset', '0');
    const dashOffset = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:px)?$/i.test(dashOffsetText)
      ? Number(dashOffsetText.replace(/px$/, '')) : NaN;
    const linecap = inheritedSvgAttribute(element, 'stroke-linecap', 'butt') as CanvasLineCap;
    const linejoin = inheritedSvgAttribute(element, 'stroke-linejoin', 'miter') as CanvasLineJoin;
    const miterlimit = Number(inheritedSvgAttribute(element, 'stroke-miterlimit', '4'));
    if (!Number.isFinite(width) || width <= 0 || !dashes || !Number.isFinite(dashOffset) ||
      !['butt', 'round', 'square'].includes(linecap) ||
      !['miter', 'round', 'bevel'].includes(linejoin)) {
      expanded.push(node);
      continue;
    }
    const nonScaling = inheritedSvgAttribute(element, 'vector-effect', 'none') ===
      'non-scaling-stroke';
    let source = svgPrimitiveStrokePath(node, depth, rectRadii.get(node.id));
    let projected: Parameters<typeof strokeOutline>[7];
    if (nonScaling) {
      try {
        const transform = sourceTransform(element, root);
        // Project the centerline first, then expand it at the specified width.
        // Clipping in this already projected space needs a separate path, so
        // retain those SVG sources in 2D for now.
        if (transform.clipViewports.length || transform.clipReferences.length ||
          (root && sliceAspectRatio(root))) {
          expanded.push(node);
          continue;
        }
        const clone = element.cloneNode(false) as SVGElement;
        clone.removeAttribute('transform');
        const local = deserializeSvgElements(
          [clone], [], undefined, 0, undefined, { fill: false, stroke: false },
        )[0];
        source = local && svgPrimitiveStrokePath(local, depth, rectRadii.get(node.id));
        if (source) projected = {
          matrix: transform.matrix, x: local.x ?? 0, y: local.y ?? 0,
        };
      } catch {
        expanded.push(node);
        continue;
      }
    }
    let outline = '';
    try {
      if (source) outline = strokeOutline(
        source, width, linecap, linejoin, miterlimit, dashes, dashOffset, projected,
      );
    } catch {
      // Keep the original 2D SVG node when the contour cannot be expanded.
    }
    if (!outline) {
      expanded.push(node);
      continue;
    }
    let outlinePosition: Pick<PathSerializedNode, 'x' | 'y' | 'width' | 'height' | 'd'>;
    try {
      const { minX, minY, maxX, maxY } = Path.getGeometryBounds({ d: outline });
      if (![minX, minY, maxX, maxY].every(Number.isFinite) ||
        maxX <= minX || maxY <= minY) {
        expanded.push(node);
        continue;
      }
      outlinePosition = {
        x: (projected ? 0 : node.x ?? 0) + minX,
        y: (projected ? 0 : node.y ?? 0) + minY,
        width: maxX - minX,
        height: maxY - minY,
        d: shiftPath(outline, -minX, -minY, 6),
      };
    } catch {
      // Keep the source in 2D when its outline cannot be normalized.
      expanded.push(node);
      continue;
    }
    const strokePaint = [{ ...strokes[0] }];
    const noStroke = [{ type: 'solid' as const, value: 'none' }];
    // Keep the front and back caps just outside a filled source. Otherwise
    // the overlapping half of a centered stroke fights the fill in the depth buffer.
    const separation = Math.max(0.01, depth * 0.002);
    const strokeExtrusion = {
      depth: depth + separation * 2,
      z: separation,
    };
    if (visibleFills.length) {
      let strokeId = `${node.id}--stroke`;
      for (let suffix = 2; usedIds.has(strokeId); suffix++)
        strokeId = `${node.id}--stroke-${suffix}`;
      usedIds.add(strokeId);
      expanded.push({ ...node, strokes: noStroke, strokeWidth: 0 } as SerializedNode);
      expanded.push({
        ...node, ...outlinePosition, id: strokeId, type: 'path', fillRule: 'evenodd',
        fills: strokePaint, strokes: noStroke, strokeWidth: 0,
        name: `${node.name ?? node.id} stroke`, zIndex: node.zIndex + 0.5,
        ...(projected ? { parentId: undefined, rotation: 0, scaleX: 1, scaleY: 1 } : {}),
        extrude3d: strokeExtrusion,
      } as PathSerializedNode);
      nodeElements.set(strokeId, element);
      strokeIds.set(node.id, strokeId);
      if (projected) projectedIds.add(strokeId);
    } else {
      expanded.push({
        ...node, ...outlinePosition, type: 'path', fillRule: 'evenodd',
        fills: strokePaint, strokes: noStroke, strokeWidth: 0,
        ...(projected ? { parentId: undefined, rotation: 0, scaleX: 1, scaleY: 1 } : {}),
        extrude3d: depth,
      } as PathSerializedNode);
      strokeIds.set(node.id, node.id);
      if (projected) projectedIds.add(node.id);
    }
  }
  return { nodes: expanded, strokeIds, projectedIds };
}

export function svgSvgElementToComputedCamera(element: SVGSVGElement) {
  const { viewBox, width, height } = element;
  const { x, y, width: vw, height: vh } = viewBox.baseVal;

  if (
    vw === 0 ||
    vh === 0 ||
    width.baseVal.unitType === 2 ||
    height.baseVal.unitType === 2
  ) {
    return {
      x,
      y,
      zoom: 1,
    };
  }

  return {
    x,
    y,
    zoom: Math.min(width.baseVal.value / vw, height.baseVal.value / vh),
  };
}
/**
 * Note that this conversion is not fully reversible.
 * For example, in the StrokeAlignment implementation, one Circle corresponds to two <circle>s.
 * The same is true in Figma.
 *
 * @see https://github.com/ShukantPal/pixi-essentials/blob/master/packages/svg
 */
export function svgElementsToSerializedNodes(
  elements: SVGElement[],
  defsChildren: SVGElement[] = [],
  parentId?: string,
  zIndex = 0,
  overrideAttributes?: NamedNodeMap,
): SerializedNode[] {
  const expanded = expandSvgUses(elements, defsChildren);
  const fallbackColor = svgColor(elements[0]?.parentElement);
  return deserializeSvgElements(
    expanded.children,
    [...defsChildren, ...collectSvgDefinitions(expanded.children)],
    parentId,
    zIndex,
    overrideAttributes,
    { fill: false, stroke: false },
    undefined,
    undefined,
    fallbackColor,
  );
}

function deserializeSvgElements(
  elements: SVGElement[],
  defsChildren: SVGElement[],
  parentId: string | undefined,
  zIndex: number,
  overrideAttributes: NamedNodeMap | undefined,
  paintFromGroups: { fill: boolean; stroke: boolean },
  rectRadii?: Map<string, { rx: number; ry: number }>,
  nodeElements?: Map<string, SVGElement>,
  fallbackColor = '#000000',
  pathCache: PathTransformCache = new Map(),
  inheritedPattern?: InheritedSvgPattern,
): SerializedNode[] {
  const nodes: SerializedNode[] = [];

  for (const element of elements) {
    let type = element.tagName.toLowerCase();
    let elementOverrideAttributes = overrideAttributes;
    let patternForChildren = inheritedPattern;

    let id = element.id || uuidv4();

    if (type === 'svg') {
      type = 'g';
    } else if (type === 'defs') {
      for (const child of Array.from(element.children) as SVGElement[]) {
        if (!defsChildren.includes(child)) defsChildren.push(child);
      }
      continue;
    } else if (type === 'use') {
      continue;
    } else if (type === 'tspan') {
      continue;
    }

    // <g> maybe a single element, so we need to infer it, e.g. a rect with children
    let inferedSingleElement = false;
    if (
      type === 'g' &&
      !element.hasAttribute('data-svg-use-instance') &&
      !element.querySelector('[data-svg-use-instance]')
    ) {
      // <g><defs></defs></g> e.g. a <polyline> with an arrow
      if (
        Array.from(element.children).filter((child) => child.tagName !== 'defs')
          .length === 1
      ) {
        inferedSingleElement = true;
        id = undefined;
        elementOverrideAttributes = element.attributes;
      }
    }

    if (!inferedSingleElement) {
      const attributes = [
        ...svgPresentationAttributes(element),
        ...(elementOverrideAttributes?.length
          ? svgPresentationAttributes(
              elementOverrideAttributes[0].ownerElement as SVGElement,
            )
          : []),
      ].reduce((prev, attr) => {
        if (attr.name === 'data-svg-use-instance' ||
          attr.name === 'data-svg-viewport' ||
          attr.name === 'data-svg-viewport-transform' ||
          attr.name === 'style' || attr.name === 'color') return prev;
        let attributeName = kebabToCamelCase(attr.name);
        // A collapsed single-child group only supplies paint that the child
        // has not specified itself.
        if (attr.owner !== element && SVG_PAINT_PROPERTIES.has(attr.name) &&
            attributeName in prev) return prev;

        let value: string | number = attr.value;
        if ((attributeName === 'fill' || attributeName === 'stroke') &&
            value.trim().toLowerCase() === 'currentcolor') {
          value = svgColor(attr.owner, fallbackColor);
        }

        // e.g. fill="url(#bgGradient)"
        if (value.startsWith('url(#')) {
          if (
            attributeName === 'markerStart' ||
            attributeName === 'markerEnd'
          ) {
            value = 'line';
            // TODO: extract marker factor from <marker> in defs
          } else {
            const id = value.replace('url(#', '').replace(')', '');
            const def = defsChildren.find((d) => d.id === id);
            if (def?.localName === 'pattern' && attributeName === 'fill') {
              const pattern = deserializePattern(def, defsChildren);
              if (pattern) {
                (prev as unknown as Record<string, unknown>).fill = pattern;
                return prev;
              }
            } else if (def?.localName === 'radialGradient' && attributeName === 'fill') {
              value = deserializeSvgRadialGradient(def, element) ??
                deserializeSvgRadialGradientImage(def, element) ?? 'none';
            } else if (def?.localName === 'linearGradient') {
              value = deserializeGradient(def as SVGGradientElement);
            }
          }
        }

        if (
          type === 'rect' &&
          (attributeName === 'rx' || attributeName === 'ry')
        ) {
          attributeName = 'cornerRadius';
          value = Number(value);
        } else if (
          attributeName === 'cx' ||
          attributeName === 'cy' ||
          attributeName === 'x' ||
          attributeName === 'y' ||
          attributeName === 'x1' ||
          attributeName === 'y1' ||
          attributeName === 'x2' ||
          attributeName === 'y2' ||
          attributeName === 'rx' ||
          attributeName === 'ry' ||
          attributeName === 'r' ||
          attributeName === 'width' ||
          attributeName === 'height' ||
          attributeName === 'opacity' ||
          attributeName === 'fillOpacity' ||
          attributeName === 'strokeOpacity' ||
          attributeName === 'strokeWidth' ||
          attributeName === 'strokeMiterlimit' ||
          attributeName === 'strokeDashoffset' ||
          attributeName === 'fontSize'
        ) {
          // remove 'px' suffix
          value = Number(value.replace('px', ''));
        } else if (attributeName === 'textAnchor') {
          attributeName = 'textAlign';
          if (value === 'middle') {
            value = 'center';
          }
        }

        prev[attributeName] = value;
        return prev;
      }, {} as SerializedNode);

      const rawAttributes = attributes as unknown as Record<string, unknown>;
      const ownFill = rawAttributes.fill;
      const ownOpacity = typeof rawAttributes.fillOpacity === 'number'
        ? rawAttributes.fillOpacity : undefined;
      if (type === 'g') {
        if ('fill' in attributes) {
          patternForChildren = isPattern(ownFill)
            ? { paint: ownFill, fillOpacity: ownOpacity ?? inheritedPattern?.fillOpacity }
            : undefined;
          if (!isPattern(ownFill) && ownOpacity === undefined &&
              inheritedPattern?.fillOpacity !== undefined) {
            rawAttributes.fillOpacity = inheritedPattern.fillOpacity;
          }
        } else if (inheritedPattern && ownOpacity !== undefined) {
          patternForChildren = { ...inheritedPattern, fillOpacity: ownOpacity };
        }
      } else if (ownFill === undefined && !('fills' in attributes) &&
          inheritedPattern) {
        // Group patterns must be rebased for each child, just like a pattern
        // specified on that child directly.
        rawAttributes.fill = inheritedPattern.paint;
      }
      if (type !== 'g' && !('fillOpacity' in attributes) &&
          inheritedPattern?.fillOpacity !== undefined) {
        rawAttributes.fillOpacity = inheritedPattern.fillOpacity;
      }

      // The 2D Rect stores one corner radius. Preserve both SVG radii for the
      // extrusion converter before the attributes above collapse rx and ry.
      if (type === 'rect' && rectRadii) {
        const rxValue = element.getAttribute('rx');
        const ryValue = element.getAttribute('ry');
        if (rxValue !== null || ryValue !== null) {
          const rx = Number((rxValue ?? ryValue)!.replace('px', ''));
          const ry = Number((ryValue ?? rxValue)!.replace('px', ''));
          rectRadii.set(id, { rx, ry });
        }
      }

      if (type === 'circle') {
        type = 'ellipse';
        Object.assign(attributes, {
          // @ts-ignore
          rx: attributes.r,
          // @ts-ignore
          ry: attributes.r,
        });
        // @ts-ignore
        delete attributes.r;
      } else if (type === 'text') {
        // extract from style, e.g. font: normal normal normal 10px sans-serif;
        if (element.style.font) {
          (attributes as TextSerializedNode).fontFamily =
            element.style.fontFamily;
          (attributes as TextSerializedNode).fontSize = Number(
            element.style.fontSize.replace('px', ''),
          );
          (attributes as TextSerializedNode).fontStyle =
            element.style.fontStyle;
          (attributes as TextSerializedNode).fontWeight =
            element.style.fontWeight;
          (attributes as TextSerializedNode).fontVariant =
            element.style.fontVariant;
        }
        if (element.style.textDecoration) {
          // e.g. text-decoration: underline 4px wavy rgb(0, 0, 0) ;
          const [
            decorationLine,
            decorationThickness,
            decorationStyle,
            decorationColor,
          ] = element.style.textDecoration.split(' ');
          (attributes as TextSerializedNode).decorationStyle =
            decorationStyle as TextDecorationStyle;
          (attributes as TextSerializedNode).decorationLine =
            decorationLine as TextDecorationLine;
          (attributes as TextSerializedNode).decorationColor = decorationColor;
          (attributes as TextSerializedNode).decorationThickness = Number(
            decorationThickness.replace('px', ''),
          );
        }

        const $tspans = Array.from(element.children).filter(
          (c) => c.tagName === 'tspan',
        );
        if ($tspans.length > 0) {
          (attributes as TextSerializedNode).content = $tspans
            .map(($tspan) => $tspan.textContent)
            .join('\n');
        } else {
          // remove prefix and suffix whitespace and newlines
          (attributes as TextSerializedNode).content =
            element.textContent?.trim();
        }

        const dominantBaseline =
          element.attributes.getNamedItem('dominant-baseline')?.value;
        if (dominantBaseline) {
          (attributes as TextSerializedNode).textBaseline =
            DOMINANT_BASELINE_MAP[dominantBaseline] as CanvasTextBaseline;
        }

        const { x, y } = attributes;
        (attributes as TextSerializedNode).anchorX = x as number;
        (attributes as TextSerializedNode).anchorY = y as number;

        delete attributes.x;
        delete attributes.y;
        // @ts-ignore
        delete attributes.style;
      } else if (type === 'polygon') {
        type = 'path';
        // @ts-ignore
        const points = deserializePoints(attributes.points);
        let d = '';
        points.forEach((point, index) => {
          if (index === 0) {
            d += `M${point[0]},${point[1]}`;
          } else {
            d += `L${point[0]},${point[1]}`;
          }
        });
        d += 'Z';
        (attributes as PathSerializedNode).d = d;
        // @ts-ignore
        delete attributes.points;
      }

      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/visibility
      const visibility = attributes.visibility;
      if (visibility) attributes.visibility = visibility as Visibility['value'];

      const vectorEffect = (attributes as unknown as Record<string, string>)
        .vectorEffect;
      if (vectorEffect) {
        (attributes as AttenuationAttributes).sizeAttenuation =
          vectorEffect === 'non-scaling-size';
        (attributes as AttenuationAttributes).strokeAttenuation =
          vectorEffect === 'non-scaling-stroke';
      }

      attributes.name =
        element.getAttribute('name') ||
        (type === 'text' && (attributes as TextSerializedNode).content) ||
        `Layer ${id}`;

      attributes.zIndex = zIndex++;

      const node = {
        id,
        parentId: !isNil(parentId) ? `${parentId}` : undefined,
        type,
        ...defaultAttributes[type],
        ...attributes,
      } as SerializedNode;
      // A child without its own paint must inherit the group's paint rather
      // than turning default opacity/`none` placeholders into a new layer.
      if (
        paintFromGroups.fill &&
        !('fill' in attributes) &&
        !('fillOpacity' in attributes) &&
        !('fills' in attributes)
      ) {
        delete (node as unknown as Record<string, unknown>).fill;
        delete (node as unknown as Record<string, unknown>).fillOpacity;
      }
      if (
        paintFromGroups.stroke &&
        !('stroke' in attributes) &&
        !('strokeOpacity' in attributes) &&
        !('strokes' in attributes)
      ) {
        delete (node as unknown as Record<string, unknown>).strokes;
        delete (node as unknown as Record<string, unknown>).strokeOpacity;
      }
      migrateLegacyFillWireInPlace(node as unknown as Record<string, unknown>);
      if (type === 'g' && patternForChildren &&
          (isPattern(ownFill) || ownFill === undefined)) {
        // The SVG pattern is materialized on each descendant so its user-space
        // coordinates survive geometry rebasing. Do not leave a stale group
        // paint that would appear editable but no longer affect its children.
        delete (node as unknown as Record<string, unknown>).fills;
      }
      if ('fills' in node && Array.isArray(node.fills)) {
        node.fills = node.fills.map((layer) =>
          layer.type === 'solid' && /^(?:linear|radial)-gradient\(/i.test(layer.value)
            ? { ...layer, type: 'gradient' as const } : layer,
        );
      }
      migrateLegacyStrokeWireInPlace(
        node as unknown as Record<string, unknown>,
      );
      nodes.push(node);
      nodeElements?.set(node.id, element);

      const { minX, minY } = fixTransform(
        (attributes as any).transform || '', node, pathCache,
      );
      // Geometry is rebased to (0, 0) by fixTransform. Keep the imported
      // pattern in the same SVG user-space position after that rebase.
      if ((minX || minY) && Number.isFinite(minX) &&
          Number.isFinite(minY) && 'fills' in node && Array.isArray(node.fills)) {
        node.fills = node.fills.map((layer) => layer.type === 'pattern'
          ? {
              ...layer,
              transform: `translate(${-minX} ${-minY}) ${layer.transform ?? ''}`.trim(),
            }
          : layer);
      }
    }

    const children = deserializeSvgElements(
      Array.from(element.children) as SVGElement[],
      defsChildren,
      id,
      0,
      elementOverrideAttributes,
      {
        fill:
          paintFromGroups.fill ||
          (type === 'g' && (element.hasAttribute('fill') || !!element.style?.fill)),
        stroke:
          paintFromGroups.stroke ||
          (type === 'g' && (element.hasAttribute('stroke') || !!element.style?.stroke)),
      },
      rectRadii,
      nodeElements,
      fallbackColor,
      pathCache,
      patternForChildren,
    ).filter(Boolean);

    nodes.push(...children);
  }

  return nodes;
}

/** Import closed, filled SVG shapes as editable extrusion sources. */
export function svgElementsToExtrudedNodes(
  elements: SVGElement[] | SVGSVGElement,
  depth: number,
): SerializedNode[] {
  if (!Number.isFinite(depth) || depth <= 0) {
    throw new RangeError('SVG extrusion depth must be finite and positive');
  }
  const rectRadii = new Map<string, { rx: number; ry: number }>();
  const { root, children } = expandSvgUses(elements);
  const pathCache: PathTransformCache = new Map();
  const fallbackColor = Array.isArray(elements)
    ? svgColor(elements[0]?.parentElement)
    : '#000000';
  const nodeElements = new Map<string, SVGElement>();
  const clipDefinitions = new Map<string, ReturnType<typeof parseSvgClipPath>>();
  const allElements = root
    ? [root, ...Array.from(root.querySelectorAll('*')) as SVGElement[]]
    : children.flatMap((child) => [child, ...Array.from(child.querySelectorAll('*')) as SVGElement[]]);
  const definitions = new Map(allElements.filter((element) => element.id)
    .map((element) => [element.id, element] as const));
  for (const element of allElements) {
    if (element.localName === 'clipPath' && element.id)
      clipDefinitions.set(element.id, parseSvgClipPath(element, definitions));
  }
  const nodes = deserializeSvgElements(
    children,
    collectSvgDefinitions(children),
    undefined,
    0,
    undefined,
    { fill: false, stroke: false },
    rectRadii,
    nodeElements,
    fallbackColor,
    pathCache,
  );
  const fallbackParent = Array.isArray(elements) ? elements[0]?.parentElement : null;
  const { nodes: strokeNodes, strokeIds, projectedIds } = expandSvgStrokeNodes(
    nodes, getComputedInheritGroupWireMap(nodes), nodeElements,
    depth, rectRadii, fallbackParent, root,
  );
  const generatedStrokeIds = new Set(strokeIds.values());
  const sourceIdByElement = new Map(nodes.map((node) =>
    [nodeElements.get(node.id), node.id] as const).filter((entry) => entry[0]));
  const inherited = getComputedInheritGroupWireMap(strokeNodes);
  const converted = strokeNodes.map((node) => {
    const paint = inherited.get(node.id) as
      | Pick<PathSerializedNode, 'fills' | 'strokes'>
      | undefined;
    const paintSupported = pathExtrusionPaintSupported(
      paint?.fills,
      paint?.strokes,
    );
    if (node.type === 'path') {
      if (paintSupported && buildPathExtrusionMesh(node.d, node.fillRule))
        return { ...node, extrude3d: node.extrude3d || depth };
      // A generated stroke that cannot form a mesh restores its original
      // source in the final fallback pass below.
      if (generatedStrokeIds.has(node.id))
        return { ...node, extrude3d: undefined };
      return node;
    }
    return extrudeSvgPrimitive(
      node,
      depth,
      paintSupported,
      rectRadii.get(node.id),
    );
  });
  const projected = reprojectSvgExtrusion(
    converted,
    () => {
      const plainChildren = children.map((element) => {
        const clone = element.cloneNode(true) as SVGElement;
        const originals = [element, ...Array.from(element.querySelectorAll('*')) as SVGElement[]];
        const copies = [clone, ...Array.from(clone.querySelectorAll('*')) as SVGElement[]];
        for (let index = 0; index < originals.length; index++) {
          const id = sourceIdByElement.get(originals[index]);
          if (id && !copies[index].id) copies[index].setAttribute('id', id);
        }
        return clone;
      });
      for (const child of plainChildren) {
        child.removeAttribute('transform');
        child.querySelectorAll('*').forEach((element) => element.removeAttribute('transform'));
      }
      const plain = deserializeSvgElements(
        plainChildren, [], undefined, 0, undefined,
        { fill: false, stroke: false },
        undefined, undefined, fallbackColor, pathCache,
      );
      return expandSvgStrokeNodes(
        plain, getComputedInheritGroupWireMap(plain), nodeElements,
        depth, rectRadii, fallbackParent, root,
      ).nodes;
    },
    root, nodeElements, inherited, depth, rectRadii, clipDefinitions, projectedIds,
  );
  const byId = new Map(projected.map((node) => [node.id, node]));
  const originalById = new Map(nodes.map((node) => [node.id, node]));
  const failed = new Set<string>();
  for (const [sourceId, strokeId] of strokeIds) {
    const stroke = byId.get(strokeId);
    const fill = strokeId !== sourceId ? byId.get(sourceId) : undefined;
    if (!stroke || !('extrude3d' in stroke) || !stroke.extrude3d ||
      (fill && (!('extrude3d' in fill) || !fill.extrude3d))) failed.add(sourceId);
  }
  const failedStrokeIds = new Set([...failed].map((id) => strokeIds.get(id)));
  return projected
    .filter((node) => !failedStrokeIds.has(node.id) || failed.has(node.id))
    .map((node) => failed.has(node.id) ? originalById.get(node.id)! : node)
    .map((node) => {
      const element = nodeElements.get(node.id);
      if (!element) return node;
      if (svgHidden(element, fallbackParent))
        return { ...node, visibility: 'hidden', extrude3d: undefined };
      if (hasUnsupportedSvgEffects(element, fallbackParent))
        return { ...node, extrude3d: undefined };
      return node;
    });
}

export function kebabToCamelCase(str: string) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

export function toNumber(
  length: SVGAnimatedLength | SVGAnimatedNumber,
): number {
  if (isNumber(length.baseVal)) {
    return length.baseVal;
  }
  return length.baseVal.valueInSpecifiedUnits;
}

/** The paint system currently has circular gradients, so retain only SVG
 * gradients that map to a circle in a rectangle's local user coordinates. */
function deserializeSvgRadialGradient(
  gradient: SVGElement,
  target: SVGElement,
): string | undefined {
  if (target.localName !== 'rect' ||
      gradient.getAttribute('gradientUnits') !== 'userSpaceOnUse' ||
      gradient.hasAttribute('gradientTransform') ||
      gradient.hasAttribute('href') || gradient.hasAttribute('xlink:href') ||
      (gradient.getAttribute('spreadMethod') ?? 'pad') !== 'pad') return;
  const length = (value: string | null) => {
    if (value === null ||
        !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/i.test(value)) return;
    const number = Number(value.replace(/px$/i, ''));
    return Number.isFinite(number) ? number : undefined;
  };
  const cx = length(gradient.getAttribute('cx'));
  const cy = length(gradient.getAttribute('cy'));
  const radius = length(gradient.getAttribute('r'));
  const x = length(target.getAttribute('x') ?? '0');
  const y = length(target.getAttribute('y') ?? '0');
  if (cx === undefined || cy === undefined || radius === undefined ||
      radius <= 0 || x === undefined || y === undefined ||
      (gradient.hasAttribute('fx') && length(gradient.getAttribute('fx')) !== cx) ||
      (gradient.hasAttribute('fy') && length(gradient.getAttribute('fy')) !== cy) ||
      (gradient.hasAttribute('fr') && length(gradient.getAttribute('fr')) !== 0)) return;
  const stops = Array.from(gradient.children);
  if (stops.length < 2 || stops.some((stop) => stop.localName !== 'stop')) return;
  const colors = stops.map((stop) => {
    const rawOffset = stop.getAttribute('offset');
    const offset = rawOffset?.endsWith('%')
      ? Number(rawOffset.slice(0, -1)) / 100 : Number(rawOffset);
    const rawColor = (stop as SVGElement).style?.getPropertyValue('stop-color') ||
      stop.getAttribute('stop-color') || 'black';
    const rawOpacity = (stop as SVGElement).style?.getPropertyValue('stop-opacity') ||
      stop.getAttribute('stop-opacity') || '1';
    const opacity = Number(rawOpacity);
    if (!Number.isFinite(offset) || offset < 0 || offset > 1 ||
        !Number.isFinite(opacity) || opacity < 0 || opacity > 1 ||
        /(?:url\(|var\(|currentcolor)/i.test(rawColor)) return;
    const { r, g, b, opacity: colorOpacity } = parseColor(rawColor);
    const color = opacity === 1 && colorOpacity === 1
      ? rawColor : `rgba(${r}, ${g}, ${b}, ${opacity * colorOpacity})`;
    return `${color} ${offset * 100}%`;
  });
  if (colors.some((color) => color === undefined)) return;
  return `radial-gradient(circle ${radius}px at ${cx - x}px ${cy - y}px, ${colors.join(', ')})`;
}

/** The fill texture is mapped to the same local geometry bounds after import. */
function svgRadialFillBounds(
  target: SVGElement,
): { x: number; y: number; width: number; height: number } | undefined {
  const numericLength = (value: string | null, fallback = 0) => {
    if (value === null) return fallback;
    if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/i.test(value)) return;
    const number = Number(value.replace(/px$/i, ''));
    return Number.isFinite(number) ? number : undefined;
  };
  const kind = target.localName;
  let bounds: { x: number; y: number; width: number; height: number } | undefined;
  if (kind === 'rect') {
    const x = numericLength(target.getAttribute('x'));
    const y = numericLength(target.getAttribute('y'));
    const width = numericLength(target.getAttribute('width'));
    const height = numericLength(target.getAttribute('height'));
    if ([x, y, width, height].every((value) => value !== undefined))
      bounds = { x: x!, y: y!, width: width!, height: height! };
  } else if (kind === 'circle' || kind === 'ellipse') {
    const cx = numericLength(target.getAttribute('cx'));
    const cy = numericLength(target.getAttribute('cy'));
    const rx = numericLength(target.getAttribute(kind === 'circle' ? 'r' : 'rx'));
    const ry = kind === 'circle' ? rx : numericLength(target.getAttribute('ry'));
    if ([cx, cy, rx, ry].every((value) => value !== undefined))
      bounds = { x: cx! - rx!, y: cy! - ry!, width: 2 * rx!, height: 2 * ry! };
  } else if (kind === 'path') {
    try {
      const { minX, minY, maxX, maxY } = Path.getGeometryBounds({
        d: target.getAttribute('d') || '',
      });
      bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } catch { return; }
  } else if (kind === 'polygon' || kind === 'polyline') {
    const points = deserializePoints(target.getAttribute('points') || '');
    if (points.length < 3) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.width <= 0 || bounds.height <= 0 ||
      bounds.width > 4096 || bounds.height > 4096) return;
  return bounds;
}

/** Preserve SVG radial geometry that the circular CSS paint model cannot express.
 * The editable shape clips the paint image to its original outline. */
function deserializeSvgRadialGradientImage(
  gradient: SVGElement,
  target: SVGElement,
): string | undefined {
  if (gradient.hasAttribute('href') || gradient.hasAttribute('xlink:href') ||
      Array.from(gradient.children).some((child) => child.localName !== 'stop') ||
      Array.from(gradient.querySelectorAll('*')).some((child) =>
        Array.from(child.attributes).some(({ name, value }) =>
          name === 'href' || name === 'xlink:href' || /url\s*\(|currentcolor/i.test(value)),
      )) return;
  const bounds = svgRadialFillBounds(target);
  if (!bounds) return;
  const { x, y, width, height } = bounds;
  const svg = gradient.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  const defs = gradient.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const paint = gradient.cloneNode(true) as SVGElement;
  paint.setAttribute('id', 'paint');
  defs.appendChild(paint);
  svg.appendChild(defs);
  const rect = gradient.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('fill', 'url(#paint)');
  svg.appendChild(rect);
  const markup = new XMLSerializer().serializeToString(svg);
  if (markup.length > 64_000) return;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/**
 * convert <linearGradient> to CSS gradient string
 */
export function deserializeGradient(element: SVGGradientElement): string {
  if (element.tagName === 'linearGradient') {
    const { x1, y1, x2, y2 } = element as SVGLinearGradientElement;
    // calculate angle
    const angle =
      (Math.atan2(toNumber(y2) - toNumber(y1), toNumber(x2) - toNumber(x1)) *
        180) /
      Math.PI;

    const stops = Array.from(element.querySelectorAll('stop')).map(
      (stop: SVGStopElement) => {
        const offset = toNumber(stop.offset);
        const stopColor = stop.getAttribute('stop-color');
        // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stop-opacity
        // const stopOpacity = stop.getAttribute('stop-opacity');

        return `${stopColor} ${offset * 100}%`;
      },
    );

    // linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%)
    return `linear-gradient(${angle}deg, ${stops.join(',')})`;
  } else if (element.tagName === 'radialGradient') {
    // const { cx, cy, r } = element as SVGRadialGradientElement;
  }

  return '';
}
