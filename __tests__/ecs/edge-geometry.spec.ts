import {
  EdgeStyle,
  type EdgeSerializedNode,
  type SerializedNode,
} from '../../packages/ecs/src';
import {
  edgeEndsResolvable,
  getWorldTerminalOfEdge,
  hasTerminalPoint,
  inferEdgePoints,
  inferEdgeTerminalWorldPoints,
  inferPointsWithFromIdAndToId,
  polylineVertexApproxFromPathD,
} from '../../packages/ecs/src/utils/deserialize/entity';
import { type EdgeState } from '../../packages/ecs/src/utils/binding';
import { normalizePathCommands } from '../../packages/ecs/src/utils/path-edit';

it.each([
  [undefined, false],
  [null, false],
  [{ x: 0, y: 0 }, true],
  [{ x: -2.5, y: 3 }, true],
  [{ x: NaN, y: 0 }, false],
  [{ x: 0, y: Infinity }, false],
] as const)('validates finite terminal %j', (point, expected) =>
  expect(hasTerminalPoint(point)).toBe(expected),
);

const node: SerializedNode = {
  id: 'node',
  type: 'rect',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 20,
  height: 40,
};
const base = { id: 'edge', zIndex: 0 };
it.each([
  [node, node, {}, true],
  [null, node, { sourcePoint: { x: 0, y: 0 } }, true],
  [node, null, { targetPoint: { x: 0, y: 0 } }, true],
  [
    null,
    null,
    { sourcePoint: { x: 0, y: 0 }, targetPoint: { x: 0, y: 0 } },
    true,
  ],
  [null, node, { sourcePoint: { x: NaN, y: 0 } }, false],
  [node, null, {}, false],
] as const)(
  'resolves both bound/floating ends %j %j %j',
  (from, to, patch, expected) => {
    expect(
      edgeEndsResolvable(
        { ...base, type: 'line', x1: 0, y1: 0, x2: 0, y2: 0, ...patch },
        from,
        to,
      ),
    ).toBe(expected);
  },
);

it.each([
  [
    'M10 20 L30 40',
    [
      [10, 20],
      [30, 40],
    ],
  ],
  [
    'm10 20 h30 v40',
    [
      [10, 20],
      [40, 20],
      [40, 60],
    ],
  ],
  [
    'M0 0 Q10 20 30 40 T60 0',
    [
      [0, 0],
      [30, 40],
      [60, 0],
    ],
  ],
  [
    'M0 0 C10 20 20 20 30 0 S50 -20 60 0',
    [
      [0, 0],
      [30, 0],
      [60, 0],
    ],
  ],
  [
    'M0 0 A20 20 0 0 1 40 0',
    [
      [0, 0],
      [40, 0],
    ],
  ],
  ['', null],
  ['M10 20', null],
] as const)(
  'keeps command endpoints for label interpolation: %s',
  (d, expected) => {
    expect(polylineVertexApproxFromPathD(d)).toEqual(expected);
  },
);

it.each([
  'line',
  'rough-line',
  'polyline',
  'rough-polyline',
  'path',
  'rough-path',
] as const)('finds %s endpoints after local normalization', (type) => {
  const edge = {
    ...base,
    type,
    x: 10,
    y: 20,
    x1: -5,
    y1: 3,
    x2: 15,
    y2: 7,
    points: '-5,3 15,7',
    d: 'M-5 3 Q10 50 15 7',
  } as SerializedNode;
  expect(getWorldTerminalOfEdge(edge, 'start')).toEqual({ x: 5, y: 23 });
  expect(getWorldTerminalOfEdge(edge, 'end')).toEqual({ x: 25, y: 27 });
});

it.each([
  { ...base, type: 'rect', width: 10, height: 10 },
  { ...base, type: 'path', d: '' },
  { ...base, type: 'polyline', points: '' },
] as SerializedNode[])(
  'returns no terminal for unsupported or empty geometry %j',
  (edge) => {
    expect(getWorldTerminalOfEdge(edge, 'start')).toBeNull();
    expect(getWorldTerminalOfEdge(edge, 'end')).toBeNull();
  },
);

it.each([
  'line',
  'rough-line',
  'polyline',
  'rough-polyline',
  'path',
  'rough-path',
] as const)(
  'routes free %s terminals and cleans temporary routing data',
  (type) => {
    const edge = {
      ...base,
      type,
      sourcePoint: { x: 10, y: 20 },
      targetPoint: { x: 80, y: 60 },
    } as EdgeState;
    inferEdgePoints(null, null, edge);
    expect(getWorldTerminalOfEdge(edge, 'start')).toEqual({ x: 10, y: 20 });
    expect(getWorldTerminalOfEdge(edge, 'end')).toEqual({ x: 80, y: 60 });
    expect(edge).not.toHaveProperty('absolutePoints');
  },
);

it.each([
  { curved: true },
  { bezier: true },
  { rounded: true },
  { rounded: true, arcSize: 4 },
])('routes a two-terminal path using %j', (patch) => {
  const edge = {
    ...base,
    type: 'path',
    sourcePoint: { x: 10, y: 20 },
    targetPoint: { x: 80, y: 60 },
    ...patch,
  } as EdgeState;
  inferEdgePoints(null, null, edge);
  const commands = normalizePathCommands((edge as { d: string }).d);
  expect(commands[0]).toEqual(['M', 10, 20]);
  expect(commands[commands.length - 1].slice(-2)).toEqual([80, 60]);
  expect(commands[1][0]).toBe('curved' in patch ? 'Q' : 'L');
});

it('resolves constrained node endpoints without rewriting path geometry', () => {
  const edge = {
    ...base,
    type: 'path',
    d: 'M0 0 Q1 2 3 4',
    exitX: 1,
    exitY: 0.5,
    entryX: 0,
    entryY: 1,
  } as EdgeSerializedNode;
  const other = { ...node, id: 'to', x: 100, y: 200 };
  expect(inferEdgeTerminalWorldPoints(node, other, edge)).toEqual({
    start: { x: 30, y: 40 },
    end: { x: 100, y: 240 },
  });
  expect(edge).toMatchObject({ d: 'M0 0 Q1 2 3 4' });
  expect(edge).not.toHaveProperty('absolutePoints');
  const line = { ...edge, type: 'line' } as EdgeState;
  inferPointsWithFromIdAndToId(node, other, line);
  expect(line).toMatchObject({ x1: 30, y1: 40, x2: 100, y2: 240 });
});

it.each([
  [
    {},
    [
      ['M', 20, 10],
      ['L', 60, 10],
      ['L', 60, 110],
      ['L', 100, 110],
    ],
  ],
  [
    { curved: true },
    [
      ['M', 20, 10],
      ['Q', 60, 10, 60, 60],
      ['Q', 60, 110, 100, 110],
    ],
  ],
  [
    { bezier: true },
    [
      ['M', 20, 10],
      ['C', 60, 10, 60, 110, 100, 110],
    ],
  ],
  [
    { rounded: true },
    [
      ['M', 20, 10],
      ['L', 50, 10],
      ['Q', 60, 10, 60, 20],
      ['L', 60, 100],
      ['Q', 60, 110, 70, 110],
      ['L', 100, 110],
    ],
  ],
] as const)(
  'routes orthogonal control points with style %j',
  (style, expected) => {
    const from: SerializedNode = { ...node, x: 0, y: 0, width: 20, height: 20 };
    const to: SerializedNode = { ...from, id: 'to', x: 100, y: 100 };
    const edge = {
      ...base,
      type: 'path',
      edgeStyle: EdgeStyle.ORTHOGONAL,
      exitX: 1,
      exitY: 0.5,
      entryX: 0,
      entryY: 0.5,
      ...style,
    } as EdgeState;
    inferEdgePoints(from, to, edge);
    expect(normalizePathCommands((edge as { d: string }).d)).toEqual(expected);
  },
);
