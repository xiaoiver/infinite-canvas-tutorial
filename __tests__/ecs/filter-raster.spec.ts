import './filter-test-setup';
import { createCanvas } from 'canvas';
import {
  Circle,
  ComputedBounds,
  ComputedRough,
  ComputedTextMetrics,
  DOMAdapter,
  Ellipse,
  FillLayers,
  FillTexture,
  Filter,
  IconFontEllipseStrokeRasterPlaceholder,
  Line,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
  StrokeLayers,
  Text,
  VectorNetwork,
  type Entity,
} from '../../packages/ecs/src';
import {
  applyTextGlyphMaskToFilterRasterCanvas,
  createFillAndStrokeRgbaRasterForFilter,
  createCanvasGradientForBounds,
  createGradientFillTextRasterForFilter,
  createSolidFillMaskRasterForFilter,
  createStrokeSilhouetteRasterForFilter,
  expandBoundsForCenterCanvasStroke,
  fillCssGradientsStackedInBounds,
  getSdfGeometryBoundsForFilter,
  getStrokeSilhouetteRasterBounds,
  setWorldToCanvasTransform,
  shouldBakeStrokeIntoRasterFilterTexture,
} from '../../packages/ecs/src/utils/solidShapeRasterForFilter';
import { parseGradient } from '../../packages/ecs/src/utils/gradient';
import { pathToVectorNetwork } from '../../packages/ecs/src/utils/vector-network-topology';

// Component reads are the only scene boundary; all raster operations use Cairo.
function shape(...entries: [unknown, unknown][]): Entity {
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
const bounds = { minX: 0, minY: 0, maxX: 40, maxY: 40 };
const geometry: [unknown, unknown][] = [
  [Rect, { x: 10, y: 10, width: 20, height: 20, cornerRadius: 0 }],
  [Circle, { cx: 20, cy: 20, r: 10 }],
  [Ellipse, { cx: 20, cy: 20, rx: 10, ry: 8 }],
];
const stroke = {
  width: 4,
  linejoin: 'round',
  linecap: 'round',
  miterlimit: 4,
  alignment: 'center',
  dasharray: [0, 0],
};
const previousAdapter = DOMAdapter.get();
beforeAll(() => {
  DOMAdapter.set({
    ...previousAdapter,
    createCanvas: (w = 1, h = 1) =>
      createCanvas(w, h) as unknown as HTMLCanvasElement,
  });
});
afterAll(() => {
  DOMAdapter.set(previousAdapter);
});
type Canvas = HTMLCanvasElement | OffscreenCanvas;
const pixel = (canvas: Canvas, x: number, y: number) => [
  ...(canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(
    x,
    y,
    1,
    1,
  ).data,
];
function maxAlpha(canvas: Canvas, y = 0, height = canvas.height) {
  const data = (
    canvas.getContext('2d') as CanvasRenderingContext2D
  ).getImageData(0, y, canvas.width, height).data;
  let max = 0;
  for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]);
  return max;
}
const textShape = (lines = ['M', 'W'], path = '') =>
  shape(
    [
      Text,
      {
        textAlign: 'left',
        textBaseline: 'top',
        anchorX: 0,
        anchorY: 0,
        lineHeight: 24,
        letterSpacing: 0,
        fontKerning: true,
        path,
      },
    ],
    [
      ComputedTextMetrics,
      {
        lines,
        lineMetrics: lines.map(() => ({ x: 2 })),
        font: '24px sans-serif',
        fontMetrics: { fontSize: 24, ascent: 24, descent: 0 },
        lineHeight: 30,
        pathGlyphs: [
          { glyph: 'M', x: 2, y: 24, rotation: 0 },
          { glyph: 'W', x: 42, y: 24, rotation: Math.PI / 8 },
        ],
      },
    ],
  );
const textBounds = { minX: 0, minY: 0, maxX: 80, maxY: 60 };

it('uses the configured canvas adapter without requiring DOM or OffscreenCanvas globals', () => {
  const offscreen = globalThis.OffscreenCanvas;
  const document = globalThis.document;
  globalThis.document = undefined;
  globalThis.OffscreenCanvas = undefined;
  try {
    const canvas = createSolidFillMaskRasterForFilter(
      shape(geometry[0]),
      'red',
      bounds,
      40,
      40,
    );
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
  } finally {
    globalThis.OffscreenCanvas = offscreen;
    globalThis.document = document;
  }
});

it('maps translated fractional world bounds to bitmap pixels', () => {
  const translated = { minX: 100.5, minY: -20.5, maxX: 120.5, maxY: -0.5 };
  const canvas = createSolidFillMaskRasterForFilter(
    shape([
      Rect,
      {
        x: 105.5,
        y: -15.5,
        width: 10,
        height: 10,
        cornerRadius: 0,
      },
    ]),
    'red',
    translated,
    80,
    40,
  );
  expect(pixel(canvas, 40, 20)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 19, 20)[3]).toBe(0);
  expect(pixel(canvas, 60, 20)[3]).toBe(0);
  expect(pixel(canvas, 40, 9)[3]).toBe(0);
  expect(pixel(canvas, 40, 30)[3]).toBe(0);
});

it('resets a previous transform for degenerate bounds and returns the fallback fill', () => {
  const degenerate = { ...bounds, maxX: 0 };
  const canvas = DOMAdapter.get().createCanvas(40, 40);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.translate(100, 200);
  setWorldToCanvasTransform(ctx, degenerate, 40, 40);
  expect(ctx.getTransform().isIdentity).toBe(true);
  const raster = createSolidFillMaskRasterForFilter(
    shape(),
    'blue',
    degenerate,
    40,
    40,
  );
  expect(pixel(raster, 0, 0)).toEqual([0, 0, 255, 255]);
  expect(pixel(raster, 39, 39)).toEqual([0, 0, 255, 255]);
});

it.each([
  createSolidFillMaskRasterForFilter,
  createFillAndStrokeRgbaRasterForFilter,
])(
  'preserves rounded corners after a rectangle is flipped (%p)',
  (rasterize) => {
    const entity = shape(
      [Rect, { x: 30, y: 30, width: -20, height: -20, cornerRadius: 8 }],
      [Stroke, stroke],
      [FillLayers, { layers: [{ type: 'solid', value: 'red' }] }],
    );
    const canvas =
      rasterize === createSolidFillMaskRasterForFilter
        ? rasterize(entity, 'red', bounds, 40, 40)
        : createFillAndStrokeRgbaRasterForFilter(entity, bounds, 40, 40);
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 10, 10)[3]).toBe(0);
    expect(pixel(canvas, 0, 0)[3]).toBe(0);
  },
);

it('preserves evenodd holes in rough contours and ignores incomplete loops', () => {
  const canvas = createSolidFillMaskRasterForFilter(
    shape(
      geometry[0],
      [Rough, {}],
      [
        ComputedRough,
        {
          fillPathPoints: [
            [
              [5, 5],
              [35, 5],
              [35, 35],
              [5, 35],
            ],
            [
              [15, 15],
              [25, 15],
              [25, 25],
              [15, 25],
            ],
            [],
            [[0, 0]],
          ],
        },
      ],
    ),
    'red',
    bounds,
    40,
    40,
  );
  expect(pixel(canvas, 10, 10)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 20, 20)[3]).toBe(0);
  expect(pixel(canvas, 0, 0)[3]).toBe(0);
});

it('falls back to the primitive contour when rough fill points are absent', () => {
  const canvas = createSolidFillMaskRasterForFilter(
    shape(geometry[1], [Rough, {}], [ComputedRough, { fillPathPoints: [] }]),
    'red',
    bounds,
    40,
    40,
  );
  expect(pixel(canvas, 20, 20)[3]).toBe(255);
  expect(pixel(canvas, 10, 10)[3]).toBe(0);
});

it('rasterizes vector-network triangles without filling their bounding box', () => {
  const network = pathToVectorNetwork('M5 5 L35 5 L5 35 Z');
  const canvas = createSolidFillMaskRasterForFilter(
    shape([VectorNetwork, network]),
    'red',
    bounds,
    40,
    40,
  );
  expect(pixel(canvas, 10, 10)).toEqual([255, 0, 0, 255]);
  expect(pixel(canvas, 30, 30)[3]).toBe(0);
});

it.each<[string, [unknown, unknown][], [number, number]]>([
  ['line', [[Line, { x1: 10, y1: 20, x2: 30, y2: 20 }]], [20, 20]],
  [
    'polyline',
    [
      [
        Polyline,
        {
          points: [
            [10, 20],
            [20, 20],
            [30, 20],
          ],
        },
      ],
    ],
    [20, 20],
  ],
  ['circle', [geometry[1]], [10, 20]],
  ['ellipse', [geometry[2]], [10, 20]],
])(
  'creates a white %s stroke with transparent surroundings',
  (_name, entries, point) => {
    const canvas = createStrokeSilhouetteRasterForFilter(
      shape(...entries, [Stroke, stroke]),
      bounds,
      40,
      40,
    );
    expect(pixel(canvas, ...point)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 0, 0)[3]).toBe(0);
    expect(pixel(canvas, 20, 5)[3]).toBe(0);
  },
);

it.each<[unknown, unknown]>([
  [Polyline, { points: [[10, 10]] }],
  [Path, { d: '' }],
  [Path, { d: 'invalid path' }],
])(
  'does not invent a stroke for missing or invalid geometry (%p)',
  (type, data) => {
    expect(
      maxAlpha(
        createStrokeSilhouetteRasterForFilter(
          shape([type, data], [Stroke, stroke]),
          bounds,
          40,
          40,
        ),
      ),
    ).toBe(0);
  },
);

it.each(geometry)(
  'keeps the interior transparent when the %p fill is disabled',
  (type, data) => {
    const canvas = createFillAndStrokeRgbaRasterForFilter(
      shape(
        [type, data],
        [Stroke, stroke],
        [FillLayers, { layers: [{ type: 'solid', value: 'red', opacity: 0 }] }],
        [StrokeLayers, { layers: [{ type: 'solid', value: 'blue' }] }],
      ),
      bounds,
      40,
      40,
    );
    expect(pixel(canvas, 20, 20)[3]).toBe(0);
    expect(pixel(canvas, 9, 20)).toEqual([0, 0, 255, 255]);
  },
);

it('does not turn an icon ellipse stroke placeholder into a filled disk', () => {
  const canvas = createFillAndStrokeRgbaRasterForFilter(
    shape(
      geometry[2],
      [Stroke, stroke],
      [IconFontEllipseStrokeRasterPlaceholder, {}],
      [FillLayers, { layers: [{ type: 'solid', value: 'red' }] }],
      [StrokeLayers, { layers: [{ type: 'solid', value: 'blue' }] }],
    ),
    bounds,
    40,
    40,
  );
  expect(pixel(canvas, 20, 20)[3]).toBe(0);
  expect(pixel(canvas, 9, 20)).toEqual([0, 0, 255, 255]);
});

it.each<[unknown, unknown, number]>([
  [Rect, geometry[0][1], 10],
  [Circle, geometry[1][1], 10],
  [Ellipse, geometry[2][1], 12],
])(
  'uses %p geometry when computed bounds are not ready',
  (type, data, minY) => {
    const expected = { minX: 10, minY, maxX: 30, maxY: 40 - minY };
    expect(getSdfGeometryBoundsForFilter(shape([type, data]))).toEqual(
      expected,
    );
    expect(
      getSdfGeometryBoundsForFilter(
        shape(
          [type, data],
          [
            ComputedBounds,
            {
              geometryBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            },
          ],
        ),
      ),
    ).toEqual(expected);
  },
);

it('prefers computed geometry/render bounds and otherwise includes centered stroke padding', () => {
  const computed = {
    geometryBounds: bounds,
    renderBounds: { minX: -3, minY: -4, maxX: 43, maxY: 44 },
  };
  const entity = shape(geometry[0], [ComputedBounds, computed]);
  expect(getSdfGeometryBoundsForFilter(entity)).toEqual(bounds);
  expect(getSdfGeometryBoundsForFilter(entity)).not.toBe(bounds);
  const fallback = jest.fn(() => bounds);
  expect(getStrokeSilhouetteRasterBounds(entity, fallback)).toEqual(
    computed.renderBounds,
  );
  expect(fallback).not.toHaveBeenCalled();
  expect(
    getStrokeSilhouetteRasterBounds(
      shape(
        [Stroke, stroke],
        [
          ComputedBounds,
          {
            renderBounds: { ...bounds, maxY: 0 },
          },
        ],
      ),
      fallback,
    ),
  ).toEqual({ minX: -2, minY: -2, maxX: 42, maxY: 42 });
  expect(getStrokeSilhouetteRasterBounds(shape(), fallback)).toEqual(bounds);
  expect(expandBoundsForCenterCanvasStroke(bounds, 4)).toEqual({
    minX: -2,
    minY: -2,
    maxX: 42,
    maxY: 42,
  });
  expect(getSdfGeometryBoundsForFilter(shape())).toEqual({
    minX: 0,
    minY: 0,
    maxX: 1,
    maxY: 1,
  });
  expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 40 });
});

it('fills a radial gradient with an opaque center and transparent exterior stop', () => {
  const canvas = DOMAdapter.get().createCanvas(40, 40);
  const gradients = parseGradient(
    'radial-gradient(circle at center, red 0%, transparent 100%)',
  )!;
  fillCssGradientsStackedInBounds(
    canvas.getContext('2d') as CanvasRenderingContext2D,
    gradients,
    bounds,
  );
  expect(pixel(canvas, 20, 20)[0]).toBe(255);
  expect(pixel(canvas, 20, 20)[3]).toBeGreaterThan(240);
  expect(pixel(canvas, 0, 0)[3]).toBeLessThan(15);
});

it('maps gradient stops to translated bounds and skips collapsed radial bounds', () => {
  const canvas = DOMAdapter.get().createCanvas(80, 40);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const g = {
    type: 'linear-gradient' as const,
    angle: 0,
    steps: [
      { offset: { type: 'number' as const, value: -1 }, color: 'red' },
      { offset: { type: 'number' as const, value: 2 }, color: 'blue' },
    ],
  };
  const translated = { ...bounds, minX: 40, maxX: 80 };
  ctx.fillStyle = createCanvasGradientForBounds(ctx, g, translated)!;
  ctx.fillRect(40, 0, 40, 40);
  expect(pixel(canvas, 0, 20)[3]).toBe(0);
  expect(pixel(canvas, 41, 20)[0]).toBeGreaterThan(pixel(canvas, 41, 20)[2]);
  expect(pixel(canvas, 78, 20)[2]).toBeGreaterThan(pixel(canvas, 78, 20)[0]);
  expect(
    createCanvasGradientForBounds(ctx, g, { ...bounds, maxX: 0 }),
  ).toBeNull();
  const radial = parseGradient('radial-gradient(circle at center, red, blue)')!;
  ctx.clearRect(0, 0, 80, 40);
  fillCssGradientsStackedInBounds(ctx, radial, { ...bounds, maxY: 0 });
  expect(maxAlpha(canvas)).toBe(0);
});

const rasterFilter = [
  Filter,
  {
    value:
      'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
  },
] as [unknown, unknown];
it.each(geometry)(
  'bakes a centered solid %p stroke only for a supported raster effect',
  (type, data) => {
    expect(
      shouldBakeStrokeIntoRasterFilterTexture(
        shape([type, data], [Stroke, stroke], rasterFilter),
      ),
    ).toBe(true);
    expect(
      shouldBakeStrokeIntoRasterFilterTexture(
        shape([type, data], [Stroke, stroke]),
      ),
    ).toBe(false);
    expect(
      shouldBakeStrokeIntoRasterFilterTexture(
        shape([type, data], [Stroke, stroke], [Filter, { value: 'none' }]),
      ),
    ).toBe(false);
  },
);

it.each<[string, [unknown, unknown][]]>([
  ['texture', [[FillTexture, {}]]],
  ['rough contour', [[Rough, {}]]],
  [
    'gradient fill',
    [
      [
        FillLayers,
        {
          layers: [
            { type: 'gradient', value: 'linear-gradient(90deg, red, blue)' },
          ],
        },
      ],
    ],
  ],
  [
    'layered fill',
    [
      [
        FillLayers,
        {
          layers: [
            { type: 'solid', value: 'red' },
            { type: 'solid', value: 'blue' },
          ],
        },
      ],
    ],
  ],
  [
    'gradient stroke',
    [
      [
        StrokeLayers,
        {
          layers: [
            { type: 'gradient', value: 'linear-gradient(90deg, red, blue)' },
          ],
        },
      ],
    ],
  ],
  ['zero-width stroke', [[Stroke, { ...stroke, width: 0 }]]],
  ['inside stroke', [[Stroke, { ...stroke, alignment: 'inner' }]]],
  ['dashed stroke', [[Stroke, { ...stroke, dasharray: [2, 2] }]]],
])('keeps %s out of the simple solid stroke bake', (_name, overrides) => {
  expect(
    shouldBakeStrokeIntoRasterFilterTexture(
      shape(geometry[0], [Stroke, stroke], rasterFilter, ...overrides),
    ),
  ).toBe(false);
});

it('requires supported geometry and a stroke, but allows a single solid fill', () => {
  expect(
    shouldBakeStrokeIntoRasterFilterTexture(
      shape([Line, {}], [Stroke, stroke], rasterFilter),
    ),
  ).toBe(false);
  expect(
    shouldBakeStrokeIntoRasterFilterTexture(shape(geometry[0], rasterFilter)),
  ).toBe(false);
  expect(
    shouldBakeStrokeIntoRasterFilterTexture(
      shape(geometry[0], [Stroke, stroke], rasterFilter, [
        FillLayers,
        { layers: [{ type: 'solid', value: 'red' }] },
      ]),
    ),
  ).toBe(true);
});

it.each(geometry)(
  'rasterizes %p contours with transparent exterior and preserved alpha',
  (type, data) => {
    const canvas = createSolidFillMaskRasterForFilter(
      shape([type, data]),
      'rgba(255,0,0,0.5)',
      bounds,
      40,
      40,
    );
    expect(pixel(canvas, 0, 0)[3]).toBe(0);
    expect(pixel(canvas, 20, 20)[3]).toBeCloseTo(127, 0);
    expect(pixel(canvas, 20, 20).slice(0, 3)).toEqual([255, 0, 0]);
  },
);

it.each(geometry)(
  'bakes independent fill and centered stroke alpha for %p',
  (type, data) => {
    const canvas = createFillAndStrokeRgbaRasterForFilter(
      shape(
        [type, data],
        [Stroke, stroke],
        [
          FillLayers,
          { layers: [{ type: 'solid', value: 'red', opacity: 0.5 }] },
        ],
        [
          StrokeLayers,
          { layers: [{ type: 'solid', value: 'blue', opacity: 0.25 }] },
        ],
      ),
      bounds,
      40,
      40,
    );
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 127]);
    const edge = pixel(canvas, 9, 20);
    expect(edge.slice(0, 2)).toEqual([0, 0]);
    // Cairo unpremultiplies 8-bit colors with a possible one-level rounding loss.
    expect(edge[2]).toBeGreaterThanOrEqual(254);
    expect(edge[3]).toBe(63);
    expect(pixel(canvas, 0, 0)[3]).toBe(0);
  },
);

it('keeps both lines when intersecting a gradient with a multiline glyph mask', () => {
  const canvas = createGradientFillTextRasterForFilter(
    textShape(),
    textBounds,
    80,
    60,
    parseGradient('linear-gradient(90deg, red, blue)')!,
    1,
  );
  expect(maxAlpha(canvas, 0, 30)).toBe(255);
  expect(maxAlpha(canvas, 30, 30)).toBe(255);
  expect(pixel(canvas, 79, 59)[3]).toBe(0);
});

it.each([0, 0.25, 0.5, 1])(
  'applies text fill opacity %s exactly once',
  (opacity) => {
    const canvas = createGradientFillTextRasterForFilter(
      textShape(['M']),
      textBounds,
      80,
      60,
      parseGradient('linear-gradient(90deg, red, blue)')!,
      opacity,
    );
    expect(
      Math.abs(maxAlpha(canvas) - Math.round(255 * opacity)),
    ).toBeLessThanOrEqual(1);
  },
);

it('keeps all independently positioned path glyphs in an existing color raster', () => {
  const canvas = DOMAdapter.get().createCanvas(80, 60);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 80, 60);
  applyTextGlyphMaskToFilterRasterCanvas(
    canvas,
    textShape(['MW'], 'M0 0 L80 0'),
    textBounds,
    80,
    60,
  );
  expect(maxAlpha(canvas)).toBe(255);
  expect(pixel(canvas, 79, 59)[3]).toBe(0);
  expect(ctx.globalCompositeOperation).toBe('source-over');
  expect(ctx.globalAlpha).toBe(1);
  expect(ctx.getTransform().isIdentity).toBe(true);
  const right = ctx.getImageData(40, 0, 40, 60).data;
  expect(right.some((value, i) => i % 4 === 3 && value === 255)).toBe(true);
});

it('paints the first CSS gradient above later layers without reordering input', () => {
  const canvas = DOMAdapter.get().createCanvas(40, 40);
  const gradients = parseGradient(
    'linear-gradient(90deg, red, red), linear-gradient(90deg, blue, blue)',
  )!;
  const before = JSON.stringify(gradients);
  fillCssGradientsStackedInBounds(
    canvas.getContext('2d') as CanvasRenderingContext2D,
    gradients,
    bounds,
  );
  expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
  expect(JSON.stringify(gradients)).toBe(before);
});
