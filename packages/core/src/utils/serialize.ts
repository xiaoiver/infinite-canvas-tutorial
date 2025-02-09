import { Transform } from '@pixi/math';
import { path2String } from '@antv/util';
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';
import {
  AABB,
  Circle,
  Ellipse,
  Group,
  Polyline,
  Path,
  Rect,
  Text,
  Shape,
  RoughRect,
  shiftPoints,
  RoughCircle,
  RoughEllipse,
  RoughPolyline,
  RoughPath,
} from '../shapes';
import { createSVGElement } from './browser';
import {
  camelToKebabCase,
  isDataUrl,
  isString,
  isUndefined,
  kebabToCamelCase,
} from './lang';
import { IRough } from '../shapes/mixins/Rough';
import { Drawable } from 'roughjs/bin/core';
import { opSet2Absolute } from './rough';
import { fontStringFromTextStyle } from './font';
import { randomInteger } from './math';

type SerializedTransform = {
  matrix: {
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
  };
  position: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
  skew: {
    x: number;
    y: number;
  };
  rotation: number;
  pivot: {
    x: number;
    y: number;
  };
};

const commonAttributes = ['renderable', 'visible', 'zIndex'] as const;
const renderableAttributes = [
  'cullable',
  'batchable',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeAlignment',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeDasharray',
  'strokeDashoffset',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'innerShadowColor',
  'innerShadowOffsetX',
  'innerShadowOffsetY',
  'innerShadowBlurRadius',
] as const;
const roughAttributes = [
  'drawableSets',
  'seed',
  'roughness',
  'bowing',
  'fillStyle',
  'fillWeight',
  'hachureAngle',
  'hachureGap',
  'curveStepCount',
  'simplification',
  'curveFitting',
  'fillLineDash',
  'fillLineDashOffset',
  'disableMultiStroke',
  'disableMultiStrokeFill',
  'dashOffset',
  'dashGap',
  'zigzagOffset',
  'preserveVertices',
] as const;

const circleAttributes = ['cx', 'cy', 'r'] as const;
const ellipseAttributes = ['cx', 'cy', 'rx', 'ry'] as const;
const rectAttributes = [
  'x',
  'y',
  'width',
  'height',
  'cornerRadius',
  'dropShadowColor',
  'dropShadowOffsetX',
  'dropShadowOffsetY',
  'dropShadowBlurRadius',
] as const;
const polylineAttributes = ['points'] as const;
const pathAttributes = ['d', 'fillRule'] as const;
const textAttributes = [
  'x',
  'y',
  'content',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'whiteSpace',
  'wordWrap',
  'wordWrapWidth',
] as const;

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

type CommonAttributeName = (
  | typeof commonAttributes
  | typeof renderableAttributes
)[number];
type CircleAttributeName = (typeof circleAttributes)[number];
type EllipseAttributeName = (typeof ellipseAttributes)[number];
type RectAttributeName = (typeof rectAttributes)[number];
type PolylineAttributeName = (typeof polylineAttributes)[number];
type PathAttributeName = (typeof pathAttributes)[number];
type TextAttributeName = (typeof textAttributes)[number];

export interface SerializedNode {
  uid: number;
  version?: number;
  versionNonce?: number;
  updated?: number;
  isDeleted?: boolean;
  type:
    | 'g'
    | 'circle'
    | 'ellipse'
    | 'rect'
    | 'polyline'
    | 'path'
    | 'text'
    | 'rough-circle'
    | 'rough-ellipse'
    | 'rough-rect'
    | 'rough-polyline'
    | 'rough-path';
  attributes?: Pick<Shape, CommonAttributeName> &
    Record<'transform', SerializedTransform> &
    Partial<Pick<Circle, CircleAttributeName>> &
    Partial<Pick<Ellipse, EllipseAttributeName>> &
    Partial<Pick<Rect, RectAttributeName>> &
    Partial<Pick<Polyline, PolylineAttributeName>> &
    Partial<Pick<Path, PathAttributeName>> &
    Partial<Pick<Text, TextAttributeName>> &
    Partial<IRough & { drawableSets: Drawable['sets'] }>;
  children?: SerializedNode[];
}

export function typeofShape(
  shape: Shape,
):
  | ['g', typeof commonAttributes]
  | ['circle', ...(typeof circleAttributes & typeof renderableAttributes)]
  | ['ellipse', ...(typeof ellipseAttributes & typeof renderableAttributes)]
  | ['rect', ...(typeof rectAttributes & typeof renderableAttributes)]
  | ['polyline', ...(typeof polylineAttributes & typeof renderableAttributes)]
  | ['rough-circle', ...(typeof circleAttributes & typeof renderableAttributes)]
  | [
      'rough-ellipse',
      ...(typeof ellipseAttributes & typeof renderableAttributes),
    ]
  | ['rough-rect', ...(typeof rectAttributes & typeof renderableAttributes)]
  | [
      'rough-polyline',
      ...(typeof polylineAttributes & typeof renderableAttributes),
    ]
  | ['rough-path', ...(typeof pathAttributes & typeof renderableAttributes)]
  | ['path', ...(typeof pathAttributes & typeof renderableAttributes)]
  | ['text', ...(typeof textAttributes & typeof renderableAttributes)] {
  if (shape instanceof Group) {
    return ['g', commonAttributes];
  } else if (shape instanceof Circle) {
    return ['circle', [...renderableAttributes, ...circleAttributes]];
  } else if (shape instanceof Ellipse) {
    return ['ellipse', [...renderableAttributes, ...ellipseAttributes]];
  } else if (shape instanceof Rect) {
    return ['rect', [...renderableAttributes, ...rectAttributes]];
  } else if (shape instanceof Polyline) {
    return ['polyline', [...renderableAttributes, ...polylineAttributes]];
  } else if (shape instanceof Path) {
    return ['path', [...renderableAttributes, ...pathAttributes]];
  } else if (shape instanceof Text) {
    return ['text', [...renderableAttributes, ...textAttributes]];
  } else if (shape instanceof RoughCircle) {
    return [
      'rough-circle',
      [...renderableAttributes, ...circleAttributes, ...roughAttributes],
    ];
  } else if (shape instanceof RoughEllipse) {
    return [
      'rough-ellipse',
      [...renderableAttributes, ...ellipseAttributes, ...roughAttributes],
    ];
  } else if (shape instanceof RoughRect) {
    return [
      'rough-rect',
      [...renderableAttributes, ...rectAttributes, ...roughAttributes],
    ];
  } else if (shape instanceof RoughPolyline) {
    return [
      'rough-polyline',
      [...renderableAttributes, ...polylineAttributes, ...roughAttributes],
    ];
  } else if (shape instanceof RoughPath) {
    return [
      'rough-path',
      [...renderableAttributes, ...pathAttributes, ...roughAttributes],
    ];
  }
}

export async function deserializeNode(data: SerializedNode) {
  // @ts-ignore
  const { type, attributes, children, text } = data;
  let shape: Shape;
  if (type === 'g') {
    shape = new Group();
  } else if (type === 'circle') {
    shape = new Circle();
  } else if (type === 'ellipse') {
    shape = new Ellipse();
  } else if (type === 'rect') {
    shape = new Rect();
  } else if (type === 'polyline') {
    shape = new Polyline();
    // @ts-ignore
  } else if (type === 'line') {
    shape = new Polyline();
    attributes.points = [
      // @ts-ignore
      [attributes.x1, attributes.y1],
      // @ts-ignore
      [attributes.x2, attributes.y2],
    ];
    // @ts-ignore
    delete attributes.x1;
    // @ts-ignore
    delete attributes.y1;
    // @ts-ignore
    delete attributes.x2;
    // @ts-ignore
    delete attributes.y2;
    // @ts-ignore
  } else if (type === 'polygon') {
    shape = new Path();
    // attributes.points: "0,150 100,150 100,50"
    // convert to d attribute
    // @ts-ignore
    attributes.d = (attributes.points as string)
      .split(' ')
      .map((xy, i, points) => {
        const [x, y] = xy.split(',').map(Number);
        const command = i === 0 ? 'M' : 'L';
        if (i === points.length - 1) {
          return `${command} ${x},${y} Z`;
        }
        return `${command} ${x},${y}`;
      })
      .join(' ');
    delete attributes.points;
  } else if (type === 'path') {
    shape = new Path();
  } else if (type === 'text') {
    shape = new Text();
    // @ts-ignore
    attributes.content = text;
  } else if (type === 'rough-circle') {
    shape = new RoughCircle();
    // TODO: implement with path
  } else if (type === 'rough-ellipse') {
    shape = new RoughEllipse();
  } else if (type === 'rough-rect') {
    shape = new RoughRect();
  } else if (type === 'rough-polyline') {
    shape = new RoughPolyline();
  } else if (type === 'rough-path') {
    shape = new RoughPath();
  }

  let { transform } = attributes;
  const { transform: _, ...rest } = attributes;
  Object.assign(shape, rest);

  // create Image from DataURL
  const { fill, points, strokeDasharray } = rest;
  if (fill && isString(fill) && isDataUrl(fill)) {
    shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
  }
  if (points && isString(points)) {
    // @ts-ignore
    (shape as Polyline).points = points
      .split(' ')
      .map((xy) => xy.split(',').map(Number));
  }
  if (strokeDasharray && isString(strokeDasharray)) {
    shape.strokeDasharray = strokeDasharray.split(' ').map(Number);
  }

  if (transform) {
    if (isString(transform)) {
      transform = parseTransform(transform);
    }

    const { position, scale, skew, rotation, pivot } = transform;
    shape.transform.position.set(position.x, position.y);
    shape.transform.scale.set(scale.x, scale.y);
    shape.transform.skew.set(skew.x, skew.y);
    shape.transform.rotation = rotation;
    shape.transform.pivot.set(pivot.x, pivot.y);
  }

  if (children && children.length > 0) {
    await Promise.all(
      children.map(async (child) => {
        shape.appendChild(await deserializeNode(child));
      }),
    );
  }
  return shape;
}

export function serializeNode(node: Shape): SerializedNode {
  const [type, attributes] = typeofShape(node);
  const serialized: SerializedNode = {
    uid: node.uid,
    type,
    attributes: [...commonAttributes, ...attributes].reduce((prev, cur) => {
      if (!isUndefined(node[cur])) {
        prev[cur] = node[cur];
      }
      return prev;
    }, {}),
  };

  const { fill, points, strokeDasharray } = serialized.attributes;
  if (fill && !isString(fill)) {
    serialized.attributes.fill = imageBitmapToURL(fill as ImageBitmap);
  }

  if (points) {
    // @ts-ignore
    serialized.attributes.points = points
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  }
  if (strokeDasharray) {
    // @ts-ignore
    serialized.attributes.strokeDasharray = strokeDasharray.join(' ');
  }

  serialized.attributes.transform = serializeTransform(node.transform);
  serialized.children = node.children.map(serializeNode);

  return serialized;
}

export function serializeTransform(transform: Transform): SerializedTransform {
  const { a, b, c, d, tx, ty } = transform.localTransform;

  return {
    matrix: { a, b, c, d, tx, ty },
    position: {
      x: transform.position.x,
      y: transform.position.y,
    },
    scale: {
      x: transform.scale.x,
      y: transform.scale.y,
    },
    skew: {
      x: transform.skew.x,
      y: transform.skew.y,
    },
    rotation: transform.rotation,
    pivot: {
      x: transform.pivot.x,
      y: transform.pivot.y,
    },
  };
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
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const { type, attributes } = node;
  const { strokeWidth, strokeAlignment } = attributes;
  const innerStrokeAlignment = strokeAlignment === 'inner';
  const halfStrokeWidth = strokeWidth / 2;

  if (type === 'polyline') {
    const { points: pointsStr } = attributes;

    const points = pointsStr
      // @ts-ignore
      .split(' ')
      .map((xy) => xy.split(',').map(Number)) as [number, number][];

    const shiftedPoints = shiftPoints(
      points,
      innerStrokeAlignment,
      strokeWidth,
    );

    element.setAttribute(
      'points',
      shiftedPoints.map((point) => point.join(',')).join(' '),
    );
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
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const {
    uid,
    attributes: {
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      innerShadowColor,
    },
  } = node;

  const $defs = createSVGElement('defs');
  const $filter = createSVGElement('filter');
  $filter.id = `filter_inner_shadow_${uid}`;

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
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const {
    uid,
    attributes: {
      width,
      height,
      dropShadowBlurRadius,
      dropShadowColor,
      dropShadowOffsetX,
      dropShadowOffsetY,
    },
  } = node;

  const $defs = createSVGElement('defs');
  const $filter = createSVGElement('filter');
  $filter.id = `filter_drop_shadow_${uid}`;

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

export function exportFillImage(
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
) {
  const $defs = createSVGElement('defs');
  const $pattern = createSVGElement('pattern');
  $pattern.id = `image-fill_${node.uid}`;
  $pattern.setAttribute('patternUnits', 'objectBoundingBox');
  $pattern.setAttribute('width', '1');
  $pattern.setAttribute('height', '1');
  const $image = createSVGElement('image');
  $image.setAttribute('href', node.attributes.fill as string);
  $image.setAttribute('x', '0');
  $image.setAttribute('y', '0');
  // use geometry bounds of shape.
  let bounds: AABB;
  if (node.type === 'circle') {
    bounds = Circle.getGeometryBounds(node.attributes);
  } else if (node.type === 'ellipse') {
    bounds = Ellipse.getGeometryBounds(node.attributes);
  } else if (node.type === 'rect') {
    bounds = Rect.getGeometryBounds(node.attributes);
  }
  $image.setAttribute('width', `${bounds.maxX - bounds.minX}`);
  $image.setAttribute('height', `${bounds.maxY - bounds.minY}`);
  $pattern.appendChild($image);
  $defs.appendChild($pattern);
  $g.appendChild($defs);

  element.setAttribute('fill', `url(#${$pattern.id})`);
}

/**
 * use <text> and <tspan> to render text.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text#example
 */
export function exportText(node: SerializedNode, $g: SVGElement) {
  const {
    content,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    fontVariant,
    fill,
  } = node.attributes;
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

export function exportRough(node: SerializedNode, $g: SVGElement) {
  const {
    attributes: { drawableSets, stroke, fill },
  } = node;

  drawableSets.forEach((drawableSet) => {
    const { type } = drawableSet;
    const commands = opSet2Absolute(drawableSet);
    const d = path2String(commands, 2);
    const $path = createSVGElement('path');
    $path.setAttribute('d', d);
    $g.appendChild($path);
    if (type === 'fillSketch') {
      $path.setAttribute('stroke', fill as string);
      $path.setAttribute('fill', 'none');
    } else if (type === 'path') {
      $path.setAttribute('stroke', stroke as string);
      $path.setAttribute('fill', 'none');
    } else if (type === 'fillPath') {
      $path.setAttribute('fill', fill as string);
      $path.setAttribute('stroke', 'none');
    }
  });
}

export function toSVGElement(node: SerializedNode) {
  const { type, attributes, children } = node;

  const isRough = type.startsWith('rough-');

  const element = !isRough && createSVGElement(type);
  const {
    transform,
    visible,
    cullable,
    renderable,
    batchable,
    innerShadowColor,
    innerShadowOffsetX,
    innerShadowOffsetY,
    innerShadowBlurRadius,
    dropShadowColor,
    dropShadowOffsetX,
    dropShadowOffsetY,
    dropShadowBlurRadius,
    strokeAlignment,
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
    ...rest
  } = attributes;

  if (element) {
    Object.entries(rest).forEach(([key, value]) => {
      if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
      }
    });
  }

  // Handle negative size of rect.
  if (type === 'rect') {
    const { width, height, x, y } = attributes;
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

  const innerStrokeAlignment = strokeAlignment === 'inner';
  const outerStrokeAlignment = strokeAlignment === 'outer';
  const innerOrOuterStrokeAlignment =
    innerStrokeAlignment || outerStrokeAlignment;
  const hasFillImage = rest.fill && isString(rest.fill) && isDataUrl(rest.fill);

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
    (children && children.length > 0 && type !== 'g') ||
    (innerOrOuterStrokeAlignment && type !== 'polyline') ||
    isRough ||
    hasFillImage
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

  $g = $g || element;

  if (visible === false) {
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
    exportText(node, $g);
  }

  const { a, b, c, d, tx, ty } = transform.matrix;
  if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || tx !== 0 || ty !== 0) {
    $g.setAttribute('transform', `matrix(${a},${b},${c},${d},${tx},${ty})`);
  }

  [...children]
    .sort(sortByZIndex)
    .map((child) => toSVGElement(child))
    .forEach((child) => {
      $g.appendChild(child);
    });

  return $g;
}

/**
 * Note that this conversion is not fully reversible.
 * For example, in the StrokeAlignment implementation, one Circle corresponds to two <circle>s.
 * The same is true in Figma.
 *
 * @see https://github.com/ShukantPal/pixi-essentials/blob/master/packages/svg
 */
export function fromSVGElement(
  element: SVGElement,
  uid = 0,
  defsChildren: SVGElement[] = [],
): SerializedNode {
  let type = element.tagName.toLowerCase();

  if (type === 'svg') {
    type = 'g';
  } else if (type === 'defs') {
    defsChildren.push(...(Array.from(element.childNodes) as SVGElement[]));
    return;
  } else if (type === 'use') {
    const href = element.getAttribute('xlink:href');
    if (href) {
      const def = defsChildren.find((d) => d.id === href.replace('#', ''));
      if (def) {
        return fromSVGElement(def, uid, defsChildren);
      }
    }
    return;
  } else if (type === 'tspan') {
    return;
  }

  const attributes = Array.from(element.attributes).reduce((prev, attr) => {
    let attributeName = kebabToCamelCase(attr.name);

    let value: string | number | SerializedTransform = attr.value;
    if (attributeName === 'transform') {
      value = parseTransform(value);
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
  }, {} as SerializedNode['attributes']);

  if (type === 'text') {
    attributes.content = element.textContent;
  } else if (type === 'line') {
    type = 'polyline';
    // @ts-ignore
    attributes.points = `${attributes.x1},${attributes.y1} ${attributes.x2},${attributes.y2}`;
    // @ts-ignore
    delete attributes.x1;
    // @ts-ignore
    delete attributes.y1;
    // @ts-ignore
    delete attributes.x2;
    // @ts-ignore
    delete attributes.y2;
  }

  const children = Array.from(element.children)
    .map((e: SVGElement) => fromSVGElement(e, uid++, defsChildren))
    .filter(Boolean);

  return {
    uid,
    type: type as SerializedNode['type'],
    attributes,
    children,
  };
}

/**
 * We can't use bitmaprenderer since the ImageBitmap has been rendered in Texture.
 *
 * Error message: `The input ImageBitmap has been detached`
 * @see https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
 */
export function imageBitmapToURL(bmp: ImageBitmap) {
  const canvas = document.createElement('canvas');
  // resize it to the size of our ImageBitmap
  canvas.width = bmp.width;
  canvas.height = bmp.height;

  // We get the 2d drawing context and draw the image in the top left
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  // get a bitmaprenderer context
  // const ctx = canvas.getContext('bitmaprenderer');
  // ctx.transferFromImageBitmap(bmp);
  // const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
  return canvas.toDataURL();
}

export function parseTransform(transformStr: string): SerializedTransform {
  const transform: SerializedTransform = {
    matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    rotation: 0,
    pivot: { x: 0, y: 0 },
  };

  const translateRegex = /translate\(([^,]+),([^,]+)\)/;
  const translateXRegex = /translateX\(([^,\)]+)\)/;
  const translateYRegex = /translateY\(([^,\)]+)\)/;
  const rotateRegex = /rotate\(([^,]+)\)/;
  const scaleRegex = /scale\(([^,\)]+)(?:,([^,\)]+))?\)/;
  const scaleXRegex = /scaleX\(([^,\)]+)\)/;
  const scaleYRegex = /scaleY\(([^,\)]+)\)/;
  const skewRegex = /skew\(([^,]+),([^,]+)\)/;
  const skewXRegex = /skewX\(([^,\)]+)\)/;
  const skewYRegex = /skewY\(([^,\)]+)\)/;
  const matrixRegex =
    /matrix\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+)\)/;

  // 解析 translate(x,y)
  const translateMatch = transformStr.match(translateRegex);
  if (translateMatch) {
    transform.position.x = parseFloat(translateMatch[1]);
    transform.position.y = parseFloat(translateMatch[2]);
  }

  // 解析 translateX(x)
  const translateXMatch = transformStr.match(translateXRegex);
  if (translateXMatch) {
    transform.position.x = parseFloat(translateXMatch[1]);
  }

  // 解析 translateY(y)
  const translateYMatch = transformStr.match(translateYRegex);
  if (translateYMatch) {
    transform.position.y = parseFloat(translateYMatch[1]);
  }

  const rotateMatch = transformStr.match(rotateRegex);
  if (rotateMatch) {
    transform.rotation = parseFloat(rotateMatch[1]);
  }

  const scaleMatch = transformStr.match(scaleRegex);
  if (scaleMatch) {
    const x = parseFloat(scaleMatch[1]);
    transform.scale.x = x;
    transform.scale.y = scaleMatch[2] ? parseFloat(scaleMatch[2]) : x;
  }

  const scaleXMatch = transformStr.match(scaleXRegex);
  if (scaleXMatch) {
    transform.scale.x = parseFloat(scaleXMatch[1]);
  }

  const scaleYMatch = transformStr.match(scaleYRegex);
  if (scaleYMatch) {
    transform.scale.y = parseFloat(scaleYMatch[1]);
  }

  const skewMatch = transformStr.match(skewRegex);
  if (skewMatch) {
    transform.skew.x = parseFloat(skewMatch[1]);
    transform.skew.y = parseFloat(skewMatch[2]);
  }

  const skewXMatch = transformStr.match(skewXRegex);
  if (skewXMatch) {
    transform.skew.x = parseFloat(skewXMatch[1]);
  }

  const skewYMatch = transformStr.match(skewYRegex);
  if (skewYMatch) {
    transform.skew.y = parseFloat(skewYMatch[1]);
  }

  const matrixMatch = transformStr.match(matrixRegex);
  if (matrixMatch) {
    transform.matrix.a = parseFloat(matrixMatch[1]);
    transform.matrix.b = parseFloat(matrixMatch[2]);
    transform.matrix.c = parseFloat(matrixMatch[3]);
    transform.matrix.d = parseFloat(matrixMatch[4]);
    transform.matrix.tx = parseFloat(matrixMatch[5]);
    transform.matrix.ty = parseFloat(matrixMatch[6]);
  }

  return transform;
}

function sortByZIndex(a: SerializedNode, b: SerializedNode) {
  const zIndex1 = a.attributes.zIndex ?? 0;
  const zIndex2 = b.attributes.zIndex ?? 0;
  return zIndex1 - zIndex2;
}

export function deepClone(node: SerializedNode) {
  return JSON.parse(JSON.stringify(node));
}

export const newElementWith = <TElement extends SerializedNode>(
  element: TElement,
  updates: Partial<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== 'undefined') {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== 'object' || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    updated: Date.now(),
    version: element.version + 1,
    versionNonce: randomInteger(),
  };
};
