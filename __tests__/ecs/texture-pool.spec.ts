import { createCanvas } from 'canvas';
import {
  TexturePool,
  generateGradientKey,
} from '../../packages/ecs/src/resources/TexturePool';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import {
  type RadialGradient,
  type ConicGradient,
} from '../../packages/ecs/src/utils/gradient';

const adapter = DOMAdapter.get();
let pool: TexturePool;
let canvases: ReturnType<typeof createCanvas>[];
beforeEach(() => {
  canvases = [];
  DOMAdapter.set({
    ...adapter,
    createCanvas: (w, h) => {
      const c = createCanvas(w!, h!);
      canvases.push(c);
      return c as unknown as HTMLCanvasElement;
    },
    createTexImageSource: (c) => c as HTMLCanvasElement,
  });
  pool = new TexturePool();
});
afterEach(() => {
  pool.destroy();
  DOMAdapter.set(adapter);
  jest.restoreAllMocks();
});
const pixel = (c: TexImageSource, x = 1, y = 1) => [
  ...(c as HTMLCanvasElement).getContext('2d')!.getImageData(x, y, 1, 1).data,
];
function source(color: string) {
  const c = createCanvas(2, 2);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 2, 2);
  return c as unknown as HTMLCanvasElement;
}
const radial = (patch: Partial<RadialGradient> = {}): RadialGradient => ({
  type: 'radial-gradient',
  cx: { type: '%', value: 50 },
  cy: { type: '%', value: 50 },
  size: { type: 'px', value: 10 },
  steps: [
    { offset: { type: '%', value: 0 }, color: 'red' },
    { offset: { type: '%', value: 100 }, color: 'blue' },
  ],
  ...patch,
});
const drawGradient = (g = radial(), width = 40, height = 20) =>
  pool.getOrCreateGradient({ gradients: [g], width, height, min: [0, 0] });

it('keeps distinct image objects separate even when their string representations match', () => {
  const a = source('red'),
    b = source('blue');
  expect(String(a)).toBe(String(b));
  expect(
    pixel(
      pool.getOrCreatePattern({ pattern: { image: a }, width: 8, height: 8 }),
    ),
  ).toEqual([255, 0, 0, 255]);
  expect(
    pixel(
      pool.getOrCreatePattern({ pattern: { image: b }, width: 8, height: 8 }),
    ),
  ).toEqual([0, 0, 255, 255]);
});

it('reuses a pattern for the same image and repetition across target sizes', () => {
  const create = jest.spyOn(canvases[0].getContext('2d'), 'createPattern');
  const image = source('red');
  pool.getOrCreatePattern({
    pattern: { image, repetition: 'repeat' },
    width: 8,
    height: 8,
  });
  const larger = pool.getOrCreatePattern({
    pattern: { image, repetition: 'repeat' },
    width: 12,
    height: 12,
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(pixel(larger, 10, 10)).toEqual([255, 0, 0, 255]);
});

it.each(['repeat', 'repeat-x', 'repeat-y', 'no-repeat'] as const)(
  'renders %s with the expected transparent area',
  (repetition) => {
    const c = pool.getOrCreatePattern({
      pattern: { image: source('red'), repetition },
      width: 8,
      height: 8,
    });
    expect(pixel(c, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(pixel(c, 5, 5)[3]).toBe(repetition === 'repeat' ? 255 : 0);
    expect(pixel(c, 5, 1)[3]).toBe(
      repetition === 'repeat' || repetition === 'repeat-x' ? 255 : 0,
    );
    expect(pixel(c, 1, 5)[3]).toBe(
      repetition === 'repeat' || repetition === 'repeat-y' ? 255 : 0,
    );
  },
);

it('leaves unloaded patterns transparent and retries rather than caching a failed creation', () => {
  const create = jest.spyOn(canvases[0].getContext('2d'), 'createPattern');
  create.mockReturnValueOnce(null);
  const params = { pattern: { image: source('red') }, width: 8, height: 8 };
  expect(pixel(pool.getOrCreatePattern(params))[3]).toBe(0);
  expect(pixel(pool.getOrCreatePattern(params))).toEqual([255, 0, 0, 255]);
  expect(create).toHaveBeenCalledTimes(2);
});

it('returns a transparent placeholder for an unresolved URL', () => {
  expect(
    pixel(
      pool.getOrCreatePattern({
        pattern: { image: '/pending.png' },
        width: 8,
        height: 8,
      }),
    )[3],
  ).toBe(0);
});

it('releases gradient and pattern entries on destroy', () => {
  const ctx = canvases[0].getContext('2d');
  const gradient = jest.spyOn(ctx, 'createRadialGradient');
  const pattern = jest.spyOn(ctx, 'createPattern');
  const params = { pattern: { image: source('red') }, width: 8, height: 8 };
  drawGradient();
  drawGradient();
  pool.getOrCreatePattern(params);
  pool.getOrCreatePattern(params);
  expect(gradient).toHaveBeenCalledTimes(1);
  expect(pattern).toHaveBeenCalledTimes(1);
  pool.destroy();
  pool.destroy();
  drawGradient();
  pool.getOrCreatePattern(params);
  expect(gradient).toHaveBeenCalledTimes(2);
  expect(pattern).toHaveBeenCalledTimes(2);
});

it.each([
  ['fractional center', { cx: { type: '%', value: 50.2 } }],
  ['center units', { cx: { type: 'px', value: 50 } }],
  ['fractional radius', { size: { type: 'px', value: 10.2 } }],
  [
    'radius keyword',
    { size: { type: 'extent-keyword', value: 'farthest-side' } },
  ],
] as [string, Partial<RadialGradient>][])(
  'creates a new gradient for changed %s',
  (_label, patch) => {
    const create = jest.spyOn(
      canvases[0].getContext('2d'),
      'createRadialGradient',
    );
    drawGradient();
    drawGradient(radial(patch));
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]).not.toEqual(create.mock.calls[1]);
  },
);

it('distinguishes radial extent keywords that used to collapse to NaN', () => {
  const create = jest.spyOn(
    canvases[0].getContext('2d'),
    'createRadialGradient',
  );
  drawGradient(
    radial({ size: { type: 'extent-keyword', value: 'closest-side' } }),
  );
  drawGradient(
    radial({ size: { type: 'extent-keyword', value: 'farthest-side' } }),
  );
  expect(create.mock.calls.map((args) => args[5])).toEqual([10, 20]);
});

it('does not change the caller gradient order when composing layers', () => {
  const solid = (color: string) =>
    radial({
      size: { type: 'px', value: 50 },
      steps: [
        { offset: { type: '%', value: 0 }, color },
        { offset: { type: '%', value: 100 }, color },
      ],
    });
  const gradients = [solid('rgba(255,0,0,0.5)'), solid('blue')];
  const before = JSON.stringify(gradients);
  const c = pool.getOrCreateGradient({
    gradients,
    min: [0, 0],
    width: 8,
    height: 8,
  });
  const [r, g, b, a] = pixel(c);
  expect(r).toBeGreaterThan(120);
  expect(b).toBeGreaterThan(120);
  expect(g).toBe(0);
  expect(a).toBe(255);
  expect(JSON.stringify(gradients)).toBe(before);
});

it('composites a premultiplied linear gradient over the lower layer', () => {
  const c = pool.getOrCreateGradient({
    gradients: [
      {
        type: 'linear-gradient',
        angle: 0,
        steps: [
          { offset: { type: '%', value: 0 }, color: 'transparent' },
          { offset: { type: '%', value: 100 }, color: 'white' },
        ],
      },
      radial({
        steps: [
          { offset: { type: '%', value: 0 }, color: 'blue' },
          { offset: { type: '%', value: 100 }, color: 'blue' },
        ],
      }),
    ],
    min: [0, 0],
    width: 20,
    height: 10,
  });
  const [r, g, b, a] = pixel(c, 10, 5);
  expect(r).toBeGreaterThan(80);
  expect(g).toBe(r);
  expect(b).toBe(255);
  expect(a).toBe(255);
});

it('preserves fractional geometry and unit-bearing stops in exported gradient IDs', () => {
  const params = {
    ...radial(),
    min: [0, 0] as [number, number],
    width: 40,
    height: 20,
  };
  const keys = [
    params,
    { ...params, width: 40.1 },
    { ...params, min: [0.1, 0] as [number, number] },
    {
      ...params,
      steps: params.steps.map((s) => ({
        ...s,
        offset: { ...s.offset, type: 'px' },
      })),
    },
  ].map(generateGradientKey);
  expect(new Set(keys).size).toBe(keys.length);
  expect(generateGradientKey(JSON.parse(JSON.stringify(params)))).toBe(keys[0]);
});

it('distinguishes nearby linear and conic angles in gradient IDs', () => {
  const common = {
    width: 40,
    height: 20,
    min: [0, 0] as [number, number],
    steps: radial().steps,
  };
  for (const type of ['linear-gradient', 'conic-gradient'] as const) {
    const base = {
      ...common,
      type,
      cx: { type: '%', value: 50 },
      cy: { type: '%', value: 50 },
      angle: 0,
    };
    expect(generateGradientKey(base)).not.toBe(
      generateGradientKey({ ...base, angle: 0.2 }),
    );
  }
});

it('creates and reuses a conic gradient with precise centers and angles', () => {
  const ctx = canvases[0].getContext('2d');
  const create = jest.fn(() => ctx.createRadialGradient(10, 10, 0, 10, 10, 20));
  Object.defineProperty(ctx, 'createConicGradient', {
    configurable: true,
    value: create,
  });
  const gradient: ConicGradient = {
    type: 'conic-gradient',
    cx: { type: '%', value: 25 },
    cy: { type: 'px', value: 3 },
    angle: 0.25,
    steps: radial().steps,
  };
  const params = {
    gradients: [gradient],
    min: [0, 0] as [number, number],
    width: 40,
    height: 20,
  };
  pool.getOrCreateGradient(params);
  pool.getOrCreateGradient(params);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(0.25, 10, 3);
  pool.getOrCreateGradient({
    ...params,
    gradients: [{ ...gradient, angle: 0.3 }],
  });
  expect(create).toHaveBeenCalledTimes(2);
});

it('evicts the least recently used gradient while keeping an actively reused entry', () => {
  const create = jest.spyOn(
    canvases[0].getContext('2d'),
    'createRadialGradient',
  );
  const gradients = Array.from({ length: 257 }, (_, i) =>
    radial({ cx: { type: '%', value: i / 10 } }),
  );
  gradients.slice(0, 256).forEach((g) => drawGradient(g));
  drawGradient(gradients[0]);
  drawGradient(gradients[256]);
  drawGradient(gradients[0]);
  expect(create).toHaveBeenCalledTimes(257);
  drawGradient(gradients[1]);
  expect(create).toHaveBeenCalledTimes(258);
});

it('evicts old patterns without retaining or closing their caller-owned images', () => {
  const create = jest.spyOn(canvases[0].getContext('2d'), 'createPattern');
  const images = Array.from({ length: 257 }, () =>
    Object.assign(source('red'), { close: jest.fn() }),
  );
  const draw = (i: number) =>
    pool.getOrCreatePattern({
      pattern: { image: images[i] },
      width: 2,
      height: 2,
    });
  for (let i = 0; i < 256; i++) draw(i);
  draw(0);
  draw(256);
  draw(0);
  expect(create).toHaveBeenCalledTimes(257);
  expect(pixel(draw(1))).toEqual([255, 0, 0, 255]);
  expect(create).toHaveBeenCalledTimes(258);
  pool.destroy();
  images.forEach((image) => expect(image.close).not.toHaveBeenCalled());
});
