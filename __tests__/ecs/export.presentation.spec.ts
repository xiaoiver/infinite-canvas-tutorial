import type {
  HitStrokeInteractionAttributes,
  RectSerializedNode,
  TextSerializedNode,
} from '../../packages/ecs/src/types/serialized-node';
import {
  checkerImage,
  paintReference,
  svgExportFixture,
} from '../helpers/svg-export';

let fixture: ReturnType<typeof svgExportFixture>;
beforeAll(() => {
  fixture = svgExportFixture();
});
afterAll(() => fixture.dispose());

const rect = (
  patch: Partial<RectSerializedNode & HitStrokeInteractionAttributes> = {},
): RectSerializedNode => ({
  id: 'r',
  type: 'rect',
  zIndex: 0,
  x: 20,
  y: 30,
  width: 80,
  height: 40,
  fills: [{ type: 'solid', value: '#f00' }],
  ...patch,
});

it.each([0, 12, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'writes finite nonnegative hit width %s as metadata',
  async (hitStrokeWidth) => {
    const svg = await fixture.export([rect({ hitStrokeWidth })]);
    const root = svg.querySelector('#node-r')!;
    expect(root.getAttribute('data-hit-stroke-width')).toBe(
      Number.isFinite(hitStrokeWidth) && hitStrokeWidth >= 0
        ? String(hitStrokeWidth)
        : null,
    );
    expect(root.hasAttribute('hit-stroke-width')).toBe(false);
  },
);

it('writes metadata and visibility on a wrapped root without leaking the object', async () => {
  const svg = await fixture.export([
    rect({
      strokes: [{ type: 'solid', value: '#000' }],
      strokeWidth: 4,
      strokeAlignment: 'outer',
      visibility: 'hidden',
      hitStrokeWidth: 8,
      svgDataAttributes: {
        nodeKind: 'diagram',
        'data-action': 'edit',
        empty: '',
      },
    }),
  ]);
  const root = svg.querySelector('#node-r')!;
  expect(root.localName).toBe('g');
  expect(root.getAttribute('data-node-kind')).toBe('diagram');
  expect(root.getAttribute('data-action')).toBe('edit');
  expect(root.getAttribute('data-empty')).toBeNull();
  expect(root.getAttribute('data-hit-stroke-width')).toBe('8');
  expect(root.getAttribute('visibility')).toBe('hidden');
  expect(svg.outerHTML).not.toMatch(/\[object Object\]|svg-data-attributes/);
});

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 50])(
  'clamps corner radius %s to valid local half-extents',
  async (cornerRadius) => {
    const svg = await fixture.export([rect({ cornerRadius })]);
    const shape = svg.querySelector('rect')!;
    expect(shape.getAttribute('rx')).toBe(cornerRadius === 50 ? '20' : null);
    expect(shape.getAttribute('ry')).toBe(shape.getAttribute('rx'));
  },
);

it.each(['gradient', 'image', 'pattern', 'multi-gradient'] as const)(
  'keeps text and %s paint definitions in the same exported group',
  async (type) => {
    const node: TextSerializedNode = {
      id: 'text',
      type: 'text',
      zIndex: 0,
      x: 20,
      y: 30,
      width: 80,
      height: 20,
      fontFamily: 'sans-serif',
      fontSize: 16,
      content: 'SVG',
      letterSpacing: 0,
      fills: [
        {
          type: type === 'multi-gradient' ? 'gradient' : type,
          value:
            type === 'gradient'
              ? 'linear-gradient(90deg, red, blue)'
              : type === 'multi-gradient'
              ? 'linear-gradient(90deg, red, blue), linear-gradient(0deg, blue, red)'
              : checkerImage(),
        },
      ],
    };
    const svg = await fixture.export([node]);
    const text = svg.querySelector('text');
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe('SVG');
    if (type === 'multi-gradient') {
      expect(text!.getAttribute('fill')).toBe('black');
      expect(paintReference(svg, text!, 'filter').localName).toBe('filter');
      expect(svg.querySelectorAll('linearGradient')).toHaveLength(2);
      return;
    }
    const definition = paintReference(svg, text!, 'fill');
    expect(definition.localName).toBe(
      type === 'gradient' ? 'linearGradient' : 'pattern',
    );
    expect(text!.getAttribute('font-family')).toBe('sans-serif');
  },
);
