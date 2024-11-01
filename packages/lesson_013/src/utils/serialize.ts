import { Transform } from '@pixi/math';
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
  Shape,
  shiftPoints,
} from '../shapes';
import { createSVGElement } from './browser';
import {
  camelToKebabCase,
  isDataUrl,
  isString,
  kebabToCamelCase,
} from './lang';

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

const commonAttributes = ['renderable', 'visible'] as const;
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
const pathAttributes = ['d'] as const;

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

interface SerializedNode {
  uid: number;
  type: 'g' | 'circle' | 'ellipse' | 'rect' | 'polyline' | 'path';
  attributes?: Pick<Shape, CommonAttributeName> &
    Record<'transform', SerializedTransform> &
    Partial<Pick<Circle, CircleAttributeName>> &
    Partial<Pick<Ellipse, EllipseAttributeName>> &
    Partial<Pick<Rect, RectAttributeName>> &
    Partial<Pick<Polyline, PolylineAttributeName>> &
    Partial<Pick<Path, PathAttributeName>>;
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
  | ['path', ...(typeof pathAttributes & typeof renderableAttributes)] {
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
  }
}

export async function deserializeNode(data: SerializedNode) {
  const { type, attributes, children } = data;
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
  } else if (type === 'path') {
    shape = new Path();
  }

  const { transform, ...rest } = attributes;
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

  const { position, scale, skew, rotation, pivot } = transform;
  shape.transform.position.set(position.x, position.y);
  shape.transform.scale.set(scale.x, scale.y);
  shape.transform.skew.set(skew.x, skew.y);
  shape.transform.rotation = rotation;
  shape.transform.pivot.set(pivot.x, pivot.y);

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
      prev[cur] = node[cur];
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
  doc: Document,
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
  doc: Document,
) {
  const {
    uid,
    type,
    attributes: {
      innerShadowOffsetX,
      innerShadowOffsetY,
      innerShadowBlurRadius,
      // innerShadowColor,
      r,
      rx,
      ry,
      width,
      height,
    },
  } = node;

  const $defs = createSVGElement('defs', doc);
  const $filter = createSVGElement('filter', doc);
  $filter.id = `filter_${uid}`;

  let filterW = 0;
  let filterH = 0;
  if (type === 'circle') {
    filterW = r * 2 + innerShadowOffsetX;
    filterH = r * 2 + innerShadowOffsetY;
  } else if (type === 'ellipse') {
    filterW = rx * 2 + innerShadowOffsetX;
    filterH = ry * 2 + innerShadowOffsetY;
  } else if (type === 'rect') {
    filterW = width + innerShadowOffsetX;
    filterH = height + innerShadowOffsetY;
  }
  $filter.setAttribute('x', '0');
  $filter.setAttribute('y', '0');
  $filter.setAttribute('width', `${filterW}`);
  $filter.setAttribute('height', `${filterH}`);
  $filter.setAttribute('filterUnits', 'userSpaceOnUse');
  $filter.setAttribute('color-interpolation-filters', 'sRGB');

  const $feFlood = createSVGElement('feFlood', doc);
  $feFlood.setAttribute('flood-opacity', '0');
  $feFlood.setAttribute('result', 'BackgroundImageFix');
  $filter.appendChild($feFlood);

  const $feBlend = createSVGElement('feBlend', doc);
  $feBlend.setAttribute('mode', 'normal');
  $feBlend.setAttribute('in', 'SourceGraphic');
  $feBlend.setAttribute('in2', 'BackgroundImageFix');
  $feBlend.setAttribute('result', 'shape');
  $filter.appendChild($feBlend);

  // <feColorMatrix xmlns="http://www.w3.org/2000/svg" in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
  const $feColorMatrix = createSVGElement('feColorMatrix', doc);
  $feColorMatrix.setAttribute('in', 'SourceAlpha');
  $feColorMatrix.setAttribute('type', 'matrix');
  $feColorMatrix.setAttribute('values', '');
  $feColorMatrix.setAttribute('result', 'hardAlpha');
  $filter.appendChild($feColorMatrix);

  // <feMorphology xmlns="http://www.w3.org/2000/svg" radius="8" operator="dilate" in="SourceAlpha" result="effect1_innerShadow_2429_2"/>
  const $feMorphology = createSVGElement('feMorphology', doc);
  $feMorphology.setAttribute('radius', '8');
  $feMorphology.setAttribute('operator', 'dilate');
  $feMorphology.setAttribute('in', 'SourceAlpha');
  $feMorphology.setAttribute('result', 'effect1_innerShadow_2429_2');
  $filter.appendChild($feMorphology);

  const $feOffset = createSVGElement('feOffset', doc);
  $feOffset.setAttribute('dx', `${innerShadowOffsetX}`);
  $feOffset.setAttribute('dy', `${innerShadowOffsetY}`);
  $filter.appendChild($feOffset);

  const $feGaussianBlur = createSVGElement('feGaussianBlur', doc);
  $feGaussianBlur.setAttribute('stdDeviation', `${innerShadowBlurRadius / 2}`);
  $filter.appendChild($feGaussianBlur);

  // <feComposite xmlns="http://www.w3.org/2000/svg" in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
  const $feComposite = createSVGElement('feComposite', doc);
  $feComposite.setAttribute('in2', 'hardAlpha');
  $feComposite.setAttribute('operator', 'arithmetic');
  $feComposite.setAttribute('k2', '-1');
  $feComposite.setAttribute('k3', '1');
  $filter.appendChild($feComposite);

  // <feColorMatrix xmlns="http://www.w3.org/2000/svg" type="matrix" values="0 0 0 0 0.0470588 0 0 0 0 0.0470588 0 0 0 0 0.0509804 0 0 0 1 0"/>
  const $feColorMatrix2 = createSVGElement('feColorMatrix', doc);
  $feColorMatrix2.setAttribute('type', 'matrix');
  $feColorMatrix2.setAttribute('values', '');
  $filter.appendChild($feColorMatrix2);

  // <feBlend xmlns="http://www.w3.org/2000/svg" mode="normal" in2="shape" result="effect1_innerShadow_2429_2"/>
  const $feBlend2 = createSVGElement('feBlend', doc);
  $feBlend2.setAttribute('mode', 'normal');
  $feBlend2.setAttribute('in2', 'shape');
  $feBlend2.setAttribute('result', 'effect1_innerShadow_2429_2');
  $filter.appendChild($feBlend2);

  $defs.appendChild($filter);

  $g.appendChild($defs);
  $g.setAttribute('filter', `url(#${$filter.id})`);
}

export function exportFillImage(
  node: SerializedNode,
  element: SVGElement,
  $g: SVGElement,
  doc: Document,
) {
  const $defs = createSVGElement('defs', doc);
  const $pattern = createSVGElement('pattern', doc);
  $pattern.id = `image-fill_${node.uid}`;
  $pattern.setAttribute('patternUnits', 'objectBoundingBox');
  $pattern.setAttribute('width', '1');
  $pattern.setAttribute('height', '1');
  const $image = createSVGElement('image', doc);
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

export function toSVGElement(node: SerializedNode, doc?: Document) {
  const { type, attributes, children } = node;
  const element = createSVGElement(type, doc);
  const {
    transform,
    visible,
    cullable,
    renderable,
    batchable,
    innerShadowBlurRadius,
    innerShadowColor,
    innerShadowOffsetX,
    innerShadowOffsetY,
    strokeAlignment,
    ...rest
  } = attributes;
  Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
      element.setAttribute(camelToKebabCase(key), `${value}`);
    }
  });

  // TODO: outerShadow in Rect

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
    innerShadowBlurRadius > 0 ||
    hasFillImage
  ) {
    $g = createSVGElement('g', doc);
    $g.appendChild(element);
  }

  if (innerOrOuterStrokeAlignment) {
    exportInnerOrOuterStrokeAlignment(node, element, $g, doc);
  }
  if (innerShadowBlurRadius > 0) {
    exportInnerShadow(node, element, $g, doc);
  }
  // avoid `fill="[object ImageBitmap]"`
  if (hasFillImage) {
    exportFillImage(node, element, $g, doc);
  }

  $g = $g || element;

  if (visible === false) {
    // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/visibility
    $g.setAttribute('visibility', 'hidden');
  }

  const { a, b, c, d, tx, ty } = transform.matrix;
  if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || tx !== 0 || ty !== 0) {
    $g.setAttribute('transform', `matrix(${a},${b},${c},${d},${tx},${ty})`);
  }

  children
    .map((child) => toSVGElement(child, doc))
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
export function fromSVGElement(element: SVGElement, uid = 0): SerializedNode {
  const type = element.tagName.toLowerCase() as SerializedNode['type'];
  const attributes = Array.from(element.attributes).reduce((prev, attr) => {
    const attributeName = kebabToCamelCase(attr.name);

    // TODO: convert value to Number

    if (attributeName === 'transform') {
    }

    prev[attributeName] = attr.value;
    return prev;
  }, {} as SerializedNode['attributes']);

  const children = Array.from(element.children).map((e: SVGElement) =>
    fromSVGElement(e, uid++),
  );

  return {
    uid,
    type,
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
