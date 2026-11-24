import type { Entity } from '@lastolivegames/becsy';
import {
  Format,
  TextureUsage,
  type Device,
} from '@infinite-canvas-tutorial/device-api';
import type { API } from '../API';
import {
  Rect,
  GlobalTransform,
  Rough,
  UI,
  FillTexture,
  Wireframe,
  SizeAttenuation,
  StrokeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
  Stroke,
  Opacity,
} from '../components';
import { getEnabledFillLayers } from './fillLayers';
import { getEnabledStrokeLayers } from './strokeLayers';
import { isLikelySvgResourceUrl } from './fillImageSvgReraster';
import { DOMAdapter } from '../environment';
import {
  imageTextures,
  imageRasterizerIdentity,
  isImmutableImage,
  type ImageTextureLease,
} from './image-texture-pool';
import {
  getFillLayerDecodedBitmap,
  getFillLayerDecodedBitmapIntrinsicSize,
  resolveImageFillRasterOptions,
  resolveFillLayerImageRasterPixelSize,
  rasterizeFillLayerImageUrlForTexture,
} from './fill-layer-image-url-raster';
import { upload2DRasterCanvasToTexture } from './rasterCanvasTextureUpload';
import { getDevicePixelRatioForRaster } from './fillImageTextureSize';
import { getSdfGeometryBoundsForFilter } from './solidShapeRasterForFilter';

export function eligibleImageRect(shape: Entity) {
  if (
    !shape.has(Rect) ||
    !shape.has(GlobalTransform) ||
    shape.hasSomeOf(
      Rough,
      UI,
      FillTexture,
      Wireframe,
      SizeAttenuation,
      StrokeAttenuation,
      Filter,
      DropShadow,
      InnerShadow,
      ClipMode,
      NodeLayerBlendMode,
      Extrude3D,
    ) ||
    getEnabledStrokeLayers(shape).length
  )
    return false;
  const layers = getEnabledFillLayers(shape);
  if (
    layers.length !== 1 ||
    layers[0].type !== 'image' ||
    (layers[0].blendMode && layers[0].blendMode !== 'normal') ||
    isLikelySvgResourceUrl(layers[0].value) ||
    !isImmutableImage(getFillLayerDecodedBitmap(layers[0].value))
  )
    return false;
  const r = shape.read(Rect),
    m = shape.read(GlobalTransform).matrix;
  return (
    r.cornerRadius === 0 &&
    r.width > 0 &&
    r.height > 0 &&
    m.m02 === 0 &&
    m.m12 === 0 &&
    m.m22 === 1 &&
    [
      r.x,
      r.y,
      r.width,
      r.height,
      m.m00,
      m.m01,
      m.m10,
      m.m11,
      m.m20,
      m.m21,
      shape.has(Stroke) ? shape.read(Stroke).width : 0,
      shape.has(Opacity) ? shape.read(Opacity).opacity : 1,
    ].every(Number.isFinite) &&
    Math.abs(m.m00 * m.m11 - m.m01 * m.m10) > 1e-12
  );
}

const rasterDescriptions = new WeakMap<
  Entity,
  {
    api: API;
    layer: unknown;
    source: ImageBitmap;
    width: number;
    height: number;
    dpr: number;
    intrinsicWidth: number;
    intrinsicHeight: number;
    adapter: object;
    value: ReturnType<typeof createImageRectTexture>;
  }
>();
export function invalidateImageRectTexture(shape: Entity) {
  rasterDescriptions.delete(shape);
}

/** Avoid document lookups and option resolution on camera/culling-only replans. */
export function imageRectTexture(shape: Entity, api: API) {
  const layer = getEnabledFillLayers(shape)[0];
  if (layer.type !== 'image') throw new Error('Expected one image layer');
  const source = getFillLayerDecodedBitmap(layer.value)!;
  const bounds = getSdfGeometryBoundsForFilter(shape);
  const width = bounds.maxX - bounds.minX,
    height = bounds.maxY - bounds.minY;
  const intrinsic = getFillLayerDecodedBitmapIntrinsicSize(layer.value);
  const dpr = getDevicePixelRatioForRaster(),
    adapter = DOMAdapter.get();
  const previous = rasterDescriptions.get(shape);
  if (
    previous &&
    previous.api === api &&
    previous.layer === layer &&
    previous.source === source &&
    previous.width === width &&
    previous.height === height &&
    previous.dpr === dpr &&
    previous.intrinsicWidth === intrinsic?.width &&
    previous.intrinsicHeight === intrinsic?.height &&
    previous.adapter === adapter
  )
    return previous.value;
  const value = createImageRectTexture(shape, api);
  rasterDescriptions.set(shape, {
    api,
    layer,
    source,
    width,
    height,
    dpr,
    intrinsicWidth: intrinsic?.width,
    intrinsicHeight: intrinsic?.height,
    adapter,
    value,
  });
  return value;
}

/** Use exactly the ordinary SDF raster variant and its ref-counted texture pool. */
function createImageRectTexture(shape: Entity, api: API) {
  const layer = getEnabledFillLayers(shape)[0];
  if (layer.type !== 'image') throw new Error('Expected one image layer');
  const source = getFillLayerDecodedBitmap(layer.value)!;
  const opts = resolveImageFillRasterOptions(api, shape, layer);
  const b = getSdfGeometryBoundsForFilter(shape);
  const { width, height } = resolveFillLayerImageRasterPixelSize(
    layer.value,
    b.maxX - b.minX,
    b.maxY - b.minY,
    opts.objectFit,
  );
  const intrinsic = getFillLayerDecodedBitmapIntrinsicSize(layer.value);
  const key = JSON.stringify([
    width,
    height,
    intrinsic?.width,
    intrinsic?.height,
    opts.objectFit ?? 'fill',
    opts.objectPosition ?? '50% 50%',
    imageRasterizerIdentity(DOMAdapter.get()),
  ]);
  return {
    source,
    key,
    token: imageBatchToken(source, key),
    acquire(device: Device) {
      return imageTextures.acquire(device, source, key, () => {
        const canvas = rasterizeFillLayerImageUrlForTexture(
          layer.value,
          width,
          height,
          () => {},
          opts,
        );
        if (!canvas) throw new Error('Image batch source is no longer decoded');
        const texture = device.createTexture({
          format: Format.U8_RGBA_NORM,
          width,
          height,
          usage: TextureUsage.SAMPLED,
        });
        try {
          upload2DRasterCanvasToTexture(texture, canvas);
        } catch (error) {
          texture.destroy();
          throw error;
        }
        return texture;
      });
    },
  };
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

/** One synchronous dirty plan owns this cache; never reuse it across frames. */
export function cacheImageTokens<T>(resolve: (shape: T) => string) {
  const tokens = new Map<T, string>();
  return (shape: T) => {
    let token = tokens.get(shape);
    if (token === undefined) {
      token = resolve(shape);
      tokens.set(shape, token);
    }
    return token;
  };
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

/** Retain live variants across page reorders; publish only a complete binding. */
export class ImageBatchTextures<T> {
  private held = new Map<string, ImageTextureLease<T>>();
  sync(
    requests: readonly { token: string; acquire(): ImageTextureLease<T> }[],
    bind: (leases: readonly ImageTextureLease<T>[]) => void,
  ) {
    const next = new Map<string, ImageTextureLease<T>>();
    const acquired: ImageTextureLease<T>[] = [];
    const ordered: ImageTextureLease<T>[] = [];
    try {
      for (const request of requests) {
        let lease = next.get(request.token) ?? this.held.get(request.token);
        if (!lease) {
          lease = request.acquire();
          acquired.push(lease);
        }
        next.set(request.token, lease);
        ordered.push(lease);
      }
      bind(ordered);
    } catch (error) {
      acquired.forEach((lease) => lease.release());
      throw error;
    }
    for (const [token, lease] of this.held)
      if (!next.has(token)) lease.release();
    this.held = next;
  }
  dispose() {
    this.held.forEach((lease) => lease.release());
    this.held.clear();
  }
}
