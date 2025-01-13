/**
 * @see https://github.com/mapbox/tiny-sdf
 * @see https://gitlab.com/unconed/use.gpu/-/blob/master/packages/glyph/src/sdf.ts
 * @see https://acko.net/blog/subpixel-distance-transform/
 */
import { glyphToEDT } from './sdf-edt';
import { glyphToESDT } from './sdf-esdt';

// Convert grayscale glyph to rgba
export const glyphToRGBA = (
  data: Uint8Array,
  w: number,
  h: number,
  pad: number = 0,
) => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;
  const out = new Uint8Array(wp * hp * 4);

  for (let i = 0; i < data.length; i++) {
    out[i * 4] = data[i];
    out[i * 4 + 1] = data[i];
    out[i * 4 + 2] = data[i];
    out[i * 4 + 3] = data[i];
  }
  return { data: out, width: wp, height: hp };
};

export const INF = 1e20;

export type SDFStage = {
  outer: Float32Array;
  inner: Float32Array;

  xo: Float32Array;
  yo: Float32Array;
  xi: Float32Array;
  yi: Float32Array;

  f: Float32Array;
  z: Float32Array;
  b: Float32Array;
  t: Float32Array;
  v: Uint16Array;

  size: number;
};

export const getSDFStage = (size: number) => {
  const n = size * size;

  const outer = new Float32Array(n);
  const inner = new Float32Array(n);

  const xo = new Float32Array(n);
  const yo = new Float32Array(n);
  const xi = new Float32Array(n);
  const yi = new Float32Array(n);

  const f = new Float32Array(size);
  const z = new Float32Array(size + 1);
  const b = new Float32Array(size);
  const t = new Float32Array(size);
  const v = new Uint16Array(size);

  return { outer, inner, xo, yo, xi, yi, f, z, b, t, v, size };
};

export class TinySDF {
  ctx: CanvasRenderingContext2D;
  size: number;
  buffer: number;
  cutoff: number;
  radius: number;

  constructor({
    fontSize = 24,
    buffer = 3,
    radius = 8,
    cutoff = 0.25,
    fontFamily = 'sans-serif',
    fontWeight = 'normal',
    fontStyle = 'normal',
    fill = 'black',
  } = {}) {
    this.buffer = buffer;
    this.cutoff = cutoff;
    this.radius = radius;

    // make the canvas size big enough to both have the specified buffer around the glyph
    // for "halo", and account for some glyphs possibly being larger than their font size
    const size = (this.size = fontSize + buffer * 4);

    const canvas = this._createCanvas(size);
    const ctx = (this.ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }));
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; // Necessary so that RTL text doesn't have different alignment
    ctx.fillStyle = fill; // If plain text mixed with emoji, we should use fill color instead of 'black'
  }

  _createCanvas(size: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  }

  draw(char: string, esdt = false, color = false) {
    const {
      width: glyphAdvance,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
    } = this.ctx.measureText(char);

    // The integer/pixel part of the top alignment is encoded in metrics.glyphTop
    // The remainder is implicitly encoded in the rasterization
    const glyphTop = Math.ceil(actualBoundingBoxAscent);
    const glyphLeft = 0;

    // If the glyph overflows the canvas size, it will be clipped at the bottom/right
    const w = Math.max(
      0,
      Math.min(
        this.size - this.buffer,
        Math.ceil(actualBoundingBoxRight - actualBoundingBoxLeft),
      ),
    );
    const h = Math.min(
      this.size - this.buffer,
      glyphTop + Math.ceil(actualBoundingBoxDescent),
    );

    if (w === 0 || h === 0) {
      return {
        data: new Uint8Array(0),
        width: 0,
        height: 0,
        glyphWidth: 0,
        glyphHeight: 0,
        glyphTop: 0,
        glyphLeft: 0,
        glyphAdvance: 0,
      };
    }

    const pad = this.buffer;

    const { ctx, buffer } = this;
    ctx.clearRect(buffer, buffer, w, h);
    ctx.fillText(char, buffer, buffer + glyphTop);
    const imageData = ctx.getImageData(buffer, buffer, w, h);

    let data: Uint8Array;
    let width: number;
    let height: number;

    if (esdt) {
      ({ data, width, height } = glyphToESDT(
        imageData.data,
        color ? imageData.data : null,
        w,
        h,
        pad,
        this.radius,
        this.cutoff,
        // true,
        // true,
      ));
    } else {
      ({ data, width, height } = glyphToEDT(
        imageData.data,
        w,
        h,
        pad,
        this.radius,
        this.cutoff,
      ));
    }

    return {
      data,
      width,
      height,
      glyphWidth: w,
      glyphHeight: h,
      glyphTop,
      glyphLeft,
      glyphAdvance,
    };
  }
}

// 1D squared distance transform
export const edt1d = (
  grid: Float32Array,
  offset: number,
  stride: number,
  length: number,
  f: Float32Array,
  z: Float32Array,
  v: Uint16Array,
) => {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];

  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];

    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);

    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    const fr = f[r];
    grid[offset + q * stride] = fr + qr * qr;
  }
};

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
export const edt = (
  data: Float32Array,
  x0: number,
  y0: number,
  width: number,
  height: number,
  gridWidth: number,
  f: Float32Array,
  z: Float32Array,
  v: Uint16Array,
  half?: number,
) => {
  if (half !== 2)
    for (let y = y0; y < y0 + height; y++)
      edt1d(data, y * gridWidth + x0, 1, width, f, z, v);
  if (half !== 1)
    for (let x = x0; x < x0 + width; x++)
      edt1d(data, y0 * gridWidth + x, gridWidth, height, f, z, v);
};

// Helpers
export const isBlack = (x: number) => !x;
export const isWhite = (x: number) => x === 1;
// export const isBlack = (x: number) => x === 1;
// export const isWhite = (x: number) => !x;
export const isSolid = (x: number) => !(x && 1 - x);

export const sqr = (x: number) => x * x;
export const seq = (n: number, start: number = 0, step: number = 1) =>
  Array.from({ length: n }).map((_, i) => start + i * step);
