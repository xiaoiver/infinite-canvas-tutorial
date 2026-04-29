/**
 * Rasterize vector solid-fill geometry to a canvas for post filters (liquid-metal, etc.),
 * matching paper-style “real” alpha contours instead of a full bounding rect.
 */
import type { Entity } from '@lastolivegames/becsy';
import {
  Circle,
  ComputedRough,
  ComputedTextMetrics,
  Ellipse,
  Path,
  Rect,
  Rough,
  Text,
  VectorNetwork,
} from '../components';
import { buildVectorNetworkFillMesh } from './vector-network-fill';

export interface SolidShapeRasterBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 2D context for bitmap + Path2D fill (Canvas or Offscreen). */
type BitmapCanvas2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

function setWorldToCanvasTransform(
  ctx: BitmapCanvas2D,
  bounds: SolidShapeRasterBounds,
  tw: number,
  th: number,
): void {
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  if (bw <= 1e-8 || bh <= 1e-8) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }
  ctx.setTransform(
    tw / bw,
    0,
    0,
    th / bh,
    (-bounds.minX * tw) / bw,
    (-bounds.minY * th) / bh,
  );
}

function drawFillPathContours(
  ctx: BitmapCanvas2D,
  loops: [number, number][][],
): void {
  if (loops.length === 0) {
    return;
  }
  ctx.beginPath();
  for (const loop of loops) {
    if (loop.length < 2) {
      continue;
    }
    const p0 = loop[0]!;
    ctx.moveTo(p0[0]!, p0[1]!);
    for (let i = 1; i < loop.length; i++) {
      const p = loop[i]!;
      ctx.lineTo(p[0]!, p[1]!);
    }
    ctx.closePath();
  }
  ctx.fill('evenodd');
}

/**
 * System-font text: rasterize with the same `ComputedTextMetrics.lineMetrics` / anchor
 * convention as `measureText` + `SDFText` (bitmapFont is not supported here).
 */
function tryDrawSolidFillTextMask(
  ctx: BitmapCanvas2D,
  shape: Entity,
  fillRgba: string,
): boolean {
  if (!shape.has(Text) || !shape.has(ComputedTextMetrics)) {
    return false;
  }
  const text = shape.read(Text);
  if (text.bitmapFont) {
    return false;
  }
  const metrics = shape.read(ComputedTextMetrics);
  const { lines, lineMetrics, font } = metrics;
  if (!font || !lines?.length || !lineMetrics?.length) {
    return false;
  }

  ctx.fillStyle = fillRgba;
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = text.textAlign;
  if ('fontKerning' in ctx) {
    try {
      (ctx as CanvasRenderingContext2D & { fontKerning: string }).fontKerning =
        text.fontKerning ? 'normal' : 'none';
    } catch {
      // ignore
    }
  }
  const ls = text.letterSpacing;
  if (ls && 'letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${ls}px`;
  }

  const { anchorX, anchorY } = text;
  for (let i = 0; i < lines.length; i++) {
    const m = lineMetrics[i];
    if (!m) {
      continue;
    }
    ctx.fillText(lines[i] ?? '', anchorX, anchorY + m.y);
  }
  return true;
}

/**
 * Paints the solid fill shape in world space into an `tw`×`th` bitmap whose pixel (0,0)
 * maps to bounds min corner — same convention as {@link Mesh} `u_FillUVRect` when using
 * {@link ComputedBounds} geometry bounds.
 */
export function createSolidFillMaskRasterForFilter(
  shape: Entity,
  fillRgba: string,
  bounds: SolidShapeRasterBounds,
  tw: number,
  th: number,
): HTMLCanvasElement | OffscreenCanvas {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    canvas = c;
  } else {
    canvas = new OffscreenCanvas(tw, th);
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error('Canvas 2D required for solid fill + filter mask');
  }

  ctx.clearRect(0, 0, tw, th);
  ctx.fillStyle = fillRgba;
  setWorldToCanvasTransform(ctx, bounds, tw, th);

  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  if (bw <= 1e-8 || bh <= 1e-8) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = fillRgba;
    ctx.fillRect(0, 0, tw, th);
    return canvas;
  }

  if (tryDrawSolidFillTextMask(ctx, shape, fillRgba)) {
    return canvas;
  }

  if (
    shape.has(Rough) &&
    shape.has(ComputedRough) &&
    shape.hasSomeOf(Circle, Ellipse, Rect, Path)
  ) {
    const { fillPathPoints } = shape.read(ComputedRough);
    if (fillPathPoints.length > 0) {
      drawFillPathContours(ctx, fillPathPoints);
      return canvas;
    }
  }

  if (shape.has(VectorNetwork)) {
    const { vertices, segments, regions } = shape.read(VectorNetwork);
    const { points, indices } = buildVectorNetworkFillMesh(
      vertices,
      segments,
      regions,
    );
    if (indices.length >= 3) {
      for (let t = 0; t < indices.length; t += 3) {
        const a = indices[t]! * 2;
        const b = indices[t + 1]! * 2;
        const c = indices[t + 2]! * 2;
        ctx.beginPath();
        ctx.moveTo(points[a]!, points[a + 1]!);
        ctx.lineTo(points[b]!, points[b + 1]!);
        ctx.lineTo(points[c]!, points[c + 1]!);
        ctx.closePath();
        ctx.fill();
      }
      return canvas;
    }
  }

  if (shape.has(Path)) {
    const path = shape.read(Path);
    if (path.d && String(path.d).trim().length > 0) {
      try {
        const p2d = new Path2D(path.d);
        ctx.fill(p2d, path.fillRule ?? 'nonzero');
        return canvas;
      } catch {
        // fall through
      }
    }
  }

  if (shape.has(Ellipse)) {
    const { cx, cy, rx, ry } = shape.read(Ellipse);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }

  if (shape.has(Circle)) {
    const { cx, cy, r } = shape.read(Circle);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }

  if (shape.has(Rect)) {
    const { x, y, width, height, cornerRadius } = shape.read(Rect);
    const rx = x + width;
    const ry = y + height;
    const left = Math.min(x, rx);
    const top = Math.min(y, ry);
    const w = Math.abs(width);
    const h = Math.abs(height);
    const r = Math.max(0, cornerRadius);
    ctx.beginPath();
    if (r > 0 && 'roundRect' in ctx && typeof ctx.roundRect === 'function') {
      ctx.roundRect(left, top, w, h, r);
    } else {
      ctx.rect(left, top, w, h);
    }
    ctx.fill();
    return canvas;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = fillRgba;
  ctx.fillRect(0, 0, tw, th);
  return canvas;
}
