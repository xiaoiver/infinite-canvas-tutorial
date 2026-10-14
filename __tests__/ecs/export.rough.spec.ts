import type { SerializedNode } from '../../packages/ecs/src/types/serialized-node';
import { rasterizeSvg, svgExportFixture } from '../helpers/svg-export';
import { svgElementsToSerializedNodes } from '../../packages/ecs/src/utils/deserialize/svg';

let fixture: ReturnType<typeof svgExportFixture>;
beforeAll(() => {
  fixture = svgExportFixture();
});
afterAll(() => fixture.dispose());

it.each([0, '0', '0.25', 1, 2, -1])(
  'normalizes rough fill and stroke opacity %s without losing zero',
  async (opacity) => {
    const svg = await fixture.export([
      rough({
        fills: [{ type: 'solid', value: '#ff0000', opacity }],
        strokes: [{ type: 'solid', value: '#0000ff', opacity }],
      }),
    ]);
    const expected = Math.max(0, Math.min(1, Number(opacity)));
    const fill = svg.querySelector('path[fill="#ff0000"]')!;
    const outline = svg.querySelector('path[stroke="#0000ff"]')!;
    expect(Number(fill.getAttribute('fill-opacity') ?? 1)).toBe(expected);
    expect(Number(outline.getAttribute('stroke-opacity') ?? 1)).toBe(expected);
  },
);

it('renders node opacity multiplied by fill opacity', async () => {
  const raster = await rasterizeSvg(await fixture.export([rough()]));
  const [r, g, b, alpha] = raster.pixel(80, 50);
  expect([r, g, b]).toEqual([255, 0, 0]);
  expect(alpha).toBeGreaterThanOrEqual(50);
  expect(alpha).toBeLessThanOrEqual(52);
});

it('preserves rough path pixels through SVG import and re-export', async () => {
  const first = await fixture.export([rough()]);
  const imported = svgElementsToSerializedNodes(
    Array.from(first.children) as SVGElement[],
  );
  expect(imported.some((node) => node.type === 'path')).toBe(true);
  const again = await fixture.export(imported);
  expect((await rasterizeSvg(again)).pixels()).toEqual(
    (await rasterizeSvg(first)).pixels(),
  );
});

const rough = (patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id: 'rough',
    type: 'rough-rect',
    zIndex: 0,
    x: 40,
    y: 30,
    width: 80,
    height: 40,
    fills: [{ type: 'solid', value: '#ff0000', opacity: 0.4 }],
    strokes: [{ type: 'solid', value: '#0000ff', opacity: 0.6 }],
    strokeWidth: 4,
    roughSeed: 42,
    roughRoughness: 0,
    roughFillStyle: 'solid',
    opacity: 0.5,
    ...patch,
  } as SerializedNode);

it.each(['solid', 'hachure', 'watercolor'] as const)(
  'preserves independent paint and node opacity for %s',
  async (roughFillStyle) => {
    const svg = await fixture.export([rough({ roughFillStyle })]);
    const group = svg.querySelector('#node-rough')!;
    expect(group.getAttribute('opacity')).toBe('0.5');
    const outline = group.querySelector('path[stroke="#0000ff"]')!;
    expect(outline.getAttribute('stroke-opacity')).toBe('0.6');
    if (roughFillStyle === 'hachure') {
      expect(
        group
          .querySelector('path[stroke="#ff0000"]')!
          .getAttribute('stroke-opacity'),
      ).toBe('0.4');
    } else {
      const filled = group.querySelector('path[fill="#ff0000"]')!;
      const opacity = Number(filled.getAttribute('fill-opacity'));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(0.4);
      if (roughFillStyle === 'solid') expect(opacity).toBe(0.4);
    }
  },
);

it.each([
  [undefined, 2],
  [-1, 2],
  [1.25, 1.25],
])(
  'exports fill weight %s separately from the outline',
  async (roughFillWeight, expected) => {
    const svg = await fixture.export([
      rough({ roughFillStyle: 'hachure', roughFillWeight }),
    ]);
    expect(
      svg.querySelector('path[stroke="#ff0000"]')!.getAttribute('stroke-width'),
    ).toBe(String(expected));
    expect(
      svg.querySelector('path[stroke="#0000ff"]')!.getAttribute('stroke-width'),
    ).toBe('4');
  },
);

it.each([
  { type: 'rough-line', x1: 0, y1: 0, x2: 80, y2: 40 },
  { type: 'rough-path', d: 'M0 0 L80 0 L80 40 Z' },
  { type: 'rough-polyline', points: '0,0 80,0 80,40' },
  { type: 'rough-ellipse' },
  { type: 'rough-rect' },
] as const)(
  'applies $type translation only to the SVG group',
  async (geometry) => {
    const [a, b] = await Promise.all([
      fixture.export([rough({ ...geometry, x: 0, y: 0 })]),
      fixture.export([rough({ ...geometry, x: 40, y: 30 })]),
    ]);
    const paths = (svg: SVGElement) =>
      Array.from(svg.querySelectorAll('path'), (p) => p.getAttribute('d'));
    expect(paths(b)).toEqual(paths(a));
    expect(paths(b).length).toBeGreaterThan(0);
    expect(paths(b).join(' ')).not.toMatch(/NaN|undefined/);
    expect(b.querySelector('#node-rough')!.getAttribute('transform')).toBe(
      'matrix(1,0,0,1,40,30)',
    );
  },
);
