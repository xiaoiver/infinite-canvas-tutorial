import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import {
  checkerImage,
  paintReference,
  svgExportFixture,
} from '../helpers/svg-export';

let fixture: ReturnType<typeof svgExportFixture>;
let image: string;
beforeAll(() => {
  fixture = svgExportFixture();
  image = checkerImage();
});
afterAll(() => fixture.dispose());

it('shares matching fill and stroke definitions within one node', async () => {
  const paint = { type: 'pattern' as const, value: image };
  const svg = await fixture.export([
    rect({ fills: [paint], strokes: [paint], strokeWidth: 4 }),
  ]);
  const shape = svg.querySelector('rect')!;
  expect(paintReference(svg, shape, 'stroke')).toBe(
    paintReference(svg, shape, 'fill'),
  );
  expect(svg.querySelectorAll('pattern')).toHaveLength(1);
});

it.each(['inner', 'outer'] as const)(
  'keeps pattern stroke on the %s aligned stroke copy',
  async (strokeAlignment) => {
    const svg = await fixture.export([
      rect({
        fills: [{ type: 'solid', value: '#fff' }],
        strokes: [{ type: 'pattern', value: image }],
        strokeWidth: 4,
        strokeAlignment,
      }),
    ]);
    const [fill, stroke] = Array.from(svg.querySelectorAll('rect'));
    expect(fill.getAttribute('stroke')).toBe('none');
    expect(stroke.getAttribute('fill')).toBe('none');
    expect(
      paintReference(svg, stroke, 'stroke').querySelector('image'),
    ).not.toBeNull();
  },
);

it('rejects an undecodable pattern instead of emitting a broken resource', async () => {
  await expect(
    fixture.export([
      rect({
        fills: [{ type: 'pattern', value: 'data:image/png;base64,broken' }],
      }),
    ]),
  ).rejects.toThrow();
});

const rect = (patch: Partial<RectSerializedNode> = {}): RectSerializedNode => ({
  id: 'rect',
  type: 'rect',
  zIndex: 0,
  x: 37,
  y: 19,
  width: 80,
  height: 40,
  ...patch,
});

it.each([
  ['repeat', 8, 4],
  ['repeat-x', 8, 40],
  ['repeat-y', 80, 4],
  ['no-repeat', 80, 40],
] as const)(
  'exports %s using natural image dimensions in local coordinates',
  async (repetition, width, height) => {
    const svg = await fixture.export([
      rect({ fills: [{ type: 'pattern', value: image, repetition }] }),
    ]);
    const pattern = paintReference(svg, svg.querySelector('rect')!, 'fill');
    expect(pattern.localName).toBe('pattern');
    expect(pattern.getAttribute('patternUnits')).toBe('userSpaceOnUse');
    expect(pattern.getAttribute('x')).toBe('0');
    expect(pattern.getAttribute('y')).toBe('0');
    expect(Number(pattern.getAttribute('width'))).toBe(width);
    expect(Number(pattern.getAttribute('height'))).toBe(height);
    const tile = pattern.querySelector('image')!;
    expect(Number(tile.getAttribute('width'))).toBe(8);
    expect(Number(tile.getAttribute('height'))).toBe(4);
    expect(tile.getAttribute('href')).toMatch(/^data:image\/png/);
    expect(svg.querySelector('#node-rect')!.getAttribute('transform')).toBe(
      'matrix(1,0,0,1,37,19)',
    );
  },
);

it('keeps repetition, transform and opacity on a pattern stroke', async () => {
  const svg = await fixture.export([
    rect({
      fills: [],
      strokeWidth: 6,
      strokes: [
        {
          type: 'pattern',
          value: image,
          repetition: 'repeat-y',
          transform: 'rotate(30)',
          opacity: 0.35,
        },
      ],
    }),
  ]);
  const shape = svg.querySelector('rect')!;
  const pattern = paintReference(svg, shape, 'stroke');
  expect(shape.getAttribute('fill')).toBe('none');
  expect(shape.getAttribute('stroke-opacity')).toBe('0.35');
  expect(pattern.getAttribute('patternTransform')).toBe('rotate(30)');
  expect(pattern.getAttribute('width')).toBe('80');
  expect(pattern.getAttribute('height')).toBe('4');
});

it('does not reuse a pattern definition with a different node repetition extent', async () => {
  const svg = await fixture.export([
    rect({
      id: 'small',
      fills: [{ type: 'pattern', value: image, repetition: 'no-repeat' }],
    }),
    rect({
      id: 'large',
      width: 160,
      height: 100,
      fills: [{ type: 'pattern', value: image, repetition: 'no-repeat' }],
    }),
  ]);
  const shapes = svg.querySelectorAll('rect');
  const small = paintReference(svg, shapes[0], 'fill');
  const large = paintReference(svg, shapes[1], 'fill');
  expect(small.getAttribute('width')).toBe('80');
  expect(large.getAttribute('width')).toBe('160');
  expect(large.getAttribute('height')).toBe('100');
});

it('selects the first enabled pattern and leaves source layers unchanged', async () => {
  const node = rect({
    fills: [
      { type: 'solid', value: '#00ff00', enabled: false },
      { type: 'pattern', value: image, transform: 'scale(2)', opacity: 0.4 },
    ],
  });
  const original = structuredClone(node);
  const svg = await fixture.export([node]);
  const shape = svg.querySelector('rect')!;
  expect(
    paintReference(svg, shape, 'fill').getAttribute('patternTransform'),
  ).toBe('scale(2)');
  expect(shape.getAttribute('fill-opacity')).toBe('0.4');
  expect(node).toEqual(original);
});

it('keeps ordinary image fill stretched instead of tiled', async () => {
  const svg = await fixture.export([
    rect({ fills: [{ type: 'image', value: image }] }),
  ]);
  const pattern = paintReference(svg, svg.querySelector('rect')!, 'fill');
  expect(pattern.getAttribute('patternUnits')).toBe('objectBoundingBox');
  expect(pattern.getAttribute('width')).toBe('1');
  expect(
    pattern.querySelector('image')!.getAttribute('preserveAspectRatio'),
  ).toBe('none');
});
