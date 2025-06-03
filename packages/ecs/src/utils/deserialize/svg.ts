import { isNil, isNumber } from '@antv/util';
import { Visibility } from '../../components';
import {
  defaultAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
  fixTransform,
  TextSerializedNode,
} from '../serialize';
import { deserializePoints } from './points';

/**
 * Note that this conversion is not fully reversible.
 * For example, in the StrokeAlignment implementation, one Circle corresponds to two <circle>s.
 * The same is true in Figma.
 *
 * @see https://github.com/ShukantPal/pixi-essentials/blob/master/packages/svg
 */
export function svgElementsToSerializedNodes(
  elements: SVGElement[],
  id = 0,
  defsChildren: SVGElement[] = [],
  parentId?: number,
  zIndex = 0,
): SerializedNode[] {
  const nodes: SerializedNode[] = [];

  for (const element of elements) {
    let type = element.tagName.toLowerCase();

    if (type === 'svg') {
      type = 'g';
    } else if (type === 'defs') {
      defsChildren.push(...(Array.from(element.childNodes) as SVGElement[]));
      continue;
    } else if (type === 'use') {
      const href = element.getAttribute('xlink:href');
      if (href) {
        const def = defsChildren.find((d) => d.id === href.replace('#', ''));
        if (def) {
          return svgElementsToSerializedNodes(
            [def],
            id,
            defsChildren,
            parentId,
          );
        }
      }
      continue;
    } else if (type === 'tspan') {
      continue;
    }

    const attributes = Array.from(element.attributes).reduce((prev, attr) => {
      let attributeName = kebabToCamelCase(attr.name);

      let value: string | number = attr.value;

      // e.g. fill="url(#bgGradient)"
      if (value.startsWith('url(#')) {
        const id = value.replace('url(#', '').replace(')', '');
        const def = defsChildren.find((d) => d.id === id);
        if (def) {
          value = deserializeGradient(def as SVGGradientElement);
        }
      }

      if (
        type === 'rect' &&
        (attributeName === 'rx' || attributeName === 'ry')
      ) {
        attributeName = 'radius';
        value = Number(value);
      } else if (
        attributeName === 'cx' ||
        attributeName === 'cy' ||
        attributeName === 'x' ||
        attributeName === 'y' ||
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

    if (type === 'circle') {
      type = 'ellipse';
      Object.assign(attributes, {
        // @ts-ignore
        rx: attributes.r,
        // @ts-ignore
        ry: attributes.r,
      });
    } else if (type === 'text') {
      (attributes as TextSerializedNode).content = element.textContent;
    } else if (type === 'line') {
      type = 'polyline';
      // @ts-ignore
      const { x1, y1, x2, y2 } = attributes;
      (attributes as PolylineSerializedNode).points = `${x1},${y1} ${x2},${y2}`;
      // @ts-ignore
      delete attributes.x1;
      // @ts-ignore
      delete attributes.y1;
      // @ts-ignore
      delete attributes.x2;
      // @ts-ignore
      delete attributes.y2;
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
    const visibility = element.getAttribute('visibility');
    if (visibility) {
      attributes.visibility = visibility as Visibility['value'];
    }

    attributes.name =
      element.getAttribute('name') ||
      (type === 'text' && (attributes as TextSerializedNode).content) ||
      `Layer ${id}`;

    attributes.zIndex = zIndex++;

    const node = {
      id: `${id}`,
      parentId: !isNil(parentId) ? `${parentId}` : undefined,
      type,
      ...defaultAttributes[type],
      ...attributes,
    } as SerializedNode;
    nodes.push(node);

    fixTransform(
      element.attributes.getNamedItem('transform')?.value || '',
      node,
    );

    const children = svgElementsToSerializedNodes(
      Array.from(element.children) as SVGElement[],
      ++id,
      defsChildren,
      Number(node.id),
      0,
    ).filter(Boolean);

    id += children.length;
    nodes.push(...children);
  }

  return nodes;
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
