import type { Entity } from '@lastolivegames/becsy';
import { ComputedBounds, Rect } from '../components';

/** 避免 SVG 等小 intrinsic 位图在放大后处理时糊成一片；与 {@link resolveFillImageTexturePixelSize} 配合使用。 */
export const FILL_IMAGE_RASTER_MAX_EDGE = 4096;

/**
 * 与 {@link Mesh.getSolidFillFilterGeometry} 一致：用几何盒像素尺寸，Rect 在 bounds 未刷新时作后备。
 */
export function getShapePixelBoundsForFillImage(instance: Entity): {
  geomW: number;
  geomH: number;
} {
  const g = instance.read(ComputedBounds).geometryBounds;
  let gw = g.maxX - g.minX;
  let gh = g.maxY - g.minY;
  if (instance.has(Rect)) {
    const aabb = Rect.getGeometryBounds(instance.read(Rect));
    const rw = aabb.maxX - aabb.minX;
    const rh = aabb.maxY - aabb.minY;
    if ((gw < 0.5 || gh < 0.5) && rw >= 0.5 && rh >= 0.5) {
      gw = rw;
      gh = rh;
    }
  }
  return { geomW: gw, geomH: gh };
}

export function getDevicePixelRatioForRaster(): number {
  if (typeof globalThis === 'undefined') {
    return 1;
  }
  const dpr = (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
  return Number.isFinite(dpr) && dpr! > 0 ? dpr! : 1;
}

/**
 * 按画布上实际占用尺寸 × DPR 提升纹理分辨率，使 SVG 等小图在 liquid-metal / heatmap / gem-smoke 等
 * 全纹理后处理中仍足够清晰；若超过 {@link FILL_IMAGE_RASTER_MAX_EDGE} 则等比缩小。
 */
export function resolveFillImageTexturePixelSize(
  srcW: number,
  srcH: number,
  geomW: number,
  geomH: number,
  devicePixelRatio: number,
  maxEdge: number = FILL_IMAGE_RASTER_MAX_EDGE,
): { width: number; height: number } {
  const sw = Math.max(1, Math.floor(srcW));
  const sh = Math.max(1, Math.floor(srcH));
  const dpr = Math.max(1, devicePixelRatio);
  if (geomW < 0.5 || geomH < 0.5) {
    return { width: sw, height: sh };
  }
  const targetW = Math.ceil(geomW * dpr);
  const targetH = Math.ceil(geomH * dpr);
  let tw = Math.max(sw, targetW);
  let th = Math.max(sh, targetH);
  if (tw > maxEdge || th > maxEdge) {
    const scale = Math.min(maxEdge / tw, maxEdge / th, 1);
    tw = Math.max(1, Math.floor(tw * scale));
    th = Math.max(1, Math.floor(th * scale));
  }
  return { width: tw, height: th };
}

/**
 * 将**已有**位图画到目标尺寸（Canvas2D 插值）。对真正的 SVG 矢量，插值仍偏糊，需配合
 * `fillImageSvgReraster` 在目标尺寸用矢量重栅格后替换 `FillImage.src`。
 */
export function blitImageBitmapToPixelSize(
  src: ImageBitmap,
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    canvas = c;
  } else {
    canvas = new OffscreenCanvas(width, height);
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error('Canvas 2D required for FillImage raster upscale');
  }
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}
