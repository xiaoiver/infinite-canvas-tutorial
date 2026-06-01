import { conv2Same } from './conv2d';

function buildTargetHistogram(): Float32Array {
  const Ub = 225;
  const Ua = 105;
  const Mud = 90;
  const DeltaB = 9;
  const DeltaD = 11;
  // 3rd group (lighter tone map) — default in GenToneMap.m
  const Omega1 = 76;
  const Omega2 = 22;
  const Omega3 = 2;

  const hist = new Float32Array(256);
  let total = 0;
  for (let ii = 0; ii < 256; ii++) {
    let p = 0;
    if (ii >= Ua && ii <= Ub) {
      p = 1 / (Ub - Ua);
    }
    const v =
      (Omega1 * (1 / DeltaB) * Math.exp(-(255 - ii) / DeltaB) +
        Omega2 * p +
        Omega3 *
          (1 / Math.sqrt(2 * Math.PI * DeltaD)) *
          Math.exp(-((ii - Mud) ** 2) / (2 * DeltaD ** 2))) *
      0.01;
    hist[ii] = v;
    total += v;
  }
  for (let i = 0; i < 256; i++) {
    hist[i] = hist[i]! / total;
  }
  return hist;
}

function buildCdf(hist: Float32Array): Float32Array {
  const cdf = new Float32Array(256);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist[i]!;
    cdf[i] = sum;
  }
  return cdf;
}

function histogram256(im: Float32Array): Float32Array {
  const hist = new Float32Array(256);
  for (let i = 0; i < im.length; i++) {
    const b = Math.max(0, Math.min(255, Math.round(im[i]! * 255)));
    hist[b] = hist[b]! + 1;
  }
  const n = im.length;
  for (let i = 0; i < 256; i++) {
    hist[i] = hist[i]! / n;
  }
  return hist;
}

function histeq(im: Float32Array, targetHist: Float32Array): Float32Array {
  const srcHist = histogram256(im);
  const srcCdf = buildCdf(srcHist);
  const tgtCdf = buildCdf(targetHist);

  const lut = new Uint8Array(256);
  for (let s = 0; s < 256; s++) {
    const sc = srcCdf[s]!;
    let t = 0;
    while (t < 255 && tgtCdf[t]! < sc) {
      t++;
    }
    lut[s] = t;
  }

  const out = new Float32Array(im.length);
  for (let i = 0; i < im.length; i++) {
    const b = Math.max(0, Math.min(255, Math.round(im[i]! * 255)));
    out[i] = lut[b]! / 255;
  }
  return out;
}

function averageFilter10(im: Float32Array, width: number, height: number): Float32Array {
  const ker = new Float32Array(100);
  ker.fill(1 / 100);
  return conv2Same(im, width, height, ker, 10, 10);
}

/**
 * Port of MATLAB {@link https://github.com/candycat1992/PencilDrawing/blob/master/GenToneMap.m GenToneMap.m}.
 */
export function genToneMap(
  im: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const target = buildTargetHistogram();
  const matched = histeq(im, target);
  return averageFilter10(matched, width, height);
}
