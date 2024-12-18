import type { GlyphPosition } from './glyph-atlas';
import type { Point } from './alpha-image';
import type { PositionedGlyph } from './glyph-manager';
import { BASE_FONT_BUFFER, SDF_SCALE } from './glyph-manager';

export type SymbolQuad = {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
  tex: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  glyphOffset: [number, number];
};

/**
 * Create the quads used for rendering a text label.
 */
export function getGlyphQuads(
  positionedGlyphs: PositionedGlyph[],
  positions: Record<string, Record<number, GlyphPosition>>,
): SymbolQuad[] {
  const quads: SymbolQuad[] = [];

  for (let k = 0; k < positionedGlyphs.length; k++) {
    const positionedGlyph = positionedGlyphs[k];
    const glyphPositions = positions[positionedGlyph.fontStack];
    const glyph = glyphPositions && glyphPositions[positionedGlyph.glyph];
    if (!glyph) continue;

    const { rect } = glyph;
    if (!rect) continue;

    // The rects have an addditional buffer that is not included in their size.
    const glyphPadding = 1.0;
    // const glyphPadding = 0.0;
    const rectBuffer = BASE_FONT_BUFFER / SDF_SCALE + glyphPadding;

    const halfAdvance = (glyph.metrics.advance * positionedGlyph.scale) / 2;

    const glyphOffset: [number, number] = [0, 0];

    const builtInOffset = [positionedGlyph.x + halfAdvance, positionedGlyph.y];

    const pixelRatio = 1;
    const paddedWidth =
      (rect.w * positionedGlyph.scale) / (pixelRatio * SDF_SCALE);
    const paddedHeight =
      (rect.h * positionedGlyph.scale) / (pixelRatio * SDF_SCALE);

    const x1 =
      (glyph.metrics.left - rectBuffer) * positionedGlyph.scale -
      halfAdvance +
      builtInOffset[0];
    const y1 =
      (-glyph.metrics.top - rectBuffer) * positionedGlyph.scale +
      builtInOffset[1];
    const x2 = x1 + paddedWidth;
    const y2 = y1 + paddedHeight;

    const tl = { x: x1, y: y1 };
    const tr = { x: x2, y: y1 };
    const bl = { x: x1, y: y2 };
    const br = { x: x2, y: y2 };

    quads.push({ tl, tr, bl, br, tex: rect, glyphOffset });
  }

  return quads;
}
