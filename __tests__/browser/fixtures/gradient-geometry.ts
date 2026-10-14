import { DOMAdapter } from '../../../packages/ecs/src/environment';
import { TexturePool } from '../../../packages/ecs/src/resources/TexturePool';
import { createCanvasGradientForBounds } from '../../../packages/ecs/src/utils/solidShapeRasterForFilter';
import {
  parseGradient,
  type ConicGradient,
} from '../../../packages/ecs/src/utils/gradient';

const size = 80;
const canvas = (width = size, height = size) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  // Keep readback on one raster backend; a CPU/GPU switch can assign a pixel
  // exactly on a hard diagonal boundary to the opposite side.
  c.getContext('2d', { willReadFrequently: true });
  return c;
};
DOMAdapter.set({ ...DOMAdapter.get(), createCanvas: canvas });
const bytes = (c: HTMLCanvasElement | OffscreenCanvas) =>
  (c.getContext('2d') as CanvasRenderingContext2D).getImageData(
    0,
    0,
    size,
    size,
  ).data;
const mismatch = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
  a.reduce((n, value, i) => n + (value === b[i] ? 0 : 1), 0);

const harness = {
  conic(angle: number) {
    const pool = new TexturePool();
    try {
      const g: ConicGradient = {
        type: 'conic-gradient',
        angle,
        cx: { type: '%', value: 50 },
        cy: { type: '%', value: 50 },
        steps: [
          { offset: { type: '%', value: 0 }, color: 'red' },
          { offset: { type: '%', value: 25 }, color: 'red' },
          { offset: { type: '%', value: 25 }, color: 'blue' },
          { offset: { type: '%', value: 100 }, color: 'blue' },
        ],
      };
      const params = {
        gradients: [g],
        width: size,
        height: size,
        min: [0, 0] as [number, number],
      };
      const actual = pool.getOrCreateGradient(params) as HTMLCanvasElement;
      const reference = canvas(),
        ctx = reference.getContext('2d')!;
      const native = ctx.createConicGradient((angle * Math.PI) / 180, 40, 40);
      for (const step of g.steps)
        native.addColorStop(step.offset.value / 100, step.color);
      ctx.fillStyle = native;
      ctx.fillRect(0, 0, size, size);
      const filtered = canvas(),
        filterCtx = filtered.getContext('2d')!;
      filterCtx.fillStyle = createCanvasGradientForBounds(filterCtx, g, {
        minX: 0,
        minY: 0,
        maxX: size,
        maxY: size,
      })!;
      filterCtx.fillRect(0, 0, size, size);
      const actualBytes = bytes(actual),
        referenceBytes = bytes(reference);
      const first = mismatch(actualBytes, referenceBytes);
      const filter = mismatch(actualBytes, bytes(filtered));
      const cached = pool.getOrCreateGradient(params) as HTMLCanvasElement;
      const cachedBytes = bytes(cached);
      return {
        first,
        filter,
        cached: mismatch(cachedBytes, referenceBytes),
        opaque: cachedBytes.filter((value, i) => i % 4 === 3 && value === 255)
          .length,
      };
    } finally {
      pool.destroy();
    }
  },
  radial() {
    const pool = new TexturePool();
    try {
      const gradients = parseGradient(
        'RADIAL-GRADIENT(CIRCLE CLOSEST-SIDE AT 150% 50%, red, blue)',
      )!;
      const actual = pool.getOrCreateGradient({
        gradients,
        width: size,
        height: size,
        min: [0, 0],
      }) as HTMLCanvasElement;
      const reference = canvas(),
        ctx = reference.getContext('2d')!;
      const native = ctx.createRadialGradient(120, 40, 0, 120, 40, 40);
      native.addColorStop(0, 'red');
      native.addColorStop(1, 'blue');
      ctx.fillStyle = native;
      ctx.fillRect(0, 0, size, size);
      return mismatch(bytes(actual), bytes(reference));
    } finally {
      pool.destroy();
    }
  },
};
window.gradientGeometryTest = harness;
declare global {
  interface Window {
    gradientGeometryTest: typeof harness;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
