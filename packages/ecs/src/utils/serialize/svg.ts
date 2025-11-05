import { isNil, isNumber, isString } from '@antv/util';
import toposort from 'toposort';
import { Marker, Mat3 } from '../../components';
import {
  shiftPoints,
  fontStringFromTextStyle,
  sortByFractionalIndex,
  measureText,
} from '../../systems';
import { createSVGElement } from '../browser';
import {
  InnerShadowAttributes,
  PathSerializedNode,
  RectSerializedNode,
  SerializedNode,
  SerializedNodeAttributes,
  StrokeAttributes,
  TextSerializedNode,
} from './type';
import { serializePoints } from './points';
import {
  computeLinearGradient,
  computeRadialGradient,
  Gradient,
  isGradient,
  parseGradient,
} from '../gradient';
import { isPattern, Pattern } from '../pattern';
import { generateGradientKey, generatePatternKey } from '../../resources';
import { lineArrow } from '../marker';
import { DOMAdapter } from '../../environment';

const strokeDefaultAttributes = {
  strokeOpacity: 1,
  stroke: 'none',
  strokeWidth: 1,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeAlignment: 'center',
  strokeMiterlimit: 4,
  strokeDasharray: '0,0',
  strokeDashoffset: 0,
};

export const markerDefaultAttributes = {
  markerStart: 'none',
  markerEnd: 'none',
  markerFactor: 3,
};

const fillDefaultAttributes = {
  fillOpacity: 1,
  fill: 'black',
};

const commonDefaultAttributes = {
  visibility: 'inherited',
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
};

/**
 * No need to output default value in SVG Element.
 */
export const defaultAttributes: Record<
  SerializedNode['type'],
  Record<string, any>
> = {
  rect: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    cornerRadius: 0,
    dropShadowColor: 'none',
    dropShadowOffsetX: 0,
    dropShadowOffsetY: 0,
    dropShadowBlurRadius: 0,
    innerShadowBlurRadius: 0,
    innerShadowColor: 'none',
    innerShadowOffsetX: 0,
    innerShadowOffsetY: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  'rough-rect': {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    cornerRadius: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  'rough-ellipse': {
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  ellipse: {
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  line: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    ...commonDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
  },
  polyline: {
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
  },
  brush: {
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  path: {
    fillRule: 'nonzero',
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
  },
  text: {
    fontFamily: 'sans-serif',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontVariant: 'normal',
    letterSpacing: 0,
    whiteSpace: 'normal',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineHeight: 0,
    leading: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  g: {
    ...commonDefaultAttributes,
  },
  'vector-network': {
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  html: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    html: '',
  },
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
  const svgElementIdMap = new WeakMap<SVGElement, string>();

  const vertices = nodes.map((node) => node.id);
  const edges = nodes
    .filter((node) => !isNil(node.parentId))
    .map((node) => [node.parentId, node.id] as [string, string]);
  const sorted = toposort.array(vertices, edges);

  for (const id of sorted) {
    const node = idSerializedNodeMap.get(id);
    const { id: _, parentId, type, ...restAttributes } = node;
    const element = createSVGElement(type);
    element.id = `node-${id}`;

    const {
      x = 0,
      y = 0,
      width,
      height,
      scaleX = 1,
      scaleY = 1,
      rotation = 0,
      innerShadowColor,
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      dropShadowColor,
      dropShadowOffsetX,
      dropShadowOffsetY,
      dropShadowBlurRadius,
      decorationColor,
      decorationLine,
      decorationStyle,
      decorationThickness,
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
      visibility,
      fractionalIndex,
      fontBoundingBoxAscent,
      fontBoundingBoxDescent,
      hangingBaseline,
      ideographicBaseline,
      textOverflow,
      markerStart,
      markerEnd,
      markerFactor,
      ...rest
    } = restAttributes as SerializedNodeAttributes;

    Object.entries(rest).forEach(([key, value]) => {
      if (
        `${value}` !== '' &&
        `${defaultAttributes[type][key]}` !== `${value}`
      ) {
        if (isNumber(value)) {
          value = toFixedAndRemoveTrailingZeros(value);
        }
        element.setAttribute(camelToKebabCase(key), `${value}`);
      }
    });

    if (type === 'ellipse') {
      element.setAttribute('cx', `${toFixedAndRemoveTrailingZeros(width / 2)}`);
      element.setAttribute(
        'cy',
        `${toFixedAndRemoveTrailingZeros(height / 2)}`,
      );
      element.setAttribute('rx', `${toFixedAndRemoveTrailingZeros(width / 2)}`);
      element.setAttribute(
        'ry',
        `${toFixedAndRemoveTrailingZeros(height / 2)}`,
      );
    } else if (type === 'rect') {
      element.setAttribute('width', `${toFixedAndRemoveTrailingZeros(width)}`);
      element.setAttribute(
        'height',
        `${toFixedAndRemoveTrailingZeros(height)}`,
      );
      // const { width, height, x, y } = node;
      // // Handle negative size of rect.
      // if (width < 0 || height < 0) {
      //   const x1 = x;
      //   const y1 = y;
      //   const x2 = x + width;
      //   const y2 = y + height;
      //   element.setAttribute('x', `${Math.min(x1, x2)}`);
      //   element.setAttribute('y', `${Math.min(y1, y2)}`);
      //   element.setAttribute('width', `${Math.abs(width)}`);
      //   element.setAttribute('height', `${Math.abs(height)}`);
      // }
    } else if (type === 'polyline' || type === 'path') {
      if (!rest.fill) {
        element.setAttribute('fill', 'none');
      }
    } else if (type === 'text') {
      let x = 0;
      let y = 0;
      if (textAlign === 'center') {
        x = width / 2;
      } else if (textAlign === 'right' || textAlign === 'end') {
        x = width;
      }

      if (textBaseline === 'middle') {
        y = height / 2;
      } else if (textBaseline === 'alphabetic' || textBaseline === 'hanging') {
        y = fontBoundingBoxAscent;
      }

      element.setAttribute('x', `${toFixedAndRemoveTrailingZeros(x)}`);
      element.setAttribute('y', `${toFixedAndRemoveTrailingZeros(y)}`);
      element.removeAttribute('fill');
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

    const hasMarker =
      (markerStart && markerStart !== 'none') ||
      (markerEnd && markerEnd !== 'none');
    const hasFillImage =
      rest.fill && isString(rest.fill) && isDataUrl(rest.fill);
    const hasFillGradient =
      rest.fill && isString(rest.fill) && isGradient(rest.fill);
    const hasFillPattern = rest.fill && isPattern(rest.fill);
    const isRough = false;
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
      hasFillPattern ||
      hasMarker
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
      exportFillImage(node, element, $g);
    }
    if (hasFillGradient || hasFillPattern) {
      exportFillGradientOrPattern(node, element, $g);
    }
    if (hasMarker) {
      exportMarker(node, element, $g);
    }

    $g = $g || element;

    if (visibility === 'hidden') {
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/visibility
      $g.setAttribute('visibility', 'hidden');
    }
    if (cornerRadius) {
      $g.setAttribute('rx', `${cornerRadius}`);
      $g.setAttribute('ry', `${cornerRadius}`);
    }
    if (isRough) {
      // TODO:
      // exportRough(node, $g);
    }
    if (content) {
      exportText(node as TextSerializedNode, $g, element);
    }

    const matrix = Mat3.from_scale_angle_translation(
      {
        x: scaleX,
        y: scaleY,
      },
      rotation,
      {
        x,
        y,
      },
    );
    const a = matrix.m00;
    const b = matrix.m01;
    const c = matrix.m10;
    const d = matrix.m11;
    const e = matrix.m20;
    const f = matrix.m21;

    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || e !== 0 || f !== 0) {
      $g.setAttribute(
        'transform',
        `matrix(${toFixedAndRemoveTrailingZeros(
          a,
        )},${toFixedAndRemoveTrailingZeros(b)},${toFixedAndRemoveTrailingZeros(
          c,
        )},${toFixedAndRemoveTrailingZeros(d)},${toFixedAndRemoveTrailingZeros(
          e,
        )},${toFixedAndRemoveTrailingZeros(f)})`,
      );
    }

    idSVGElementMap.set(id, $g);
    svgElementIdMap.set($g, id);
    if (parentId) {
      const parent = idSVGElementMap.get(parentId);
      if (parent) {
        // parent.childNodes

        parent.appendChild($g);
      }
    } else {
      elements.push($g);
    }
  }

  // Sort by fractionalIndex
  elements.sort((a, b) => {
    const aId = svgElementIdMap.get(a);
    const bId = svgElementIdMap.get(b);
    const aNode = idSerializedNodeMap.get(aId);
    const bNode = idSerializedNodeMap.get(bId);
    return sortByFractionalIndex(aNode.fractionalIndex, bNode.fractionalIndex);
  });

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

    if (type === 'ellipse') {
      const { width, height } = attributes;
      const offset = innerStrokeAlignment ? -halfStrokeWidth : halfStrokeWidth;
      $stroke.setAttribute(
        'rx',
        `${toFixedAndRemoveTrailingZeros(width / 2 + offset)}`,
      );
      $stroke.setAttribute(
        'ry',
        `${toFixedAndRemoveTrailingZeros(height / 2 + offset)}`,
      );
    } else if (type === 'rect') {
      const { width, height, strokeWidth } = attributes;
      $stroke.setAttribute(
        'x',
        `${toFixedAndRemoveTrailingZeros(
          innerStrokeAlignment ? halfStrokeWidth : -halfStrokeWidth,
        )}`,
      );
      $stroke.setAttribute(
        'y',
        `${toFixedAndRemoveTrailingZeros(
          innerStrokeAlignment ? halfStrokeWidth : -halfStrokeWidth,
        )}`,
      );
      $stroke.setAttribute(
        'width',
        `${toFixedAndRemoveTrailingZeros(
          width + (innerStrokeAlignment ? -strokeWidth : strokeWidth),
        )}`,
      );
      $stroke.setAttribute(
        'height',
        `${toFixedAndRemoveTrailingZeros(
          height + (innerStrokeAlignment ? -strokeWidth : strokeWidth),
        )}`,
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
 * <circle filter="url(#filter)">
 *   <defs>
 *     <filter id="filter">
 *       <feOffset dx="10" dy="10"/>
 *     </filter>
 *   </defs>
 * </circle>
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

function createOrUpdateGradient(
  node: SerializedNode,
  $def: SVGDefsElement,
  gradient: Gradient,
) {
  const { x, y, width, height } = node;

  const gradientId = generateGradientKey({
    ...gradient,
    min: [x, y],
    width,
    height,
  });
  let $existed = $def.querySelector(`#${gradientId}`);

  if (!$existed) {
    // <linearGradient> <radialGradient>
    // @see https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/linearGradient
    // @see https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/radialGradient
    $existed = createSVGElement(
      gradient.type === 'linear-gradient' ? 'linearGradient' : 'radialGradient',
    );
    // @see https://github.com/antvis/g/issues/1025
    $existed.setAttribute('gradientUnits', 'userSpaceOnUse');
    // add stops
    let innerHTML = '';
    gradient.steps
      // sort by offset @see https://github.com/antvis/G/issues/1171
      .sort((a, b) => a.offset.value - b.offset.value)
      .forEach(({ offset, color }) => {
        // TODO: support absolute unit like `px`
        innerHTML += `<stop offset="${
          offset.value / 100
        }" stop-color="${color}"></stop>`;
      });
    $existed.innerHTML = innerHTML;
    $existed.id = gradientId;
    $def.appendChild($existed);
  }

  if (gradient.type === 'linear-gradient') {
    const { angle } = gradient;
    const { x1, y1, x2, y2 } = computeLinearGradient(
      [x, y],
      width,
      height,
      angle,
    );

    $existed.setAttribute('x1', `${x1}`);
    $existed.setAttribute('y1', `${y1}`);
    $existed.setAttribute('x2', `${x2}`);
    $existed.setAttribute('y2', `${y2}`);
  } else if (gradient.type === 'radial-gradient') {
    const { cx, cy, size } = gradient;
    const {
      x: xx,
      y: yy,
      r,
    } = computeRadialGradient([x, y], width, height, cx, cy, size);

    $existed.setAttribute('cx', `${xx}`);
    $existed.setAttribute('cy', `${yy}`);
    $existed.setAttribute('r', `${r}`);
  }

  return gradientId;
}

export function createOrUpdateMultiGradient(
  node: SerializedNode,
  $def: SVGDefsElement,
  gradients: Gradient[],
) {
  const filterId = `filter-${node.id}-gradient`;
  let $existed = $def.querySelector(`#${filterId}`);
  if (!$existed) {
    $existed = createSVGElement('filter') as SVGFilterElement;
    $existed.setAttribute('filterUnits', 'userSpaceOnUse');
    // @see https://github.com/antvis/g/issues/1025
    $existed.setAttribute('x', '0%');
    $existed.setAttribute('y', '0%');
    $existed.setAttribute('width', '100%');
    $existed.setAttribute('height', '100%');

    $existed.id = filterId;

    $def.appendChild($existed);
  }

  /**
   * <rect id="wave-rect" x="0" y="0" width="100%" height="100%" fill="url(#wave)"></rect>
   * <filter id="blend-it" x="0%" y="0%" width="100%" height="100%">
        <feImage xlink:href="#wave-rect" result="myWave" x="100" y="100"/>
        <feImage xlink:href="#ry-rect" result="myRY"  x="100" y="100"/>
        <feBlend in="myWave" in2="myRY" mode="multiply" result="blendedGrad"/>
        <feComposite in="blendedGrad" in2="SourceGraphic" operator="in"/>
    </filter>
   */

  let blended = 0;
  gradients.forEach((gradient, i) => {
    const gradientId = createOrUpdateGradient(node, $def, gradient);

    const rectId = `${gradientId}_rect`;
    const $rect = createSVGElement('rect') as SVGRectElement;
    $rect.setAttribute('x', '0');
    $rect.setAttribute('y', '0');
    $rect.setAttribute('width', '100%');
    $rect.setAttribute('height', '100%');
    $rect.setAttribute('fill', `url(#${gradientId})`);
    $rect.id = rectId;
    $def.appendChild($rect);

    const $feImage = createSVGElement('feImage') as SVGFEImageElement;
    $feImage.setAttribute('href', `#${rectId}`);
    $feImage.setAttribute('result', `${filterId}-${i}`);
    $existed.appendChild($feImage);

    if (i > 0) {
      const $feBlend = createSVGElement('feBlend') as SVGFEBlendElement;
      $feBlend.setAttribute(
        'in',
        i === 1 ? `${filterId}-${i - 1}` : `${filterId}-blended-${blended - 1}`,
      );
      $feBlend.setAttribute('in2', `${filterId}-${i}`);
      $feBlend.setAttribute('result', `${filterId}-blended-${blended++}`);
      // @see https://developer.mozilla.org/zh-CN/docs/Web/CSS/blend-mode
      $feBlend.setAttribute('mode', 'multiply');
      $existed.appendChild($feBlend);
    }
  });

  const $feComposite = createSVGElement('feComposite') as SVGFECompositeElement;
  $feComposite.setAttribute('in', `${filterId}-blended-${blended}`);
  $feComposite.setAttribute('in2', 'SourceGraphic');
  $feComposite.setAttribute('operator', 'in');
  $existed.appendChild($feComposite);

  return filterId;
}

function create$Pattern(
  node: SerializedNode,
  $def: SVGDefsElement,
  pattern: Pattern,
  patternId: string,
) {
  const { repetition, transform, width, height } = pattern;

  // @see https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/pattern
  const $pattern = createSVGElement('pattern') as SVGPatternElement;
  if (transform) {
    $pattern.setAttribute('patternTransform', transform);
  }
  $pattern.setAttribute('patternUnits', 'userSpaceOnUse');

  $pattern.id = patternId;
  $def.appendChild($pattern);

  const { x, y, width: nodeWidth, height: nodeHeight } = node;
  $pattern.setAttribute('x', `${x}`);
  $pattern.setAttribute('y', `${y}`);

  // There is no equivalent to CSS no-repeat for SVG patterns
  // @see https://stackoverflow.com/a/33481956
  let patternWidth = width;
  let patternHeight = height;
  if (repetition === 'repeat-x') {
    patternHeight = nodeHeight;
  } else if (repetition === 'repeat-y') {
    patternWidth = nodeWidth;
  } else if (repetition === 'no-repeat') {
    patternWidth = nodeWidth;
    patternHeight = nodeHeight;
  }
  $pattern.setAttribute('width', `${patternWidth}`);
  $pattern.setAttribute('height', `${patternHeight}`);

  return $pattern;
}

function createOrUpdatePattern(
  node: SerializedNode,
  $def: SVGDefsElement,
  pattern: Pattern,
) {
  const { width: nodeWidth, height: nodeHeight } = node;

  const patternId = generatePatternKey({ pattern });
  const $existed = $def.querySelector(`#${patternId}`);
  if (!$existed) {
    const imageURL = pattern.image as string;
    if (imageURL) {
      const $image = createSVGElement('image');
      // use href instead of xlink:href
      // @see https://stackoverflow.com/a/13379007
      $image.setAttribute('href', imageURL);

      const $pattern = create$Pattern(node, $def, pattern, patternId);

      $def.appendChild($pattern);
      $pattern.appendChild($image);

      $image.setAttribute('x', '0');
      $image.setAttribute('y', '0');
      $image.setAttribute('width', `${pattern.width || nodeWidth}`);
      $image.setAttribute('height', `${pattern.height || nodeHeight}`);
    }
  }
  return patternId;
}

export function exportFillGradientOrPattern(
  node: SerializedNode,
  $el: SVGElement,
  $g: SVGElement,
) {
  const $defs = createSVGElement('defs') as SVGDefsElement;
  $g.prepend($defs);

  const fill = (node as TextSerializedNode).fill;

  if (isPattern(fill)) {
    const patternId = createOrUpdatePattern(node, $defs, fill);
    $el?.setAttribute('fill', `url(#${patternId})`);
  } else {
    const gradients = parseGradient(fill as string);
    if (gradients.length === 1) {
      const gradientId = createOrUpdateGradient(node, $defs, gradients[0]);
      $el?.setAttribute('fill', `url(#${gradientId})`);
    } else {
      // @see https://stackoverflow.com/questions/20671502/can-i-blend-gradients-in-svg
      const filterId = createOrUpdateMultiGradient(node, $defs, gradients);
      $el?.setAttribute('filter', `url(#${filterId})`);
      $el?.setAttribute('fill', 'black');
    }
  }
}

function createOrUpdateMarker(
  node: SerializedNode,
  $def: SVGDefsElement,
  marker: Marker['start'],
  isEnd = false,
) {
  const {
    stroke,
    strokeWidth,
    strokeOpacity,
    strokeLinecap,
    strokeLinejoin,
    markerFactor = 3,
  } = node as PathSerializedNode;

  const patternId = `marker-${marker}-${
    isEnd ? 'end' : 'start'
  }-${strokeWidth}`;
  const $existed = $def.querySelector(`#${patternId}`);
  if (!$existed) {
    const arrowRadius = strokeWidth * markerFactor;
    const markerSize = arrowRadius * markerFactor;
    const viewBoxSize = arrowRadius * markerFactor;
    const viewBoxOffset = viewBoxSize / markerFactor;

    const $marker = createSVGElement('marker');
    $marker.setAttribute('id', patternId);
    // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/markerUnits
    $marker.setAttribute('markerUnits', 'userSpaceOnUse');
    $marker.setAttribute('markerWidth', `${markerSize}`);
    $marker.setAttribute('markerHeight', `${markerSize}`);
    $marker.setAttribute(
      'viewBox',
      `-${viewBoxOffset} -${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`,
    );
    $marker.setAttribute('refX', '0');
    $marker.setAttribute('refY', '0');
    if (isEnd) {
      $marker.setAttribute('orient', 'auto');
    } else {
      $marker.setAttribute('orient', 'auto-start-reverse');
    }
    $def.appendChild($marker);

    if (marker === 'line') {
      const points = lineArrow(0, 0, arrowRadius, Math.PI);
      const $path = createSVGElement('path');
      $path.setAttribute('fill', 'none');
      $path.setAttribute('stroke', stroke);
      $path.setAttribute('stroke-width', `${strokeWidth}`);
      if (!isNil(strokeOpacity)) {
        $path.setAttribute('stroke-opacity', `${strokeOpacity}`);
      }
      if (!isNil(strokeLinecap)) {
        $path.setAttribute('stroke-linecap', strokeLinecap);
      }
      if (!isNil(strokeLinejoin)) {
        $path.setAttribute('stroke-linejoin', strokeLinejoin);
      }
      $path.setAttribute(
        'd',
        `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]}`,
      );
      $marker.appendChild($path);
    }
  }
  return patternId;
}

export function exportMarker(
  node: SerializedNode,
  $el: SVGElement,
  $g: SVGElement,
) {
  const { markerStart, markerEnd } = node as PathSerializedNode;

  const $defs = createSVGElement('defs') as SVGDefsElement;
  $g.prepend($defs);

  if (markerStart === 'line') {
    const markerId = createOrUpdateMarker(node, $defs, markerStart);
    $el?.setAttribute('marker-start', `url(#${markerId})`);
  }
  if (markerEnd === 'line') {
    const markerId = createOrUpdateMarker(node, $defs, markerEnd, true);
    $el?.setAttribute('marker-end', `url(#${markerId})`);
  }
}

/**
 * use <text> and <tspan> to render text.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text#example
 */
export function exportText(
  attributes: TextSerializedNode,
  $g: SVGElement,
  element: SVGElement,
) {
  const {
    content,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontVariant,
    fill,
    decorationLine,
    decorationStyle,
    decorationColor,
    decorationThickness,
  } = attributes;

  const { lineHeight } = measureText(attributes);

  const lines = content.split('\n');
  if (lines.length > 1) {
    lines.forEach((line, i) => {
      const $tspan = createSVGElement('tspan');
      $tspan.textContent = line;
      $tspan.setAttribute('x', '0');
      $tspan.setAttribute('dy', `${i * lineHeight}`);
      $g.appendChild($tspan);
    });
  } else {
    $g.textContent = content;
  }

  // <text>
  if ($g === element) {
    $g.setAttribute('font-family', fontFamily);
    $g.setAttribute('font-size', `${fontSize}`);
    $g.setAttribute('font-weight', `${fontWeight}`);
    $g.setAttribute('font-style', fontStyle);
    $g.setAttribute('font-variant', fontVariant);
    $g.setAttribute('fill', fill as string);
  } else {
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

  // TODO: use <foreignObject> to render text decoration.
  // @see https://stackoverflow.com/questions/76894327/text-decoration-of-a-text-svg-in-html
  if (decorationLine !== 'none' && decorationThickness > 0) {
    // @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration#values
    // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/text-decoration
    // e.g. text-decoration: solid underline purple 4px;
    const styleCSSText = $g.getAttribute('style') || '';

    $g.setAttribute(
      'style',
      styleCSSText +
        `text-decoration: ${decorationStyle} ${decorationLine} ${decorationColor} ${decorationThickness}px;`,
    );
  }
}

export function exportFillImage(
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const $defs = createSVGElement('defs');
  const $pattern = createSVGElement('pattern');
  $pattern.id = `image-fill_${node.id}`;
  $pattern.setAttribute('patternUnits', 'objectBoundingBox');
  $pattern.setAttribute('width', '1');
  $pattern.setAttribute('height', '1');
  const $image = createSVGElement('image');
  $image.setAttribute('href', (node as any).fill as string);
  $image.setAttribute('x', '0');
  $image.setAttribute('y', '0');
  // use geometry bounds of shape.
  const { width: nodeWidth, height: nodeHeight } = node;
  $image.setAttribute('width', `${nodeWidth}`);
  $image.setAttribute('height', `${nodeHeight}`);
  $pattern.appendChild($image);
  $defs.appendChild($pattern);
  $g.appendChild($defs);

  element.setAttribute('fill', `url(#${$pattern.id})`);
}

const dataUrlRegex =
  /^data:([a-z]+\/[a-z0-9\-\+]+)?(;charset=[a-z0-9\-]+)?(;base64)?,[a-z0-9\!\$&',\(\)\*\+,;=\-\._\~:@\/\?%\s]*$/i;
export function isDataUrl(url: string) {
  return dataUrlRegex.test(url);
}

export function isUrl(url: string) {
  return (
    url &&
    (url.startsWith('http') || url.startsWith('https') || url.startsWith('/'))
  );
}

function toFixedAndRemoveTrailingZeros(value: number) {
  return value.toFixed(3).replace(/\.?0+$/, '');
}

export function toSVG($svg: SVGElement) {
  const svgDocType = DOMAdapter.get()
    .getDocument()
    .implementation.createDocumentType(
      'svg',
      '-//W3C//DTD SVG 1.1//EN',
      'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd',
    );
  const svgDoc = DOMAdapter.get()
    .getDocument()
    .implementation.createDocument(
      'http://www.w3.org/2000/svg',
      'svg',
      svgDocType,
    );
  svgDoc.replaceChild($svg, svgDoc.documentElement);
  return DOMAdapter.get().getXMLSerializer().serializeToString(svgDoc);
}

export function toSVGDataURL($svg: SVGElement) {
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(toSVG($svg))}`;
}
