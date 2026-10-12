import './filter-test-setup';
import {
  Children,
  Circle,
  Ellipse,
  Filter,
  IconFont,
  Line,
  Path,
  Polyline,
  Rect,
  Rough,
  Stroke,
  StrokeLayers,
  type Entity,
} from '../../packages/ecs/src';
import {
  getRasterFilterValueForShape,
  shouldRasterizeStrokeForFilterTexture,
} from '../../packages/ecs/src/utils/filterEntity';
function entity(...entries: [unknown, unknown][]): Entity {
  const components = new Map(entries);
  return {
    has: (type: unknown) => components.has(type),
    hasSomeOf: (...types: unknown[]) =>
      types.some((type) => components.has(type)),
    read: (type: unknown) => {
      if (!components.has(type)) throw new Error('Unexpected component read');
      return components.get(type);
    },
  } as unknown as Entity;
}
const solid = [{ type: 'solid', value: 'red' }];
const stroke = (type: unknown = Path, ...extra: [unknown, unknown][]) =>
  entity(
    [type, {}],
    [Stroke, { width: 4, alignment: 'center', dasharray: [0, 0] }],
    [StrokeLayers, { layers: solid }],
    [Filter, { value: 'blur(4px)' }],
    ...extra,
  );
it('own filter wins over icon ancestors and reflects mutations without caching', () => {
  const parent = entity([IconFont, {}], [Filter, { value: 'blur(4px)' }]);
  const value = { value: 'brightness(0.2)' };
  const child = entity([Filter, value], [Children, { parent }]);
  expect(getRasterFilterValueForShape(child)).toBe('brightness(0.2)');
  value.value = '';
  expect(getRasterFilterValueForShape(child)).toBe('blur(4px)');
  value.value = 'contrast(0.4)';
  expect(getRasterFilterValueForShape(child)).toBe('contrast(0.4)');
});
it('skips ordinary parents and icons without a filter to find the nearest filtered icon', () => {
  const outer = entity([IconFont, {}], [Filter, { value: 'blur(2px)' }]);
  const parent = entity(
    [Filter, { value: 'noise(0.1)' }],
    [Children, { parent: outer }],
  );
  const icon = entity([IconFont, {}], [Children, { parent }]);
  expect(
    getRasterFilterValueForShape(entity([Children, { parent: icon }])),
  ).toBe('blur(2px)');
});
it('an empty nearest icon filter prevents falling through to an outer icon', () => {
  const outer = entity([IconFont, {}], [Filter, { value: 'blur(2px)' }]);
  const nearest = entity(
    [IconFont, {}],
    [Filter, { value: '' }],
    [Children, { parent: outer }],
  );
  expect(
    getRasterFilterValueForShape(entity([Children, { parent: nearest }])),
  ).toBeUndefined();
});
it.each([undefined, null])(
  'handles a missing parent %p without reading it',
  (parent) => {
    expect(
      getRasterFilterValueForShape(entity([Children, { parent }])),
    ).toBeUndefined();
    expect(
      shouldRasterizeStrokeForFilterTexture(
        stroke(Path, [Children, { parent }]),
      ),
    ).toBe(true);
  },
);
it('does not inherit filter strings from ordinary groups', () => {
  const parent = entity([Filter, { value: 'blur(2px)' }]);
  expect(
    getRasterFilterValueForShape(entity([Children, { parent }])),
  ).toBeUndefined();
  expect(getRasterFilterValueForShape(entity())).toBeUndefined();
});
it.each([63, 64, 65])(
  'bounds icon ancestor lookup at 64 links (depth %i)',
  (depth) => {
    let parent = entity([IconFont, {}], [Filter, { value: 'blur(2px)' }]);
    for (let i = 1; i < depth; i++) parent = entity([Children, { parent }]);
    const child = entity([Children, { parent }]);
    expect(getRasterFilterValueForShape(child)).toBe(
      depth <= 64 ? 'blur(2px)' : undefined,
    );
    expect(
      shouldRasterizeStrokeForFilterTexture(
        stroke(Circle, [Children, { parent }]),
      ),
    ).toBe(depth <= 64);
  },
);
it('terminates on cyclic parent links for both filter and stroke lookup', () => {
  const link: { parent?: Entity } = {};
  const child = entity([Children, link]);
  link.parent = child;
  expect(getRasterFilterValueForShape(child)).toBeUndefined();
  expect(
    shouldRasterizeStrokeForFilterTexture(stroke(Circle, [Children, link])),
  ).toBe(false);
});
it.each([Path, Polyline, Line])(
  'rasterizes a valid centered %p stroke',
  (type) => {
    expect(shouldRasterizeStrokeForFilterTexture(stroke(type))).toBe(true);
  },
);
it.each([Circle, Ellipse, Rect])(
  'leaves ordinary %p primitives on their fill/stroke path',
  (type) => {
    expect(shouldRasterizeStrokeForFilterTexture(stroke(type))).toBe(false);
  },
);
it.each([Path, Polyline, Line, Circle, Ellipse, Rect])(
  'routes icon %p children according to supported silhouette geometry',
  (type) => {
    const parent = entity([IconFont, {}]);
    expect(
      shouldRasterizeStrokeForFilterTexture(
        stroke(
          type,
          [Children, { parent }],
          [Stroke, { width: 4, alignment: 'outer', dasharray: [0, 0] }],
        ),
      ),
    ).toBe(type !== Rect);
  },
);
it.each(['inner', 'outer'])(
  'keeps ordinary %s-aligned strokes out of center silhouette rasterization',
  (alignment) => {
    expect(
      shouldRasterizeStrokeForFilterTexture(
        stroke(Path, [Stroke, { width: 4, alignment, dasharray: [0, 0] }]),
      ),
    ).toBe(false);
  },
);
it.each([
  [
    'gradient',
    [
      StrokeLayers,
      {
        layers: [
          { type: 'gradient', value: 'linear-gradient(0deg, red, blue)' },
        ],
      },
    ],
  ],
  ['no filter', [Filter, { value: '' }]],
  ['inline adjustment', [Filter, { value: 'saturate(1)' }]],
  ['zero width', [Stroke, { width: 0 }]],
  ['no paint', [StrokeLayers, { layers: [] }]],
  [
    'disabled paint',
    [
      StrokeLayers,
      { layers: [{ type: 'solid', value: 'red', enabled: false }] },
    ],
  ],
  ['rough paint', [Rough, {}]],
] as [string, [unknown, unknown]][])(
  'does not rasterize %s as an ordinary filtered stroke',
  (_name, entry) => {
    expect(shouldRasterizeStrokeForFilterTexture(stroke(Path, entry))).toBe(
      false,
    );
  },
);
it.each([
  [4, 3, false],
  [0, 3, true],
  [4, 0, true],
])('uses the stroke dash pair %p/%p consistently', (a, b, expected) => {
  expect(
    shouldRasterizeStrokeForFilterTexture(
      stroke(Path, [
        Stroke,
        { width: 4, alignment: 'center', dasharray: [a, b] },
      ]),
    ),
  ).toBe(expected);
});
