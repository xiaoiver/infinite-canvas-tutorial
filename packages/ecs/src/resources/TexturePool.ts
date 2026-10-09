import { isString } from '@antv/util';
import { DOMAdapter } from '../environment';
import {
  computeConicGradient,
  computeRadialGradient,
  ConicGradient,
  fillLinearGradientPremultiplied,
  Gradient,
  hashCode,
  LinearGradient,
  Pattern,
  RadialGradient,
} from '../utils';

type CanvasRasterGradient = LinearGradient | RadialGradient | ConicGradient;

type GradientExtraParams = {
  width: number;
  height: number;
  min: [number, number];
};

// Continuous edits must not retain every historical gradient/pattern forever.
const TEXTURE_POOL_CACHE_LIMIT = 256;
function cachedPaint<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key);
  if (value) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}
function cachePaint<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.set(key, value);
  if (cache.size > TEXTURE_POOL_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
}

export class TexturePool {
  #canvas: HTMLCanvasElement | OffscreenCanvas;
  #ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  #gradientCache = new Map<string, CanvasGradient>();
  #patternCache = new Map<string, CanvasPattern>();

  constructor() {
    this.#canvas = DOMAdapter.get().createCanvas(128, 128);
    this.#ctx = this.#canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
  }

  destroy() {
    this.#gradientCache.clear();
    this.#patternCache.clear();
  }

  getOrCreatePattern(params: {
    pattern: Pattern;
    width: number;
    height: number;
  }) {
    const { pattern, width, height } = params;
    const { image, repetition } = pattern;

    this.#canvas.width = width;
    this.#canvas.height = height;

    // TODO: load image
    if (isString(image)) {
      return this.#canvas;
    }

    let canvasPattern: CanvasPattern | null = null;
    const key = generatePatternKey(params);
    const cached = cachedPaint(this.#patternCache, key);
    if (cached) {
      canvasPattern = cached;
    } else {
      canvasPattern = image && this.#ctx.createPattern(image, repetition);
      if (canvasPattern) cachePaint(this.#patternCache, key, canvasPattern);

      // @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform
      // if (transform) {
      //   const mat = parsedTransformToMat4(
      //     parseTransform(transform),
      //     new DisplayObject({}),
      //   );
      //   canvasPattern.setTransform({
      //     a: mat[0],
      //     b: mat[1],
      //     c: mat[4],
      //     d: mat[5],
      //     e: mat[12],
      //     f: mat[13],
      //   });
      // }
    }

    // createPattern can return null while its image is not decoded yet. Keep
    // the placeholder transparent instead of filling with the default black.
    if (canvasPattern) {
      this.#ctx.fillStyle = canvasPattern;
      this.#ctx.fillRect(0, 0, width, height);
    }

    return DOMAdapter.get().createTexImageSource(this.#canvas);
  }

  getOrCreateGradient(
    params: {
      gradients: Gradient[];
    } & GradientExtraParams,
    fillRect = true,
  ) {
    const { width, height, gradients } = params;

    if (fillRect) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }

    // CSS `background` 列表：靠前的层在上；绘制时自下而上叠合。
    [...gradients].reverse().forEach((g, index) => {
      if (!g || g.type === 'mesh-gradient') {
        return;
      }
      if (g.type === 'linear-gradient') {
        // putImageData replaces pixels. Raster upper linear layers separately
        // so their transparency composites over the existing lower layers.
        if (index === 0) {
          fillLinearGradientPremultiplied(this.#ctx, 0, 0, width, height, g);
        } else {
          const layer = DOMAdapter.get().createCanvas(width, height);
          const ctx = layer.getContext('2d') as CanvasRenderingContext2D;
          fillLinearGradientPremultiplied(ctx, 0, 0, width, height, g);
          this.#ctx.drawImage(ctx.canvas, 0, 0);
        }
        return;
      }
      const gradient = this.getOrCreateGradientInternal({
        ...g,
        width,
        height,
        min: [0, 0],
      });

      this.#ctx.fillStyle = gradient;
      if (fillRect) {
        this.#ctx.fillRect(0, 0, width, height);
      }
    });

    return DOMAdapter.get().createTexImageSource(this.#canvas);
  }

  private getOrCreateGradientInternal(
    params: (RadialGradient | ConicGradient) & GradientExtraParams,
  ) {
    const key = generateGradientKey(params);
    const { type, steps, min, width, height } = params;

    const cached = cachedPaint(this.#gradientCache, key);
    if (cached) return cached;

    let gradient: CanvasGradient | null = null;
    if (type === 'radial-gradient') {
      const { cx, cy, size } = params;
      const { x, y, r } = computeRadialGradient(
        min,
        width,
        height,
        cx,
        cy,
        size,
      );
      // @see https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createRadialGradient
      gradient = this.#ctx.createRadialGradient(x, y, 0, x, y, r);
    } else if (type === 'conic-gradient') {
      const { cx, cy, angle } = params;
      const { x, y } = computeConicGradient(min, width, height, cx, cy);
      gradient = this.#ctx.createConicGradient(angle, x, y);
    }

    if (gradient) {
      steps.forEach(({ offset, color }) => {
        if (offset.type === '%') {
          gradient?.addColorStop(offset.value / 100, color.toString());
        }
      });

      cachePaint(this.#gradientCache, key, gradient);
    }

    return gradient;
  }
}

export function generateGradientKey(
  params: CanvasRasterGradient & GradientExtraParams,
): string {
  const { type, min, width, height, steps } = params;

  // Keep units, keywords and fractional values: rounding merges visibly
  // different gradients, both in the raster cache and exported SVG defs.
  const geometry =
    type === 'linear-gradient'
      ? [params.angle]
      : [
          params.cx.type,
          params.cx.value,
          params.cy.type,
          params.cy.value,
          ...(type === 'radial-gradient'
            ? [params.size?.type, params.size?.value]
            : [params.angle]),
        ];
  return `gradient-${hashCode(
    JSON.stringify([
      type,
      min,
      width,
      height,
      geometry,
      steps.map(({ offset, color }) => [
        offset.type,
        offset.value,
        color.toString(),
      ]),
    ]),
  )}`;
}

const patternImageIds = new WeakMap<object, number>();
let nextPatternImageId = 0;

export function generatePatternKey(params: { pattern: Pattern }): string {
  const { image, repetition, transform } = params.pattern;
  if (isString(image)) {
    return `pattern-${hashCode(`pattern-${image}-${repetition}-${transform}`)}`;
  }
  let id = patternImageIds.get(image);
  if (id === undefined) {
    id = nextPatternImageId++;
    patternImageIds.set(image, id);
  }
  return `pattern-image-${id}-${hashCode(`${repetition}-${transform}`)}`;
}
