import {
  DIRECTION_EAST,
  DIRECTION_NORTH,
  DIRECTION_SOUTH,
  DIRECTION_WEST,
  EdgeStyle,
  type NodeSerializedNode,
} from '../../packages/ecs/src';
import {
  type EdgeState,
  updatePoints,
} from '../../packages/ecs/src/utils/binding/connection';
import { inferEdgePoints } from '../../packages/ecs/src/utils/deserialize/entity';
import { normalizePathCommands } from '../../packages/ecs/src/utils/path-edit';

const node: NodeSerializedNode = {
  id: 'node',
  type: 'rect',
  zIndex: 0,
  x: 10,
  y: 20,
  width: 40,
  height: 20,
};

const loopEdge = (patch: Record<string, unknown> = {}): EdgeState =>
  ({
    id: 'loop',
    type: 'path',
    zIndex: 0,
    edgeStyle: EdgeStyle.LOOP,
    ...patch,
  } as EdgeState);

it.each([
  [
    DIRECTION_EAST,
    [
      [70, 20],
      [70, 40],
    ],
    'x',
    50,
  ],
  [
    DIRECTION_WEST,
    [
      [-10, 20],
      [-10, 40],
    ],
    'x',
    10,
  ],
  [
    DIRECTION_NORTH,
    [
      [20, 0],
      [40, 0],
    ],
    'y',
    20,
  ],
  [
    DIRECTION_SOUTH,
    [
      [20, 60],
      [40, 60],
    ],
    'y',
    40,
  ],
] as const)(
  'routes a floating %s self-loop outside the requested side',
  (direction, controls, boundaryAxis, boundaryValue) => {
    const edge = loopEdge({ direction });
    inferEdgePoints(node, node, edge);

    const commands = normalizePathCommands((edge as { d: string }).d);
    expect(commands.map((command) => command.slice(-2))).toEqual([
      expect.any(Array),
      ...controls,
      expect.any(Array),
    ]);
    expect(commands[0][boundaryAxis === 'x' ? 1 : 2]).toBe(boundaryValue);
    expect(commands[3][boundaryAxis === 'x' ? 1 : 2]).toBe(boundaryValue);
    expect(edge).not.toHaveProperty('absolutePoints');
  },
);

it('keeps a centered outside hint from collapsing the two loop controls', () => {
  const edge = loopEdge({
    absolutePoints: [null, null],
    direction: DIRECTION_NORTH,
  });

  updatePoints(edge, [{ x: 30, y: -20 }], node, node);

  expect(edge.absolutePoints.slice(1, 3)).toEqual([
    { x: 20, y: -20 },
    { x: 40, y: -20 },
  ]);
});

it('ignores a hint inside the node and keeps the requested loop side', () => {
  const edge = loopEdge({
    absolutePoints: [null, null],
    direction: DIRECTION_EAST,
  });

  updatePoints(edge, [{ x: 30, y: 30 }], node, node);

  expect(edge.absolutePoints.slice(1, 3)).toEqual([
    { x: 70, y: 20 },
    { x: 70, y: 40 },
  ]);
});

it('uses an outside hint while keeping a minimum gap around the loop', () => {
  const edge = loopEdge({
    absolutePoints: [null, null],
    direction: DIRECTION_EAST,
  });

  updatePoints(edge, [{ x: 90, y: 10 }], node, node);

  expect(edge.absolutePoints.slice(1, 3)).toEqual([
    { x: 90, y: 10 },
    { x: 90, y: 50 },
  ]);
});

it('preserves fixed terminals and transforms explicit loop controls', () => {
  const start = { x: 10, y: 30 };
  const end = { x: 50, y: 30 };
  const edge = loopEdge({
    absolutePoints: [start, end],
    x: 5,
    y: 10,
    scaleX: 2,
    scaleY: 3,
  });

  updatePoints(edge, [{ x: 1, y: 2 }], node, node);

  expect(edge.absolutePoints).toEqual([start, { x: 12, y: 36 }, end]);
});

it('leaves an unbound loop without a source node free of control points', () => {
  const edge = loopEdge({ absolutePoints: [null, null] });

  updatePoints(edge, [], null, null);

  expect(edge.absolutePoints).toEqual([null, null]);
});

it('does not route a loop around invalid source bounds', () => {
  const edge = loopEdge({ absolutePoints: [null, null] });

  updatePoints(edge, [], { ...node, width: NaN }, null);

  expect(edge.absolutePoints).toEqual([null, null]);
});
