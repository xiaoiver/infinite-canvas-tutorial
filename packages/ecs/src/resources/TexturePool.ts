import { isString } from '@antv/util';
import { DOMAdapter } from '../environment';
import {
  computeConicGradient,
  computeLinearGradient,
  computeRadialGradient,
  ConicGradient,
  Gradient,
  hashCode,
  LinearGradient,
  Pattern,
  RadialGradient,
} from '../utils';

type GradientExtraParams = {
  width: number;
  height: number;
  min: [number, number];
};

export class TexturePool {
  #canvas: HTMLCanvasElement | OffscreenCanvas;
  #ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  #gradientCache: Record<string, CanvasGradient> = {};
  #patternCache: Record<string, CanvasPattern> = {};

  constructor() {
    this.#canvas = DOMAdapter.get().createCanvas(128, 128);
    this.#ctx = this.#canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
  }

  destroy() {
    this.#gradientCache = {};
    this.#patternCache = {};
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
    if (this.#patternCache[key]) {
      canvasPattern = this.#patternCache[key];
    } else {
      canvasPattern = image && this.#ctx.createPattern(image, repetition);
      this.#patternCache[key] = canvasPattern;

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

    this.#ctx.fillStyle = canvasPattern;
    this.#ctx.fillRect(0, 0, width, height);

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

    gradients.forEach((g) => {
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
    params: (LinearGradient | RadialGradient | ConicGradient) &
      GradientExtraParams,
  ) {
    const key = generateGradientKey(params);
    const { type, steps, min, width, height } = params;

    if (this.#gradientCache[key]) {
      return this.#gradientCache[key];
    }

    let gradient: CanvasGradient | null = null;
    if (type === 'linear-gradient') {
      const { x1, y1, x2, y2 } = computeLinearGradient(
        min,
        width,
        height,
        params.angle,
      );
      // @see https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
      gradient = this.#ctx.createLinearGradient(x1, y1, x2, y2);
    } else if (type === 'radial-gradient') {
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

      this.#gradientCache[key] = gradient;
    }

    return this.#gradientCache[key];
  }
}

export function generateGradientKey(
  params: Gradient & GradientExtraParams,
): string {
  const { type, min, width, height, steps } = params;

  const suffix = `${type}-${Math.round(min[0])}-${Math.round(
    min[1],
  )}-${Math.round(width)}-${Math.round(height)}-${steps
    .map(({ offset, color }) => `${offset.value}${color}`)
    .join('-')}`;

  if (type === 'linear-gradient') {
    const { angle } = params;
    return `gradient-${hashCode(`${Math.round(angle)}-${suffix}`)}`;
  } else if (type === 'radial-gradient') {
    const { cx, cy, size } = params;
    return `gradient-${hashCode(
      `${Math.round(cx.value)}-${Math.round(cy.value)}-${Math.round(
        Number(size?.value || 0),
      )}-${suffix}`,
    )}`;
  } else if (type === 'conic-gradient') {
    const { cx, cy, angle } = params;
    return `gradient-${hashCode(
      `${Math.round(cx.value)}-${Math.round(cy.value)}-${Math.round(
        angle || 0,
      )}-${suffix}`,
    )}`;
  }
}

export function generatePatternKey(params: { pattern: Pattern }): string {
  const { image, repetition, transform } = params.pattern;
  // TODO: when image is not string
  return `pattern-${hashCode(`pattern-${image}-${repetition}-${transform}`)}`;
}
