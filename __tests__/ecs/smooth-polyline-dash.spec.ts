import type { Entity } from '@lastolivegames/becsy';
import {
  Circle,
  Ellipse,
  Polyline,
  Rect,
  Stroke,
  VectorNetwork,
} from '../../packages/ecs/src/components';
import { updateBuffer } from '../../packages/ecs/src/drawcalls/SmoothPolyline';
import { JointType } from '../../packages/ecs/src/shaders/polyline';

function shape(
  geometry: object,
  component: unknown,
  stroke: Partial<Stroke> = {},
) {
  const data = new Map<unknown, unknown>([
    [component, geometry],
    [Stroke, { width: 10, linecap: 'round', linejoin: 'miter', ...stroke }],
  ]);
  return {
    has: (type: unknown) => data.has(type),
    hasSomeOf: (...types: unknown[]) => types.some((type) => data.has(type)),
    read: (type: unknown) => data.get(type),
  } as unknown as Entity;
}

function segments(entity: Entity) {
  const { pointsBuffer: points, travelBuffer: travel } = updateBuffer(entity);
  const count = points.length / 3 - 3;
  expect(travel).toHaveLength(count * 3);
  expect(points.every(Number.isFinite)).toBe(true);
  const result = [];
  for (let i = 0; i < count; i++) {
    const joint = points[(i + 1) * 3 + 2];
    // Inactive padding and the reversed start-cap instance are not segments.
    if (joint % 32 < JointType.JOINT_BEVEL) continue;
    result.push({
      a: points.slice((i + 1) * 3, (i + 1) * 3 + 2),
      b: points.slice((i + 2) * 3, (i + 2) * 3 + 2),
      joint,
      travel: travel.slice(i * 3, i * 3 + 3),
    });
  }
  return result;
}

it('associates travel with the segment after the optional start cap', () => {
  const result = segments(
    shape(
      {
        points: [
          [0, 0],
          [100, 0],
          [100, 35],
        ],
      },
      Polyline,
    ),
  );
  expect(result.map((s) => s.travel)).toEqual([
    [0, -1, 100],
    [100, 0, -1],
  ]);
});

it('closes rectangles with real neighboring segments and no epsilon cap', () => {
  const result = segments(shape({ x: 0, y: 0, width: 100, height: 35 }, Rect));
  expect(result.map((s) => s.travel)).toEqual([
    [0, 235, 100],
    [100, 0, 135],
    [135, 100, 235],
    [235, 135, 0],
  ]);
  expect(result.every((s) => s.joint === JointType.JOINT_MITER)).toBe(true);
});

it.each([
  [Circle, { cx: 0, cy: 0, r: 80 }],
  [Ellipse, { cx: 0, cy: 0, rx: 100, ry: 60 }],
])('closes sampled curves with 64 nonzero segments', (component, geometry) => {
  const result = segments(shape(geometry, component));
  expect(result).toHaveLength(64);
  expect(
    result.every((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 0),
  ).toBe(true);
  expect(result[63].b).toEqual(result[0].a);
  expect(result[0].travel[1]).toBe(result[63].travel[0]);
  expect(result[63].travel[2]).toBe(0);
});

it('separates subpaths without phantom reverse segments or shifted travel', () => {
  const result = segments(
    shape(
      {
        points: [
          [NaN, NaN],
          [4, 4],
          [NaN, NaN],
          [0, 0],
          [30, 0],
          [NaN, NaN],
          [0, 50],
          [70, 50],
        ],
      },
      Polyline,
    ),
  );
  expect(result.map((s) => [s.a, s.b, s.travel])).toEqual([
    [
      [0, 0],
      [30, 0],
      [0, -1, -1],
    ],
    [
      [0, 50],
      [70, 50],
      [0, -1, -1],
    ],
  ]);
});

it('preserves vector network endpoint overrides after a closed subpath', () => {
  const result = segments(
    shape(
      {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 200, y: 0, strokeLinecap: 'round' },
          { x: 300, y: 0, strokeLinecap: 'square' },
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 0 },
          { start: 3, end: 4 },
        ],
      },
      VectorNetwork,
      { linecap: 'butt' },
    ),
  );
  const open = result.find((s) => s.a[0] === 200)!;
  expect(open.b).toEqual([300, 0]);
  expect(open.joint).toBe(JointType.JOINT_CAP_SQUARE);
  expect(open.travel).toEqual([0, -1, -1]);
});
