import { splitVectorNetworkIntersections } from '../../packages/ecs/src/utils/vector-network-intersections';
import {
  bendVectorSegment,
  nearestVectorCurveParameter,
  pointOnVectorCubic,
  vectorSegmentCubic,
} from '../../packages/ecs/src/utils/vector-network-curve';
import { buildVectorNetworkFillMesh } from '../../packages/ecs/src/utils/vector-network-fill';
import { pathToVectorNetwork } from '../../packages/ecs/src/utils/vector-network-topology';
import type { VectorNetworkData } from '../../packages/ecs/src/utils/vector-network-topology';
import { orientVectorLoop } from '../../packages/ecs/src/utils/vector-network-loop';
import { findVectorNetworkFaces } from '../../packages/ecs/src/utils/vector-network-region';

const cross = (): VectorNetworkData => ({
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 100, y: 0 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 2, end: 3 },
  ],
  regions: [],
});
it('joins a crossing once, keeps original vertex indices and does not mutate input', () => {
  const input = cross(),
    before = structuredClone(input);
  const next = splitVectorNetworkIntersections(input);
  expect(input).toEqual(before);
  expect(next.vertices.slice(0, 4)).toEqual(input.vertices);
  expect(next.vertices[4].x).toBeCloseTo(50, 8);
  expect(next.vertices[4].y).toBeCloseTo(50, 8);
  expect(next.segments).toHaveLength(4);
  expect(
    next.segments.filter((s) => s.start === 4 || s.end === 4),
  ).toHaveLength(4);
  expect(splitVectorNetworkIntersections(next)).toBe(next);
});
it('reuses an existing endpoint at a T junction, without welding Cut endpoints', () => {
  const input = cross();
  input.vertices[2] = { x: 50, y: 50 };
  const next = splitVectorNetworkIntersections(input);
  expect(next.vertices).toHaveLength(4);
  expect(next.segments).toHaveLength(3);
  expect(
    next.segments.filter((s) => s.start === 2 || s.end === 2),
  ).toHaveLength(3);
  input.vertices[2] = { ...input.vertices[0] };
  expect(splitVectorNetworkIntersections(input)).toBe(input);
});
it('orders multiple splits along one edge and preserves reversed region walks', () => {
  const input: VectorNetworkData = {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: -20, y: 50 },
      { x: 120, y: 50 },
    ],
    segments: [
      { start: 1, end: 0 },
      { start: 1, end: 2 },
      { start: 3, end: 2 },
      { start: 0, end: 3 },
      { start: 4, end: 5 },
    ],
    regions: [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }],
  };
  const next = splitVectorNetworkIntersections(input);
  expect(next.vertices).toHaveLength(8);
  expect(next.segments).toHaveLength(9);
  expect(next.regions![0].loops[0]).toHaveLength(6);
  expect(
    orientVectorLoop(next.segments, next.regions![0].loops[0]),
  ).not.toBeNull();
  expect(findVectorNetworkFaces(next.vertices, next.segments)).toHaveLength(2);
});
it('keeps cubic geometry when a line crosses it twice', () => {
  const input: VectorNetworkData = {
    vertices: [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: -20, y: 50 },
      { x: 120, y: 50 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: -100 },
        tangentEnd: { x: 0, y: -100 },
      },
      { start: 2, end: 3 },
    ],
  };
  const curve = vectorSegmentCubic(input.vertices, input.segments[0])!;
  const next = splitVectorNetworkIntersections(input);
  expect(next.vertices).toHaveLength(6);
  expect(next.segments).toHaveLength(6);
  for (const edge of next.segments.filter(
    (s) => s.tangentStart || s.tangentEnd,
  )) {
    const part = vectorSegmentCubic(next.vertices, edge)!;
    for (const t of [0, 0.17, 0.5, 0.87, 1]) {
      const p = pointOnVectorCubic(part, t),
        q = pointOnVectorCubic(curve, nearestVectorCurveParameter(curve, p));
      expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(0.001);
    }
  }
  expect(splitVectorNetworkIntersections(next)).toBe(next);
});
it('splits a self-intersecting cubic into a shared junction and a loop', () => {
  const input: VectorNetworkData = {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 200, y: 200 },
        tangentEnd: { x: -200, y: 200 },
      },
    ],
  };
  const next = splitVectorNetworkIntersections(input);
  expect(next.vertices).toHaveLength(3);
  expect(next.segments).toHaveLength(3);
  expect(next.segments.some((s) => s.start === s.end)).toBe(true);
  expect(splitVectorNetworkIntersections(next)).toBe(next);
});
it('ignores overlaps, tangencies, invalid and unaffected edges', () => {
  const input = cross();
  expect(splitVectorNetworkIntersections(input, new Set())).toBe(input);
  input.segments[1] = { start: 0, end: 1 };
  expect(splitVectorNetworkIntersections(input)).toBe(input);
  input.segments[1] = { start: 1, end: 0 };
  expect(splitVectorNetworkIntersections(input)).toBe(input);
  input.segments[1] = { start: 10, end: 11 };
  expect(splitVectorNetworkIntersections(input)).toBe(input);
});
for (const curved of [false, true])
  it(`bends ${
    curved ? 'a cubic' : 'a straight edge'
  } at the grabbed parameter, retaining anchors and unrelated edges`, () => {
    const input = cross();
    if (curved) input.segments[0].tangentStart = { x: 30, y: -40 };
    const before = structuredClone(input),
      t = 0.27;
    const p = pointOnVectorCubic(
      vectorSegmentCubic(input.vertices, input.segments[0])!,
      t,
    );
    const next = bendVectorSegment(input, 0, t, [20, -35]);
    const q = pointOnVectorCubic(
      vectorSegmentCubic(next.vertices, next.segments[0])!,
      t,
    );
    expect(q[0] - p[0]).toBeCloseTo(20, 6);
    expect(q[1] - p[1]).toBeCloseTo(-35, 6);
    expect(next.vertices.map((v) => [v.x, v.y])).toEqual(
      input.vertices.map((v) => [v.x, v.y]),
    );
    expect(next.segments[1]).toEqual(input.segments[1]);
    expect(input).toEqual(before);
    expect(bendVectorSegment(input, 0, 0, [20, 20])).toBe(input);
  });

it('preserves painted area and hole loops across four crossings', () => {
  const input = pathToVectorNetwork(
    'M0 0 H100 V100 H0 Z M20 20 H80 V80 H20 Z',
    'evenodd',
  );
  input.vertices.push({ x: -10, y: 50 }, { x: 110, y: 50 });
  input.segments.push({ start: 8, end: 9 });
  const next = splitVectorNetworkIntersections(input);
  expect(next.regions![0].loops).toHaveLength(2);
  for (const loop of next.regions![0].loops)
    expect(orientVectorLoop(next.segments, loop)).not.toBeNull();
  const mesh = buildVectorNetworkFillMesh(
    next.vertices,
    next.segments,
    next.regions,
  );
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices
      .slice(i, i + 3)
      .map((k) => mesh.points.slice(k * 2, k * 2 + 2));
    area +=
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) /
      2;
  }
  expect(area).toBeCloseTo(6400, 3);
});
it('connects two cubic edges at their transverse intersections', () => {
  const input: VectorNetworkData = {
    vertices: [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: -100 },
        tangentEnd: { x: 0, y: -100 },
      },
      {
        start: 2,
        end: 3,
        tangentStart: { x: 100, y: 0 },
        tangentEnd: { x: -100, y: 0 },
      },
    ],
  };
  const next = splitVectorNetworkIntersections(input);
  expect(next.vertices.length).toBeGreaterThan(4);
  for (const p of next.vertices.slice(4))
    for (const edge of input.segments) {
      const curve = vectorSegmentCubic(input.vertices, edge)!;
      const point = pointOnVectorCubic(
        curve,
        nearestVectorCurveParameter(curve, [p.x, p.y]),
      );
      expect(Math.hypot(point[0] - p.x, point[1] - p.y)).toBeLessThan(0.001);
    }
  expect(splitVectorNetworkIntersections(next)).toBe(next);
});
it('does not create a spurious junction at a tangent contact', () => {
  const input: VectorNetworkData = {
    vertices: [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 0, y: 25 },
      { x: 100, y: 25 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: -100 },
        tangentEnd: { x: 0, y: -100 },
      },
      { start: 2, end: 3 },
    ],
  };
  expect(splitVectorNetworkIntersections(input)).toBe(input);
});
