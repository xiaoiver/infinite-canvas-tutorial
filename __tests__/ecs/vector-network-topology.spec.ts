import {
  pathToVectorNetwork,
  splitSegmentAt,
  deleteVertex,
  findRegionLoopAtPoint,
  contourFromSegmentLoop,
  type VectorNetworkData,
} from '../../packages/ecs/src/utils';

describe('pathToVectorNetwork', () => {
  it('converts a closed triangle into vertices/segments/regions', () => {
    const { vertices, segments, regions } = pathToVectorNetwork(
      'M 0 0 L 100 0 L 50 100 Z',
    );
    expect(vertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(segments.map((s) => [s.start, s.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    expect(regions).toBeDefined();
    expect(regions![0].loops).toEqual([[0, 1, 2]]);
    expect(regions![0].fillRule).toBe('nonzero');
  });

  it('keeps cubic curvature as Figma-style relative tangents', () => {
    const { vertices, segments } = pathToVectorNetwork(
      'M 0 0 C 10 20 30 20 40 0',
    );
    expect(vertices).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0].tangentStart).toEqual({ x: 10, y: 20 });
    expect(segments[0].tangentEnd).toEqual({ x: -10, y: 20 });
  });

  it('treats straight lines as zero tangents (undefined)', () => {
    const { segments } = pathToVectorNetwork('M 0 0 L 10 0');
    expect(segments[0].tangentStart).toBeUndefined();
    expect(segments[0].tangentEnd).toBeUndefined();
  });

  it('converts quadratic commands into cubic tangents', () => {
    const { segments } = pathToVectorNetwork('M 0 0 Q 50 100 100 0');
    // c1 = p0 + 2/3 (q - p0) = (33.33, 66.66); tangentStart = c1 - p0
    expect(segments[0].tangentStart!.x).toBeCloseTo(100 / 3, 5);
    expect(segments[0].tangentStart!.y).toBeCloseTo(200 / 3, 5);
    // c2 = p3 + 2/3 (q - p3) = (66.66, 66.66); tangentEnd = c2 - p3
    expect(segments[0].tangentEnd!.x).toBeCloseTo(-100 / 3, 5);
    expect(segments[0].tangentEnd!.y).toBeCloseTo(200 / 3, 5);
  });

  it('does not duplicate the start vertex when Z closes on it', () => {
    const { vertices, segments } = pathToVectorNetwork(
      'M 0 0 L 100 0 L 100 100 L 0 0 Z',
    );
    // The explicit "L 0 0" returns to start; Z must reuse vertex 0.
    expect(vertices).toHaveLength(3);
    expect(segments[segments.length - 1].end).toBe(0);
  });

  it('supports multiple subpaths (holes) as separate loops', () => {
    const { regions } = pathToVectorNetwork(
      'M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z',
    );
    expect(regions![0].loops).toHaveLength(2);
  });
});

describe('splitSegmentAt', () => {
  it('splits a straight segment at its midpoint and updates region loops', () => {
    const network: VectorNetworkData = pathToVectorNetwork(
      'M 0 0 L 100 0 L 50 100 Z',
    ) as VectorNetworkData;
    const newIndex = splitSegmentAt(network, 0, 0.5);
    expect(newIndex).toBe(3);
    expect(network.vertices[newIndex]).toEqual({ x: 50, y: 0 });
    // Original segment now ends at the new vertex.
    expect([network.segments[0].start, network.segments[0].end]).toEqual([
      0,
      3,
    ]);
    // A new segment connects the new vertex to the original end.
    const second = network.segments[network.segments.length - 1];
    expect([second.start, second.end]).toEqual([3, 1]);
    // Region loop has the inserted segment right after the original.
    expect(network.regions![0].loops[0]).toEqual([0, 3, 1, 2]);
  });

  it('preserves cubic curvature when splitting (point lies on the curve)', () => {
    const network = pathToVectorNetwork(
      'M 0 0 C 0 100 100 100 100 0',
    ) as VectorNetworkData;
    const newIndex = splitSegmentAt(network, 0, 0.5);
    const mid = network.vertices[newIndex];
    // Midpoint of this symmetric cubic at t=0.5 is (50, 75).
    expect(mid.x).toBeCloseTo(50, 5);
    expect(mid.y).toBeCloseTo(75, 5);
  });
});

describe('deleteVertex', () => {
  it('heals a degree-2 vertex into a single straight segment', () => {
    // Open chain 0-1-2; deleting vertex 1 should connect 0 to 2.
    const network = pathToVectorNetwork(
      'M 0 0 L 50 50 L 100 0',
    ) as VectorNetworkData;
    const result = deleteVertex(network, 1);
    expect(result.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.segments).toHaveLength(1);
    expect([result.segments[0].start, result.segments[0].end]).toEqual([0, 1]);
  });

  it('drops incident edges for a degree-3 vertex without healing', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
      { x: 50, y: 50 },
    ];
    const segments = [
      { start: 3, end: 0 },
      { start: 3, end: 1 },
      { start: 3, end: 2 },
    ];
    const result = deleteVertex({ vertices, segments }, 3);
    expect(result.segments).toHaveLength(0);
    expect(result.vertices).toHaveLength(3);
  });
});

describe('findRegionLoopAtPoint', () => {
  it('finds the enclosing loop of a triangle', () => {
    const { vertices, segments } = pathToVectorNetwork(
      'M 0 0 L 100 0 L 50 100 Z',
    );
    const loop = findRegionLoopAtPoint(vertices, segments, [50, 30]);
    expect(loop).not.toBeNull();
    const contour = contourFromSegmentLoop(vertices, segments, loop!);
    expect(contour.length).toBe(3);
  });

  it('returns null when the point is outside any face', () => {
    const { vertices, segments } = pathToVectorNetwork(
      'M 0 0 L 100 0 L 50 100 Z',
    );
    const loop = findRegionLoopAtPoint(vertices, segments, [500, 500]);
    expect(loop).toBeNull();
  });

  it('picks the minimal face in a subdivided square', () => {
    // A square split by a vertical edge into two cells.
    const vertices = [
      { x: 0, y: 0 }, // 0
      { x: 50, y: 0 }, // 1
      { x: 100, y: 0 }, // 2
      { x: 100, y: 100 }, // 3
      { x: 50, y: 100 }, // 4
      { x: 0, y: 100 }, // 5
    ];
    const segments = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 0 },
      { start: 1, end: 4 }, // dividing edge
    ];
    const left = findRegionLoopAtPoint(vertices, segments, [25, 50]);
    const right = findRegionLoopAtPoint(vertices, segments, [75, 50]);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    // Each cell is a 4-edge loop, not the whole 6-edge outline.
    expect(left!.length).toBe(4);
    expect(right!.length).toBe(4);
    expect(left).toContain(6);
    expect(right).toContain(6);
  });
});
