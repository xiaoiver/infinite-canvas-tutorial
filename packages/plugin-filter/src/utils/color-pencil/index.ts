import {
  imageDataToPencilTexture,
  pencilDrawing,
  type PencilDrawingParams,
  type PencilTextureData,
} from './pencilDrawing';
import {
  COLOR_PENCIL_TEXTURE_DEFAULT_URL,
  getColorPencilTextureIfReady,
} from './texture-cache';

export type { PencilDrawingParams, PencilTextureData };

export function getColorPencilTextureData(): PencilTextureData | null {
  return getColorPencilTextureIfReady(COLOR_PENCIL_TEXTURE_DEFAULT_URL) ?? null;
}

/** Procedural fallback when pencil scan is unavailable. */
export function createProceduralPencilTexture(size = 256): PencilTextureData {
  const gray = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        Math.sin(x * 0.31 + y * 0.17) * 0.08 +
        Math.sin(x * 0.73 + y * 0.51) * 0.06 +
        Math.sin(x * 1.9 + y * 2.3) * 0.04;
      gray[y * size + x] = clamp01(0.55 + n);
    }
  }
  return { gray, width: size, height: size };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function resizeImageDataBilinear(src: ImageData, dstW: number, dstH: number): ImageData {
  const { width: srcW, height: srcH, data: srcData } = src;
  const out = new ImageData(dstW, dstH);
  const dst = out.data;
  for (let y = 0; y < dstH; y++) {
    const sy = (y / Math.max(dstH - 1, 1)) * (srcH - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dstW; x++) {
      const sx = (x / Math.max(dstW - 1, 1)) * (srcW - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;
      const dstPx = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = srcData[(y0 * srcW + x0) * 4 + c] ?? 0;
        const v10 = srcData[(y0 * srcW + x1) * 4 + c] ?? 0;
        const v01 = srcData[(y1 * srcW + x0) * 4 + c] ?? 0;
        const v11 = srcData[(y1 * srcW + x1) * 4 + c] ?? 0;
        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        dst[dstPx + c] = Math.round(v0 * (1 - fy) + v1 * fy);
      }
    }
  }
  return out;
}

function downscaleImageData(src: ImageData, maxEdge: number): ImageData {
  const { width, height } = src;
  const long = Math.max(width, height);
  if (long <= maxEdge) {
    return src;
  }
  const scale = maxEdge / long;
  const dw = Math.max(1, Math.round(width * scale));
  const dh = Math.max(1, Math.round(height * scale));
  return resizeImageDataBilinear(src, dw, dh);
}

function upscaleImageData(src: ImageData, width: number, height: number): ImageData {
  if (src.width === width && src.height === height) {
    return src;
  }
  return resizeImageDataBilinear(src, width, height);
}

/**
 * CPU pre-pass for color pencil (Lu et al. NPAR 2012 / PencilDrawing).
 */
export function imageDataToColorPencilProcessed(
  src: ImageData,
  params: PencilDrawingParams = {},
  pencil?: PencilTextureData | null,
  maxEdge = 1024,
): ImageData {
  const { width, height } = src;
  if (width <= 0 || height <= 0) {
    return new ImageData(src.width, src.height);
  }
  const small = downscaleImageData(src, maxEdge);
  const texture = pencil ?? getColorPencilTextureData() ?? createProceduralPencilTexture();
  const outSmall = pencilDrawing(small.data, small.width, small.height, texture, params);
  const processed = new ImageData(outSmall, small.width, small.height);
  return upscaleImageData(processed, width, height);
}

export { genStroke } from './genStroke';
export { genToneMap } from './genToneMap';
export { genPencil } from './genPencil';
export {
  imageDataToPencilTexture,
  pencilDrawing,
} from './pencilDrawing';
export {
  COLOR_PENCIL_TEXTURE_DEFAULT_URL,
  getColorPencilTextureIfReady,
  loadColorPencilTextureCached,
} from './texture-cache';
