import {
  computeLinearGradient,
  computeConicGradient,
  computeRadialGradient,
  normalizeLinearGradientStops,
  sampleLinearGradientPremultiplied,
  fillLinearGradientPremultiplied,
  isGradient,
  parseGradient,
  type LinearGradient,
} from '../../packages/ecs/src/utils/gradient';
import { createCanvas } from 'canvas';

it('recognizes case-insensitive gradient functions and their orientation', () => {
  const paint = '  LINEAR-GRADIENT(to TOP, red, blue)';
  expect(isGradient(paint)).toBe(true);
  expect(parseGradient(paint)).toMatchObject([
    { type: 'linear-gradient', angle: -90 },
  ]);
});

it('does not mistake image URLs or arbitrary words for gradient functions', () => {
  for (const value of [
    'linear',
    'radial',
    'conical',
    'https://example.org/linear.png',
    'url(mesh-gradient.png)',
  ]) {
    expect(isGradient(value)).toBe(false);
    expect(parseGradient(value)).toBeUndefined();
  }
});

it('uses nonnegative side distances when a radial center is outside the bounds', () => {
  expect(
    computeRadialGradient(
      [10, 20],
      100,
      80,
      { type: '%', value: 150 },
      { type: '%', value: -25 },
      { type: 'extent-keyword', value: 'closest-side' },
    ),
  ).toEqual({ x: 160, y: 0, r: 20 });
});

const percent = (value: number) => ({ type: '%', value });
const px = (value: number) => ({ type: 'px', value });

it.each([
  [0, [10, 60, 110, 60]],
  [90, [60, 20, 60, 100]],
  [180, [110, 60, 10, 60]],
  [-90, [60, 100, 60, 20]],
  [450, [60, 20, 60, 100]],
] as [number, number[]][])(
  'places the %s degree line across translated bounds',
  (angle, expected) => {
    const { x1, y1, x2, y2 } = computeLinearGradient([10, 20], 100, 80, angle);
    [x1, y1, x2, y2].forEach((value, i) =>
      expect(value).toBeCloseTo(expected[i]),
    );
  },
);

it('extends a diagonal line through opposite corners of a square', () => {
  const { x1, y1, x2, y2 } = computeLinearGradient([5, 10], 100, 100, 45);
  [x1, y1, x2, y2].forEach((value, i) =>
    expect(value).toBeCloseTo([5, 10, 105, 110][i]),
  );
});

it.each([
  [percent(25), percent(75), [60, 80]],
  [px(25), px(-5), [35, 15]],
  [percent(150), px(10), [310, 30]],
] as [ReturnType<typeof percent>, ReturnType<typeof percent>, number[]][])(
  'resolves conic center units %j and %j',
  (cx, cy, expected) => {
    expect(computeConicGradient([10, 20], 200, 80, cx, cy)).toEqual({
      x: expected[0],
      y: expected[1],
    });
  },
);

it.each([
  ['closest-side', 20],
  ['farthest-side', 80],
  ['closest-corner', Math.hypot(20, 20)],
  ['farthest-corner', Math.hypot(80, 60)],
])(
  'computes radial %s from local bounds before translating its center',
  (value, expected) => {
    const g = computeRadialGradient([7, 9], 100, 80, px(20), px(60), {
      type: 'extent-keyword',
      value,
    });
    expect(g.x).toBe(27);
    expect(g.y).toBe(69);
    expect(g.r).toBeCloseTo(expected as number);
  },
);

it('defaults radial size to the farthest corner and retains a fractional explicit radius', () => {
  expect(
    computeRadialGradient([0, 0], 100, 80, percent(50), percent(50)).r,
  ).toBeCloseTo(Math.hypot(50, 40));
  expect(
    computeRadialGradient([0, 0], 100, 80, px(20), px(20), {
      type: 'px',
      value: '12.5',
    }).r,
  ).toBe(12.5);
});

it('can pass outside-center radial geometry to a real Canvas gradient', () => {
  const ctx = createCanvas(20, 20).getContext('2d');
  const { x, y, r } = computeRadialGradient(
    [0, 0],
    20,
    20,
    percent(150),
    percent(50),
    { type: 'extent-keyword', value: 'closest-side' },
  );
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, 'red');
  gradient.addColorStop(1, 'blue');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 20, 20);
  expect([...ctx.getImageData(10, 10, 1, 1).data]).toEqual([0, 0, 255, 255]);
});

describe('premultiplied sampling and rasterization', () => {
  const gradient = (paint: string) =>
    parseGradient(paint)![0] as LinearGradient;
  const stops = (paint: string) =>
    normalizeLinearGradientStops(gradient(paint).steps);
  it('sorts a copy of the supplied stops while preserving equal-offset order', () => {
    const input = [
      { offset: percent(100), color: 'blue' },
      { offset: percent(50), color: 'red' },
      { offset: percent(50), color: 'green' },
      { offset: percent(0), color: 'black' },
    ];
    const before = structuredClone(input);
    expect(
      normalizeLinearGradientStops(input).map((s) => [s.t, s.r, s.g, s.b]),
    ).toEqual([
      [0, 0, 0, 0],
      [0.5, 1, 0, 0],
      [0.5, 0, 128 / 255, 0],
      [1, 0, 0, 1],
    ]);
    expect(input).toEqual(before);
  });
  it('extends boundary colors and clamps samples outside the gradient', () => {
    const colors = stops('linear-gradient(red 25%, blue 75%)');
    expect(sampleLinearGradientPremultiplied(colors, -10)).toEqual({
      t: 0,
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
    expect(sampleLinearGradientPremultiplied(colors, 10)).toEqual({
      t: 1,
      r: 0,
      g: 0,
      b: 1,
      a: 1,
    });
    expect(sampleLinearGradientPremultiplied(colors, 0.5)).toEqual({
      t: 0.5,
      r: 0.5,
      g: 0,
      b: 0.5,
      a: 1,
    });
  });
  it('returns transparent black for no stops and fully transparent interpolation', () => {
    for (const colors of [
      [],
      stops('linear-gradient(rgba(255,0,0,0), rgba(0,0,255,0))'),
    ]) {
      expect(sampleLinearGradientPremultiplied(colors, 0.5)).toEqual({
        t: 0.5,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
      });
    }
  });
  it('weights color by alpha rather than introducing a dark transparent fringe', () => {
    const color = sampleLinearGradientPremultiplied(
      stops('linear-gradient(rgba(255,0,0,.25), rgba(0,0,255,.75))'),
      0.5,
    );
    expect(color).toEqual({ t: 0.5, r: 0.25, g: 0, b: 0.75, a: 0.5 });
  });
  it('writes translated pixel centers without changing neighboring pixels', () => {
    const canvas = createCanvas(8, 4),
      ctx = canvas.getContext('2d');
    ctx.fillStyle = 'lime';
    ctx.fillRect(0, 0, 8, 4);
    fillLinearGradientPremultiplied(
      ctx as unknown as CanvasRenderingContext2D,
      2,
      1,
      4,
      2,
      gradient('linear-gradient(0deg, black, white)'),
    );
    expect([...ctx.getImageData(1, 1, 1, 1).data]).toEqual([0, 255, 0, 255]);
    expect([...ctx.getImageData(2, 1, 4, 1).data]).toEqual([
      32, 32, 32, 255, 96, 96, 96, 255, 159, 159, 159, 255, 223, 223, 223, 255,
    ]);
    expect([...ctx.getImageData(6, 1, 1, 1).data]).toEqual([0, 255, 0, 255]);
  });
  it('rasterizes transparent-to-white without darkening RGB', () => {
    const ctx = createCanvas(4, 1).getContext('2d');
    fillLinearGradientPremultiplied(
      ctx as unknown as CanvasRenderingContext2D,
      0,
      0,
      4,
      1,
      gradient('linear-gradient(transparent, white)'),
    );
    const pixels = [...ctx.getImageData(0, 0, 4, 1).data];
    for (let i = 0; i < 4; i++) {
      // Cairo's premultiplied storage can round a white channel down by one.
      for (let channel = 0; channel < 3; channel++)
        expect(pixels[i * 4 + channel]).toBeGreaterThanOrEqual(254);
      expect(pixels[i * 4 + 3]).toBe([32, 96, 159, 223][i]);
    }
  });
  it.each([
    [0, 4],
    [4, 0],
    [-1, 4],
    [4, -1],
  ])('does not paint a %s by %s raster', (w, h) => {
    const ctx = createCanvas(4, 4).getContext('2d');
    const allocate = jest.spyOn(ctx, 'createImageData');
    try {
      fillLinearGradientPremultiplied(
        ctx as unknown as CanvasRenderingContext2D,
        0,
        0,
        w,
        h,
        gradient('linear-gradient(red, blue)'),
      );
      expect(allocate).not.toHaveBeenCalled();
      expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 0]);
    } finally {
      allocate.mockRestore();
    }
  });
});
