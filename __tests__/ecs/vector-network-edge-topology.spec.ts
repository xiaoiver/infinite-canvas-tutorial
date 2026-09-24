import {
  glueVectorNetworkEdges,
  unglueVectorNetworkEdge,
  vectorEdgeUses,
  coincidentVectorEdges,
} from '../../packages/ecs/src/utils/vector-network-edge-topology';
import { orientVectorLoop } from '../../packages/ecs/src/utils/vector-network-loop';
import type { VectorNetworkData } from '../../packages/ecs/src/utils/vector-network-topology';

// Two filled triangles share diagonal edge 4, with opposite boundary traversal.
const square = (): VectorNetworkData => ({
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
    { start: 0, end: 2 },
  ],
  regions: [
    { fillRule: 'evenodd', loops: [[0, 1, 4]] },
    { fillRule: 'evenodd', loops: [[4, 2, 3]] },
  ],
});
describe('shared edge Glue / Unglue', () => {
  it('duplicates only the chosen region use, preserves geometry, and glues back', () => {
    const n = square(),
      before = structuredClone(n),
      uses = vectorEdgeUses(n, 4);
    expect(uses).toEqual([
      { regionIndex: 0, loopIndex: 0, offset: 2 },
      { regionIndex: 1, loopIndex: 0, offset: 0 },
    ]);
    const result = unglueVectorNetworkEdge(n, 4, [uses[1]]);
    if (!result.ok) throw Error(result.reason);
    expect(result.network.vertices).toEqual(n.vertices);
    expect(result.network.segments[5]).toEqual(n.segments[4]);
    expect(result.network.regions!.map((r) => r.loops)).toEqual([
      [[0, 1, 4]],
      [[5, 2, 3]],
    ]);
    expect(result.segmentMap).toEqual([[0], [1], [2], [3], [4, 5]]);
    expect(result.selectedSegment).toBe(5);
    const glued = glueVectorNetworkEdges(result.network, 5, 4);
    if (!glued.ok) throw Error(glued.reason);
    expect(glued.network).toEqual(n);
    expect(glued.segmentMap).toEqual([[0], [1], [2], [3], [4], [4]]);
    expect(n).toEqual(before);
  });
  it('keeps cubic tangents independent, including reversed matching curves', () => {
    const n = square();
    n.segments[4].tangentStart = { x: 0, y: 30 };
    n.segments[4].tangentEnd = { x: -30, y: 0 };
    const before = structuredClone(n),
      r = unglueVectorNetworkEdge(n, 4, [vectorEdgeUses(n, 4)[0]]);
    if (!r.ok) throw Error(r.reason);
    r.network.segments[5] = {
      start: 2,
      end: 0,
      tangentStart: { x: -30, y: 0 },
      tangentEnd: { x: 0, y: 30 },
    };
    expect(coincidentVectorEdges(r.network, 5, 4)).toBe('reverse');
    const g = glueVectorNetworkEdges(r.network, 5, 4);
    if (!g.ok) throw Error(g.reason);
    expect(g.network).toEqual(n);
    g.network.segments[4].tangentStart!.x = 999;
    expect(n).toEqual(before);
    r.network.segments[5].tangentStart!.x = 999;
    expect(glueVectorNetworkEdges(r.network, 5, 4)).toEqual({
      ok: false,
      reason: 'different-geometry',
    });
  });
  it('welds separate coincident endpoints and remaps every incident edge and region', () => {
    const n = square();
    n.vertices.push({ ...n.vertices[0] }, { ...n.vertices[2] });
    n.segments.push({ start: 5, end: 4 });
    n.segments[2].start = 5;
    n.segments[3].end = 4;
    n.regions![1].loops = [[5, 2, 3]];
    const before = structuredClone(n),
      r = glueVectorNetworkEdges(n, 5, 4);
    if (!r.ok) throw Error(r.reason);
    expect(r.network).toEqual(square());
    expect(r.vertexMap).toEqual([[0], [1], [2], [3], [0], [2]]);
    expect(n).toEqual(before);
  });
  it('removes only the requested edge and remaps an earlier source into a later target', () => {
    const n = square(),
      r = unglueVectorNetworkEdge(n, 4, [vectorEdgeUses(n, 4)[1]]);
    if (!r.ok) throw Error(r.reason);
    r.network.segments.push({ ...n.segments[0] });
    const g = glueVectorNetworkEdges(r.network, 4, 5);
    if (!g.ok) throw Error(g.reason);
    expect(g.network.segments).toHaveLength(6);
    expect(g.selectedSegment).toBe(4);
    expect(g.segmentMap).toEqual([[0], [1], [2], [3], [4], [4], [5]]);
    expect(g.network.segments[5]).toEqual(n.segments[0]);
  });
  it('preserves a shared hole boundary and closed cubic self-loops', () => {
    const n: VectorNetworkData = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      segments: [
        {
          start: 0,
          end: 0,
          tangentStart: { x: 100, y: -100 },
          tangentEnd: { x: -100, y: -100 },
        },
        {
          start: 1,
          end: 1,
          tangentStart: { x: 300, y: -300 },
          tangentEnd: { x: -300, y: -300 },
        },
      ],
      regions: [
        { fillRule: 'evenodd', loops: [[1], [0]] },
        { fillRule: 'evenodd', loops: [[0]] },
      ],
    };
    const r = unglueVectorNetworkEdge(n, 0, [vectorEdgeUses(n, 0)[0]]);
    if (!r.ok) throw Error(r.reason);
    expect(r.network.regions![0].loops).toEqual([[1], [2]]);
    expect(
      r.network.regions!.every((r) =>
        r.loops.every(
          (l) => !!orientVectorLoop(n.segments.concat(n.segments[0]), l),
        ),
      ),
    ).toBe(true);
    const g = glueVectorNetworkEdges(r.network, 2, 0);
    if (!g.ok) throw Error(g.reason);
    expect(g.network).toEqual(n);
  });
  it('supports repeated uses of an edge and more than two incident regions', () => {
    const n = square();
    n.regions!.push({ loops: [[0, 1, 4, 4, 2, 3]] });
    const uses = vectorEdgeUses(n, 4);
    expect(uses).toHaveLength(4);
    const r = unglueVectorNetworkEdge(n, 4, [uses[2]]);
    if (!r.ok) throw Error(r.reason);
    expect(r.network.regions![2].loops).toEqual([[0, 1, 5, 4, 2, 3]]);
    expect(n.regions![2].loops).toEqual([[0, 1, 4, 4, 2, 3]]);
  });
  it('rejects empty, duplicate, foreign, and all-use splits without modifying input', () => {
    const n = square(),
      before = structuredClone(n),
      uses = vectorEdgeUses(n, 4);
    for (const selected of [
      [],
      uses,
      [uses[0], uses[0]],
      [{ regionIndex: 0, loopIndex: 0, offset: 0 }],
    ])
      expect(unglueVectorNetworkEdge(n, 4, selected)).toEqual({
        ok: false,
        reason: 'invalid-uses',
      });
    expect(
      unglueVectorNetworkEdge({ ...n, regions: [] }, 4, uses.slice(0, 1)).ok,
    ).toBe(false);
    expect(n).toEqual(before);
  });
  it('rejects invalid indices, different curves, and collapsing a boundary', () => {
    const n = square();
    expect(glueVectorNetworkEdges(n, 4, 4)).toEqual({
      ok: false,
      reason: 'same-edge',
    });
    expect(glueVectorNetworkEdges(n, 4, 0)).toEqual({
      ok: false,
      reason: 'different-geometry',
    });
    expect(glueVectorNetworkEdges(n, 4, NaN)).toEqual({
      ok: false,
      reason: 'invalid-edge',
    });
    n.segments.push({ ...n.segments[4] });
    n.regions!.push({ loops: [[4, 5]] });
    expect(glueVectorNetworkEdges(n, 4, 5)).toEqual({
      ok: false,
      reason: 'collapsed-region',
    });
    n.regions![0].loops = [[0, 2]];
    expect(unglueVectorNetworkEdge(n, 4, [])).toEqual({
      ok: false,
      reason: 'invalid-network',
    });
  });
  it('rejects a reversed self-loop when it would change nonzero hole winding', () => {
    const n: VectorNetworkData = {
      vertices: [
        { x: 0, y: -40 },
        { x: 0, y: 0 },
      ],
      segments: [
        {
          start: 0,
          end: 0,
          tangentStart: { x: 10, y: -10 },
          tangentEnd: { x: -10, y: -10 },
        },
        {
          start: 1,
          end: 1,
          tangentStart: { x: -100, y: -100 },
          tangentEnd: { x: 100, y: -100 },
        },
        {
          start: 0,
          end: 0,
          tangentStart: { x: -10, y: -10 },
          tangentEnd: { x: 10, y: -10 },
        },
      ],
      regions: [{ fillRule: 'nonzero', loops: [[1], [0]] }],
    };
    expect(glueVectorNetworkEdges(n, 0, 2)).toEqual({
      ok: false,
      reason: 'incompatible-winding',
    });
    n.regions![0].fillRule = 'evenodd';
    expect(glueVectorNetworkEdges(n, 0, 2).ok).toBe(true);
    n.regions = [{ fillRule: 'nonzero', loops: [[0]] }];
    expect(glueVectorNetworkEdges(n, 0, 2).ok).toBe(true);
  });
});
