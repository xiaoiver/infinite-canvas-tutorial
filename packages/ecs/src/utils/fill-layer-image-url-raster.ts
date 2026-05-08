import { parseColor } from './color';

function createRgbaCanvas(
  tw: number,
  th: number,
  fr: number,
  fg: number,
  fb: number,
  fa: number,
): HTMLCanvasElement | OffscreenCanvas {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    canvas = c;
  } else {
    canvas = new OffscreenCanvas(tw, th);
  }
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
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    canvas = c;
  } else {
    canvas = new OffscreenCanvas(tw, th);
  }
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
