import {
  glyphToEDT,
} from '../../packages/ecs/src/utils/glyph/sdf-edt';

describe('glyphToEDT', () => {
  it('should process simple glyph', () => {
    // Create a simple 2x2 glyph with alpha values
    const data = new Uint8ClampedArray([
      0, 0, 0, 0,      // transparent
      0, 0, 0, 255,    // opaque
      0, 0, 0, 255,    // opaque
      0, 0, 0, 0,      // transparent
    ]);
    const w = 2;
    const h = 2;

    const result = glyphToEDT(data, w, h, 1, 3, 0.25);

    expect(result.width).toBe(4); // w + pad * 2
    expect(result.height).toBe(4); // h + pad * 2
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBe(4 * 4 * 4); // RGBA
  });

  it('should use default padding and radius', () => {
    const data = new Uint8ClampedArray(4 * 4).fill(128);
    const w = 2;
    const h = 2;

    const result = glyphToEDT(data, w, h);
    expect(result.width).toBe(2 + 4 * 2); // default pad = 4
    expect(result.height).toBe(2 + 4 * 2);
  });

  it('should handle fully transparent glyph', () => {
    const data = new Uint8ClampedArray(4).fill(0); // 1x1 transparent
    const w = 1;
    const h = 1;

    const result = glyphToEDT(data, w, h, 2, 3, 0.25);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(result.data.length).toBe(5 * 5 * 4); // (1 + 2*2) * (1 + 2*2) * 4
  });

  it('should handle fully opaque glyph', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255]); // 1x1 opaque
    const w = 1;
    const h = 1;

    const result = glyphToEDT(data, w, h, 2, 3, 0.25);
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('should produce valid RGBA output', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 128,  0, 0, 0, 128,
      0, 0, 0, 128,  0, 0, 0, 128,
    ]);
    const w = 2;
    const h = 2;

    const result = glyphToEDT(data, w, h, 1, 3, 0.25);

    // Check that output is valid RGBA
    for (let i = 0; i < result.data.length; i += 4) {
      // RGB should be equal (grayscale SDF)
      expect(result.data[i]).toBe(result.data[i + 1]);
      expect(result.data[i + 1]).toBe(result.data[i + 2]);
      // Alpha can be anything
    }
  });
});
