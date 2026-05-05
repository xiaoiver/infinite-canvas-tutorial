/**
 * Rasterize vector solid-fill geometry to a canvas for post filters (liquid-metal, etc.),
 * matching paper-style “real” alpha contours instead of a full bounding rect.
 */
import type { Entity } from '@lastolivegames/becsy';
import {
  Circle,
  ComputedBounds,
  ComputedRough,
  ComputedTextMetrics,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  IconFontEllipseStrokeRasterPlaceholder,
  Opacity,
  Line,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
  StrokeGradient,
  Text,
  VectorNetwork,
} from '../components';
import { buildVectorNetworkFillMesh } from './vector-network-fill';
import { parseColor } from './color';
import { getRasterFilterValueForShape, hasRasterPostEffects } from './filter';
import {
  computeLinearGradient,
  computeRadialGradient,
  computeConicGradient,
  type Gradient,
  type MeshGradient,
  isMeshGradientGradient,
} from './gradient';
import { yOffsetFromTextBaseline } from '../systems/ComputeTextMetrics';

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

export function setWorldToCanvasTransform(
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
 * System-font text: 与 `Text.getGeometryBounds` / `SDFText` 字形盒顶对齐；
 * 水平位置仍用 `lineMetrics[i].x`（含 textAlign 偏移）。勿用 `anchorY + m.y` 配 `textBaseline: top`：
 * `measureText` 的 `offsetY`（如 alphabetic 时 `-height`）与几何顶边公式不一致，会导致渐变遮罩整体上下错位。
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
  const { lines, lineMetrics, font, fontMetrics, lineHeight: lineHeightStep } =
    metrics;
  if (!font || !lines?.length || !lineMetrics?.length || !fontMetrics) {
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
  const lhVal = text.lineHeight || fontMetrics.fontSize;
  const lineTop0 =
    anchorY +
    yOffsetFromTextBaseline(text.textBaseline, fontMetrics) -
    (lhVal - fontMetrics.fontSize) / 2;

  for (let i = 0; i < lines.length; i++) {
    const m = lineMetrics[i];
    if (!m) {
      continue;
    }
    ctx.fillText(lines[i] ?? '', anchorX + m.x, lineTop0 + i * lineHeightStep);
  }
  return true;
}

/**
 * 将已有像素内容（mesh/CSS 渐变叠层）按字形 alpha 裁剪，供 Text + filter 离屏纹理上传。
 */
export function applyTextGlyphMaskToFilterRasterCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  shape: Entity,
  bounds: SolidShapeRasterBounds,
  tw: number,
  th: number,
): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    return;
  }
  ctx.globalCompositeOperation = 'destination-in';
  setWorldToCanvasTransform(ctx, bounds, tw, th);
  tryDrawSolidFillTextMask(ctx, shape, 'rgba(255,255,255,1)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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

function rgbaFromParsed(
  rgb: ReturnType<typeof parseColor>,
  opacityMul: number,
): string {
  const a = Math.max(0, Math.min(1, rgb.opacity * opacityMul));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

/**
 * Geometry AABB for SDF primitives (stroke excluded), for filter raster + UV alignment.
 */
export function getSdfGeometryBoundsForFilter(
  shape: Entity,
): SolidShapeRasterBounds {
  if (shape.has(ComputedBounds)) {
    const g = shape.read(ComputedBounds).geometryBounds;
    const gw = g.maxX - g.minX;
    const gh = g.maxY - g.minY;
    if (gw >= 0.5 && gh >= 0.5) {
      return { minX: g.minX, minY: g.minY, maxX: g.maxX, maxY: g.maxY };
    }
  }
  if (shape.has(Rect)) {
    const b = Rect.getGeometryBounds(shape.read(Rect));
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  }
  if (shape.has(Ellipse)) {
    const b = Ellipse.getGeometryBounds(shape.read(Ellipse));
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  }
  if (shape.has(Circle)) {
    const b = Circle.getGeometryBounds(shape.read(Circle));
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  }
  return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

/**
 * Expand geometry bounds so a centered canvas stroke (`lineWidth` = stroke width) is not clipped.
 */
export function expandBoundsForCenterCanvasStroke(
  bounds: SolidShapeRasterBounds,
  strokeWidth: number,
): SolidShapeRasterBounds {
  const h = strokeWidth * 0.5;
  return {
    minX: bounds.minX - h,
    minY: bounds.minY - h,
    maxX: bounds.maxX + h,
    maxY: bounds.maxY + h,
  };
}

/**
 * AABB for {@link createStrokeSilhouetteRasterForFilter} and polyline `u_StrokeUVRect` — must be
 * identical. Prefer {@link ComputedBounds.renderBounds} (includes linecap/linejoin/miter expansion
 * per `Polyline`/`Path`/`Line` helpers); otherwise geometry + half stroke.
 */
export function getStrokeSilhouetteRasterBounds(
  shape: Entity,
  geometryFallback: () => SolidShapeRasterBounds,
): SolidShapeRasterBounds {
  if (shape.has(ComputedBounds)) {
    const r = shape.read(ComputedBounds).renderBounds;
    const rw = r.maxX - r.minX;
    const rh = r.maxY - r.minY;
    if (rw >= 0.5 && rh >= 0.5) {
      return {
        minX: r.minX,
        minY: r.minY,
        maxX: r.maxX,
        maxY: r.maxY,
      };
    }
  }
  const gb = geometryFallback();
  const sw = shape.has(Stroke) ? shape.read(Stroke).width : 0;
  return expandBoundsForCenterCanvasStroke(gb, sw);
}

/**
 * White stroke on transparent background in world space → texture for spatial raster filters
 * (liquid-metal, etc.) on iconfont child strokes. Matches Canvas `center` stroke semantics.
 */
export function createStrokeSilhouetteRasterForFilter(
  shape: Entity,
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
    throw new Error('Canvas 2D required for stroke silhouette filter raster');
  }
  ctx.clearRect(0, 0, tw, th);
  setWorldToCanvasTransform(ctx, bounds, tw, th);

  const stroke = shape.read(Stroke);
  ctx.lineWidth = stroke.width;
  ctx.lineJoin = stroke.linejoin;
  ctx.lineCap = stroke.linecap;
  ctx.miterLimit = stroke.miterlimit;
  ctx.strokeStyle = 'rgba(255,255,255,1)';

  if (shape.has(Path)) {
    const { d } = shape.read(Path);
    if (d && String(d).trim()) {
      try {
        ctx.stroke(new Path2D(String(d)));
      } catch {
        // ignore invalid d
      }
    }
    return canvas;
  }
  if (shape.has(Line)) {
    const { x1, y1, x2, y2 } = shape.read(Line);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return canvas;
  }
  if (shape.has(Polyline)) {
    const pts = shape.read(Polyline).points;
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i]![0], pts[i]![1]);
      }
      ctx.stroke();
    }
    return canvas;
  }
  if (shape.has(Ellipse)) {
    const { cx, cy, rx, ry } = shape.read(Ellipse);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    return canvas;
  }
  if (shape.has(Circle)) {
    const { cx, cy, r } = shape.read(Circle);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    ctx.stroke();
    return canvas;
  }

  return canvas;
}

/**
 * When true, SDF rasterizes fill + stroke to a bitmap and runs raster filter effects on that
 * (liquid-metal, etc.). Requires center stroke alignment and basic Circle/Ellipse/Rect (no dash).
 */
export function shouldBakeStrokeIntoRasterFilterTexture(shape: Entity): boolean {
  const fv = getRasterFilterValueForShape(shape);
  if (!fv || !hasRasterPostEffects(fv)) {
    return false;
  }
  if (!shape.hasSomeOf(Rect, Ellipse, Circle)) {
    return false;
  }
  if (
    shape.has(FillGradient) ||
    shape.has(FillPattern) ||
    shape.has(FillImage) ||
    shape.has(FillTexture)
  ) {
    return false;
  }
  if (shape.has(Rough)) {
    return false;
  }
  if (!shape.has(Stroke) || shape.has(StrokeGradient)) {
    return false;
  }
  const st = shape.read(Stroke);
  if (st.width <= 0 || st.alignment !== 'center') {
    return false;
  }
  const [da, db] = st.dasharray;
  if (da > 0 && db > 0) {
    return false;
  }
  return true;
}

/**
 * Rasterize solid fill (if any) + center stroke for Circle/Ellipse/Rect into a `tw`×`th` canvas.
 * `bounds` should include half-stroke padding on each side (see {@link expandBoundsForCenterCanvasStroke}).
 */
export function createFillAndStrokeRgbaRasterForFilter(
  shape: Entity,
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
    throw new Error('Canvas 2D required for fill+stroke filter raster');
  }

  ctx.clearRect(0, 0, tw, th);
  setWorldToCanvasTransform(ctx, bounds, tw, th);

  const { fillOpacity, strokeOpacity } = shape.has(Opacity)
    ? shape.read(Opacity)
    : { fillOpacity: 1, strokeOpacity: 1 };

  const fillStr = shape.has(FillSolid) ? shape.read(FillSolid).value : 'none';
  const fillRgb = parseColor(
    fillStr && fillStr !== 'none' ? fillStr : 'transparent',
  );
  const fillRgba = rgbaFromParsed(fillRgb, fillOpacity);

  const stroke = shape.read(Stroke);
  const strokeRgb = parseColor(
    stroke.color && stroke.color !== 'none' ? stroke.color : 'transparent',
  );
  const strokeRgba = rgbaFromParsed(strokeRgb, strokeOpacity);

  ctx.lineWidth = stroke.width;
  ctx.lineJoin = stroke.linejoin;
  ctx.lineCap = stroke.linecap;
  ctx.miterLimit = stroke.miterlimit;

  const skipDiskFill =
    shape.has(IconFontEllipseStrokeRasterPlaceholder);
  const drawFill =
    fillStr !== 'none' &&
    fillRgb.opacity * fillOpacity > 1e-8 &&
    !skipDiskFill;

  if (shape.has(Ellipse)) {
    const { cx, cy, rx, ry } = shape.read(Ellipse);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    if (drawFill) {
      ctx.fillStyle = fillRgba;
      ctx.fill();
    }
    ctx.strokeStyle = strokeRgba;
    ctx.stroke();
    return canvas;
  }

  if (shape.has(Circle)) {
    const { cx, cy, r } = shape.read(Circle);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    if (drawFill) {
      ctx.fillStyle = fillRgba;
      ctx.fill();
    }
    ctx.strokeStyle = strokeRgba;
    ctx.stroke();
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
    if (drawFill) {
      ctx.fillStyle = fillRgba;
      ctx.fill();
    }
    ctx.strokeStyle = strokeRgba;
    ctx.stroke();
    return canvas;
  }

  return canvas;
}

function applyStepsToCanvasGradient(
  gradient: CanvasGradient,
  steps: {
    offset: { type: string; value: number };
    color: string;
  }[],
): void {
  for (const step of steps) {
    const t =
      step.offset.type === '%'
        ? step.offset.value / 100
        : Math.max(0, Math.min(1, step.offset.value));
    gradient.addColorStop(t, step.color);
  }
}

/**
 * 在布局坐标系下生成与 {@link TexturePool.getOrCreateGradientInternal} 一致的 Canvas 渐变，
 * 用于文字等多边形裁剪前的铺满矩形绘制。
 */
export function createCanvasGradientForBounds(
  ctx: BitmapCanvas2D,
  g: Exclude<Gradient, MeshGradient>,
  bounds: SolidShapeRasterBounds,
): CanvasGradient | null {
  const min: [number, number] = [bounds.minX, bounds.minY];
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  if (w <= 1e-8 || h <= 1e-8) {
    return null;
  }

  if (g.type === 'linear-gradient') {
    const { x1, y1, x2, y2 } = computeLinearGradient(min, w, h, g.angle);
    const cg = ctx.createLinearGradient(x1, y1, x2, y2);
    applyStepsToCanvasGradient(cg, g.steps);
    return cg;
  }
  if (g.type === 'radial-gradient') {
    const { x, y, r } = computeRadialGradient(min, w, h, g.cx, g.cy, g.size);
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    applyStepsToCanvasGradient(cg, g.steps);
    return cg;
  }
  if (g.type === 'conic-gradient') {
    const { x, y } = computeConicGradient(min, w, h, g.cx, g.cy);
    const cg = ctx.createConicGradient(
      (g.angle * Math.PI) / 180,
      x,
      y,
    );
    applyStepsToCanvasGradient(cg, g.steps);
    return cg;
  }
  return null;
}

/** 与 TexturePool 一致：从下至上叠多层 CSS 渐变（铺满几何盒）。 */
export function fillCssGradientsStackedInBounds(
  ctx: BitmapCanvas2D,
  gradients: Gradient[],
  bounds: SolidShapeRasterBounds,
): void {
  const gw = bounds.maxX - bounds.minX;
  const gh = bounds.maxY - bounds.minY;
  for (const g of gradients) {
    if (isMeshGradientGradient(g)) {
      continue;
    }
    const cg = createCanvasGradientForBounds(ctx, g, bounds);
    if (!cg) {
      continue;
    }
    ctx.fillStyle = cg;
    ctx.fillRect(bounds.minX, bounds.minY, gw, gh);
  }
}

/**
 * 系统字体文字：CSS 渐变铺满盒 → 再用字形 alpha 裁剪（与纯色 {@link createSolidFillMaskRaster} 同源）。
 */
export function createGradientFillTextRasterForFilter(
  shape: Entity,
  bounds: SolidShapeRasterBounds,
  tw: number,
  th: number,
  cssGradients: Gradient[],
  fillOpacityMul: number,
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
    throw new Error('Canvas 2D required for gradient text + filter');
  }
  ctx.clearRect(0, 0, tw, th);
  ctx.globalAlpha = Math.max(0, Math.min(1, fillOpacityMul));
  setWorldToCanvasTransform(ctx, bounds, tw, th);
  fillCssGradientsStackedInBounds(ctx, cssGradients, bounds);
  ctx.globalCompositeOperation = 'destination-in';
  tryDrawSolidFillTextMask(ctx, shape, 'rgba(255,255,255,1)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
