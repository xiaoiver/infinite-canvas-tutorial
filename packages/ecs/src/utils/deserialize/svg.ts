import { Visibility } from '../../components';
import {
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
  SerializedTransform,
  serializeTransform,
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

      let value: string | number | SerializedTransform = attr.value;
      if (attributeName === 'transform') {
        value = serializeTransform(value);
      } else if (
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

    if (type === 'text') {
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
    const visibility = element.getAttribute('visibility') || 'visible';
    attributes.visibility = visibility as Visibility['value'];

    attributes.name =
      element.getAttribute('name') ||
      (type === 'text' && (attributes as TextSerializedNode).content) ||
      `Layer ${id}`;

    const node = {
      id: `${id}`,
      parentId: parentId ? `${parentId}` : undefined,
      type,
      ...attributes,
    } as SerializedNode;
    nodes.push(node);

    const children = svgElementsToSerializedNodes(
      Array.from(element.children) as SVGElement[],
      ++id,
      defsChildren,
      Number(node.id),
    ).filter(Boolean);

    id += children.length;
    nodes.push(...children);
  }

  return nodes;
}

export function kebabToCamelCase(str: string) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}
