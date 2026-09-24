import { buildVectorNetworkFillMesh } from '../../packages/ecs/src/utils/vector-network-fill';
import {
  cutVectorNetworkFace,
  uncutVectorNetworkEdge,
} from '../../packages/ecs/src/utils/vector-network-face-topology';
import type { VectorNetworkData } from '../../packages/ecs/src/utils/vector-network-topology';
import {
  findVectorNetworkFaces,
  vectorNetworkFaceAtPoint,
  vectorNetworkFaceFillStates,
} from '../../packages/ecs/src/utils/vector-network-region';

const square = (filled = true): VectorNetworkData => ({
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
  ],
  regions: filled ? [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }] : [],
});
const ring = (filled = true): VectorNetworkData => {
  const n = square(filled);
  n.vertices.push(
    { x: 30, y: 30 },
    { x: 70, y: 30 },
    { x: 70, y: 70 },
    { x: 30, y: 70 },
  );
  n.segments.push(
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
    { start: 7, end: 4 },
  );
  if (filled) n.regions![0].loops.push([4, 5, 6, 7]);
  return n;
};
const fillArea = (n: VectorNetworkData) => {
  const { points, indices } = buildVectorNetworkFillMesh(
    n.vertices,
    n.segments,
    n.regions,
  );
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((j) => [points[j * 2], points[j * 2 + 1]]);
    area +=
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) /
      2;
  }
  return area;
};
const filledAt = (n: VectorNetworkData, x: number, y: number) => {
  const faces = findVectorNetworkFaces(n.vertices, n.segments);
  const face = vectorNetworkFaceAtPoint(faces, [x, y]);
  return face
    ? vectorNetworkFaceFillStates(n.vertices, n.segments, n.regions, faces)[
        faces.indexOf(face)
      ]
    : false;
};

describe('planar face Cut / Uncut', () => {
  it.each([true, false])(
    'splits and rejoins a square, preserving fill=%s and indices',
    (filled) => {
      const n = square(filled),
        before = structuredClone(n),
        cut = cutVectorNetworkFace(n, 0, 2);
      if (!cut.ok) throw Error(cut.reason);
      expect(cut.network.segments).toEqual([
        ...n.segments,
        { start: 0, end: 2 },
      ]);
      expect(cut.network.regions).toHaveLength(filled ? 2 : 0);
      expect(cut.vertexMap).toEqual([[0], [1], [2], [3]]);
      expect(cut.segmentMap).toEqual([[0], [1], [2], [3]]);
      expect(filledAt(cut.network, 70, 20)).toBe(filled);
      expect(filledAt(cut.network, 20, 70)).toBe(filled);
      const uncut = uncutVectorNetworkEdge(cut.network, 4);
      if (!uncut.ok) throw Error(uncut.reason);
      expect(uncut.network.vertices).toEqual(n.vertices);
      expect(uncut.network.segments).toEqual(n.segments);
      expect(uncut.network.regions).toHaveLength(filled ? 1 : 0);
      expect(uncut.segmentMap).toEqual([[0], [1], [2], [3], []]);
      expect(n).toEqual(before);
    },
  );
  it('keeps curved lens boundaries and independently clones tangents', () => {
    const n: VectorNetworkData = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: -80 },
          tangentEnd: { x: 0, y: -80 },
        },
        {
          start: 1,
          end: 0,
          tangentStart: { x: 0, y: 80 },
          tangentEnd: { x: 0, y: 80 },
        },
      ],
      regions: [{ loops: [[0, 1]] }],
    };
    const before = structuredClone(n),
      result = cutVectorNetworkFace(n, 0, 1);
    if (!result.ok) throw Error(result.reason);
    expect(result.network.regions).toHaveLength(2);
    expect(result.network.segments.slice(0, 2)).toEqual(n.segments);
    result.network.segments[0].tangentStart!.y = 999;
    expect(n).toEqual(before);
  });
  it('keeps a hole on its correct side of a cut and after merging', () => {
    const n = square();
    n.vertices.push(
      { x: 10, y: 50 },
      { x: 30, y: 50 },
      { x: 30, y: 70 },
      { x: 10, y: 70 },
    );
    n.segments.push(
      { start: 4, end: 5 },
      { start: 5, end: 6 },
      { start: 6, end: 7 },
      { start: 7, end: 4 },
    );
    n.regions![0].loops = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ];
    const result = cutVectorNetworkFace(n, 0, 2);
    if (!result.ok) throw Error(result.reason);
    expect(result.network.regions).toHaveLength(2);
    expect(result.network.regions!.map((r) => r.loops.length).sort()).toEqual([
      1, 2,
    ]);
    expect(filledAt(result.network, 20, 60)).toBe(false);
    expect(filledAt(result.network, 20, 80)).toBe(true);
    const uncut = uncutVectorNetworkEdge(result.network, 8);
    if (!uncut.ok) throw Error(uncut.reason);
    expect(uncut.network.regions).toHaveLength(1);
    expect(filledAt(uncut.network, 20, 60)).toBe(false);
    expect(filledAt(uncut.network, 80, 20)).toBe(true);
  });
  it.each([true, false])(
    'joins an outer boundary to a hole and restores it, filled=%s',
    (filled) => {
      const n = ring(filled),
        before = structuredClone(n);
      const cut = cutVectorNetworkFace(n, 0, 4);
      if (!cut.ok) throw Error(cut.reason);
      expect(
        findVectorNetworkFaces(cut.network.vertices, cut.network.segments),
      ).toHaveLength(2);
      expect(cut.network.regions).toHaveLength(filled ? 1 : 0);
      if (filled) {
        expect(cut.network.regions![0].loops).toHaveLength(1);
        expect(
          cut.network.regions![0].loops[0].filter((e) => e === 8),
        ).toHaveLength(2);
      }
      expect(filledAt(cut.network, 50, 50)).toBe(false);
      expect(filledAt(cut.network, 50, 10)).toBe(filled);
      expect(fillArea(cut.network)).toBeCloseTo(filled ? 8400 : 0);
      const uncut = uncutVectorNetworkEdge(cut.network, 8);
      if (!uncut.ok) throw Error(uncut.reason);
      expect(uncut.network.segments).toEqual(n.segments);
      expect(uncut.network.regions).toHaveLength(filled ? 1 : 0);
      if (filled) expect(uncut.network.regions![0].loops).toHaveLength(2);
      expect(filledAt(uncut.network, 50, 50)).toBe(false);
      expect(filledAt(uncut.network, 50, 10)).toBe(filled);
      expect(fillArea(uncut.network)).toBeCloseTo(fillArea(n));
      expect(n).toEqual(before);
    },
  );
  it('splits a face after opening its hole, then undoes both seams', () => {
    const first = cutVectorNetworkFace(ring(), 0, 4);
    if (!first.ok) throw Error(first.reason);
    const second = cutVectorNetworkFace(first.network, 1, 5);
    if (!second.ok) throw Error(second.reason);
    expect(second.network.regions).toHaveLength(2);
    expect(fillArea(second.network)).toBeCloseTo(8400);
    expect(filledAt(second.network, 50, 10)).toBe(true);
    expect(filledAt(second.network, 50, 90)).toBe(true);
    expect(filledAt(second.network, 50, 50)).toBe(false);
    const uncut = uncutVectorNetworkEdge(second.network, 8);
    if (!uncut.ok) throw Error(uncut.reason);
    expect(uncut.network.regions).toHaveLength(1);
    const restored = uncutVectorNetworkEdge(uncut.network, 8);
    if (!restored.ok) throw Error(restored.reason);
    expect(restored.network.segments).toEqual(ring().segments);
    expect(restored.network.regions![0].loops).toHaveLength(2);
    expect(filledAt(restored.network, 50, 50)).toBe(false);
  });
  it('joins two holes and restores both without changing their fills', () => {
    const n = ring();
    n.vertices.slice(4).forEach((v) => {
      v.x = v.x / 2 - 5;
      v.y = v.y / 2 + 15;
    });
    n.vertices.push(
      ...n.vertices.slice(4).map((v) => ({ x: v.x + 50, y: v.y })),
    );
    n.segments.push(
      ...n.segments
        .slice(4)
        .map((e) => ({ start: e.start + 4, end: e.end + 4 })),
    );
    n.regions![0].loops.push([8, 9, 10, 11]);
    // Fill one hole as an independent face; joining hole boundaries must preserve it.
    n.regions!.push({ fillRule: 'evenodd', loops: [[8, 9, 10, 11]] });
    const cut = cutVectorNetworkFace(n, 5, 8);
    if (!cut.ok) throw Error(cut.reason);
    expect(cut.network.regions).toHaveLength(2);
    expect(cut.network.regions![0].loops).toHaveLength(2);
    expect(filledAt(cut.network, 20, 40)).toBe(false);
    expect(filledAt(cut.network, 70, 40)).toBe(true);
    expect(filledAt(cut.network, 50, 40)).toBe(true);
    const uncut = uncutVectorNetworkEdge(cut.network, 12);
    if (!uncut.ok) throw Error(uncut.reason);
    expect(uncut.network.regions![0].loops).toHaveLength(3);
    expect(filledAt(uncut.network, 20, 40)).toBe(false);
    expect(filledAt(uncut.network, 70, 40)).toBe(true);
  });
  it('preserves curved hole boundaries and a nonzero ring', () => {
    const n = ring();
    n.segments[4].tangentStart = { x: 10, y: -8 };
    n.segments[4].tangentEnd = { x: -10, y: -8 };
    n.regions![0] = {
      fillRule: 'nonzero',
      loops: [
        [0, 1, 2, 3],
        [7, 6, 5, 4],
      ],
    };
    const before = structuredClone(n);
    const cut = cutVectorNetworkFace(n, 0, 4);
    if (!cut.ok) throw Error(cut.reason);
    expect(cut.network.segments.slice(0, 8)).toEqual(n.segments);
    expect(fillArea(cut.network)).toBeCloseTo(fillArea(n));
    expect(filledAt(cut.network, 50, 50)).toBe(false);
    expect(filledAt(cut.network, 50, 10)).toBe(true);
    const uncut = uncutVectorNetworkEdge(cut.network, 8);
    if (!uncut.ok) throw Error(uncut.reason);
    expect(filledAt(uncut.network, 50, 50)).toBe(false);
    expect(n).toEqual(before);
  });
  it('rejects dangling interior strokes as Uncut seams', () => {
    const n = ring();
    n.vertices.push({ x: 15, y: 15 });
    n.segments.push({ start: 0, end: 8 });
    expect(uncutVectorNetworkEdge(n, 8)).toEqual({
      ok: false,
      reason: 'not-interior-edge',
    });
  });
  it('rejects a cut through a hole even if the midpoint is outside the hole', () => {
    const n = square();
    n.vertices.push(
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 },
    );
    n.segments.push(
      { start: 4, end: 5 },
      { start: 5, end: 6 },
      { start: 6, end: 7 },
      { start: 7, end: 4 },
    );
    n.regions![0].loops = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ];
    expect(cutVectorNetworkFace(n, 0, 2)).toEqual({
      ok: false,
      reason: 'crossing-cut',
    });
  });
  it('rejects tangent contact with an internal cubic', () => {
    const n = square();
    // Diagonal cut y=x; this cubic touches it at (50,50) without crossing.
    n.vertices.push({ x: 30, y: 50 }, { x: 70, y: 90 });
    n.segments.push({
      start: 4,
      end: 5,
      tangentStart: { x: 10, y: 10 - 80 / 3 },
      tangentEnd: { x: -10, y: -10 - 80 / 3 },
    });
    expect(cutVectorNetworkFace(n, 0, 2)).toEqual({
      ok: false,
      reason: 'crossing-cut',
    });
  });
  it('rejects coincident overlap with a disconnected internal edge', () => {
    const n = square();
    n.vertices.push({ x: 10, y: 10 }, { x: 20, y: 20 });
    n.segments.push({ start: 4, end: 5 });
    expect(cutVectorNetworkFace(n, 0, 2)).toEqual({
      ok: false,
      reason: 'crossing-cut',
    });
  });
  it('rejects filling across a seam when only one side was filled', () => {
    const result = cutVectorNetworkFace(square(), 0, 2);
    if (!result.ok) throw Error(result.reason);
    result.network.regions = result.network.regions!.slice(0, 1);
    const before = structuredClone(result.network);
    expect(uncutVectorNetworkEdge(result.network, 4)).toEqual({
      ok: false,
      reason: 'different-fills',
    });
    expect(result.network).toEqual(before);
  });
  it('preserves an unrelated filled component and remaps later edges', () => {
    const result = cutVectorNetworkFace(square(), 0, 2);
    if (!result.ok) throw Error(result.reason);
    const n = result.network;
    n.vertices.push({ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 250, y: 80 });
    n.segments.push(
      { start: 4, end: 5 },
      { start: 5, end: 6 },
      { start: 6, end: 4 },
    );
    n.regions!.push({ loops: [[5, 6, 7]] });
    const before = structuredClone(n),
      uncut = uncutVectorNetworkEdge(n, 4);
    if (!uncut.ok) throw Error(uncut.reason);
    expect(uncut.segmentMap.slice(4)).toEqual([[], [4], [5], [6]]);
    expect(filledAt(uncut.network, 250, 20)).toBe(true);
    expect(uncut.network.regions).toHaveLength(2);
    expect(n).toEqual(before);
  });
  it.each([-1, 0, 1, 2, 3, 4, NaN])(
    'does not remove an exterior or missing edge %s',
    (edge) => {
      expect(uncutVectorNetworkEdge(square(), edge)).toEqual({
        ok: false,
        reason: 'not-interior-edge',
      });
    },
  );
  it('rejects invalid vertices, existing boundary and broken regions', () => {
    expect(cutVectorNetworkFace(square(), -1, 2)).toEqual({
      ok: false,
      reason: 'invalid-vertex',
    });
    expect(cutVectorNetworkFace(square(), 0, 0)).toEqual({
      ok: false,
      reason: 'same-vertex',
    });
    expect(cutVectorNetworkFace(square(), 0, 1).ok).toBe(false);
    const n = square();
    n.regions![0].loops = [[0, 2]];
    expect(cutVectorNetworkFace(n, 0, 2)).toEqual({
      ok: false,
      reason: 'invalid-network',
    });
  });
});
