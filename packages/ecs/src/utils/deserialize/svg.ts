import { isNil, isNumber } from '@antv/util';
import { v4 as uuidv4 } from 'uuid';
import {
  TextDecorationLine,
  TextDecorationStyle,
  Visibility,
} from '../../components';
import {
  defaultAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  SerializedNode,
  fixTransform,
  TextSerializedNode,
} from '../serialize';
import { deserializePoints } from './points';

const DOMINANT_BASELINE_MAP: Record<string, string> = {
  auto: 'alphabetic',
  central: 'middle',
  middle: 'middle',
  alphabetic: 'alphabetic',
  ideographic: 'ideographic',
  hanging: 'hanging',
};

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
  const nodes: SerializedNode[] = [];

  for (const element of elements) {
    let type = element.tagName.toLowerCase();

    let id = element.id || uuidv4();

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
          return svgElementsToSerializedNodes([def], defsChildren, parentId);
        }
      }
      continue;
    } else if (type === 'tspan') {
      continue;
    }

    // <g> maybe a single element, so we need to infer it, e.g. a rect with children
    let inferedSingleElement = false;
    if (type === 'g') {
      // <g><defs></defs></g> e.g. a <polyline> with an arrow
      if (
        Array.from(element.children).filter((child) => child.tagName !== 'defs')
          .length === 1
      ) {
        inferedSingleElement = true;
        id = undefined;
        overrideAttributes = element.attributes;
      }
    }

    if (!inferedSingleElement) {
      const attributes = [
        ...Array.from(element.attributes),
        ...Array.from(overrideAttributes || []),
      ].reduce((prev, attr) => {
        let attributeName = kebabToCamelCase(attr.name);

        let value: string | number = attr.value;

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
        if (element.style.fill) {
          (attributes as TextSerializedNode).fill = element.style.fill;
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
        (attributes as TextSerializedNode).anchorX = x;
        (attributes as TextSerializedNode).anchorY = y;

        delete attributes.x;
        delete attributes.y;
        // @ts-ignore
        delete attributes.style;
      } else if (type === 'line') {
        type = 'polyline';
        // @ts-ignore
        const { x1, y1, x2, y2 } = attributes;
        (
          attributes as PolylineSerializedNode
        ).points = `${x1},${y1} ${x2},${y2}`;
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
        id,
        parentId: !isNil(parentId) ? `${parentId}` : undefined,
        type,
        ...defaultAttributes[type],
        ...attributes,
      } as SerializedNode;
      nodes.push(node);

      fixTransform((attributes as any).transform || '', node);
    }

    const children = svgElementsToSerializedNodes(
      Array.from(element.children) as SVGElement[],
      defsChildren,
      id,
      0,
      overrideAttributes,
    ).filter(Boolean);

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
