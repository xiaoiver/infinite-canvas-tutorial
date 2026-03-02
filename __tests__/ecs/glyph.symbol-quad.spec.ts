import { getGlyphQuads } from '../../packages/ecs/src/utils/glyph/symbol-quad';
import type { PositionedGlyph } from '../../packages/ecs/src/utils/glyph/glyph-manager';
import type { GlyphPosition } from '../../packages/ecs/src/utils/glyph/glyph-atlas';

describe('getGlyphQuads', () => {
  it('should return empty array for empty glyphs', () => {
    const result = getGlyphQuads([], {}, false);
    expect(result).toEqual([]);
  });

  it('should skip glyphs without positions', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 0, y: 0, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {};

    const result = getGlyphQuads(glyphs, positions, false);
    expect(result).toEqual([]);
  });

  it('should skip glyphs without rect', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 0, y: 0, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 10 },
          rect: null as any,
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    expect(result).toEqual([]);
  });

  it('should create quad for single glyph', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 0, y: 0, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 10 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    expect(result).toHaveLength(1);

    const quad = result[0];
    expect(quad.tl).toBeDefined();
    expect(quad.tr).toBeDefined();
    expect(quad.bl).toBeDefined();
    expect(quad.br).toBeDefined();
    expect(quad.tex).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it('should position quad based on glyph metrics', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 10, y: 20, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 2, top: 8, advance: 12 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    const quad = result[0];

    // tl.x = (left - rectBuffer) * scale + x
    expect(quad.tl.x).toBeGreaterThanOrEqual(8); // Should be offset by glyph x position
    expect(quad.tl.y).toBeLessThan(20); // Should be offset by -top
  });

  it('should scale quad dimensions', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 0, y: 0, scale: 2 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 10 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      },
    };

    const resultSDF = getGlyphQuads(glyphs, positions, false);
    const resultMSDF = getGlyphQuads(glyphs, positions, true);

    // SDF and MSDF should have different sizes due to different scaling
    expect(resultSDF[0].tr.x - resultSDF[0].tl.x).not.toBe(resultMSDF[0].tr.x - resultMSDF[0].tl.x);
  });

  it('should create multiple quads for multiple glyphs', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 0, y: 0, scale: 1 },
      { fontStack: 'sans', glyph: 'B', x: 12, y: 0, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 12 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
        B: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 12 },
          rect: { x: 10, y: 0, w: 10, h: 10 },
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    expect(result).toHaveLength(2);

    // Second glyph should be positioned to the right
    expect(result[1].tl.x).toBeGreaterThan(result[0].tl.x);
  });

  it('should handle different font stacks', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'serif', glyph: 'A', x: 0, y: 0, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 8, advance: 10 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    expect(result).toEqual([]); // No matching font stack
  });

  it('should form valid quad with correct corner relationships', () => {
    const glyphs: PositionedGlyph[] = [
      { fontStack: 'sans', glyph: 'A', x: 10, y: 20, scale: 1 },
    ];
    const positions: Record<string, Record<string, GlyphPosition>> = {
      sans: {
        A: {
          metrics: { width: 10, height: 10, left: 0, top: 10, advance: 10 },
          rect: { x: 0, y: 0, w: 10, h: 10 },
        },
      },
    };

    const result = getGlyphQuads(glyphs, positions, false);
    const quad = result[0];

    // Validate quad geometry
    expect(quad.tl.x).toBe(quad.bl.x); // Left edge
    expect(quad.tr.x).toBe(quad.br.x); // Right edge
    expect(quad.tl.y).toBe(quad.tr.y); // Top edge
    expect(quad.bl.y).toBe(quad.br.y); // Bottom edge

    // Width should match
    expect(quad.tr.x - quad.tl.x).toBe(quad.br.x - quad.bl.x);

    // Height should match
    expect(quad.bl.y - quad.tl.y).toBe(quad.br.y - quad.tr.y);
  });
});
