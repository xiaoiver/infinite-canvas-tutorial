/**
 * @see https://gitlab.com/unconed/use.gpu/-/blob/master/packages/glyph/src/sdf-esdt.ts
 */

import {
  getSDFStage,
  glyphToRGBA,
  INF,
  isBlack,
  isSolid,
  isWhite,
  SDFStage,
  sqr,
} from './tiny-sdf';

// Paint alpha channel into SDF stage
const paintIntoStage = (
  stage: SDFStage,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad: number,
) => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;
  const np = wp * hp;

  const { outer, inner } = stage;

  outer.fill(INF, 0, np);
  inner.fill(0, 0, np);

  const getData = (x: number, y: number) => data[y * w + x] ?? 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = getData(x, y);
      if (!a) continue;

      const i = (y + pad) * wp + x + pad;
      if (a >= 254) {
        // Fix for bad rasterizer rounding
        data[y * w + x] = 255;

        outer[i] = 0;
        inner[i] = INF;
      } else {
        outer[i] = 0;
        inner[i] = 0;
      }
    }
  }
};

// Paint original alpha channel into final SDF when gray
export const paintIntoDistanceField = (
  image: Uint8Array,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad: number,
  radius: number,
  cutoff: number,
) => {
  const wp = w + pad * 2;

  const getData = (x: number, y: number) => (data[y * w + x] ?? 0) / 255;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = getData(x, y);
      if (!isSolid(a)) {
        const j = x + pad + (y + pad) * wp;
        const d = 0.5 - a;
        image[j] = Math.max(
          0,
          Math.min(255, Math.round(255 - 255 * (d / radius + cutoff))),
        );
      }
    }
  }
};

// Generate subpixel offsets for all border pixels
export const paintSubpixelOffsets = (
  stage: SDFStage,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad: number,
  relax?: boolean,
  half?: number | boolean,
) => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;
  const np = wp * hp;

  const { outer, inner, xo, yo, xi, yi } = stage;

  xo.fill(0, 0, np);
  yo.fill(0, 0, np);
  xi.fill(0, 0, np);
  yi.fill(0, 0, np);

  const getData = (x: number, y: number) =>
    x >= 0 && x < w && y >= 0 && y < h ? (data[y * w + x] ?? 0) / 255 : 0;

  // Make vector from pixel center to nearest boundary
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = getData(x, y);
      const j = (y + pad) * wp + x + pad;

      if (!isSolid(c)) {
        const dc = c - 0.5;

        const l = getData(x - 1, y);
        const r = getData(x + 1, y);
        const t = getData(x, y - 1);
        const b = getData(x, y + 1);

        const tl = getData(x - 1, y - 1);
        const tr = getData(x + 1, y - 1);
        const bl = getData(x - 1, y + 1);
        const br = getData(x + 1, y + 1);

        const ll = (tl + l * 2 + bl) / 4;
        const rr = (tr + r * 2 + br) / 4;
        const tt = (tl + t * 2 + tr) / 4;
        const bb = (bl + b * 2 + br) / 4;

        const min = Math.min(l, r, t, b, tl, tr, bl, br);
        const max = Math.max(l, r, t, b, tl, tr, bl, br);

        if (min > 0) {
          // Interior creases
          inner[j] = INF;
          continue;
        }
        if (max < 1) {
          // Exterior creases
          outer[j] = INF;
          continue;
        }

        let dx = rr - ll;
        let dy = bb - tt;
        const dl = 1 / Math.sqrt(sqr(dx) + sqr(dy));
        dx *= dl;
        dy *= dl;

        xo[j] = -dc * dx;
        yo[j] = -dc * dy;
      } else if (isWhite(c)) {
        const l = getData(x - 1, y);
        const r = getData(x + 1, y);
        const t = getData(x, y - 1);
        const b = getData(x, y + 1);

        if (isBlack(l)) {
          xo[j - 1] = 0.4999;
          outer[j - 1] = 0;
          inner[j - 1] = 0;
        }
        if (isBlack(r)) {
          xo[j + 1] = -0.4999;
          outer[j + 1] = 0;
          inner[j + 1] = 0;
        }

        if (isBlack(t)) {
          yo[j - wp] = 0.4999;
          outer[j - wp] = 0;
          inner[j - wp] = 0;
        }
        if (isBlack(b)) {
          yo[j + wp] = -0.4999;
          outer[j + wp] = 0;
          inner[j + wp] = 0;
        }
      }
    }
  }

  // Blend neighboring offsets but preserve normal direction
  // Uses xo as input, xi as output
  // Improves quality slightly, but slows things down.
  let xs = xo;
  let ys = yo;
  if (relax) {
    const checkCross = (
      nx: number,
      ny: number,
      dc: number,
      dl: number,
      dr: number,
      dxl: number,
      dyl: number,
      dxr: number,
      dyr: number,
    ) => {
      return (
        (dxl * nx + dyl * ny) * (dc * dl) > 0 &&
        (dxr * nx + dyr * ny) * (dc * dr) > 0 &&
        (dxl * dxr + dyl * dyr) * (dl * dr) > 0
      );
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = (y + pad) * wp + x + pad;

        const nx = xo[j];
        const ny = yo[j];
        if (!nx && !ny) continue;

        const c = getData(x, y);
        const l = getData(x - 1, y);
        const r = getData(x + 1, y);
        const t = getData(x, y - 1);
        const b = getData(x, y + 1);

        const dxl = xo[j - 1];
        const dxr = xo[j + 1];
        const dxt = xo[j - wp];
        const dxb = xo[j + wp];

        const dyl = yo[j - 1];
        const dyr = yo[j + 1];
        const dyt = yo[j - wp];
        const dyb = yo[j + wp];

        let dx = nx;
        let dy = ny;
        let dw = 1;

        const dc = c - 0.5;
        const dl = l - 0.5;
        const dr = r - 0.5;
        const dt = t - 0.5;
        const db = b - 0.5;

        if (!isSolid(l) && !isSolid(r)) {
          if (checkCross(nx, ny, dc, dl, dr, dxl, dyl, dxr, dyr)) {
            dx += (dxl + dxr) / 2;
            dy += (dyl + dyr) / 2;
            dw++;
          }
        }

        if (!isSolid(t) && !isSolid(b)) {
          if (checkCross(nx, ny, dc, dt, db, dxt, dyt, dxb, dyb)) {
            dx += (dxt + dxb) / 2;
            dy += (dyt + dyb) / 2;
            dw++;
          }
        }

        if (!isSolid(l) && !isSolid(t)) {
          if (checkCross(nx, ny, dc, dl, dt, dxl, dyl, dxt, dyt)) {
            dx += (dxl + dxt - 1) / 2;
            dy += (dyl + dyt - 1) / 2;
            dw++;
          }
        }

        if (!isSolid(r) && !isSolid(t)) {
          if (checkCross(nx, ny, dc, dr, dt, dxr, dyr, dxt, dyt)) {
            dx += (dxr + dxt + 1) / 2;
            dy += (dyr + dyt - 1) / 2;
            dw++;
          }
        }

        if (!isSolid(l) && !isSolid(b)) {
          if (checkCross(nx, ny, dc, dl, db, dxl, dyl, dxb, dyb)) {
            dx += (dxl + dxb - 1) / 2;
            dy += (dyl + dyb + 1) / 2;
            dw++;
          }
        }

        if (!isSolid(r) && !isSolid(b)) {
          if (checkCross(nx, ny, dc, dr, db, dxr, dyr, dxb, dyb)) {
            dx += (dxr + dxb + 1) / 2;
            dy += (dyr + dyb + 1) / 2;
            dw++;
          }
        }

        const nn = Math.sqrt(nx * nx + ny * ny);
        const ll = (dx * nx + dy * ny) / nn;

        dx = (nx * ll) / dw / nn;
        dy = (ny * ll) / dw / nn;

        xi[j] = dx;
        yi[j] = dy;
      }
    }
    xs = xi;
    ys = yi;
  }

  if (half) return;

  // Produce zero points for positive and negative DF, at +0.5 / -0.5.
  // Splits xs into xo/xi
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y + pad) * wp + x + pad;

      const nx = xs[j];
      const ny = ys[j];
      if (!nx && !ny) continue;

      const nn = Math.sqrt(sqr(nx) + sqr(ny));

      const sx = Math.abs(nx / nn) - 0.5 > 0 ? Math.sign(nx) : 0;
      const sy = Math.abs(ny / nn) - 0.5 > 0 ? Math.sign(ny) : 0;

      const c = getData(x, y);
      const d = getData(x + sx, y + sy);
      const s = Math.sign(d - c);

      let dlo = nn + 0.4999 * s;
      let dli = nn - 0.4999 * s;

      dli /= nn;
      dlo /= nn;

      xo[j] = nx * dlo;
      yo[j] = ny * dlo;
      xi[j] = nx * dli;
      yi[j] = ny * dli;
    }
  }
};

// Snap distance targets to neighboring target points, if closer.
// Makes the SDF more correct and less XY vs YX dependent, but has only little effect on final contours.
export const relaxSubpixelOffsets = (
  stage: SDFStage,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad: number,
) => {
  const wp = w + pad * 2;

  const { xo, yo, xi, yi } = stage;

  // Check if target's neighbor is closer
  const check = (
    xs: Float32Array,
    ys: Float32Array,
    x: number,
    y: number,
    dx: number,
    dy: number,
    tx: number,
    ty: number,
    d: number,
    j: number,
  ) => {
    const k = (y + pad) * wp + x + pad;

    const dx2 = dx + xs[k];
    const dy2 = dy + ys[k];
    const d2 = Math.sqrt(sqr(dx2) + sqr(dy2));

    if (d2 < d) {
      xs[j] = dx2;
      ys[j] = dy2;
      return d2;
    }
    return d;
  };

  const relax = (xs: Float32Array, ys: Float32Array) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = (y + pad) * wp + x + pad;

        const dx = xs[j];
        const dy = ys[j];
        if (!dx && !dy) continue;

        // Step towards target minus 0.5px to find contour
        let d = Math.sqrt(dx * dx + dy * dy);
        const ds = (d - 0.5) / d;
        const tx = x + dx * ds;
        const ty = y + dy * ds;

        // Check area around array index
        const ix = Math.round(tx);
        const iy = Math.round(ty);
        d = check(xs, ys, ix + 1, iy, ix - x + 1, iy - y, tx, ty, d, j);
        d = check(xs, ys, ix - 1, iy, ix - x - 1, iy - y, tx, ty, d, j);
        d = check(xs, ys, ix, iy + 1, ix - x, iy - y + 1, tx, ty, d, j);
        d = check(xs, ys, ix, iy - 1, ix - x, iy - y - 1, tx, ty, d, j);
      }
    }
  };

  relax(xo, yo);
  relax(xi, yi);
};

// Paint original color data into final RGBA (emoji)
export const paintIntoRGB = (
  image: Uint8Array,
  color: Uint8ClampedArray,
  xs: Float32Array,
  ys: Float32Array,
  w: number,
  h: number,
  pad: number,
) => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;

  {
    let i = 0;
    let o = (pad + pad * wp) * 4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (color[i + 3]) {
          image[o] = color[i];
          image[o + 1] = color[i + 1];
          image[o + 2] = color[i + 2];
          image[o + 3] = color[i + 3];
        }
        i += 4;
        o += 4;
      }
      o += pad * 8;
    }
  }

  {
    let i = 0,
      j = 0;
    for (let y = 0; y < hp; y++) {
      for (let x = 0; x < wp; x++) {
        if (image[i + 3] === 0) {
          const dx = xs[j];
          const dy = ys[j];
          const ox = Math.round(x + dx);
          const oy = Math.round(y + dy);

          const k = (ox + oy * wp) * 4;
          image[i] = image[k];
          image[i + 1] = image[k + 1];
          image[i + 2] = image[k + 2];
          image[i + 3] = 1;
        }
        i += 4;
        j++;
      }
    }
  }
};

// Paint sdf alpha data into final RGBA (emoji)
export const paintIntoAlpha = (
  image: Uint8Array,
  alpha: Uint8Array | number[],
  w: number,
  h: number,
  pad: number,
) => {
  const wp = w + pad * 2;

  let i = 0;
  let o = (pad + pad * wp) * 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      image[o + 3] = alpha[i];
      i++;
      o += 4;
    }
    o += pad * 8;
  }
};

// 1D subpixel distance transform
export const esdt1d = (
  mask: Float32Array,
  xs: Float32Array,
  ys: Float32Array,
  offset: number,
  stride: number,
  length: number,
  f: Float32Array, // Squared distance
  z: Float32Array, // Voronoi threshold
  b: Float32Array, // Subpixel offset parallel
  t: Float32Array, // Subpixel offset perpendicular
  v: Uint16Array, // Array index
) => {
  v[0] = 0;
  b[0] = xs[offset];
  t[0] = ys[offset];
  z[0] = -INF;
  z[1] = INF;
  f[0] = mask[offset] ? INF : ys[offset] * ys[offset];

  // Scan along array and build list of critical minima
  let k = 0;
  for (let q = 1, s = 0; q < length; q++) {
    const o = offset + q * stride;

    // Perpendicular
    const dx = xs[o];
    const dy = ys[o];
    const fq = (f[q] = mask[o] ? INF : dy * dy);
    t[q] = dy;

    // Parallel
    const qs = q + dx;
    const q2 = qs * qs;
    b[q] = qs;

    // Remove any minima eclipsed by this one
    do {
      const r = v[k];
      const rs = b[r];

      const r2 = rs * rs;
      s = (fq - f[r] + q2 - r2) / (qs - rs) / 2;
    } while (s <= z[k] && --k > -1);

    // Add to minima list
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  // Resample array based on critical minima
  for (let q = 0, k = 0; q < length; q++) {
    // Skip eclipsed minima
    while (z[k + 1] < q) k++;

    const r = v[k];
    const rs = b[r];
    const dy = t[r];

    // Distance from integer index to subpixel location of minimum
    const rq = rs - q;

    const o = offset + q * stride;
    xs[o] = rq;
    ys[o] = dy;

    // Mark cell as having propagated
    if (r !== q) mask[o] = 0;
  }
};

// 2D subpixel distance transform by unconed
// extended from Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
export const esdt = (
  mask: Float32Array,
  xs: Float32Array,
  ys: Float32Array,
  w: number,
  h: number,
  f: Float32Array,
  z: Float32Array,
  b: Float32Array,
  t: Float32Array,
  v: Uint16Array,
  half: number = 0,
) => {
  if (half !== 1)
    for (let x = 0; x < w; ++x) esdt1d(mask, ys, xs, x, w, h, f, z, b, t, v);
  if (half !== 2)
    for (let y = 0; y < h; ++y)
      esdt1d(mask, xs, ys, y * w, 1, w, f, z, b, t, v);
};

// Helper for testing
export const resolveSDF = (
  xo: Float32Array | number[],
  yo: Float32Array | number[],
  xi: Float32Array | number[],
  yi: Float32Array | number[],
) => {
  const np = xo.length;
  const out = [] as number[];
  for (let i = 0; i < np; ++i) {
    const outer = Math.max(0, Math.sqrt(sqr(xo[i]) + sqr(yo[i])) - 0.5);
    const inner = Math.max(0, Math.sqrt(sqr(xi[i]) + sqr(yi[i])) - 0.5);
    const d = outer >= inner ? outer : -inner;
    out[i] = d;
  }
  return out;
};

// Convert grayscale or color glyph to SDF using subpixel distance transform
export const glyphToESDT = (
  data: Uint8ClampedArray,
  color: Uint8ClampedArray | null,
  w: number,
  h: number,
  pad: number = 4,
  radius: number = 3,
  cutoff: number = 0.25,
  preprocess: boolean = false,
  postprocess: boolean = false,
): {
  data: Uint8Array;
  width: number;
  height: number;
} => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;
  const np = wp * hp;
  const sp = Math.max(wp, hp);

  const stage = getSDFStage(sp);
  const { outer, inner, xo, yo, xi, yi, f, z, b, t, v } = stage;

  paintIntoStage(stage, data, w, h, pad);
  paintSubpixelOffsets(stage, data, w, h, pad, preprocess);

  esdt(outer, xo, yo, wp, hp, f, z, b, t, v);
  esdt(inner, xi, yi, wp, hp, f, z, b, t, v);
  if (postprocess) relaxSubpixelOffsets(stage, data, w, h, pad);

  const alpha = new Uint8Array(np);
  for (let i = 0; i < np; ++i) {
    const outer = Math.max(0, Math.sqrt(sqr(xo[i]) + sqr(yo[i])) - 0.5);
    const inner = Math.max(0, Math.sqrt(sqr(xi[i]) + sqr(yi[i])) - 0.5);
    const d = outer >= inner ? outer : -inner;
    alpha[i] = Math.max(
      0,
      Math.min(255, Math.round(255 - 255 * (d / radius + cutoff))),
    );
  }

  if (!preprocess)
    paintIntoDistanceField(alpha, data, w, h, pad, radius, cutoff);

  if (color) {
    const out = new Uint8Array(np * 4);
    paintIntoRGB(out, color, xo, yo, w, h, pad);
    paintIntoAlpha(out, alpha, wp, hp, 0);
    return { data: out, width: wp, height: hp };
  } else {
    return glyphToRGBA(alpha, wp, hp);
  }
};
