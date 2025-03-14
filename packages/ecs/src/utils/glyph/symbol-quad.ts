import { glyphPadding, type GlyphPosition } from './glyph-atlas';
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
};

/**
 * Create the quads used for rendering a text label.
 */
export function getGlyphQuads(
  positionedGlyphs: PositionedGlyph[],
  positions: Record<string, Record<string, GlyphPosition>>,
  useMSDF: boolean,
): SymbolQuad[] {
  const quads: SymbolQuad[] = [];

  for (let k = 0; k < positionedGlyphs.length; k++) {
    const positionedGlyph = positionedGlyphs[k];
    const glyphPositions = positions[positionedGlyph.fontStack];
    const glyph = glyphPositions && glyphPositions[positionedGlyph.glyph];
    if (!glyph) continue;

    const { rect, metrics } = glyph;
    if (!rect) continue;

    const { x, y, scale } = positionedGlyph;

    // The rects have an addditional buffer that is not included in their size.
    const rectBuffer = useMSDF
      ? 0
      : BASE_FONT_BUFFER / SDF_SCALE + glyphPadding;

    const pixelRatio = 1;
    const paddedWidth =
      (rect.w * scale) / (pixelRatio * (useMSDF ? 1 : SDF_SCALE));
    const paddedHeight =
      (rect.h * scale) / (pixelRatio * (useMSDF ? 1 : SDF_SCALE));

    const x1 = (metrics.left - rectBuffer) * positionedGlyph.scale + x;
    const y1 = (-metrics.top - rectBuffer) * positionedGlyph.scale + y;
    const x2 = x1 + paddedWidth;
    const y2 = y1 + paddedHeight;

    const tl = { x: x1, y: y1 };
    const tr = { x: x2, y: y1 };
    const bl = { x: x1, y: y2 };
    const br = { x: x2, y: y2 };

    quads.push({ tl, tr, bl, br, tex: rect });
  }

  return quads;
}
