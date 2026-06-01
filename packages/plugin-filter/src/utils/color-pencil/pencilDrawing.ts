import { genStroke } from './genStroke';
import { genToneMap } from './genToneMap';
import { genPencil } from './genPencil';

export interface PencilDrawingParams {
  ks?: number;
  strokeWidth?: number;
  dirNum?: number;
  gammaS?: number;
  gammaI?: number;
}

export interface PencilTextureData {
  gray: Float32Array;
  width: number;
  height: number;
}

function rgbToLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function rgbToYcbcr(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const y = 0.299 * rn + 0.587 * gn + 0.114 * bn;
  const cb = 0.564 * (bn - y) + 0.5;
  const cr = 0.713 * (rn - y) + 0.5;
  return [y, cb, cr];
}

function ycbcrToRgb(y: number, cb: number, cr: number): [number, number, number] {
  const r = y + 1.402 * (cr - 0.5);
  const g = y - 0.344136 * (cb - 0.5) - 0.714136 * (cr - 0.5);
  const b = y + 1.772 * (cb - 0.5);
  return [r, g, b];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Port of MATLAB {@link https://github.com/candycat1992/PencilDrawing/blob/master/PencilDrawing.m PencilDrawing.m}.
 */
export function pencilDrawing(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  pencil: PencilTextureData,
  params: PencilDrawingParams = {},
): Uint8ClampedArray {
  const ks = params.ks ?? 8;
  const strokeWidth = params.strokeWidth ?? 1;
  const dirNum = params.dirNum ?? 8;
  const gammaS = params.gammaS ?? 1;
  const gammaI = params.gammaI ?? 1;

  const n = width * height;
  const lum = new Float32Array(n);
  const ycbcr = new Float32Array(n * 3);
  let hasColor = false;

  for (let i = 0; i < n; i++) {
    const px = i * 4;
    const r = rgba[px] ?? 0;
    const g = rgba[px + 1] ?? 0;
    const b = rgba[px + 2] ?? 0;
    const a = rgba[px + 3] ?? 255;
    if (a > 0 && (r !== g || g !== b)) {
      hasColor = true;
    }
    const ycc = rgbToYcbcr(r, g, b);
    ycbcr[i * 3] = ycc[0];
    ycbcr[i * 3 + 1] = ycc[1];
    ycbcr[i * 3 + 2] = ycc[2];
    lum[i] = ycc[0];
  }

  let S = genStroke(lum, width, height, ks, strokeWidth, dirNum);
  if (gammaS !== 1) {
    for (let i = 0; i < n; i++) {
      S[i] = S[i]! ** gammaS;
    }
  }

  let J = genToneMap(lum, width, height);
  if (gammaI !== 1) {
    for (let i = 0; i < n; i++) {
      J[i] = J[i]! ** gammaI;
    }
  }

  const T = genPencil(pencil.gray, pencil.width, pencil.height, J, width, height);
  const newLum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    newLum[i] = S[i]! * T[i]!;
  }

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const px = i * 4;
    const a = rgba[px + 3] ?? 255;
    let r: number;
    let g: number;
    let b: number;
    if (hasColor) {
      const rgb = ycbcrToRgb(newLum[i]!, ycbcr[i * 3 + 1]!, ycbcr[i * 3 + 2]!);
      r = clamp01(rgb[0]) * 255;
      g = clamp01(rgb[1]) * 255;
      b = clamp01(rgb[2]) * 255;
    } else {
      const v = clamp01(newLum[i]!) * 255;
      r = g = b = v;
    }
    out[px] = r;
    out[px + 1] = g;
    out[px + 2] = b;
    out[px + 3] = a;
  }
  return out;
}

export function imageDataToPencilTexture(image: ImageData): PencilTextureData {
  const { width, height, data } = image;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const px = i * 4;
    const r = data[px] ?? 0;
    const g = data[px + 1] ?? 0;
    const b = data[px + 2] ?? 0;
    gray[i] = rgbToLuminance(r, g, b);
  }
  return { gray, width, height };
}
