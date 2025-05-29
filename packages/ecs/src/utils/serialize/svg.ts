import { isNil, isString } from '@antv/util';
import toposort from 'toposort';
import { AABB, Ellipse, Polyline, Rect } from '../../components';
import { maybeShiftPoints, shiftPoints } from '../../systems/ComputePoints';
import { fontStringFromTextStyle } from '../../systems/ComputeTextMetrics';
import { createSVGElement } from '../browser';
import {
  EllipseSerializedNode,
  InnerShadowAttributes,
  PathSerializedNode,
  PolylineSerializedNode,
  RectSerializedNode,
  SerializedNode,
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
import { deserializePoints } from '../deserialize';
import { formatTransform } from '../matrix';
import { sortByFractionalIndex } from '../../systems';

const strokeDefaultAttributes = {
  strokeOpacity: 1,
  stroke: 'none',
  strokeWidth: 1,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeAlignment: 'center',
  strokeMiterlimit: 4,
  strokeDasharray: 'none',
  strokeDashoffset: 0,
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
  ellipse: {
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  polyline: {
    ...commonDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  path: {
    fillRule: 'nonzero',
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  text: {
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
  },
  g: {
    ...commonDefaultAttributes,
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
      visibility,
      fractionalIndex,
      ...rest
    } = restAttributes as any;

    Object.entries(rest).forEach(([key, value]) => {
      if (
        `${value}` !== '' &&
        `${defaultAttributes[type][key]}` !== `${value}`
      ) {
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
      exportFillImage(node, element, $g);
    }
    if (hasFillGradient || hasFillPattern) {
      exportFillGradientOrPattern(node, element, $g);
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
      // exportRough(node, $g);
    }
    if (content) {
      exportText(node, $g);
    }

    const { a, b, c, d, tx, ty } = transform.matrix;
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || tx !== 0 || ty !== 0) {
      $g.setAttribute('transform', `matrix(${a},${b},${c},${d},${tx},${ty})`);
    }

    idSVGElementMap.set(id, $g);
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

  // TODO: Sort by zIndex

  // Sort by fractionalIndex
  elements
    .sort((a, b) => {
      const aNode = idSerializedNodeMap.get(`node-${a.id}`);
      const bNode = idSerializedNodeMap.get(`node-${b.id}`);
      return sortByFractionalIndex(
        aNode.fractionalIndex,
        bNode.fractionalIndex,
      );
    })
    .reverse();

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
    $pattern.setAttribute('patternTransform', formatTransform(transform));
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

/**
 * Calculate the x and y of the node.
 */
export function getXY(node: SerializedNode) {
  const { type } = node;
  if (type === 'rect') {
    const { x, y } = node as RectSerializedNode;
    return { x, y };
  } else if (type === 'text') {
    const { x, y } = node as TextSerializedNode;
    return { x, y };
  } else if (type === 'ellipse') {
    // @ts-ignore
    const { cx, cy, rx, ry } = node as EllipseSerializedNode;
    return { x: cx - rx, y: cy - ry };
  } else if (type === 'polyline') {
    const { points, strokeWidth, strokeAlignment } =
      node as PolylineSerializedNode;

    const shiftedPoints = maybeShiftPoints(
      deserializePoints(points),
      strokeAlignment,
      strokeWidth,
    );

    const minX = Math.min(
      ...shiftedPoints.map((point) => (isNaN(point[0]) ? Infinity : point[0])),
    );
    const minY = Math.min(
      ...shiftedPoints.map((point) => (isNaN(point[1]) ? Infinity : point[1])),
    );
    const maxX = Math.max(
      ...shiftedPoints.map((point) => (isNaN(point[0]) ? Infinity : point[0])),
    );
    const maxY = Math.max(
      ...shiftedPoints.map((point) => (isNaN(point[1]) ? Infinity : point[1])),
    );
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  } else if (type === 'path') {
    return { x: 0, y: 0 };
    // const { d } = node as PathSerializedNode;
  }

  return { x: 0, y: 0 };
}
