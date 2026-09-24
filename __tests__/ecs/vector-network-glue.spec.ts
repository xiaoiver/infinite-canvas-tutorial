import {
  glueVertices,
  unglueVertex,
  vectorVertexEndpoints,
  type VectorNetworkData,
} from '../../packages/ecs/src/utils/vector-network-topology';

const branch = (): VectorNetworkData => ({
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: -100, y: 0 },
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 20, y: -10 } },
    { start: 2, end: 0, tangentEnd: { x: 0, y: 20 } },
    { start: 0, end: 3 },
  ],
  regions: [],
});

describe('explicit vertex topology operators', () => {
  it('detaches only the requested ends, preserves curves and returns index maps', () => {
    const before = branch(),
      snapshot = structuredClone(before);
    const result = unglueVertex(before, 0, [{ segmentIndex: 1, end: 'end' }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selectedVertex).toBe(4);
    expect(result.network.vertices[4]).toMatchObject(before.vertices[0]);
    expect(result.network.segments).toEqual([
      before.segments[0],
      { ...before.segments[1], end: 4 },
      before.segments[2],
    ]);
    expect(result.vertexMap).toEqual([[0, 4], [1], [2], [3]]);
    expect(result.segmentMap).toEqual([[0], [1], [2]]);
    expect(before).toEqual(snapshot);
    result.network.segments[0].tangentStart!.x = 999;
    expect(before).toEqual(snapshot);
  });

  it('can detach a group and glue it back without changing the curve geometry', () => {
    const before = branch();
    const split = unglueVertex(before, 0, [
      { segmentIndex: 1, end: 'end' },
      { segmentIndex: 2, end: 'start' },
    ]);
    if (!split.ok) throw new Error('Unglue failed');
    const joined = glueVertices(split.network, split.selectedVertex, 0);
    if (!joined.ok) throw new Error('Glue failed');
    expect(joined.network.segments).toEqual(before.segments);
    expect(joined.network.vertices.map(({ x, y }) => [x, y])).toEqual(
      before.vertices.map(({ x, y }) => [x, y]),
    );
    expect(joined.vertexMap).toEqual([[0], [1], [2], [3], [0]]);
    expect(joined.selectedVertex).toBe(0);
  });

  it.each(
    (
      [
        [],
        [{ segmentIndex: 9, end: 'start' }],
        [{ segmentIndex: 0, end: 'end' }],
        [
          { segmentIndex: 0, end: 'start' },
          { segmentIndex: 0, end: 'start' },
        ],
        [
          { segmentIndex: 0, end: 'start' },
          { segmentIndex: 1, end: 'end' },
          { segmentIndex: 2, end: 'start' },
        ],
      ] as Array<Array<{ segmentIndex: number; end: 'start' | 'end' }>>
    ).map((ends) => [ends]),
  )('rejects invalid or whole-vertex detachment: %j', (ends) => {
    expect(unglueVertex(branch(), 0, ends)).toEqual({
      ok: false,
      reason: 'invalid-endpoints',
    });
  });

  it('distinguishes both ends of a curved self-loop', () => {
    const network: VectorNetworkData = {
      vertices: [{ x: 0, y: 0 }],
      segments: [
        {
          start: 0,
          end: 0,
          tangentStart: { x: 50, y: -50 },
          tangentEnd: { x: 50, y: 50 },
        },
      ],
      regions: [{ fillRule: 'evenodd', loops: [[0]] }],
    };
    expect(vectorVertexEndpoints(network, 0)).toEqual([
      { segmentIndex: 0, end: 'start' },
      { segmentIndex: 0, end: 'end' },
    ]);
    const split = unglueVertex(network, 0, [{ segmentIndex: 0, end: 'end' }]);
    if (!split.ok) throw new Error('Unglue failed');
    expect(split.network.segments[0]).toEqual({
      ...network.segments[0],
      end: 1,
    });
    expect(split.network.regions).toEqual([]);
    const joined = glueVertices(split.network, 1, 0);
    if (!joined.ok) throw new Error('Glue failed');
    expect(joined.network.segments).toEqual(network.segments);
    // Glue restores connectivity; it does not resurrect deleted paint.
    expect(joined.network.regions).toEqual([]);
  });

  it('preserves a closed face when detaching its complete pair of incident ends', () => {
    const network: VectorNetworkData = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
        { x: -50, y: 0 },
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 0 },
        { start: 0, end: 3 },
      ],
      regions: [{ fillRule: 'evenodd', loops: [[0, 1, 2]] }],
    };
    const split = unglueVertex(network, 0, [
      { segmentIndex: 0, end: 'start' },
      { segmentIndex: 2, end: 'end' },
    ]);
    if (!split.ok) throw new Error('Unglue failed');
    expect(split.network.regions).toEqual(network.regions);
    expect(split.network.segments[3]).toEqual(network.segments[3]);
  });

  it('drops an entire filled region when its hole opens, retaining unrelated regions', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
      { x: 30, y: 20 },
      { x: 60, y: 20 },
      { x: 45, y: 50 },
    ];
    const segments = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 0 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 3 },
    ];
    const keep = { fillRule: 'evenodd' as const, loops: [[0, 1, 2]] };
    const network: VectorNetworkData = {
      vertices,
      segments,
      regions: [
        {
          fillRule: 'evenodd',
          loops: [
            [0, 1, 2],
            [3, 4, 5],
          ],
        },
        keep,
      ],
    };
    const split = unglueVertex(network, 3, [{ segmentIndex: 3, end: 'start' }]);
    if (!split.ok) throw new Error('Unglue failed');
    expect(split.network.regions).toEqual([keep]);
  });

  it('glues to the target position and reports collapsed and duplicate edges', () => {
    const network: VectorNetworkData = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 50, y: 0 },
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 0, end: 2 },
        { start: 1, end: 2 },
      ],
    };
    const snapshot = structuredClone(network);
    const joined = glueVertices(network, 0, 1);
    if (!joined.ok) throw new Error('Glue failed');
    expect(joined.network.vertices[0]).toEqual({ x: 10, y: 0 });
    expect(joined.vertexMap).toEqual([[0], [0], [1]]);
    expect(joined.segmentMap).toEqual([[], [0], [0]]);
    expect(network).toEqual(snapshot);
  });

  it('reports invalid vertices without mutation', () => {
    expect(glueVertices(branch(), 0, 0)).toEqual({
      ok: false,
      reason: 'same-vertex',
    });
    expect(glueVertices(branch(), -1, 0)).toEqual({
      ok: false,
      reason: 'invalid-vertex',
    });
    expect(unglueVertex(branch(), 0.5, [])).toEqual({
      ok: false,
      reason: 'invalid-vertex',
    });
    expect(vectorVertexEndpoints(branch(), 99)).toEqual([]);
  });
});
