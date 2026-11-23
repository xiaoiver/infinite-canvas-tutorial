import { Rect, type Shape } from '../shapes';
import { isImmutableImage } from './image-texture-pool';

export function eligibleImageRect(shape: Shape) {
  if (
    Object.getPrototypeOf(shape) !== Rect.prototype ||
    !shape.batchable ||
    !isImmutableImage(shape.fill) ||
    shape.wireframe ||
    shape.sizeAttenuation ||
    shape.strokeAttenuation ||
    (shape.stroke !== 'none' && shape.strokeWidth > 0) ||
    shape.innerShadowBlurRadius > 0 ||
    shape.dropShadowBlurRadius > 0 ||
    shape.strokeDasharray.some((n) => n !== 0)
  )
    return false;
  const r = shape as Rect,
    m = shape.worldTransform;
  return (
    r.cornerRadius === 0 &&
    r.width > 0 &&
    r.height > 0 &&
    [
      r.x,
      r.y,
      r.width,
      r.height,
      m.a,
      m.b,
      m.c,
      m.d,
      m.tx,
      m.ty,
      shape.opacity,
      shape.fillOpacity,
      shape.strokeWidth,
      shape.strokeRGB.r,
      shape.strokeRGB.g,
      shape.strokeRGB.b,
      shape.strokeRGB.opacity,
      shape.strokeOpacity,
    ].every(Number.isFinite) &&
    Math.abs(m.a * m.d - m.b * m.c) > 1e-12
  );
}
export function coreImageToken(shape: Shape) {
  const source = shape.fill as ImageBitmap;
  return imageBatchToken(source, JSON.stringify([source.width, source.height]));
}

export const IMAGE_BATCH_SIZE = 256;
export const IMAGE_BATCH_TEXTURES = 8;
export const IMAGE_BATCH_STRIDE = 20;

const identities = new WeakMap<object, number>();
let nextIdentity = 1;
/** Raster variants of the same decoded source must occupy different slots. */
export function imageBatchToken(source: object, variant: string) {
  if (!identities.has(source)) identities.set(source, nextIdentity++);
  return identities.get(source) + ':' + variant;
}

export function imageBatchRow(
  matrix: readonly number[],
  bounds: readonly number[],
  opacity: number,
  slot: number,
  depth: number,
  strokeWidth: number,
  fillOpacity: number,
  alignment: number,
  stroke: readonly number[] = [0, 0, 0, 0],
) {
  return [
    ...matrix.slice(0, 4),
    matrix[4],
    matrix[5],
    opacity,
    slot,
    ...bounds,
    depth,
    strokeWidth,
    fillOpacity,
    alignment,
    ...stroke,
  ];
}

/** Plan arrays are append-only and freshly allocated for every dirty plan. */
const pages = new WeakMap<object, { count: number; slots: Set<string> }>();
export function imagePageAccepts<T>(
  shapes: readonly T[],
  next: T,
  token: (shape: T) => string,
) {
  let page = pages.get(shapes);
  if (!page || page.count > shapes.length)
    pages.set(shapes, (page = { count: 0, slots: new Set() }));
  while (page.count < shapes.length)
    page.slots.add(token(shapes[page.count++]));
  return (
    shapes.length < IMAGE_BATCH_SIZE &&
    (page.slots.has(token(next)) || page.slots.size < IMAGE_BATCH_TEXTURES)
  );
}
