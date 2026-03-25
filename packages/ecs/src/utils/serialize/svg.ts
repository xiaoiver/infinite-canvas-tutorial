import { isNil, isNumber, isString, path2String } from '@antv/util';
import toposort from 'toposort';
import { Marker, Mat3 } from '../../components';
import {
  shiftPoints,
  fontStringFromTextStyle,
  sortByFractionalIndex,
  measureText,
  computeDrawableSets,
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
} from '../../types/serialized-node';
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
import { imageToCanvas } from './image';
import { opSet2Absolute } from '../rough';

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
  'rough-line': {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    hitStrokeWidth: -1,
    ...commonDefaultAttributes,
    ...strokeDefaultAttributes,
  },
  'rough-polyline': {
    hitStrokeWidth: -1,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
  },
  'rough-path': {
    hitStrokeWidth: -1,
    ...commonDefaultAttributes,
    ...fillDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
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
    hitStrokeWidth: -1,
    ...commonDefaultAttributes,
    ...strokeDefaultAttributes,
    ...markerDefaultAttributes,
  },
  polyline: {
    hitStrokeWidth: -1,
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
    hitStrokeWidth: -1,
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
  embed: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    url: '',
  },
};

export async function serializeNodesToSVGElements(
  nodes: SerializedNode[],
): Promise<SVGElement[]> {
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

    // Use <path> for rough elements.
    const isRough = type?.startsWith('rough-');
    const element = !isRough && createSVGElement(type);

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
      /** Text attributes */
      anchorX,
      anchorY,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      fontVariant,
      fontKerning,
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
      filter,
      sizeAttenuation,
      strokeAttenuation,
      hitStrokeWidth,
      svgDataAttributes,
      version,
      versionNonce,
      updated,
      clipMode,
      /** Yoga attributes */
      display,
      alignItems,
      justifyContent,
      padding,
      margin,
      gap,
      rowGap,
      columnGap,
      flexBasis,
      flexGrow,
      flexShrink,
      flexDirection,
      flexWrap,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      /** Binded attributes */
      fromId,
      toId,
      orthogonal,
      exitX,
      exitY,
      exitPerimeter,
      exitDx,
      exitDy,
      entryX,
      entryY,
      entryPerimeter,
      entryDx,
      entryDy,
      edgeStyle,
      sourceJettySize,
      targetJettySize,
      jettySize,
      sourcePortConstraint,
      targetPortConstraint,
      portConstraint,
      ...rest
    } = restAttributes as SerializedNodeAttributes;

    if (element) {
      Object.entries(rest).forEach(([key, value]) => {
        if (key === 'hitStrokeWidth' || key === 'svgDataAttributes') {
          return;
        }
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
    }

    if (type === 'rect' || type === 'ellipse' || type === 'polyline' || type === 'path') {
      if (!rest.fill) {
        element.setAttribute('fill', 'none');
      }
    }

    if (type === 'ellipse') {
      element.setAttribute('cx', `${isString(width) ? width : toFixedAndRemoveTrailingZeros(width / 2)}`);
      element.setAttribute(
        'cy',
        `${isString(height) ? height : toFixedAndRemoveTrailingZeros(height / 2)}`,
      );
      element.setAttribute('rx', `${isString(width) ? width : toFixedAndRemoveTrailingZeros(width / 2)}`);
      element.setAttribute(
        'ry',
        `${isString(height) ? height : toFixedAndRemoveTrailingZeros(height / 2)}`,
      );
    } else if (type === 'rect') {
      element.setAttribute('width', `${isString(width) ? width : toFixedAndRemoveTrailingZeros(width)}`);
      element.setAttribute(
        'height',
        `${isString(height) ? height : toFixedAndRemoveTrailingZeros(height)}`,
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
    } else if (type === 'text') {
      let x = 0;
      let y = 0;
      if (textAlign === 'center') {
        x = (width ?? 0) / 2;
      } else if (textAlign === 'right' || textAlign === 'end') {
        x = width ?? 0;
      }

      const lineHeightValue = lineHeight || fontSize as number;
      y += (lineHeightValue - (fontSize as number)) / 2;

      element.setAttribute('x', `${toFixedAndRemoveTrailingZeros(x)}`);
      element.setAttribute('y', `${toFixedAndRemoveTrailingZeros(y)}`);
      element.removeAttribute('fill');

      // if (fontFamily === 'Gaegu') {
      //   // Inline font faces so exported SVG is self-contained (see Excalidraw export.ts).
      //   // const doc = $namespace.ownerDocument;
      //   const $fontStyle = await createFontFacesStyleElement(nodes, DOMAdapter.get().getDocument());
      //   if ($fontStyle) {
      //     const $defs = createSVGElement('defs');
      //     $defs.appendChild($fontStyle);
      //     // $namespace.appendChild($defs);
      //   }
      // }
    }

    if (textAlign) {
      // "center" | "end" | "left" | "right" | "start";
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/text-anchor
      if (textAlign === 'center') {
        element.setAttribute('text-anchor', 'middle');
      } else if (textAlign === 'right' || textAlign === 'end') {
        element.setAttribute('text-anchor', 'end');
      } else if (textAlign === 'left' || textAlign === 'start') {
        element.setAttribute('text-anchor', 'start');
      }
    }

    if (sizeAttenuation) {
      element.setAttribute('vector-effect', 'non-scaling-size');
    }
    if (strokeAttenuation) {
      element.setAttribute('vector-effect', 'non-scaling-stroke');
    }

    const innerStrokeAlignment = strokeAlignment === 'inner';
    const outerStrokeAlignment = strokeAlignment === 'outer';
    const innerOrOuterStrokeAlignment =
      innerStrokeAlignment || outerStrokeAlignment;

    const hasMarker =
      (markerStart && markerStart !== 'none') ||
      (markerEnd && markerEnd !== 'none');
    const hasFillImage =
      rest.fill && isString(rest.fill) && (isUrl(rest.fill) || isDataUrl(rest.fill));
    const hasFillGradient =
      rest.fill && isString(rest.fill) && isGradient(rest.fill);
    const hasFillPattern = rest.fill && isPattern(rest.fill);
    const hasClipMode = !!clipMode;
    
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
      hasMarker ||
      hasClipMode
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
      await exportFillImage(node, element, $g);
    }
    if (hasFillGradient || hasFillPattern) {
      exportFillGradientOrPattern(node, element, $g);
    }
    if (hasMarker && !isRough) {
      exportMarker(node, element, $g);
    }
    if (hasClipMode) {
      await exportClipOrMask(node, element, $g);
    }

    $g = $g || element;
    $g.id = `node-${id}`;

    applySvgDataAttributesToElement($g, {
      hitStrokeWidth,
      svgDataAttributes,
    });

    if (visibility === 'hidden') {
      // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/visibility
      $g.setAttribute('visibility', 'hidden');
    }
    if (cornerRadius) {
      $g.setAttribute('rx', `${cornerRadius}`);
      $g.setAttribute('ry', `${cornerRadius}`);
    }
    if (isRough) {
      exportRough(node, $g);
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
        x: x ?? 0,
        y: y ?? 0,
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

/** `myKey` → `data-my-key`; `data-foo` → `data-foo`. */
function svgDataAttributeName(key: string): string {
  if (key.startsWith('data-')) {
    return key;
  }
  return `data-${camelToKebabCase(key)}`;
}

/**
 * Writes interaction / app metadata on the exported SVG root for each node (`<g>` or leaf).
 */
export function applySvgDataAttributesToElement(
  el: SVGElement,
  options: {
    hitStrokeWidth?: number;
    svgDataAttributes?: Record<string, string>;
  },
): void {
  const { hitStrokeWidth, svgDataAttributes } = options;
  if (
    hitStrokeWidth != null &&
    Number.isFinite(hitStrokeWidth) &&
    hitStrokeWidth >= 0
  ) {
    el.setAttribute('data-hit-stroke-width', String(hitStrokeWidth));
  }
  if (svgDataAttributes && typeof svgDataAttributes === 'object') {
    for (const [k, v] of Object.entries(svgDataAttributes)) {
      if (v == null || String(v) === '') continue;
      el.setAttribute(svgDataAttributeName(k), String(v));
    }
  }
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
        `${toFixedAndRemoveTrailingZeros((width ?? 0) / 2 + offset)}`,
      );
      $stroke.setAttribute(
        'ry',
        `${toFixedAndRemoveTrailingZeros((height ?? 0) / 2 + offset)}`,
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
          (width ?? 0) + (innerStrokeAlignment ? -strokeWidth : strokeWidth),
        )}`,
      );
      $stroke.setAttribute(
        'height',
        `${toFixedAndRemoveTrailingZeros(
          (height ?? 0) + (innerStrokeAlignment ? -strokeWidth : strokeWidth),
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
    `${((dropShadowOffsetX || 0) / 2) * Math.sign(width ?? 0)}`,
  );
  $feDropShadow.setAttribute(
    'dy',
    `${((dropShadowOffsetY || 0) / 2) * Math.sign(height ?? 0)}`,
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
  const { width, height } = node;
  const x = 0;
  const y = 0;

  const gradientId = generateGradientKey({
    ...gradient,
    min: [x ?? 0, y ?? 0],
    width: width ?? 0,
    height: height ?? 0,
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
        innerHTML += `<stop offset="${offset.value / 100
          }" stop-color="${color}"></stop>`;
      });
    $existed.innerHTML = innerHTML;
    $existed.id = gradientId;
    $def.appendChild($existed);
  }

  if (gradient.type === 'linear-gradient') {
    const { angle } = gradient;
    const { x1, y1, x2, y2 } = computeLinearGradient(
      [x ?? 0, y ?? 0],
      width ?? 0,
      height ?? 0,
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
    } = computeRadialGradient([x ?? 0, y ?? 0], width ?? 0, height ?? 0, cx, cy, size);

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
  let patternWidth = width ?? 0;
  let patternHeight = height ?? 0;
  if (repetition === 'repeat-x') {
    patternHeight = nodeHeight ?? 0;
  } else if (repetition === 'repeat-y') {
    patternWidth = nodeWidth ?? 0;
  } else if (repetition === 'no-repeat') {
    patternWidth = nodeWidth ?? 0;
    patternHeight = nodeHeight ?? 0;
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

  const patternId = `marker-${marker}-${isEnd ? 'end' : 'start'
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

    if (marker === 'line' || marker === 'triangle' || marker === 'diamond') {
      const $path = createSVGElement('path');
      let d = '';

      if (marker === 'line') {
        const points = lineArrow(0, 0, arrowRadius, Math.PI);
        d = `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]}`;
        $path.setAttribute('fill', 'none');
      } else if (marker === 'triangle') {
        const points = lineArrow(0, 0, arrowRadius, Math.PI);
        d = `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]} Z`;
        $path.setAttribute('fill', stroke);
        if (!isNil(strokeOpacity)) {
          $path.setAttribute('fill-opacity', `${strokeOpacity}`);
        }
      } else {
        const tip = [0, 0] as const;
        const center = [-(arrowRadius * 0.5), 0] as const;
        const back = [-arrowRadius, 0] as const;
        const halfWidth = arrowRadius * 0.4;
        const left = [center[0], center[1] - halfWidth] as const;
        const right = [center[0], center[1] + halfWidth] as const;
        d = `M ${tip[0]} ${tip[1]} L ${left[0]} ${left[1]} L ${back[0]} ${back[1]} L ${right[0]} ${right[1]} Z`;
        $path.setAttribute('fill', stroke);
        if (!isNil(strokeOpacity)) {
          $path.setAttribute('fill-opacity', `${strokeOpacity}`);
        }
      }

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
      $path.setAttribute('d', d);
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

  if (markerStart !== 'none') {
    const markerId = createOrUpdateMarker(node, $defs, markerStart);
    $el?.setAttribute('marker-start', `url(#${markerId})`);
  }
  if (markerEnd !== 'none') {
    const markerId = createOrUpdateMarker(node, $defs, markerEnd, true);
    $el?.setAttribute('marker-end', `url(#${markerId})`);
  }
}

async function createOrUpdateClipPath(
  node: SerializedNode,
  $defs: SVGDefsElement,
  isMask = false,
) {
  const clipPathId = isMask ? `mask-${node.id}` : `clip-path-${node.id}`;
  const $existed = $defs.querySelector(`#${clipPathId}`);
  if (!$existed) {
    const $clipPath = createSVGElement(isMask ? 'mask' : 'clipPath') as SVGClipPathElement;
    $clipPath.setAttribute('id', clipPathId);

    const { clipMode, ... rest } = node;
    const [$parentNode] = await serializeNodesToSVGElements([rest]);

    /**
     * clipPath is a sibling of the node itself, so we need to remove the transform attribute.
     *
     * <defs>
     *   <clipPath id="clip-path-frame-1">
     *     <ellipse id="node-frame-1" fill="green" cx="100" cy="100" rx="100" ry="100"/>
     *   </clipPath>
     * </defs>
     * <ellipse id="node-frame-1" fill="green" cx="100" cy="100" rx="100" ry="100"/>
     */
    $parentNode.removeAttribute('id');
    $parentNode.removeAttribute('transform');

    if (isMask) {
      // erase：mask 中白色=显示、黑色=隐藏。需要「白底 + 擦除形状为黑」才能擦掉内容
      const $whiteRect = createSVGElement('rect');
      $whiteRect.setAttribute('x', '-10000');
      $whiteRect.setAttribute('y', '-10000');
      $whiteRect.setAttribute('width', '20000');
      $whiteRect.setAttribute('height', '20000');
      $whiteRect.setAttribute('fill', 'white');
      $clipPath.appendChild($whiteRect);
      $parentNode.setAttribute('fill', 'black');
      $parentNode.setAttribute('stroke', 'black');
    }

    $clipPath.appendChild($parentNode);
    $defs.appendChild($clipPath);
  }
  return clipPathId;
}

export async function exportClipOrMask(
  node: SerializedNode,
  $el: SVGElement,
  $g: SVGElement,
) {
  const { clipMode } = node;
  const $defs = createSVGElement('defs') as SVGDefsElement;
  $g.prepend($defs);

  if (clipMode === 'clip') {
    const clipPathId = await createOrUpdateClipPath(node, $defs);
    $g.setAttribute('clip-path', `url(#${clipPathId})`);
  } else if (clipMode === 'erase') {
    const maskId = await createOrUpdateClipPath(node, $defs, true);
    $g.setAttribute('mask', `url(#${maskId})`);
  }
}

export function exportRough(node: SerializedNode, $g: SVGElement) {
  const { stroke, fill, strokeWidth } = node as PathSerializedNode;
  const drawableSets = computeDrawableSets(node);

  drawableSets.forEach((drawableSet) => {
    const { type } = drawableSet;
    const commands = opSet2Absolute(drawableSet);
    const d = path2String(commands, 2);
    const $path = createSVGElement('path');
    $path.setAttribute('d', d);
    $g.appendChild($path);
    if (type === 'fillSketch') {
      $path.setAttribute('stroke', fill as string);
      $path.setAttribute('stroke-width', `${strokeWidth}`);
      $path.setAttribute('fill', 'none');
    } else if (type === 'path') {
      $path.setAttribute('stroke', stroke as string);
      $path.setAttribute('fill', 'none');
      $path.setAttribute('stroke-width', `${strokeWidth}`);
    } else if (type === 'fillPath') {
      $path.setAttribute('fill', fill as string);
      $path.setAttribute('stroke', 'none');
    }
  });
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
    letterSpacing,
  } = attributes;

  $g.setAttribute('dominant-baseline', 'hanging');

  const { lineHeight, lines } = measureText(attributes);
  if (lines.length > 1) {
    lines.forEach((line, i) => {
      const $tspan = createSVGElement('tspan');
      $tspan.textContent = line;
      $tspan.setAttribute('x', '0');

      if (i > 0) {
        $tspan.setAttribute('dy', `${toFixedAndRemoveTrailingZeros(lineHeight)}`);
      }
      $g.appendChild($tspan);
    });

    // const y = Number($g.getAttribute('y'));
    // $g.setAttribute('y', `${toFixedAndRemoveTrailingZeros(y - lines.length * lineHeight)}`);
  } else {
    $g.textContent = content;
  }

  // <text>
  if ($g === element) {
    $g.setAttribute('font-family', fontFamily);
    $g.setAttribute('font-size', `${fontSize}`);
    if (fontWeight) {
      $g.setAttribute('font-weight', `${fontWeight}`);
    }
    if (fontStyle) {
      $g.setAttribute('font-style', fontStyle);
    }
    if (fontVariant) {
      $g.setAttribute('font-variant', fontVariant);
    }
    if (letterSpacing) {
      $g.setAttribute(
        'letter-spacing',
        `${toFixedAndRemoveTrailingZeros(letterSpacing)}`,
      );
    }
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
    if (letterSpacing !== 0) {
      styleCSSText += `letter-spacing: ${toFixedAndRemoveTrailingZeros(letterSpacing)}px;`;
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

export async function exportFillImage(
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const $defs = createSVGElement('defs');
  const $pattern = createSVGElement('pattern');
  $pattern.id = `image-fill_${node.id}`;
  $pattern.setAttribute('patternUnits', 'objectBoundingBox');
  $pattern.setAttribute('patternContentUnits', 'objectBoundingBox');
  $pattern.setAttribute('width', '1');
  $pattern.setAttribute('height', '1');
  const $image = createSVGElement('image');

  let fill = (node as any).fill as string;
  if (isUrl(fill)) {
    // Convert url to dataURL
    fill = (await imageToCanvas(fill)).toDataURL();
  }

  $image.setAttribute('href', fill);
  $image.setAttribute('x', '0');
  $image.setAttribute('y', '0');
  $image.setAttribute('width', '1');
  $image.setAttribute('height', '1');
  // 按 node 宽高填充，不保持图片原始宽高比
  $image.setAttribute('preserveAspectRatio', 'none');
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

export function toFixedAndRemoveTrailingZeros(value: number) {
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
