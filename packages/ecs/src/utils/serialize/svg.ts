import { isNil } from '@antv/util';
import toposort from 'toposort';
import { fontStringFromTextStyle, shiftPoints } from '../..';
import { createSVGElement } from '../browser';
import {
  InnerShadowAttributes,
  RectSerializedNode,
  SerializedNode,
  StrokeAttributes,
  TextSerializedNode,
} from './type';
import { serializePoints } from './points';

/**
 * No need to output default value in SVG Element.
 */
const defaultValues = {
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  fill: 'black',
  stroke: 'none',
  strokeWidth: 1,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeAlignment: 'center',
  strokeMiterlimit: 4,
  strokeDasharray: 'none',
  strokeDashoffset: 0,
  innerShadowBlurRadius: 0,
  innerShadowColor: 'none',
  innerShadowOffsetX: 0,
  innerShadowOffsetY: 0,
  visibility: 'visible',
  transform: 'matrix(1,0,0,1,0,0)',
  cornerRadius: 0,
  dropShadowColor: 'none',
  dropShadowOffsetX: 0,
  dropShadowOffsetY: 0,
  dropShadowBlurRadius: 0,
  fillRule: 'nonzero',
};

// @see https://github.com/plouc/nivo/issues/164
const BASELINE_MAP: Record<string, string> = {
  top: 'hanging', // Use hanging here.
  middle: 'central',
  bottom: 'text-after-edge', // FIXME: It is not a standard property.
  alphabetic: 'alphabetic',
  ideographic: 'ideographic',
  hanging: 'hanging',
};

export function serializeNodesToSVGElements(
  nodes: SerializedNode[],
): SVGElement[] {
  const elements: SVGElement[] = [];

  const idSerializedNodeMap = new Map<string, SerializedNode>();
  for (const node of nodes) {
    idSerializedNodeMap.set(node.id, node);
  }

  const idSVGElementMap = new Map<string, SVGElement>();

  const vertices = nodes.map((node) => node.id);
  const edges = nodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [string, string]);
  const sorted = toposort.array(vertices, edges);

  for (const id of sorted) {
    const node = idSerializedNodeMap.get(id);
    const { id: _, parentId, type, ...restAttributes } = node;
    const element = createSVGElement(type);
    element.id = `${id}`;

    const {
      transform,
      innerShadowColor,
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      dropShadowColor,
      dropShadowOffsetX,
      dropShadowOffsetY,
      dropShadowBlurRadius,
      strokeAlignment,
      tessellationMethod,
      cornerRadius,
      zIndex,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      fontVariant,
      content,
      letterSpacing,
      lineHeight,
      whiteSpace,
      wordWrap,
      wordWrapWidth,
      textAlign,
      textBaseline,
      bitmapFontKerning,
      physical,
      esdt,
      leading,
      maxLines,
      ...rest
    } = restAttributes as any;

    Object.entries(rest).forEach(([key, value]) => {
      if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
      }
    });

    // Handle negative size of rect.
    if (type === 'rect') {
      const { width, height, x, y } = node;
      if (width < 0 || height < 0) {
        const x1 = x;
        const y1 = y;
        const x2 = x + width;
        const y2 = y + height;
        element.setAttribute('x', `${Math.min(x1, x2)}`);
        element.setAttribute('y', `${Math.min(y1, y2)}`);
        element.setAttribute('width', `${Math.abs(width)}`);
        element.setAttribute('height', `${Math.abs(height)}`);
      }
    }

    if (textAlign) {
      // "center" | "end" | "left" | "right" | "start";
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/text-anchor
      if (textAlign === 'center') {
        element.setAttribute('text-anchor', 'middle');
      } else {
        element.setAttribute('text-anchor', textAlign);
      }
    }

    if (textBaseline) {
      element.setAttribute('dominant-baseline', BASELINE_MAP[textBaseline]);
    }

    const innerStrokeAlignment = strokeAlignment === 'inner';
    const outerStrokeAlignment = strokeAlignment === 'outer';
    const innerOrOuterStrokeAlignment =
      innerStrokeAlignment || outerStrokeAlignment;
    // const hasFillImage = rest.fill && isString(rest.fill) && isDataUrl(rest.fill);
    // const hasFillGradient =
    //   rest.fill && isString(rest.fill) && isGradient(rest.fill);
    // const hasFillPattern = rest.fill && isPattern(rest.fill);
    const hasFillImage = false;
    const hasFillGradient = false;
    const hasFillPattern = false;
    const isRough = false;
    // const visible = true;
    const hasChildren = edges.some(([parentId]) => parentId === id);

    /**
     * In the vast majority of cases, it is the element itself.
     *
     * Here's 3 examples where it's not the element itself but a <g> element as its parent.
     * @example
     *
     * When the element has children.
     * ```html
     * <g transform="matrix()">
     *  <circle />
     *  <text /> <!-- child #1 -->
     *  <text /> <!-- child #2 -->
     * </g>
     * ```
     *
     * When strokeAlignment is 'inner' or 'outer'.
     * ```html
     * <g transform="matrix()">
     *  <circle /> <!-- fill -->
     *  <circle /> <!-- stroke -->
     * </g>
     * ```
     *
     * `innerShadow` is implemented as a filter effect.
     * ```html
     * <g filter="url(#filter)">
     *   <defs>
     *     <filter id="filter" />
     *   </defs>
     *   <circle />
     * </g>
     * ```
     */
    let $g: SVGElement;
    if (
      (hasChildren && type !== 'g') ||
      (innerOrOuterStrokeAlignment && type !== 'polyline') ||
      isRough ||
      hasFillImage ||
      hasFillGradient ||
      hasFillPattern
    ) {
      $g = createSVGElement('g');
      if (element) {
        $g.appendChild(element);
      }
    }

    if (innerOrOuterStrokeAlignment) {
      exportInnerOrOuterStrokeAlignment(node, element, $g);
    }
    if (innerShadowBlurRadius > 0) {
      exportInnerShadow(node, element, $g);
    }
    if (dropShadowBlurRadius > 0) {
      // RoughRect has no element, use $g instead.
      exportDropShadow(node, element || $g, $g);
    }
    // avoid `fill="[object ImageBitmap]"`
    if (hasFillImage) {
      // exportFillImage(node, element, $g);
    }
    if (hasFillGradient || hasFillPattern) {
      // exportFillGradientOrPattern(node, element, $g);
    }

    $g = $g || element;

    // if (visible === false) {
    //   // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/visibility
    //   $g.setAttribute('visibility', 'hidden');
    // }
    if (cornerRadius) {
      $g.setAttribute('rx', `${cornerRadius}`);
      $g.setAttribute('ry', `${cornerRadius}`);
    }
    if (isRough) {
      // exportRough(node, $g);
    }
    if (content) {
      exportText(node, $g);
    }

    const { a, b, c, d, tx, ty } = transform.matrix;
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || tx !== 0 || ty !== 0) {
      $g.setAttribute('transform', `matrix(${a},${b},${c},${d},${tx},${ty})`);
    }

    // TODO: ZIndex

    idSVGElementMap.set(id, $g);
    if (parentId) {
      const parent = idSVGElementMap.get(parentId);
      if (parent) {
        parent.appendChild($g);
      }
    } else {
      elements.push($g);
    }
  }
  return elements;
}

export function camelToKebabCase(str: string) {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * @see https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
 * @example
 * ```html
 * <g transform="matrix()">
 *  <circle /> <!-- fill -->
 *  <circle /> <!-- stroke -->
 * </g>
 * ```
 */
function exportInnerOrOuterStrokeAlignment(
  attributes: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const { type } = attributes;
  const { strokeWidth, strokeAlignment } = attributes as StrokeAttributes;
  const innerStrokeAlignment = strokeAlignment === 'inner';
  const halfStrokeWidth = strokeWidth / 2;

  if (type === 'polyline') {
    const { points: pointsStr } = attributes;

    const points = pointsStr
      .split(' ')
      .map((xy) => xy.split(',').map(Number)) as [number, number][];

    const shiftedPoints = shiftPoints(
      points,
      innerStrokeAlignment,
      strokeWidth,
    );

    element.setAttribute('points', serializePoints(shiftedPoints));
  } else {
    const $stroke = element.cloneNode() as SVGElement;
    element.setAttribute('stroke', 'none');
    $stroke.setAttribute('fill', 'none');

    if (type === 'circle') {
      const { r } = attributes;
      const offset = innerStrokeAlignment ? -halfStrokeWidth : halfStrokeWidth;
      $stroke.setAttribute('r', `${r + offset}`);
    } else if (type === 'ellipse') {
      const { rx, ry } = attributes;
      const offset = innerStrokeAlignment ? -halfStrokeWidth : halfStrokeWidth;
      $stroke.setAttribute('rx', `${rx + offset}`);
      $stroke.setAttribute('ry', `${ry + offset}`);
    } else if (type === 'rect') {
      const { x, y, width, height, strokeWidth } = attributes;
      $stroke.setAttribute(
        'x',
        `${x + (innerStrokeAlignment ? halfStrokeWidth : -halfStrokeWidth)}`,
      );
      $stroke.setAttribute(
        'y',
        `${y + (innerStrokeAlignment ? halfStrokeWidth : -halfStrokeWidth)}`,
      );
      $stroke.setAttribute(
        'width',
        `${width + (innerStrokeAlignment ? -strokeWidth : strokeWidth)}`,
      );
      $stroke.setAttribute(
        'height',
        `${height + (innerStrokeAlignment ? -strokeWidth : strokeWidth)}`,
      );
    }

    $g.appendChild($stroke);
  }
}

/**
 * Use filter to create inner shadow.
 * @see https://stackoverflow.com/questions/69799051/creating-inner-shadow-in-svg
 * @example
 * ```html
 * <g filter="url(#filter)">
 *   <defs>
 *     <filter id="filter">
 *       <feOffset dx="10" dy="10"/>
 *     </filter>
 *   </defs>
 *   <circle />
 * </g>
 * ```
 */
export function exportInnerShadow(
  attributes: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const { id } = attributes;
  const {
    innerShadowOffsetX,
    innerShadowOffsetY,
    innerShadowBlurRadius,
    innerShadowColor,
  } = attributes as InnerShadowAttributes;

  const $defs = createSVGElement('defs');
  const $filter = createSVGElement('filter');
  $filter.id = `filter_inner_shadow_${id}`;

  const $feComponentTransfer = createSVGElement('feComponentTransfer');
  $feComponentTransfer.setAttribute('in', 'SourceAlpha');
  const $feFuncA = createSVGElement('feFuncA');
  $feFuncA.setAttribute('type', 'table');
  $feFuncA.setAttribute('tableValues', '1 0');
  $feComponentTransfer.appendChild($feFuncA);
  $filter.appendChild($feComponentTransfer);

  const $feGaussianBlur = createSVGElement('feGaussianBlur');
  $feGaussianBlur.setAttribute(
    'stdDeviation',
    `${(innerShadowBlurRadius || 0) / 4}`,
  );
  $filter.appendChild($feGaussianBlur);

  const $feOffset = createSVGElement('feOffset');
  $feOffset.setAttribute('dx', `${(innerShadowOffsetX || 0) / 2}`);
  $feOffset.setAttribute('dy', `${(innerShadowOffsetY || 0) / 2}`);
  $feOffset.setAttribute('result', 'offsetblur');
  $filter.appendChild($feOffset);

  const $feFlood = createSVGElement('feFlood');
  $feFlood.setAttribute('flood-color', innerShadowColor);
  $feFlood.setAttribute('result', 'color');
  $filter.appendChild($feFlood);

  const $feComposite = createSVGElement('feComposite');
  $feComposite.setAttribute('in2', 'offsetblur');
  $feComposite.setAttribute('operator', 'in');
  $filter.appendChild($feComposite);

  const $feComposite2 = createSVGElement('feComposite');
  $feComposite2.setAttribute('in2', 'SourceAlpha');
  $feComposite2.setAttribute('operator', 'in');
  $filter.appendChild($feComposite2);

  const $feMerge = createSVGElement('feMerge');
  $filter.appendChild($feMerge);
  const $feMergeNode = createSVGElement('feMergeNode');
  $feMergeNode.setAttribute('in', 'SourceGraphic');
  const $feMergeNode2 = createSVGElement('feMergeNode');
  $feMerge.appendChild($feMergeNode);
  $feMerge.appendChild($feMergeNode2);

  $defs.appendChild($filter);

  element.appendChild($defs);
  const existedFilter = element.getAttribute('filter') || '';
  element.setAttribute('filter', `${existedFilter} url(#${$filter.id})`.trim());
}

export function exportDropShadow(
  attributes: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const {
    id,
    width,
    height,
    dropShadowBlurRadius,
    dropShadowColor,
    dropShadowOffsetX,
    dropShadowOffsetY,
  } = attributes as RectSerializedNode;

  const $defs = createSVGElement('defs');
  const $filter = createSVGElement('filter');
  $filter.id = `filter_drop_shadow_${id}`;

  const $feDropShadow = createSVGElement('feDropShadow');
  $feDropShadow.setAttribute(
    'dx',
    `${((dropShadowOffsetX || 0) / 2) * Math.sign(width)}`,
  );
  $feDropShadow.setAttribute(
    'dy',
    `${((dropShadowOffsetY || 0) / 2) * Math.sign(height)}`,
  );
  $feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
  );
  $feDropShadow.setAttribute('flood-color', dropShadowColor);
  $filter.appendChild($feDropShadow);

  $defs.appendChild($filter);

  element.appendChild($defs);
  const existedFilter = element.getAttribute('filter') || '';
  element.setAttribute('filter', `${existedFilter} url(#${$filter.id})`.trim());
}

/**
 * use <text> and <tspan> to render text.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text#example
 */
export function exportText(attributes: SerializedNode, $g: SVGElement) {
  const {
    content,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontVariant,
    fill,
  } = attributes as TextSerializedNode;
  $g.textContent = content;

  let styleCSSText = '';
  const fontStyleString = fontStringFromTextStyle({
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontVariant,
  });
  if (fontStyleString) {
    styleCSSText += `font: ${fontStyleString};`;
  }
  if (fill) {
    styleCSSText += `fill: ${fill as string};`;
  }
  if (styleCSSText) {
    $g.setAttribute('style', styleCSSText);
  }
}
