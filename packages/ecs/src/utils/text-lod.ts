import { Mat3, Text, ComputedTextMetrics } from '../components';

export type TextLODLevel = 'full' | 'text-proxy';

/** Project the local em axis through world and camera into CSS pixels. No DPR. */
export function projectedFontHeight(
  fontSize: number,
  world: Mat3,
  viewProjection: Mat3,
  cssWidth: number,
  cssHeight: number,
): number {
  const m = viewProjection;
  // Reject projective and singular transforms; this slice supports affine 2D.
  for (const t of [world, m]) {
    if (
      ![t.m00, t.m01, t.m02, t.m10, t.m11, t.m12, t.m20, t.m21, t.m22].every(
        Number.isFinite,
      ) ||
      t.m02 !== 0 ||
      t.m12 !== 0 ||
      t.m22 !== 1 ||
      Math.abs(t.m00 * t.m11 - t.m01 * t.m10) < 1e-12
    )
      return NaN;
  }
  if (
    ![fontSize, cssWidth, cssHeight].every((v) => Number.isFinite(v) && v > 0)
  )
    return NaN;
  const x = m.m00 * world.m10 + m.m10 * world.m11;
  const y = m.m01 * world.m10 + m.m11 * world.m11;
  return Math.hypot((x * cssWidth) / 2, (y * cssHeight) / 2) * fontSize;
}

export function chooseTextLOD(
  height: number,
  previous: TextLODLevel,
  forcedFull = false,
): TextLODLevel {
  if (forcedFull || !Number.isFinite(height) || height <= 0) return 'full';
  if (previous === 'text-proxy') return height > 8 ? 'full' : 'text-proxy';
  return height < 6 ? 'text-proxy' : 'full';
}

/** Same anchor, alignment and baseline convention as SDFText's glyph layout. */
export function textProxyLines(
  text: Readonly<Text>,
  metrics: Readonly<ComputedTextMetrics>,
) {
  const size = metrics.fontMetrics?.fontSize;
  const ascent = metrics.fontMetrics?.fontBoundingBoxAscent;
  const align =
    text.textAlign === 'center'
      ? 0.5
      : text.textAlign === 'right' || text.textAlign === 'end'
      ? 1
      : 0;
  return metrics.lineMetrics
    .map(({ width }, i) => ({
      x: (metrics.width - width) * align,
      y: (metrics.lineHeight - size) / 2 + i * metrics.lineHeight + size * 0.3,
      width,
      height: Math.min(size * 0.4, ascent),
    }))
    .filter((line, i) => line.width > 0 && metrics.lines[i].trim().length > 0);
}
