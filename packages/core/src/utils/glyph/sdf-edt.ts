import { edt, getSDFStage, glyphToRGBA, INF, SDFStage } from './tiny-sdf';

// Paint glyph data into stage
export const paintIntoStage = (
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

  const getData = (x: number, y: number) =>
    (data[4 * (y * w + x) + 3] ?? 0) / 255;
  // const getData = (x: number, y: number) => (data[y * w + x] ?? 0) / 255;

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
};

// Convert grayscale glyph to SDF using pixel-based distance transform
export const glyphToEDT = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pad: number = 4,
  radius: number = 3,
  cutoff: number = 0.25,
) => {
  const wp = w + pad * 2;
  const hp = h + pad * 2;
  const np = wp * hp;
  const sp = Math.max(wp, hp);

  const out = new Uint8Array(np);

  const stage = getSDFStage(sp);
  paintIntoStage(stage, data, w, h, pad);

  const { outer, inner, f, z, v } = stage;

  edt(outer, 0, 0, wp, hp, wp, f, z, v);
  edt(inner, pad, pad, w, h, wp, f, z, v);

  for (let i = 0; i < np; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = Math.max(
      0,
      Math.min(255, Math.round(255 - 255 * (d / radius + cutoff))),
    );
  }

  return glyphToRGBA(out, wp, hp);
};
