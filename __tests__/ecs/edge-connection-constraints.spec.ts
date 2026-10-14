import type {
  EdgeSerializedNode,
  SerializedNode,
} from '../../packages/ecs/src';
import {
  getConnectionConstraint,
  getConnectionPoint,
} from '../../packages/ecs/src/utils/binding/connection';
import { inferEdgeTerminalWorldPoints } from '../../packages/ecs/src/utils/deserialize/entity';

const from: SerializedNode & {
  x: number;
  y: number;
  width: number;
  height: number;
} = {
  id: 'from',
  type: 'rect',
  zIndex: 0,
  x: 0,
  y: 0,
  width: 40,
  height: 20,
};
const to: SerializedNode = { ...from, id: 'to', x: 100 };
const edge = (patch: Record<string, unknown> = {}): EdgeSerializedNode =>
  ({ id: 'edge', type: 'line', zIndex: 0, ...patch } as EdgeSerializedNode);

it('keeps fixed endpoint offsets separate for source and target', () => {
  const points = inferEdgeTerminalWorldPoints(
    from,
    to,
    edge({
      exitX: 1,
      exitY: 0.5,
      exitDx: -5,
      exitDy: 3,
      entryX: 0,
      entryY: 0.5,
      entryDx: 4,
      entryDy: -3,
    }),
  );
  expect(points).toEqual({
    start: { x: 35, y: 13 },
    end: { x: 104, y: 7 },
  });
});

it('rotates a fixed endpoint with its vertex transform', () => {
  const rotated = { ...from, rotation: Math.PI / 2 };
  const points = inferEdgeTerminalWorldPoints(
    rotated,
    to,
    edge({ exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 }),
  );
  expect(points?.start.x).toBeCloseTo(-10);
  expect(points?.start.y).toBeCloseTo(40);
  expect(points?.end).toEqual({ x: 100, y: 10 });
});

it('projects a constrained interior point onto the vertex perimeter', () => {
  expect(
    getConnectionPoint(from, {
      x: 0.9,
      y: 0.5,
      perimeter: true,
    }),
  ).toEqual({ x: 40, y: 10 });
});

it('uses the free target point to place an orthogonal floating source', () => {
  const points = inferEdgeTerminalWorldPoints(
    from,
    null,
    edge({ targetPoint: { x: 100, y: 15 }, orthogonal: true }),
  );
  expect(points).toEqual({
    start: { x: 40, y: 15 },
    end: { x: 100, y: 15 },
  });
});

it.each([
  { exitX: NaN, exitY: 0.5 },
  { exitX: 1, exitY: Infinity },
  { entryX: Infinity, entryY: 0.5 },
  { entryX: 0, entryY: NaN },
])(
  'falls back to the perimeter for invalid binding coordinates %j',
  (patch) => {
    const points = inferEdgeTerminalWorldPoints(
      from,
      to,
      edge({ exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5, ...patch }),
    );
    expect(points?.start.x).toBeCloseTo(40, 9);
    expect(points?.start.y).toBeCloseTo(10, 9);
    expect(points?.end.x).toBeCloseTo(100, 9);
    expect(points?.end.y).toBeCloseTo(10, 9);
  },
);

it('ignores non-finite pixel offsets while keeping the normalized anchor', () => {
  const constraint = getConnectionConstraint(
    edge({ exitX: 1, exitY: 0.5, exitDx: Infinity, exitDy: NaN }),
    from,
    true,
  );
  expect(constraint).toMatchObject({ x: 1, y: 0.5, dx: 0, dy: 0 });
});

it('rejects invalid direct constraints and ignores invalid direct offsets', () => {
  expect(getConnectionPoint(from, { x: NaN, y: 0.5 })).toBeNull();
  expect(
    getConnectionPoint(from, {
      x: 1,
      y: 0.5,
      dx: Infinity,
      dy: NaN,
    }),
  ).toEqual({ x: 40, y: 10 });
});
