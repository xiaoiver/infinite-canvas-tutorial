import { parsePath } from '../curve/shape-path';
import type { Curve } from '../curve/curve';

/** Arc-length sampling without connecting separate SVG subpaths. */
export class TextPathGeometry {
  readonly length: number;
  readonly closed: boolean;
  private segments: { curve: Curve; start: number; end: number }[] = [];

  constructor(d: string) {
    const paths = parsePath(d).subPaths.filter((path) => path.curves.length);
    let length = 0;
    for (const path of paths) {
      // parsePath marks Z, but does not add its closing edge to the curve list.
      if (path.autoClose) path.closePath();
      for (const curve of path.curves) {
        const size = curve.getLength();
        if (!Number.isFinite(size) || size <= 0) continue;
        this.segments.push({ curve, start: length, end: length + size });
        length += size;
      }
    }
    this.length = length;
    const first = this.segments[0]?.curve.getPoint(0);
    const last = this.segments[this.segments.length - 1]?.curve.getPoint(1);
    this.closed =
      paths.length === 1 &&
      !!first &&
      !!last &&
      (paths[0].autoClose ||
        Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6);
  }

  sample(distance: number) {
    if (!this.length || !Number.isFinite(distance)) return;
    if (this.closed)
      distance = ((distance % this.length) + this.length) % this.length;
    else if (distance < 0 || distance > this.length) return;
    let low = 0,
      high = this.segments.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (distance < this.segments[mid].end) high = mid;
      else low = mid + 1;
    }
    const { curve, start, end } = this.segments[low];
    const u = Math.max(0, Math.min(1, (distance - start) / (end - start)));
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    return {
      x: point[0],
      y: point[1],
      rotation: Math.atan2(tangent[1], tangent[0]),
    };
  }
}

export interface GlyphLayoutOptions {
  lineHeight: number;
  textAlign: CanvasTextAlign;
  letterSpacing: number;
  dx?: number;
  dy?: number;
  path?: string;
  side?: 'left' | 'right';
  startOffset?: number;
  pathOffset?: number;
}

/** Shared baseline origins for rendering, bounds and exported glyphs. */
export function layoutGlyphs<T extends { width: number; kerning?: number }>(
  lines: string[],
  split: (line: string) => string[],
  measure: (char: string, previous: string | undefined) => T,
  options: GlyphLayoutOptions,
): (T & { glyph: string; x: number; y: number; rotation: number })[] {
  const {
    textAlign,
    letterSpacing,
    lineHeight,
    dx = 0,
    dy = 0,
    startOffset = 0,
    pathOffset = 0,
    side = 'left',
  } = options;
  const justify =
    textAlign === 'center'
      ? 0.5
      : textAlign === 'end' || textAlign === 'right'
      ? 1
      : 0;
  const path = options.path ? new TextPathGeometry(options.path) : undefined;
  if (path && !path.length) return [];
  const output: (T & {
    glyph: string;
    x: number;
    y: number;
    rotation: number;
  })[] = [];
  lines.forEach((line, lineIndex) => {
    let cursor = 0;
    let previous: string;
    const glyphs = split(line).map((char) => {
      const metrics = measure(char, previous);
      cursor += metrics.kerning ?? 0;
      const glyph = {
        ...metrics,
        glyph: char,
        x: cursor,
        y: dy + lineIndex * lineHeight,
        rotation: 0,
      };
      cursor += metrics.width + letterSpacing;
      previous = char;
      return glyph;
    });
    const lineWidth = glyphs.length ? cursor - letterSpacing : 0;
    for (const glyph of glyphs) {
      if (!path) {
        glyph.x += dx - justify * lineWidth;
      } else {
        // Track the advance-box center, not the padded atlas rectangle.
        const center = glyph.x + glyph.width / 2;
        // Closed contours permit a seam crossing, but never multiple overlapping laps.
        if (path.closed && (center < 0 || center > path.length)) continue;
        const distance =
          startOffset + justify * (path.length - lineWidth) + center;
        const frame = path.sample(
          side === 'right' ? path.length - distance : distance,
        );
        if (!frame) continue;
        const rotation = frame.rotation + (side === 'right' ? Math.PI : 0);
        const cos = Math.cos(rotation),
          sin = Math.sin(rotation);
        const normalOffset = glyph.y + pathOffset;
        glyph.x = frame.x - (cos * glyph.width) / 2 - sin * normalOffset + dx;
        glyph.y = frame.y - (sin * glyph.width) / 2 + cos * normalOffset;
        glyph.rotation = rotation;
      }
      output.push(glyph);
    }
  });
  return output;
}
