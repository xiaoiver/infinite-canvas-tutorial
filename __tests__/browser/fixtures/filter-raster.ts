import {
  ComputedTextMetrics,
  Path,
  Stroke,
  Text,
  type Entity,
} from '@infinite-canvas-tutorial/ecs';
import {
  createGradientFillTextRasterForFilter,
  createSolidFillMaskRasterForFilter,
  createStrokeSilhouetteRasterForFilter,
  fillCssGradientsStackedInBounds,
} from '../../../packages/ecs/src/utils/solidShapeRasterForFilter';
import { parseGradient } from '../../../packages/ecs/src/utils/gradient';

function entity(...entries: [unknown, unknown][]): Entity {
  const data = new Map(entries);
  return {
    has: (type: unknown) => data.has(type),
    hasSomeOf: (...types: unknown[]) => types.some((type) => data.has(type)),
    read: (type: unknown) => {
      if (!data.has(type)) throw new Error('Unexpected component read');
      return data.get(type);
    },
  } as unknown as Entity;
}
const bounds = { minX: 0, minY: 0, maxX: 80, maxY: 80 };
function pixel(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  x: number,
  y: number,
) {
  return [
    ...(canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(
      x,
      y,
      1,
      1,
    ).data,
  ];
}

const filterRasterTest = {
  path() {
    const shape = entity(
      [Path, { d: 'M10 10H70V70H10Z M30 30H50V50H30Z', fillRule: 'evenodd' }],
      [
        Stroke,
        { width: 4, linejoin: 'round', linecap: 'round', miterlimit: 4 },
      ],
    );
    const fill = createSolidFillMaskRasterForFilter(
      shape,
      'red',
      bounds,
      80,
      80,
    );
    const stroke = createStrokeSilhouetteRasterForFilter(shape, bounds, 80, 80);
    return {
      fill: [pixel(fill, 20, 20), pixel(fill, 40, 40), pixel(fill, 0, 0)],
      stroke: [
        pixel(stroke, 10, 20),
        pixel(stroke, 20, 20),
        pixel(stroke, 30, 40),
      ],
    };
  },
  conic() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    // Sharp quadrant boundaries make a degrees/radians mix-up visible.
    fillCssGradientsStackedInBounds(
      ctx,
      [
        {
          type: 'conic-gradient',
          angle: 90,
          cx: { type: '%', value: 50 },
          cy: { type: '%', value: 50 },
          steps: [
            { offset: { type: '%', value: 0 }, color: 'red' },
            { offset: { type: '%', value: 25 }, color: 'red' },
            { offset: { type: '%', value: 25 }, color: 'blue' },
            { offset: { type: '%', value: 100 }, color: 'blue' },
          ],
        },
      ],
      bounds,
    );
    return [pixel(canvas, 20, 60), pixel(canvas, 60, 20)];
  },
  text() {
    const shape = entity(
      [
        Text,
        {
          textAlign: 'left',
          textBaseline: 'top',
          anchorX: 2,
          anchorY: 0,
          lineHeight: 24,
          letterSpacing: 0,
          fontKerning: true,
        },
      ],
      [
        ComputedTextMetrics,
        {
          lines: ['M', 'W'],
          lineMetrics: [{ x: 0 }, { x: 0 }],
          font: '24px sans-serif',
          fontMetrics: { fontSize: 24, ascent: 24, descent: 0 },
          lineHeight: 30,
        },
      ],
    );
    const canvas = createGradientFillTextRasterForFilter(
      shape,
      bounds,
      80,
      80,
      parseGradient('linear-gradient(90deg, red, red)')!,
      0.5,
    );
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const maxima = [0, 30].map((y) => {
      const rgba = ctx.getImageData(0, y, 80, 30).data;
      let max = 0;
      for (let i = 3; i < rgba.length; i += 4) max = Math.max(max, rgba[i]);
      return max;
    });
    return { maxima, outside: pixel(canvas, 79, 79) };
  },
};

declare global {
  interface Window {
    filterRasterTest: typeof filterRasterTest;
  }
}
window.filterRasterTest = filterRasterTest;
document.querySelector('#status')!.textContent = 'Ready';
