/**
 * CPU pre-pass for [paper heatmap] shader: R=contour blur, G=large blur, B=inner blur
 * (see {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/heatmap.ts} `toProcessedHeatmap`).
 */
export function imageDataToHeatmapProcessed(src: ImageData): ImageData {
  const { width, height, data: srcData } = src;
  if (width <= 0 || height <= 0) {
    return new ImageData(src.width, src.height);
  }

  const totalPixels = width * height;
  const gray = new Uint8ClampedArray(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4;
    const r = srcData[px] ?? 0;
    const g = srcData[px + 1] ?? 0;
    const b = srcData[px + 2] ?? 0;
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }

  const longEdge = Math.max(width, height);
  const maxBlur = Math.floor(longEdge * 0.15);
  const bigBlurRadius = maxBlur;
  const innerBlurRadius = Math.max(1, Math.round(0.12 * maxBlur));
  const contourRadius = 5;

  const bigBlurGray = multiPassBlurGray(gray, width, height, bigBlurRadius, 3);
  const innerBlurGray = multiPassBlurGray(gray, width, height, innerBlurRadius, 3);
  const contourGray = multiPassBlurGray(gray, width, height, contourRadius, 1);

  const out = new ImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < totalPixels; i++) {
    const px = i * 4;
    dst[px] = contourGray[i] ?? 0;
    dst[px + 1] = bigBlurGray[i] ?? 0;
    dst[px + 2] = innerBlurGray[i] ?? 0;
    dst[px + 3] = srcData[px + 3] ?? 255;
  }
  return out;
}

/**
 * Box blur (integral image) — same as paper's `blurGray` / `multiPassBlurGray`.
 */
function blurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) {
    return gray.slice();
  }

  const out = new Uint8ClampedArray(width * height);
  const integral = new Uint32Array(width * height);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = gray[idx] ?? 0;
      rowSum += v;
      integral[idx] = rowSum + (y > 0 ? (integral[idx - width] ?? 0) : 0);
    }
  }

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);

      const idxA = y2 * width + x2;
      const idxB = y2 * width + (x1 - 1);
      const idxC = (y1 - 1) * width + x2;
      const idxD = (y1 - 1) * width + (x1 - 1);

      const A = integral[idxA] ?? 0;
      const B = x1 > 0 ? (integral[idxB] ?? 0) : 0;
      const C = y1 > 0 ? (integral[idxC] ?? 0) : 0;
      const D = x1 > 0 && y1 > 0 ? (integral[idxD] ?? 0) : 0;

      const sum = A - B - C + D;
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      out[y * width + x] = Math.round(sum / area);
    }
  }

  return out;
}

function multiPassBlurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes: number,
): Uint8ClampedArray {
  if (radius <= 0 || passes <= 1) {
    return blurGray(gray, width, height, radius);
  }

  let input = gray;
  let tmp: Uint8ClampedArray = gray;

  for (let p = 0; p < passes; p++) {
    tmp = blurGray(input, width, height, radius);
    input = tmp;
  }

  return tmp;
}
