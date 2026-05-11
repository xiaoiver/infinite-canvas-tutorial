import { DOMAdapter } from '../environment';
import { parseColor } from './color';
import {
  getDevicePixelRatioForRaster,
  resolveFillImageTexturePixelSize,
} from './fillImageTextureSize';

/** 已成功解码的 FillLayers 图片 URL，供后续帧同步栅格化。 */
const fillLayerDecodedBitmapByUrl = new Map<string, ImageBitmap>();

export function getFillLayerDecodedBitmap(
  url: string,
): ImageBitmap | undefined {
  return fillLayerDecodedBitmapByUrl.get(url);
}

export function setFillLayerDecodedBitmapForUrl(
  url: string,
  bmp: ImageBitmap,
): void {
  const prev = fillLayerDecodedBitmapByUrl.get(url);
  if (
    prev &&
    prev !== bmp &&
    'close' in prev &&
    typeof (prev as ImageBitmap).close === 'function'
  ) {
    try {
      (prev as ImageBitmap).close();
    } catch {
      // ignore
    }
  }
  fillLayerDecodedBitmapByUrl.set(url, bmp);
}
const fillLayerDecodeInflight = new Map<string, Promise<void>>();
const fillLayerDecodeWaiters = new Map<string, Set<() => void>>();

function blitImageBitmapToCanvas(
  bmp: ImageBitmap,
  tw: number,
  th: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  const canvas = DOMAdapter.get().createCanvas(tw, th);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    return null;
  }
  try {
    ctx.drawImage(bmp, 0, 0, tw, th);
  } catch {
    return null;
  }
  return canvas;
}

function scheduleFillLayerUrlDecode(url: string, onDecoded?: () => void): void {
  if (onDecoded) {
    let w = fillLayerDecodeWaiters.get(url);
    if (!w) {
      w = new Set();
      fillLayerDecodeWaiters.set(url, w);
    }
    w.add(onDecoded);
  }
  if (fillLayerDecodeInflight.has(url)) {
    return;
  }
  const p = (async () => {
    try {
      const bmp = (await DOMAdapter.get().createImage(url)) as ImageBitmap;
      fillLayerDecodedBitmapByUrl.set(url, bmp);
      const waiters = fillLayerDecodeWaiters.get(url);
      fillLayerDecodeWaiters.delete(url);
      if (waiters) {
        for (const cb of waiters) {
          try {
            cb();
          } catch {
            // ignore
          }
        }
      }
    } catch {
      fillLayerDecodeWaiters.delete(url);
    } finally {
      fillLayerDecodeInflight.delete(url);
    }
  })();
  fillLayerDecodeInflight.set(url, p);
}

/**
 * 将 FillLayers 的 `image` 层 URL 栅格到画布：已解码缓存 → 同步路径 → 否则启动异步解码并在完成时调用 `onDecoded`（用于打 `MaterialDirty`）。
 */
export function rasterizeFillLayerImageUrlForTexture(
  url: string,
  width: number,
  height: number,
  onDecoded?: () => void,
): HTMLCanvasElement | OffscreenCanvas | null {
  if (!url) {
    return null;
  }
  const tw = Math.max(1, Math.ceil(width));
  const th = Math.max(1, Math.ceil(height));

  const cached = fillLayerDecodedBitmapByUrl.get(url);
  if (cached) {
    return blitImageBitmapToCanvas(cached, tw, th);
  }

  const sync = trySyncRasterizeImageUrlToCanvas(url, width, height);
  if (sync) {
    return sync;
  }

  scheduleFillLayerUrlDecode(url, onDecoded);
  return null;
}

/**
 * FillLayers 图片层上传 GPU 前的栅格像素尺寸：与 {@link FillImage} 一致，按几何尺寸 × DPR，
 * 并在已解码时参考图源 intrinsic 尺寸（放大时更清晰、缩小时保留细节至上限）。
 */
export function resolveFillLayerImageRasterPixelSize(
  url: string,
  geomW: number,
  geomH: number,
): { width: number; height: number } {
  const src = fillLayerDecodedBitmapByUrl.get(url);
  const srcW = src ? Math.max(1, Math.floor(src.width)) : 1;
  const srcH = src ? Math.max(1, Math.floor(src.height)) : 1;
  return resolveFillImageTexturePixelSize(
    srcW,
    srcH,
    geomW,
    geomH,
    getDevicePixelRatioForRaster(),
  );
}

function createRgbaCanvas(
  tw: number,
  th: number,
  fr: number,
  fg: number,
  fb: number,
  fa: number,
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = DOMAdapter.get().createCanvas(tw, th);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    return canvas;
  }
  ctx.fillStyle = `rgba(${fr},${fg},${fb},${fa})`;
  ctx.fillRect(0, 0, tw, th);
  return canvas;
}

/**
 * 尝试同步将图片 URL 栅格到画布（data:、或已缓存的 http(s) 在部分环境下 `img.complete` 已为 true）。
 * 失败时返回 null，调用方使用透明占位或其它异步路径（如 {@link loadImage}）。
 */
export function trySyncRasterizeImageUrlToCanvas(
  url: string,
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof Image === 'undefined' || !url) {
    return null;
  }
  const tw = Math.max(1, Math.ceil(width));
  const th = Math.max(1, Math.ceil(height));
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  if (!img.complete || img.naturalWidth === 0) {
    return null;
  }
  const canvas = DOMAdapter.get().createCanvas(tw, th);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    return null;
  }
  try {
    ctx.drawImage(img, 0, 0, tw, th);
  } catch {
    return null;
  }
  return canvas;
}

export function transparentFillLayerCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  const tw = Math.max(1, Math.ceil(width));
  const th = Math.max(1, Math.ceil(height));
  const { r: fr, g: fg, b: fb, opacity: fa } = parseColor('none');
  return createRgbaCanvas(tw, th, fr, fg, fb, fa);
}
