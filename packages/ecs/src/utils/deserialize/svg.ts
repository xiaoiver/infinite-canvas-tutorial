import { isNil, isNumber } from '@antv/util';
import { v4 as uuidv4 } from 'uuid';
import {
  TextDecorationLine,
  TextDecorationStyle,
  Visibility,
} from '../../components';
import { defaultAttributes, fixTransform } from '../serialize';
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
import { getComputedInheritGroupWireMap } from '../inherit-group-wire';
import { extrudeSvgPrimitive } from './svg-extrusion-primitive';
import { reprojectSvgExtrusion } from './svg-extrusion-affine';
import { expandSvgUses } from './svg-use';
import { parseSvgClipPath } from './svg-clip';

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
    defsChildren,
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
): SerializedNode[] {
  const nodes: SerializedNode[] = [];

  for (const element of elements) {
    let type = element.tagName.toLowerCase();
    let elementOverrideAttributes = overrideAttributes;

    let id = element.id || uuidv4();

    if (type === 'svg') {
      type = 'g';
    } else if (type === 'defs') {
      defsChildren.push(...(Array.from(element.children) as SVGElement[]));
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
            if (def) {
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
      migrateLegacyStrokeWireInPlace(
        node as unknown as Record<string, unknown>,
      );
      nodes.push(node);
      nodeElements?.set(node.id, element);

      fixTransform((attributes as any).transform || '', node);
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
    [],
    undefined,
    0,
    undefined,
    { fill: false, stroke: false },
    rectRadii,
    nodeElements,
    fallbackColor,
  );
  const inherited = getComputedInheritGroupWireMap(nodes);
  const converted = nodes.map((node) => {
    const paint = inherited.get(node.id) as
      | Pick<PathSerializedNode, 'fills' | 'strokes'>
      | undefined;
    const paintSupported = pathExtrusionPaintSupported(
      paint?.fills,
      paint?.strokes,
    );
    if (node.type === 'path') {
      if (paintSupported && buildPathExtrusionMesh(node.d, node.fillRule))
        return { ...node, extrude3d: depth };
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
      const plainChildren = children.map((element) => element.cloneNode(true) as SVGElement);
      for (const child of plainChildren) {
        child.removeAttribute('transform');
        child.querySelectorAll('*').forEach((element) => element.removeAttribute('transform'));
      }
      return deserializeSvgElements(
        plainChildren, [], undefined, 0, undefined,
        { fill: false, stroke: false },
        undefined, undefined, fallbackColor,
      );
    },
    root, nodeElements, inherited, depth, rectRadii, clipDefinitions,
  );
  const fallbackParent = Array.isArray(elements) ? elements[0]?.parentElement : null;
  return projected.map((node) => {
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
