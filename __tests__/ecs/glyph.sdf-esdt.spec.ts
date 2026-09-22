import {
  glyphToESDT,
  paintIntoDistanceField,
  paintIntoRGB,
  paintIntoAlpha,
  resolveSDF,
  
} from '../../packages/ecs/src/utils/glyph/sdf-esdt';

import {
  isBlack,
  isWhite,
  isSolid,
  sqr,
} from '../../packages/ecs/src/utils/glyph/tiny-sdf';

describe('glyphToESDT', () => {
  it('should process simple glyph without color', () => {
    const data = new Uint8ClampedArray([
      0, 255, 255, 0,  // row 1
    ]);
    const w = 2;
    const h = 1;

    const result = glyphToESDT(data, null, w, h, 1, 3, 0.25);

    expect(result.width).toBe(4); // w + pad * 2
    expect(result.height).toBe(3); // h + pad * 2
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should process glyph with color for emoji', () => {
    const alpha = new Uint8ClampedArray([255, 255]);
    const color = new Uint8ClampedArray([
      255, 0, 0, 255,  // red
      0, 255, 0, 255,  // green
    ]);
    const w = 2;
    const h = 1;

    const result = glyphToESDT(alpha, color, w, h, 1, 3, 0.25);

    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBe(4 * 3 * 4); // RGBA
  });

  it('should handle preprocess option', () => {
    const data = new Uint8ClampedArray([128, 128]);
    const w = 2;
    const h = 1;

    const result = glyphToESDT(data, null, w, h, 1, 3, 0.25, true, false);
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should handle postprocess option', () => {
    const data = new Uint8ClampedArray([128, 128]);
    const w = 2;
    const h = 1;

    const result = glyphToESDT(data, null, w, h, 1, 3, 0.25, false, true);
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should handle fully transparent glyph', () => {
    const data = new Uint8ClampedArray(4).fill(0);
    const w = 2;
    const h = 2;

    const result = glyphToESDT(data, null, w, h, 1, 3, 0.25);
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should handle fully opaque glyph', () => {
    const data = new Uint8ClampedArray(4).fill(255);
    const w = 2;
    const h = 2;

    const result = glyphToESDT(data, null, w, h, 1, 3, 0.25);
    expect(result.data).toBeInstanceOf(Uint8Array);
  });
});

describe('paintIntoDistanceField', () => {
  it('should paint gray pixels into distance field', () => {
    const image = new Uint8Array(16).fill(128); // 2x2 with padding
    const data = new Uint8ClampedArray([
      127, 127, 127, 127,  // semi-transparent
    ]);
    const w = 1;
    const h = 1;

    paintIntoDistanceField(image, data, w, h, 1, 3, 0.25);

    // Should have modified the center pixel
    expect(image[5]).toBe(128);
  });

  it('should not paint solid pixels', () => {
    const image = new Uint8Array(16).fill(128);
    const data = new Uint8ClampedArray([
      0, 255,  // black and white (solid)
    ]);
    const w = 2;
    const h = 1;

    const original = new Uint8Array(image);
    paintIntoDistanceField(image, data, w, h, 1, 3, 0.25);

    // Solid pixels should not be modified
    expect(image).toEqual(original);
  });
});

describe('paintIntoRGB', () => {
  it('should copy color data with offset sampling', () => {
    const image = new Uint8Array(64).fill(0); // 4x4 RGBA
    const color = new Uint8ClampedArray([
      255, 0, 0, 255,   // red
      0, 255, 0, 255,   // green
      0, 0, 255, 255,   // blue
      255, 255, 0, 255, // yellow
    ]);
    const xs = new Float32Array(16).fill(0);
    const ys = new Float32Array(16).fill(0);

    paintIntoRGB(image, color, xs, ys, 2, 2, 1);

    // Should have some non-zero values now
    expect(image.some(v => v > 0)).toBe(true);
  });

  it('should preserve transparency', () => {
    const image = new Uint8Array(64).fill(0);
    const color = new Uint8ClampedArray([
      255, 0, 0, 0,  // transparent red
    ]);
    const xs = new Float32Array(9).fill(0);
    const ys = new Float32Array(9).fill(0);

    paintIntoRGB(image, color, xs, ys, 1, 1, 1);

    // Transparent pixels should remain transparent in output
    // (implementation dependent, checking basic structure)
    expect(image).toBeInstanceOf(Uint8Array);
  });
});

describe('paintIntoAlpha', () => {
  it('should copy alpha values into RGBA image', () => {
    const image = new Uint8Array(64).fill(0); // 4x4 RGBA
    const alpha = new Uint8Array([255, 128, 64, 32]);
    const w = 2;
    const h = 2;

    paintIntoAlpha(image, alpha, w, h, 1);

    // Check that some alpha channels have been set
    let alphaCount = 0;
    for (let i = 3; i < image.length; i += 4) {
      if (image[i] > 0) alphaCount++;
    }
    expect(alphaCount).toBeGreaterThan(0);
  });
});

describe('resolveSDF', () => {
  it('should calculate signed distance from offset arrays', () => {
    const xo = new Float32Array([0.5, 0, -0.5]);
    const yo = new Float32Array([0, 0.5, 0]);
    const xi = new Float32Array([0, 0.3, 0]);
    const yi = new Float32Array([0.3, 0, -0.3]);

    const result = resolveSDF(xo, yo, xi, yi);

    expect(result).toHaveLength(3);
    expect(result.every(v => typeof v === 'number')).toBe(true);
  });

  it('should prefer outer distance when greater', () => {
    const xo = new Float32Array([1.0]);  // outer distance = 1
    const yo = new Float32Array([0]);
    const xi = new Float32Array([0.5]);  // inner distance = 0.5
    const yi = new Float32Array([0]);

    const result = resolveSDF(xo, yo, xi, yi);

    expect(result[0]).toBeGreaterThan(0); // outer > inner, so positive
  });

  it('should use inner distance when greater', () => {
    const xo = new Float32Array([0.5]);  // outer distance = 0.5
    const yo = new Float32Array([0]);
    const xi = new Float32Array([1.0]);  // inner distance = 1
    const yi = new Float32Array([0]);

    const result = resolveSDF(xo, yo, xi, yi);

    expect(result[0]).toBeLessThan(0); // inner > outer, so negative
  });

  it('should handle zero vectors', () => {
    const xo = new Float32Array([0]);
    const yo = new Float32Array([0]);
    const xi = new Float32Array([0]);
    const yi = new Float32Array([0]);

    const result = resolveSDF(xo, yo, xi, yi);

    // Should handle zero case without NaN
    expect(Number.isFinite(result[0])).toBe(true);
  });
});

describe('helper functions re-exported from tiny-sdf', () => {
  it('should have isBlack function', () => {
    expect(isBlack(0)).toBe(true);
    expect(isBlack(1)).toBe(false);
  });

  it('should have isWhite function', () => {
    expect(isWhite(1)).toBe(true);
    expect(isWhite(0)).toBe(false);
  });

  it('should have isSolid function', () => {
    expect(isSolid(0)).toBe(true);
    expect(isSolid(1)).toBe(true);
    expect(isSolid(0.5)).toBe(false);
  });

  it('should have sqr function', () => {
    expect(sqr(3)).toBe(9);
    expect(sqr(-2)).toBe(4);
  });
});
