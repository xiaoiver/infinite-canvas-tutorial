import type { TextAttributes } from '../../shapes/Text';
import { DOMAdapter } from '../../environment/adapter';
import {
  getOrCreateCanvasTextMetrics,
  yOffsetFromTextBaseline,
  type TextMetrics,
} from '../font';
import { layoutGlyphs } from './text-path';

/** Measure at the same 48px raster size as TinySDF, then scale to document units. */
export function measureTextPath(
  style: Partial<TextAttributes>,
  metrics: TextMetrics,
) {
  const { bitmapFont, bitmapFontKerning = true, fontSize = 12 } = style;
  const scale = Number(fontSize) / (bitmapFont?.baseMeasurementFontSize ?? 48);
  const context = getOrCreateCanvasTextMetrics()
    .getCanvas()
    .getContext('2d') as CanvasRenderingContext2D;
  const font = context.font;
  const baseline = context.textBaseline;
  const align = context.textAlign;
  const measured = new Map<
    string,
    { width: number; left: number; top: number; right: number; bottom: number }
  >();
  context.font = `${style.fontStyle ?? 'normal'} ${
    style.fontWeight ?? 400
  } 48px ${style.fontFamily ?? 'sans-serif'}`;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  try {
    return layoutGlyphs(
      metrics.lines,
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
              left: -m.actualBoundingBoxLeft * scale,
              top: -Math.ceil(m.actualBoundingBoxAscent) * scale,
              right: m.actualBoundingBoxRight * scale,
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
        lineHeight: metrics.lineHeight,
        letterSpacing: style.letterSpacing ?? 0,
        textAlign: style.textAlign ?? 'start',
        dy:
          yOffsetFromTextBaseline(
            style.textBaseline ?? 'alphabetic',
            metrics.fontMetrics,
          ) + metrics.fontMetrics.fontBoundingBoxAscent || 0,
        path: style.path,
        side: style.side,
        startOffset: style.startOffset,
        pathOffset: style.pathOffset,
      },
    );
  } finally {
    context.font = font;
    context.textBaseline = baseline;
    context.textAlign = align;
  }
}
