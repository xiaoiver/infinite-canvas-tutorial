/**
 * Builds the raindrop normal/compose map on Canvas2D (raindrop-fx instanced pass equivalent).
 * Draws {@link RainDrop} sprites with blend modes that approximate exclusion compose.
 */
import type { RainDrop } from './raindrop';

/** Scratch canvas reads pixels every raindrop; avoids Canvas2D readback warnings. */
const SCRATCH_2D: CanvasRenderingContext2DSettings = {
  willReadFrequently: true,
};

function createCanvas2d(w: number, h: number): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', SCRATCH_2D);
    if (!ctx) {
      throw new Error('RaindropNormalMapCanvas: 2d context unavailable');
    }
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', SCRATCH_2D);
  if (!ctx) {
    throw new Error('RaindropNormalMapCanvas: 2d context unavailable');
  }
  return { canvas, ctx };
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Any2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const MAX_SPRITE_PX = 512;

function finitePositive(n: number, fallback = 1): number {
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return n;
}

/**
 * Encode one raindrop sprite into the compose texture (matches raindrop-fx raindrop-frag):
 * `vec4(color.rg * color.a, sizeNorm * color.a, color.a)`.
 */
function drawRaindropSprite(
  scratch: AnyCanvas,
  scratchCtx: Any2D,
  sprite: ImageBitmap,
  ctx: Any2D,
  x: number,
  y: number,
  width: number,
  height: number,
  sizeNorm: number,
): void {
  const sw = sprite.width;
  const sh = sprite.height;
  if (!sw || !sh) {
    return;
  }

  const pw = Math.min(
    MAX_SPRITE_PX,
    Math.max(1, Math.ceil(finitePositive(width))),
  );
  const ph = Math.min(
    MAX_SPRITE_PX,
    Math.max(1, Math.ceil(finitePositive(height))),
  );
  const dw = finitePositive(width);
  const dh = finitePositive(height);
  if (scratch.width !== pw || scratch.height !== ph) {
    scratch.width = pw;
    scratch.height = ph;
  }

  scratchCtx.clearRect(0, 0, pw, ph);
  scratchCtx.drawImage(sprite, 0, 0, sw, sh, 0, 0, pw, ph);
  const img = scratchCtx.getImageData(0, 0, pw, ph);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255;
    if (a <= 0) {
      continue;
    }
    d[i] = Math.min(255, d[i]! * a);
    d[i + 1] = Math.min(255, d[i + 1]! * a);
    d[i + 2] = Math.min(255, sizeNorm * a * 255);
    d[i + 3] = Math.min(255, a * 255);
  }
  scratchCtx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const px = Number.isFinite(x) ? x : 0;
  const py = Number.isFinite(y) ? y : 0;
  ctx.drawImage(scratch, 0, 0, pw, ph, px - dw * 0.5, py - dh * 0.5, dw, dh);
  ctx.restore();
}

export class RaindropNormalMapCanvas {
  readonly canvas: AnyCanvas;
  private readonly ctx: Any2D;
  private readonly scratch: AnyCanvas;
  private readonly scratchCtx: Any2D;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const main = createCanvas2d(width, height);
    this.canvas = main.canvas;
    this.ctx = main.ctx as Any2D;
    const scratch = createCanvas2d(64, 64);
    this.scratch = scratch.canvas;
    this.scratchCtx = scratch.ctx as Any2D;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /** Y-up simulation space → canvas (origin top-left, y down). */
  render(raindrops: RainDrop[], sprite: ImageBitmap): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, -1, 0, this.height);
    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < raindrops.length; i++) {
      const d = raindrops[i]!;
      if (d.destroied) {
        continue;
      }
      const w = d.size.x;
      const h = d.size.y;
      if (
        !Number.isFinite(w) ||
        !Number.isFinite(h) ||
        w <= 0 ||
        h <= 0 ||
        !Number.isFinite(d.pos.x) ||
        !Number.isFinite(d.pos.y)
      ) {
        continue;
      }
      const sizeNorm = Math.min(2, Math.max(0, w / 100));
      drawRaindropSprite(
        this.scratch,
        this.scratchCtx,
        sprite,
        ctx,
        d.pos.x,
        d.pos.y,
        w,
        h,
        sizeNorm,
      );
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
