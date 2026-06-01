import { conv2Same } from './conv2d';
import { medianFilter3x3 } from './medianFilter';

function buildLineKernel(ks: number, width: number, angleDeg: number): Float32Array {
  const size = ks * 2 + 1;
  const ker = new Float32Array(size * size);
  const half = ks;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (let w = 0; w < width; w++) {
    const offset = w - Math.floor(width / 2);
    for (let t = -ks; t <= ks; t++) {
      const fx = t * cos - offset * sin;
      const fy = t * sin + offset * cos;
      const ix = Math.round(fx) + half;
      const iy = Math.round(fy) + half;
      if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
        ker[iy * size + ix] = 1;
      }
    }
  }
  return ker;
}

function minMax(arr: Float32Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!;
    if (v < min) {
      min = v;
    }
    if (v > max) {
      max = v;
    }
  }
  return [min, max];
}

/**
 * Port of MATLAB {@link https://github.com/candycat1992/PencilDrawing/blob/master/GenStroke.m GenStroke.m}.
 */
export function genStroke(
  im: Float32Array,
  width: number,
  height: number,
  ks: number,
  strokeWidth: number,
  dirNum: number,
): Float32Array {
  const smoothed = medianFilter3x3(im, width, height);

  const imEdge = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const right = x < width - 1 ? smoothed[idx + 1]! : 0;
      const down = y < height - 1 ? smoothed[idx + width]! : 0;
      const cur = smoothed[idx]!;
      imEdge[idx] = Math.abs(cur - right) + Math.abs(cur - down);
    }
  }

  const response = new Float32Array(width * height * dirNum);
  const kernelSize = ks * 2 + 1;
  for (let n = 0; n < dirNum; n++) {
    const angle = (n * 180) / dirNum;
    const ker = buildLineKernel(ks, 1, angle);
    const resp = conv2Same(imEdge, width, height, ker, kernelSize, kernelSize);
    for (let i = 0; i < width * height; i++) {
      response[n * width * height + i] = resp[i]!;
    }
  }

  const index = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    let best = 0;
    let bestN = 0;
    for (let n = 0; n < dirNum; n++) {
      const v = response[n * width * height + i]!;
      if (v > best) {
        best = v;
        bestN = n;
      }
    }
    index[i] = bestN;
  }

  const classified = new Float32Array(width * height * dirNum);
  for (let n = 0; n < dirNum; n++) {
    for (let i = 0; i < width * height; i++) {
      classified[n * width * height + i] = index[i] === n ? imEdge[i]! : 0;
    }
  }

  const spn = new Float32Array(width * height);
  for (let n = 0; n < dirNum; n++) {
    const angle = (n * 180) / dirNum;
    const rotKer = buildLineKernel(ks, Math.max(1, strokeWidth), angle);
    const slice = classified.subarray(n * width * height, (n + 1) * width * height);
    const conv = conv2Same(slice, width, height, rotKer, kernelSize, kernelSize);
    for (let i = 0; i < width * height; i++) {
      spn[i] = (spn[i] ?? 0) + conv[i]!;
    }
  }

  const [min, max] = minMax(spn);
  const range = Math.max(max - min, 1e-8);
  const S = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const norm = (spn[i]! - min) / range;
    S[i] = 1 - norm;
  }
  return S;
}
