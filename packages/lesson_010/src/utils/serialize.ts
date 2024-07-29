import { Transform } from '@pixi/math';
import { Circle, Ellipse, Group, Rect, Shape } from '../shapes';
import { createSVGElement } from './browser';
import { camelToKebabCase, isDataUrl, isString } from './lang';

type SerializedTransform = {
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

const commonAttributes = ['renderable'] as const;
const renderableAttributes = [
  'visible',
  'cullable',
  'batchable',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeAlignment',
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

type CommonAttributeName = (
  | typeof commonAttributes
  | typeof renderableAttributes
)[number];
type CircleAttributeName = (typeof circleAttributes)[number];
type EllipseAttributeName = (typeof ellipseAttributes)[number];
type RectAttributeName = (typeof rectAttributes)[number];

interface SerializedNode {
  uid: number;
  type: 'g' | 'circle' | 'ellipse' | 'rect';
  attributes?: Pick<Shape, CommonAttributeName> &
    Record<'transform', SerializedTransform> &
    Partial<Pick<Circle, CircleAttributeName>> &
    Partial<Pick<Ellipse, EllipseAttributeName>> &
    Partial<Pick<Rect, RectAttributeName>>;
  children?: SerializedNode[];
}

export function typeofShape(
  shape: Shape,
):
  | ['g', typeof commonAttributes]
  | ['circle', ...(typeof circleAttributes & typeof renderableAttributes)]
  | ['ellipse', ...(typeof ellipseAttributes & typeof renderableAttributes)]
  | ['rect', ...(typeof rectAttributes & typeof renderableAttributes)] {
  if (shape instanceof Group) {
    return ['g', commonAttributes];
  } else if (shape instanceof Circle) {
    return ['circle', [...renderableAttributes, ...circleAttributes]];
  } else if (shape instanceof Ellipse) {
    return ['ellipse', [...renderableAttributes, ...ellipseAttributes]];
  } else if (shape instanceof Rect) {
    return ['rect', [...renderableAttributes, ...rectAttributes]];
  }
}

export function deserializeNode(data: SerializedNode): Shape {
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
  }

  const { transform, ...rest } = attributes;
  Object.assign(shape, rest);

  // TODO: create from DataURL

  shape.transform.position.set(transform.position.x, transform.position.y);
  shape.transform.scale.set(transform.scale.x, transform.scale.y);
  shape.transform.skew.set(transform.skew.x, transform.skew.y);
  shape.transform.rotation = transform.rotation;
  shape.transform.pivot.set(transform.pivot.x, transform.pivot.y);

  if (children && children.length > 0) {
    children.map(deserializeNode).forEach((child) => {
      shape.appendChild(child);
    });
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

  const { fill } = serialized.attributes;
  if (fill && !isString(fill)) {
    serialized.attributes.fill = imageBitmapToURL(fill as ImageBitmap);
  }

  serialized.attributes.transform = serializeTransform(node.transform);
  serialized.children = node.children.map(serializeNode);

  return serialized;
}

export function serializeTransform(transform: Transform): SerializedTransform {
  return {
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
  const $stroke = element.cloneNode() as SVGElement;
  element.setAttribute('stroke', 'none');
  $stroke.setAttribute('fill', 'none');

  const { strokeWidth, strokeAlignment } = attributes;
  const innerStrokeAlignment = strokeAlignment === 'inner';
  const halfStrokeWidth = strokeWidth / 2;

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

  const $defs = createSVGElement('defs');
  const $filter = createSVGElement('filter');
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

  const $feFlood = createSVGElement('feFlood');
  $feFlood.setAttribute('flood-opacity', '0');
  $feFlood.setAttribute('result', 'BackgroundImageFix');
  $filter.appendChild($feFlood);

  const $feBlend = createSVGElement('feBlend');
  $feBlend.setAttribute('mode', 'normal');
  $feBlend.setAttribute('in', 'SourceGraphic');
  $feBlend.setAttribute('in2', 'BackgroundImageFix');
  $feBlend.setAttribute('result', 'shape');
  $filter.appendChild($feBlend);

  // <feColorMatrix xmlns="http://www.w3.org/2000/svg" in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
  const $feColorMatrix = createSVGElement('feColorMatrix');
  $feColorMatrix.setAttribute('in', 'SourceAlpha');
  $feColorMatrix.setAttribute('type', 'matrix');
  $feColorMatrix.setAttribute('values', '');
  $feColorMatrix.setAttribute('result', 'hardAlpha');
  $filter.appendChild($feColorMatrix);

  // <feMorphology xmlns="http://www.w3.org/2000/svg" radius="8" operator="dilate" in="SourceAlpha" result="effect1_innerShadow_2429_2"/>
  const $feMorphology = createSVGElement('feMorphology');
  $feMorphology.setAttribute('radius', '8');
  $feMorphology.setAttribute('operator', 'dilate');
  $feMorphology.setAttribute('in', 'SourceAlpha');
  $feMorphology.setAttribute('result', 'effect1_innerShadow_2429_2');
  $filter.appendChild($feMorphology);

  const $feOffset = createSVGElement('feOffset');
  $feOffset.setAttribute('dx', `${innerShadowOffsetX}`);
  $feOffset.setAttribute('dy', `${innerShadowOffsetY}`);
  $filter.appendChild($feOffset);

  const $feGaussianBlur = createSVGElement('feGaussianBlur');
  $feGaussianBlur.setAttribute('stdDeviation', `${innerShadowBlurRadius / 2}`);
  $filter.appendChild($feGaussianBlur);

  // <feComposite xmlns="http://www.w3.org/2000/svg" in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
  const $feComposite = createSVGElement('feComposite');
  $feComposite.setAttribute('in2', 'hardAlpha');
  $feComposite.setAttribute('operator', 'arithmetic');
  $feComposite.setAttribute('k2', '-1');
  $feComposite.setAttribute('k3', '1');
  $filter.appendChild($feComposite);

  // <feColorMatrix xmlns="http://www.w3.org/2000/svg" type="matrix" values="0 0 0 0 0.0470588 0 0 0 0 0.0470588 0 0 0 0 0.0509804 0 0 0 1 0"/>
  const $feColorMatrix2 = createSVGElement('feColorMatrix');
  $feColorMatrix2.setAttribute('type', 'matrix');
  $feColorMatrix2.setAttribute('values', '');
  $filter.appendChild($feColorMatrix2);

  // <feBlend xmlns="http://www.w3.org/2000/svg" mode="normal" in2="shape" result="effect1_innerShadow_2429_2"/>
  const $feBlend2 = createSVGElement('feBlend');
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
  // TODO: use geometry bounds of shape.
  $image.setAttribute('height', '200');
  $image.setAttribute('width', '200');
  $pattern.appendChild($image);
  $defs.appendChild($pattern);
  $g.appendChild($defs);

  element.setAttribute('fill', `url(#${$pattern.id})`);
}

export function toSVGElement(node: SerializedNode) {
  const { type, attributes, children } = node;
  const element = createSVGElement(type);
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
    element.setAttribute(camelToKebabCase(key), `${value}`);
  });

  // TODO: outerShadow in Rect

  const innerStrokeAlignment = strokeAlignment === 'inner';
  const outerStrokeAlignment = strokeAlignment === 'outer';
  const innerOrOuterStrokeAlignment =
    innerStrokeAlignment || outerStrokeAlignment;
  const hasFillImage = rest.fill && isDataUrl(rest.fill as string);

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
    innerOrOuterStrokeAlignment ||
    innerShadowBlurRadius > 0 ||
    hasFillImage
  ) {
    $g = createSVGElement('g');
    $g.appendChild(element);
  }

  if (innerOrOuterStrokeAlignment) {
    exportInnerOrOuterStrokeAlignment(node, element, $g);
  }
  if (innerShadowBlurRadius > 0) {
    exportInnerShadow(node, element, $g);
  }
  // avoid `fill="[object ImageBitmap]"`
  if (hasFillImage) {
    exportFillImage(node, element, $g);
  }

  $g = $g || element;

  // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/visibility
  $g.setAttribute('visibility', visible ? 'visible' : 'hidden');

  $g.setAttribute(
    'transform',
    `matrix(${transform.scale.x},${transform.skew.x},${transform.skew.y},${transform.scale.y},${transform.position.x},${transform.position.y})`,
  );
  $g.setAttribute(
    'transform-origin',
    `${transform.pivot.x} ${transform.pivot.y}`,
  );

  children.map(toSVGElement).forEach((child) => {
    $g.appendChild(child);
  });

  return $g;
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
