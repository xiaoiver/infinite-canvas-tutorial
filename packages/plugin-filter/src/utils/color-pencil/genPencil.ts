/**
 * Conjugate gradient for GenPencil sparse system (MATLAB column-major layout).
 * A = theta * (Dx*Dx' + Dy*Dy') + diag(logP^2),  b = logP * logJ
 */
export function solveGenPencilBeta(
  logP: Float32Array,
  logJ: Float32Array,
  width: number,
  height: number,
  theta = 0.2,
  maxIter = 60,
  tol = 1e-6,
): Float32Array {
  const n = width * height;
  const b = new Float32Array(n);
  const logP2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lp = logP[i]!;
    logP2[i] = lp * lp;
    b[i] = lp * logJ[i]!;
  }

  const applyA = (x: Float32Array, out: Float32Array) => {
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        const i = col * height + row;
        let neighborSum = 0;
        let degree = 0;
        if (col > 0) {
          neighborSum += x[i - height]!;
          degree++;
        }
        if (col < width - 1) {
          neighborSum += x[i + height]!;
          degree++;
        }
        if (row > 0) {
          neighborSum += x[i - 1]!;
          degree++;
        }
        if (row < height - 1) {
          neighborSum += x[i + 1]!;
          degree++;
        }
        out[i] = theta * (degree * x[i]! - neighborSum) + logP2[i]! * x[i]!;
      }
    }
  };

  const x = new Float32Array(n);
  const r = new Float32Array(n);
  const p = new Float32Array(n);
  const Ap = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    r[i] = b[i]!;
    p[i] = r[i]!;
  }

  let rsold = dot(r, r);
  const tol2 = tol * tol * rsold;

  for (let iter = 0; iter < maxIter; iter++) {
    if (rsold <= tol2) {
      break;
    }
    applyA(p, Ap);
    const alpha = rsold / Math.max(dot(p, Ap), 1e-20);
    for (let i = 0; i < n; i++) {
      x[i] = x[i]! + alpha * p[i]!;
      r[i] = r[i]! - alpha * Ap[i]!;
    }
    const rsnew = dot(r, r);
    const beta = rsnew / Math.max(rsold, 1e-20);
    for (let i = 0; i < n; i++) {
      p[i] = r[i]! + beta * p[i]!;
    }
    rsold = rsnew;
  }
  return x;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i]! * b[i]!;
  }
  return s;
}

function resizeBilinear(
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const out = new Float32Array(dstW * dstH);
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
      const v00 = src[y0 * srcW + x0]!;
      const v10 = src[y0 * srcW + x1]!;
      const v01 = src[y1 * srcW + x0]!;
      const v11 = src[y1 * srcW + x1]!;
      const v0 = v00 * (1 - fx) + v10 * fx;
      const v1 = v01 * (1 - fx) + v11 * fx;
      out[y * dstW + x] = v0 * (1 - fy) + v1 * fy;
    }
  }
  return out;
}

/**
 * Port of MATLAB {@link https://github.com/candycat1992/PencilDrawing/blob/master/GenPencil.m GenPencil.m}.
 */
export function genPencil(
  pencilGray: Float32Array,
  pencilW: number,
  pencilH: number,
  toneMap: Float32Array,
  width: number,
  height: number,
  theta = 0.2,
): Float32Array {
  const P = resizeBilinear(pencilGray, pencilW, pencilH, width, height);
  const J = toneMap;

  const n = width * height;
  const logP = new Float32Array(n);
  const logJ = new Float32Array(n);
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const rowIdx = row * width + col;
      const colIdx = col * height + row;
      const p = Math.max(P[rowIdx]!, 1e-4);
      const j = Math.max(J[rowIdx]!, 1e-4);
      logP[colIdx] = Math.log(p);
      logJ[colIdx] = Math.log(j);
    }
  }

  const betaCol = solveGenPencilBeta(logP, logJ, width, height, theta);
  const T = new Float32Array(n);
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const rowIdx = row * width + col;
      const colIdx = col * height + row;
      const p = Math.max(P[rowIdx]!, 1e-4);
      T[rowIdx] = p ** betaCol[colIdx]!;
    }
  }
  return T;
}
