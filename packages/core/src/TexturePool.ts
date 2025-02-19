import { DOMAdapter } from './environment';
import { computeLinearGradient, LinearGradient } from './utils';

type GradientExtraParams = {
  width: number;
  height: number;
  min: [number, number];
  cx?: number;
  cy?: number;
  size?: number;
};

export class TexturePool {
  #canvas: HTMLCanvasElement | OffscreenCanvas;
  #ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  #gradientCache: Record<string, CanvasGradient> = {};

  constructor() {
    this.#canvas = DOMAdapter.get().createCanvas(1, 1);
    this.#ctx = this.#canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
  }

  destroy() {
    this.#gradientCache = {};
  }

  getOrCreateGradient(
    params: {
      gradients: LinearGradient[];
    } & GradientExtraParams,
  ) {
    const { width, height, gradients } = params;
    this.#canvas.width = width;
    this.#canvas.height = height;

    gradients.forEach((g) => {
      const gradient = this.getOrCreateGradientInternal({
        ...g,
        width,
        height,
        min: [0, 0],
      });

      this.#ctx.fillStyle = gradient;
      this.#ctx.fillRect(0, 0, width, height);
    });

    return this.#canvas;
  }

  private getOrCreateGradientInternal(
    params: LinearGradient & GradientExtraParams,
  ) {
    const key = this.generateGradientKey(params);
    const { type, steps, min, width, height, angle } = params;

    if (this.#gradientCache[key]) {
      return this.#gradientCache[key];
    }

    let gradient: CanvasGradient | null = null;
    if (type === 'linear-gradient') {
      const { x1, y1, x2, y2 } = computeLinearGradient(
        min,
        width,
        height,
        angle,
      );
      // @see https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
      gradient = this.#ctx.createLinearGradient(x1, y1, x2, y2);
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

  private generateGradientKey(
    params: LinearGradient & GradientExtraParams,
  ): string {
    const { type, min, width, height, steps, angle, cx, cy, size } = params;
    return `gradient-${type}-${angle?.toString() || 0}-${cx?.toString() || 0}-${
      cy?.toString() || 0
    }-${size?.toString() || 0}-${min[0]}-${min[1]}-${width}-${height}-${steps
      .map(({ offset, color }) => `${offset}${color}`)
      .join('-')}`;
  }
}
