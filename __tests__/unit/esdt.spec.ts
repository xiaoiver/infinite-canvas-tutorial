/**
 * @see https://gitlab.com/unconed/use.gpu/-/blob/master/packages/glyph/src/sdf-esdt.test.ts
 */
import {
  esdt1d,
  glyphToESDT,
} from '../../packages/core/src/utils/glyph/sdf-esdt';
import { sqr } from '../../packages/core/src/utils/glyph/tiny-sdf';

const resolveSDF = (
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

describe('edt', () => {
  it('edt1d pixel aligned', () => {
    const I = 1e10;
    const mask = [0, 0, 0, I, I, I, I, I, I, 0, 0, 0] as any;
    const xs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const ys = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = mask.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(mask, xs, ys, offset, stride, length, f, z, b, t, v);
    expect(xs).toEqual([0, 0, 0, -1, -2, -3, 3, 2, 1, 0, 0, 0]);
  });

  it('edt1d fractional left', () => {
    const I = 1e10;
    const F = -0.25;
    const mask = [0, 0, 0, I, I, I, I, I, I, 0, 0, 0] as any;
    const xs = [0, 0, F, 0, 0, 0, 0, 0, 0, F, 0, 0] as any;
    const ys = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = mask.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(mask, xs, ys, offset, stride, length, f, z, b, t, v);

    expect(xs).toEqual([
      0,
      0,
      F,
      -1 + F,
      -2 + F,
      -3 + F,
      3 + F,
      2 + F,
      1 + F,
      F,
      0,
      0,
    ]);
  });

  it('edt1d signed pixel aligned', () => {
    const I = 1e10;
    const outer = [I, I, I, 0, 0, 0, 0, 0, 0, I, I, I] as any;
    const inner = [0, 0, 0, 0, I, I, I, I, 0, 0, 0, 0] as any;

    const P = 0.5;
    const N = -0.5;
    const xo = [0, 0, 0, P, 0, 0, 0, 0, N, 0, 0, 0] as any;
    const yo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xi = [0, 0, 0, N, 0, 0, 0, 0, P, 0, 0, 0] as any;
    const yi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = outer.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(outer, xo, yo, offset, stride, length, f, z, b, t, v);
    esdt1d(inner, xi, yi, offset, stride, length, f, z, b, t, v);

    const ds = resolveSDF(xo, yo, xi, yi);
    expect(ds).toEqual([3, 2, 1, 0, -1, -2, -2, -1, 0, 1, 2, 3]);
  });

  it('edt1d signed fractional left-left', () => {
    const I = 1e10;
    const outer = [I, I, I, 0, 0, 0, 0, 0, 0, I, I, I] as any;
    const inner = [0, 0, 0, 0, I, I, I, I, 0, 0, 0, 0] as any;

    const F = -0.25;
    const P = 0.5 + F;
    const N = -0.5 + F;

    const xo = [0, 0, 0, P, 0, 0, 0, 0, N, 0, 0, 0] as any;
    const yo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xi = [0, 0, 0, N, 0, 0, 0, 0, P, 0, 0, 0] as any;
    const yi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = outer.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(outer, xo, yo, offset, stride, length, f, z, b, t, v);
    esdt1d(inner, xi, yi, offset, stride, length, f, z, b, t, v);

    const ds = resolveSDF(xo, yo, xi, yi);
    expect(ds).toEqual([
      3 - P,
      2 - P,
      1 - P,
      -P,
      -1 - P,
      -2 - P,
      -2 + P,
      -1 + P,
      +P,
      1 + P,
      2 + P,
      3 + P,
    ]);
  });

  it('edt1d signed fractional right-right', () => {
    const I = 1e10;
    const outer = [I, I, I, 0, 0, 0, 0, 0, 0, I, I, I] as any;
    const inner = [0, 0, 0, 0, I, I, I, I, 0, 0, 0, 0] as any;

    const F = 0.25;
    const P = 0.5 + F;
    const N = -0.5 + F;

    const xo = [0, 0, 0, P, 0, 0, 0, 0, N, 0, 0, 0] as any;
    const yo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xi = [0, 0, 0, N, 0, 0, 0, 0, P, 0, 0, 0] as any;
    const yi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = outer.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(outer, xo, yo, offset, stride, length, f, z, b, t, v);
    esdt1d(inner, xi, yi, offset, stride, length, f, z, b, t, v);

    const ds = resolveSDF(xo, yo, xi, yi);
    expect(ds).toEqual([
      3 - N,
      2 - N,
      1 - N,
      -N,
      -1 - N,
      -2 - N,
      -2 + N,
      -1 + N,
      +N,
      1 + N,
      2 + N,
      3 + N,
    ]);
  });

  it('edt1d signed fractional left-right', () => {
    const I = 1e10;
    const outer = [I, I, I, 0, 0, 0, 0, 0, 0, I, I, I] as any;
    const inner = [0, 0, 0, 0, I, I, I, I, 0, 0, 0, 0] as any;

    const F = 0.25;
    const PL = 0.5 - F;
    const NL = -0.5 - F;
    const PR = 0.5 + F;
    const NR = -0.5 + F;

    const xo = [0, 0, 0, PL, 0, 0, 0, 0, NR, 0, 0, 0] as any;
    const yo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xi = [0, 0, 0, NL, 0, 0, 0, 0, PR, 0, 0, 0] as any;
    const yi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = outer.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(outer, xo, yo, offset, stride, length, f, z, b, t, v);
    esdt1d(inner, xi, yi, offset, stride, length, f, z, b, t, v);

    const ds = resolveSDF(xo, yo, xi, yi);
    expect(ds).toEqual([
      3 - PL,
      2 - PL,
      1 - PL,
      -PL,
      -1 - PL,
      -2 - PL,
      -2 + NR,
      -1 + NR,
      +NR,
      1 + NR,
      2 + NR,
      3 + NR,
    ]);
  });

  it('edt1d signed fractional right-left', () => {
    const I = 1e10;
    const outer = [I, I, I, 0, 0, 0, 0, 0, 0, I, I, I] as any;
    const inner = [0, 0, 0, 0, I, I, I, I, 0, 0, 0, 0] as any;

    const F = -0.25;
    const PL = 0.5 - F;
    const NL = -0.5 - F;
    const PR = 0.5 + F;
    const NR = -0.5 + F;

    const xo = [0, 0, 0, PL, 0, 0, 0, 0, NR, 0, 0, 0] as any;
    const yo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xi = [0, 0, 0, NL, 0, 0, 0, 0, PR, 0, 0, 0] as any;
    const yi = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = outer.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(outer, xo, yo, offset, stride, length, f, z, b, t, v);
    esdt1d(inner, xi, yi, offset, stride, length, f, z, b, t, v);

    const ds = resolveSDF(xo, yo, xi, yi);
    expect(ds).toEqual([
      3 - NL,
      2 - NL,
      1 - NL,
      -NL,
      -1 - NL,
      -2 - NL,
      -2 + PR,
      -1 + PR,
      +PR,
      1 + PR,
      2 + PR,
      3 + PR,
    ]);
  });

  it('edt2d transverse pixel aligned', () => {
    const mask = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const xs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as any;
    const ys = [0, 0, 0, -1.1, -2, -2, -2, -2, -1.1, 0, 0, 0] as any;

    const offset = 0;
    const stride = 1;
    const length = mask.length;

    const f = [] as any;
    const z = [] as any;
    const b = [] as any;
    const t = [] as any;
    const v = [] as any;

    esdt1d(mask, xs, ys, offset, stride, length, f, z, b, t, v);

    expect(xs).toEqual([0, 0, 0, -1, -1, 0, 0, 1, 1, 0, 0, 0]);
    expect(ys).toEqual([0, 0, 0, 0, -1.1, -2, -2, -1.1, 0, 0, 0, 0]);
  });

  it('glyphToESDT handles checker-board patterns correctly', () => {
    const w = 8;
    const h = 4;
    const image = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const imageUint8 = Uint8ClampedArray.from(image.flat().map((x) => x * 255));
    expect(imageUint8.length).toEqual(w * h);

    const pad = 1;
    const result = glyphToESDT(imageUint8, null, 8, 4, pad, 4, 0.5);
    expect(result.width).toEqual(w + pad * 2);
    expect(result.height).toEqual(h + pad * 2);

    const withoutPadding: number[][] = [];
    for (let y = 0; y < h; y++) {
      const slice: number[] = [];
      withoutPadding.push(slice);

      for (let x = 0; x < w; x++) {
        const i = x + pad + (y + pad) * result.width;
        slice.push(result.data[i * 4]);
      }
    }

    const expected = [
      [69, 96, 69, 24, 0, 0, 0, 0],
      [96, 141, 114, 69, 17, 0, 0, 0],
      [69, 114, 141, 96, 32, 0, 0, 0],
      [24, 69, 96, 69, 17, 0, 0, 0],
    ];

    expect(withoutPadding).toEqual(expected);
  });
});
