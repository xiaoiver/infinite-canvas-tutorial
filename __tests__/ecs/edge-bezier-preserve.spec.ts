import {
  type PathSerializedNode,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import {
  inferEdgePointsPreservingBezierHandles,
  type EdgePathPreserveSnapshot,
} from '../../packages/ecs/src/utils/deserialize/entity';
import { type EdgeState } from '../../packages/ecs/src/utils/binding';
import { normalizePathCommands } from '../../packages/ecs/src/utils/path-edit';
import { transformPath } from '../../packages/ecs/src/utils/serialize';
import { mat3 } from 'gl-matrix';

const rect = (id: string, x: number, y: number): RectSerializedNode => ({
  id,
  type: 'rect',
  zIndex: 0,
  x,
  y,
  width: 10,
  height: 10,
});
const snapshot: EdgePathPreserveSnapshot = {
  d: 'M0 0 Q50 50 100 0',
  x: 0,
  y: 0,
};
const edge = (patch: Partial<PathSerializedNode> = {}): PathSerializedNode => ({
  id: 'edge',
  type: 'path',
  zIndex: 0,
  d: snapshot.d,
  fromId: 'from',
  toId: 'to',
  exitX: 1,
  exitY: 0.5,
  entryX: 0,
  entryY: 0.5,
  ...patch,
});
function worldCommands(node: EdgePathPreserveSnapshot) {
  const m = mat3.fromTranslation(mat3.create(), [node.x, node.y]);
  mat3.rotate(m, m, node.rotation ?? 0);
  mat3.scale(m, m, [node.scaleX ?? 1, node.scaleY ?? 1]);
  return normalizePathCommands(transformPath(node.d, m));
}

it('translates a quadratic curve once when both bound endpoints move together', () => {
  const node = edge();
  expect(
    inferEdgePointsPreservingBezierHandles(
      rect('from', 0, 15),
      rect('to', 110, 15),
      node as EdgeState,
      snapshot,
    ),
  ).toBe(true);
  expect(worldCommands(node as EdgePathPreserveSnapshot)).toEqual([
    ['M', 10, 20],
    ['Q', 60, 70, 110, 20],
  ]);
});

it.each([
  ['quadratic', 'M0 0 Q50 50 100 0'],
  ['cubic', 'M0 0 C20 40 80 40 100 0'],
])(
  'preserves %s endpoint controls with separate endpoint movements',
  (_name, d) => {
    const node = edge({ d });
    expect(
      inferEdgePointsPreservingBezierHandles(
        rect('from', 0, 15),
        rect('to', 130, -15),
        node as EdgeState,
        { ...snapshot, d },
      ),
    ).toBe(true);
    expect(worldCommands(node as EdgePathPreserveSnapshot)).toEqual(
      d.includes('Q')
        ? [
            ['M', 10, 20],
            ['Q', 70, 55, 130, -10],
          ]
        : [
            ['M', 10, 20],
            ['C', 30, 60, 110, 30, 130, -10],
          ],
    );
  },
);

it.each([
  [
    'start',
    { fromId: 'from', toId: undefined, targetPoint: { x: 999, y: 999 } },
    [
      ['M', 10, 20],
      ['C', 30, 60, 80, 40, 100, 0],
    ],
  ],
  [
    'end',
    { fromId: undefined, toId: 'to', sourcePoint: { x: -999, y: -999 } },
    [
      ['M', 0, 0],
      ['C', 20, 40, 110, 30, 130, -10],
    ],
  ],
  [
    'neither',
    {
      fromId: undefined,
      toId: undefined,
      sourcePoint: { x: -999, y: -999 },
      targetPoint: { x: 999, y: 999 },
    },
    [
      ['M', 0, 0],
      ['C', 20, 40, 80, 40, 100, 0],
    ],
  ],
] as const)(
  'moves only the %s bound end, ignoring stale floating coordinates',
  (which, patch, expected) => {
    const d = 'M0 0 C20 40 80 40 100 0';
    const node = edge({ ...patch, d });
    expect(
      inferEdgePointsPreservingBezierHandles(
        which === 'start' ? rect('from', 0, 15) : null,
        which === 'end' ? rect('to', 130, -15) : null,
        node as EdgeState,
        { ...snapshot, d },
      ),
    ).toBe(true);
    expect(worldCommands(node as EdgePathPreserveSnapshot)).toEqual(expected);
  },
);

it.each([
  { rotation: 0, scaleX: 1, scaleY: 1 },
  { rotation: Math.PI / 2, scaleX: 1, scaleY: 1 },
  { rotation: -Math.PI / 2, scaleX: -2, scaleY: 3 },
  { rotation: Math.PI, scaleX: 2, scaleY: -1 },
])('keeps world-space cubic tangents under transform %j', (transform) => {
  const snap = {
    ...snapshot,
    ...transform,
    x: 30,
    y: 40,
    d: 'M0 0 C20 40 80 40 100 0',
  };
  const toWorld = (x: number, y: number) => [
    30 +
      x * transform.scaleX * Math.cos(transform.rotation) -
      y * transform.scaleY * Math.sin(transform.rotation),
    40 +
      x * transform.scaleX * Math.sin(transform.rotation) +
      y * transform.scaleY * Math.cos(transform.rotation),
  ];
  const start = toWorld(0, 0),
    end = toWorld(100, 0);
  const node = edge(snap);
  expect(
    inferEdgePointsPreservingBezierHandles(
      rect('from', start[0], start[1] + 15),
      rect('to', end[0] + 30, end[1] - 15),
      node as EdgeState,
      snap,
    ),
  ).toBe(true);
  const actual = worldCommands(node as EdgePathPreserveSnapshot);
  const c1 = toWorld(20, 40),
    c2 = toWorld(80, 40);
  const expected = [
    start[0] + 10,
    start[1] + 20,
    c1[0] + 10,
    c1[1] + 20,
    c2[0] + 30,
    c2[1] - 10,
    end[0] + 30,
    end[1] - 10,
  ];
  const coords = actual.flatMap((c) => c.slice(1) as number[]);
  coords.forEach((n, i) => expect(n).toBeCloseTo(expected[i], 1));
  expect(node).toMatchObject(transform);
  expect(node.width).toBeGreaterThan(0);
  expect(node.height).toBeGreaterThan(0);
  expect(node).not.toHaveProperty('absolutePoints');
});

it.each([
  '',
  'M0 0',
  'M0 0 L100 0',
  'M0 0 C20 40 80 40 100 0 Q150 50 200 0',
  'M0 0 C20 40 80 40 100 0 C120 40 180 40 200 0',
  'M0 0 Q50 50 100 0 Q150 50 200 0',
  'M0 0 L10 0 C20 40 80 40 100 0',
  'M0 0 Q50 50 100 0 Z',
])('leaves unsupported geometry unchanged for the router: %s', (d) => {
  const node = edge({ d });
  const original = structuredClone(node);
  expect(
    inferEdgePointsPreservingBezierHandles(
      rect('from', 0, 15),
      rect('to', 130, -15),
      node as EdgeState,
      { ...snapshot, d },
    ),
  ).toBe(false);
  expect(node).toEqual(original);
});

it('returns false when a required endpoint cannot be resolved', () => {
  const node = edge();
  const original = structuredClone(node);
  expect(
    inferEdgePointsPreservingBezierHandles(
      null,
      null,
      node as EdgeState,
      snapshot,
    ),
  ).toBe(false);
  expect(node).toEqual(original);
});

it('keeps a trailing straight endpoint while moving the adjacent cubic control', () => {
  const d = 'M0 0 C20 40 60 40 80 0 L100 0';
  const node = edge({ d });
  expect(
    inferEdgePointsPreservingBezierHandles(
      rect('from', 0, 15),
      rect('to', 130, -15),
      node as EdgeState,
      { ...snapshot, d },
    ),
  ).toBe(true);
  expect(worldCommands(node as EdgePathPreserveSnapshot)).toEqual([
    ['M', 10, 20],
    ['C', 30, 60, 60, 40, 80, 0],
    ['L', 130, -10],
  ]);
});
