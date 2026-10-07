import type { ComputedTextMetrics, Text } from '../../components/geometry/Text';
import { DOMAdapter } from '../../environment';
import { BASE_FONT_WIDTH } from './glyph-atlas';
import { layoutGlyphs } from './text-path';

export interface TextPathGlyph {
  glyph: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One layout for GPU quads, bounds, picking, raster effects and SVG export. */
export function measureTextPath(
  style: Partial<Text>,
  metrics: Partial<ComputedTextMetrics>,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rasterStyle: { font: string; baselineOffset: number },
): TextPathGlyph[] {
  const { bitmapFont, bitmapFontKerning = true, fontSize = 12 } = style;
  const scale =
    Number(fontSize) / (bitmapFont?.baseMeasurementFontSize ?? BASE_FONT_WIDTH);
  context.save();
  // Match TinySDF's fixed raster size, independent of the display font size.
  context.font = rasterStyle.font;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  if ('letterSpacing' in context) context.letterSpacing = '0px';
  const measured = new Map<
    string,
    Omit<TextPathGlyph, 'glyph' | 'x' | 'y' | 'rotation'>
  >();
  try {
    const glyphs = layoutGlyphs(
      metrics.lines ?? [],
      (line) => DOMAdapter.get().splitGraphemes(line),
      (char, previous) => {
        const data = bitmapFont?.chars[char];
        let ink = measured.get(char);
        if (!ink) {
          if (bitmapFont) {
            ink = {
              width: (data?.xAdvance ?? 0) * scale,
              left: (data?.xOffset ?? 0) * scale,
              top: ((data?.yOffset ?? 0) - bitmapFont.lineHeight) * scale,
              right: ((data?.xOffset ?? 0) + (data?.rect.w ?? 0)) * scale,
              bottom:
                ((data?.yOffset ?? 0) -
                  bitmapFont.lineHeight +
                  (data?.rect.h ?? 0)) *
                scale,
            };
          } else {
            const m = context.measureText(char);
            ink = {
              width: m.width * scale,
              left: Math.floor(-m.actualBoundingBoxLeft) * scale,
              top: -Math.ceil(m.actualBoundingBoxAscent) * scale,
              right: Math.ceil(m.actualBoundingBoxRight) * scale,
              bottom: Math.ceil(m.actualBoundingBoxDescent) * scale,
            };
          }
          measured.set(char, ink);
        }
        return {
          ...ink,
          kerning:
            bitmapFontKerning && previous
              ? (data?.kerning[previous] ?? 0) * scale
              : 0,
        };
      },
      {
        lineHeight: metrics.lineHeight ?? Number(fontSize),
        letterSpacing: style.letterSpacing ?? 0,
        textAlign: style.textAlign ?? 'start',
        dy: rasterStyle.baselineOffset,
        path: style.path,
        side: style.side,
        startOffset: style.startOffset,
        pathOffset: style.pathOffset,
      },
    );
    return glyphs.map((glyph) => ({
      ...glyph,
      x: glyph.x + (style.anchorX ?? 0),
      y: glyph.y + (style.anchorY ?? 0),
    }));
  } finally {
    context.restore();
  }
}

/** Ink rectangles in baseline coordinates, before the entity transform. */
export function textPathGlyphCorners(glyph: TextPathGlyph) {
  const cos = Math.cos(glyph.rotation),
    sin = Math.sin(glyph.rotation);
  return [
    [glyph.left, glyph.top],
    [glyph.right, glyph.top],
    [glyph.right, glyph.bottom],
    [glyph.left, glyph.bottom],
  ].map(([x, y]) => ({
    x: glyph.x + cos * x - sin * y,
    y: glyph.y + sin * x + cos * y,
  }));
}

export function hitTestTextPath(
  glyphs: TextPathGlyph[],
  x: number,
  y: number,
  padding = 0,
) {
  return glyphs.some((glyph) => {
    if (glyph.right <= glyph.left || glyph.bottom <= glyph.top) return false;
    const cos = Math.cos(glyph.rotation),
      sin = Math.sin(glyph.rotation);
    const dx = x - glyph.x,
      dy = y - glyph.y;
    const localX = cos * dx + sin * dy,
      localY = -sin * dx + cos * dy;
    return (
      localX >= glyph.left - padding &&
      localX <= glyph.right + padding &&
      localY >= glyph.top - padding &&
      localY <= glyph.bottom + padding
    );
  });
}
