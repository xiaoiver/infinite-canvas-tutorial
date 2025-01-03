/**
 * @see https://github.com/mapbox/tiny-sdf
 * @see https://gitlab.com/unconed/use.gpu/-/blob/master/packages/glyph/src/sdf.ts
 * @see https://acko.net/blog/subpixel-distance-transform/
 */

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

const INF = 1e20;

export class TinySDF {
  ctx: CanvasRenderingContext2D;
  size: number;
  buffer: number;
  cutoff: number;
  radius: number;
  outer: Float32Array;
  inner: Float32Array;
  f: Float32Array;
  z: Float32Array;
  v: Uint16Array;
  xo: Float32Array;
  yo: Float32Array;
  xi: Float32Array;
  yi: Float32Array;
  b: Float32Array;
  t: Float32Array;

  constructor({
    fontSize = 24,
    buffer = 3,
    radius = 8,
    cutoff = 0.25,
    fontFamily = 'sans-serif',
    fontWeight = 'normal',
    fontStyle = 'normal',
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
    ctx.fillStyle = 'black';

    const n = size * size;
    // temporary arrays for the distance transform
    this.outer = new Float32Array(n);
    this.inner = new Float32Array(n);

    this.xo = new Float32Array(n);
    this.yo = new Float32Array(n);
    this.xi = new Float32Array(n);
    this.yi = new Float32Array(n);

    this.f = new Float32Array(size);
    this.z = new Float32Array(size + 1);
    this.b = new Float32Array(size);
    this.t = new Float32Array(size);
    this.v = new Uint16Array(size);
  }

  _createCanvas(size: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  }

  draw(char: string) {
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

    const pad = this.buffer;
    const wp = w + pad * 2;
    const hp = h + pad * 2;
    const np = wp * hp;
    // const sp = Math.max(wp, hp);

    const out = new Uint8Array(np);

    const glyph = {
      data: out,
      width: wp,
      height: hp,
      glyphWidth: w,
      glyphHeight: h,
      glyphTop,
      glyphLeft,
      glyphAdvance,
    };
    if (w === 0 || h === 0) {
      glyph.data = new Uint8Array(np * 4);
      return glyph;
    }

    const { ctx, buffer, inner, outer } = this;
    ctx.clearRect(buffer, buffer, w, h);
    ctx.fillText(char, buffer, buffer + glyphTop);
    const imageData = ctx.getImageData(buffer, buffer, w, h);
    const data = imageData.data;

    outer.fill(INF, 0, np);
    inner.fill(0, 0, np);

    const getData = (x: number, y: number) =>
      (data[4 * (y * w + x) + 3] ?? 0) / 255;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = getData(x, y);
        const i = (y + pad) * wp + x + pad;

        if (a >= 254 / 255) {
          // Fix for bad rasterizer rounding
          data[4 * (y * w + x) + 3] = 255;

          outer[i] = 0;
          inner[i] = INF;
        } else if (a > 0) {
          const d = 0.5 - a;
          outer[i] = d > 0 ? d * d : 0;
          inner[i] = d < 0 ? d * d : 0;
        }
      }
    }

    edt(outer, 0, 0, wp, hp, wp, this.f, this.z, this.v);
    edt(inner, pad, pad, w, h, wp, this.f, this.z, this.v);

    for (let i = 0; i < np; i++) {
      const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
      out[i] = Math.max(
        0,
        Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))),
      );
    }

    glyph.data = glyphToRGBA(out, w, h, pad).data;

    return glyph;
  }
}

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(
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
) {
  if (half !== 2)
    for (let y = y0; y < y0 + height; y++)
      edt1d(data, y * gridWidth + x0, 1, width, f, z, v);
  if (half !== 1)
    for (let x = x0; x < x0 + width; x++)
      edt1d(data, y0 * gridWidth + x, gridWidth, height, f, z, v);
}

// 1D squared distance transform
function edt1d(
  grid: Float32Array,
  offset: number,
  stride: number,
  length: number,
  f: Float32Array,
  z: Float32Array,
  v: Uint16Array,
) {
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
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
