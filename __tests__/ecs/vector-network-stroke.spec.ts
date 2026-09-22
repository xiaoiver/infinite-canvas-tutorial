import { vectorNetworkToFlatStrokePoints } from '../../packages/ecs/src/utils/vector-network-stroke';

/** Wireframe cube (7 verts, 9 segs) — must not draw chords between unconnected vertices. */
const CUBE_VERTICES = [
  { x: 0, y: 80 },
  { x: 80, y: 80 },
  { x: 80, y: 0 },
  { x: 0, y: 0 },
  { x: 110, y: 50 },
  { x: 110, y: -30 },
  { x: 30, y: -30 },
];

const CUBE_SEGMENTS = [
  { start: 0, end: 1 },
  { start: 1, end: 2 },
  { start: 2, end: 3 },
  { start: 3, end: 0 },
  { start: 3, end: 6 },
  { start: 6, end: 5 },
  { start: 2, end: 5 },
  { start: 1, end: 4 },
  { start: 4, end: 5 },
];

function flatEdgePairs(points: number[]): [number, number][][] {
  const subpaths: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (Number.isNaN(x)) {
      if (cur.length) {
        subpaths.push(cur);
      }
      cur = [];
      continue;
    }
    cur.push([x, y]);
  }
  if (cur.length) {
    subpaths.push(cur);
  }
  const edges: [number, number][][] = [];
  for (const path of subpaths) {
    const pathEdges: [number, number][] = [];
    for (let i = 0; i < path.length - 1; i++) {
      pathEdges.push([path[i], path[i + 1]]);
    }
    edges.push(pathEdges);
  }
  return edges;
}

function nearestVertexIndex(
  vertices: typeof CUBE_VERTICES,
  x: number,
  y: number,
): number {
  let best = -1;
  let bestD = Infinity;
  vertices.forEach((v, i) => {
    const d = (v.x - x) ** 2 + (v.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function hasEdgeBetween(
  points: number[],
  vertices: typeof CUBE_VERTICES,
  a: number,
  b: number,
): boolean {
  const va = vertices[a];
  const vb = vertices[b];
  for (const subpath of flatEdgePairs(points)) {
    for (const [[x1, y1], [x2, y2]] of subpath) {
      const i = nearestVertexIndex(vertices, x1, y1);
      const j = nearestVertexIndex(vertices, x2, y2);
      if ((i === a && j === b) || (i === b && j === a)) {
        return true;
      }
      // Direct coordinate match for chord detection (not via vertex snap).
      const direct =
        (Math.hypot(x1 - va.x, y1 - va.y) < 1e-3 &&
          Math.hypot(x2 - vb.x, y2 - vb.y) < 1e-3) ||
        (Math.hypot(x2 - va.x, y2 - va.y) < 1e-3 &&
          Math.hypot(x1 - vb.x, y1 - vb.y) < 1e-3);
      if (direct) {
        return true;
      }
    }
  }
  return false;
}

describe('vectorNetworkToFlatStrokePoints', () => {
  it('does not emit chords for undeclared edges on the wireframe cube', () => {
    const points = vectorNetworkToFlatStrokePoints(
      CUBE_VERTICES,
      CUBE_SEGMENTS,
    );
    expect(hasEdgeBetween(points, CUBE_VERTICES, 1, 5)).toBe(false);
    expect(hasEdgeBetween(points, CUBE_VERTICES, 0, 5)).toBe(false);
  });

  it('merges degree-2 chains when prepending backward along a segment', () => {
    const points = vectorNetworkToFlatStrokePoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
      ],
    );
    expect(points).toEqual([0, 0, 10, 0, 20, 0]);
  });
});
