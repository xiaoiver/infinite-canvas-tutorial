import { Path } from '../../packages/ecs/src';
import { resolveIconifyBodyToScalablePrimitives } from '../../packages/ecs/src/utils/icon-font';

it('inherits nested group styles across paired and self-closing shapes', () => {
  const body =
    '<g fill="red" stroke="black">' +
    '<path d="M0 0H10V10H0Z"/>' +
    '<g fill="blue"><ellipse cx="15" cy="5" rx="3" ry="2"></ellipse></g>' +
    '<line x1="0" y1="15" x2="20" y2="15" stroke="green"/>' +
    '</g>';
  const primitives = resolveIconifyBodyToScalablePrimitives(
    body,
    40,
    40,
    20,
    20,
  );

  expect(primitives?.map((primitive) => primitive.kind)).toEqual([
    'path',
    'ellipse',
    'line',
  ]);
  expect(primitives?.map((primitive) => primitive.style)).toMatchObject([
    { fill: 'red', stroke: 'black' },
    { fill: 'blue', stroke: 'black' },
    { fill: 'red', stroke: 'green' },
  ]);
  expect(primitives?.[1]).toMatchObject({
    kind: 'ellipse',
    cx: 30,
    cy: 10,
    rx: 6,
    ry: 4,
  });
  expect(primitives?.[2]).toMatchObject({
    kind: 'line',
    x1: 0,
    y1: 30,
    x2: 40,
    y2: 30,
  });
});

it('keeps recognized shapes inside unsupported wrappers', () => {
  const primitives = resolveIconifyBodyToScalablePrimitives(
    '<svg><title>Icon</title><g fill="currentColor"><circle cx="5" cy="5" r="5"/></g></svg>',
    20,
    20,
    10,
    10,
  );

  expect(primitives).toEqual([
    {
      kind: 'ellipse',
      cx: 10,
      cy: 10,
      rx: 10,
      ry: 10,
      style: expect.objectContaining({ fill: 'currentColor' }),
    },
  ]);
});

it('clamps rounded rect corners and keeps the resulting geometry in its viewBox', () => {
  const [rounded] = resolveIconifyBodyToScalablePrimitives(
    '<rect x="2" y="3" width="10" height="6" rx="20" fill="orange"/>',
    10,
    6,
    10,
    6,
    2,
    3,
  )!;

  expect(rounded.kind).toBe('path');
  if (rounded.kind !== 'path') throw new Error('Expected a path');
  expect(rounded.d).toMatch(/[Aa]3 3/);
  expect(Path.getGeometryBounds({ d: rounded.d })).toMatchObject({
    minX: 0,
    minY: 0,
    maxX: 10,
    maxY: 6,
  });
  expect(rounded.style.fill).toBe('orange');
});

it('normalizes multiple shapes by their union when no viewBox is provided', () => {
  const primitives = resolveIconifyBodyToScalablePrimitives(
    '<rect x="10" y="20" width="10" height="10"/>' +
      '<circle cx="25" cy="25" r="5"/>',
    40,
    20,
  );

  expect(primitives).toHaveLength(2);
  expect(primitives?.[1]).toMatchObject({
    kind: 'ellipse',
    cx: 30,
    cy: 10,
    rx: 10,
    ry: 10,
  });
});

it.each([
  '',
  '<g><title>no geometry</title></g>',
  '<rect width="0" height="20"/>',
  '<path/>',
])('returns no primitives for a body without usable geometry: %s', (body) => {
  expect(resolveIconifyBodyToScalablePrimitives(body, 24, 24)).toBeNull();
});
