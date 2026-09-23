import {
  breakVertex,
  deleteVertex,
  getVectorSegmentPointAt,
  mergeVertices,
  pathToVectorNetwork,
  splitSegmentAt,
  type VectorNetworkData,
} from '../../packages/ecs/src/utils/vector-network-topology';
import { orientVectorLoop } from '../../packages/ecs/src/utils/vector-network-loop';
import {
  buildVectorNetworkFillMesh,
  contourFromSegmentLoop,
} from '../../packages/ecs/src/utils/vector-network-fill';
import { findRegionLoopAtPoint } from '../../packages/ecs/src/utils/vector-network-region';
import { buildVectorNetworkFillPathD } from '../../packages/ecs/src/utils/vector-network-svg';
import {
  tessellateVectorSegment,
  vectorNetworkToFlatStrokePoints,
} from '../../packages/ecs/src/utils/vector-network-stroke';
import { VectorNetwork } from '../../packages/ecs/src/components/geometry/VectorNetwork';

function meshArea(network: VectorNetworkData): number {
  const { points, indices } = buildVectorNetworkFillMesh(
    network.vertices,
    network.segments,
    network.regions,
  );
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((index) => points.slice(index * 2, index * 2 + 2));
    area +=
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) /
      2;
  }
  return area;
}

function sharedSquares(): VectorNetworkData {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ],
    segments: [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 0 },
      { start: 1, end: 4 },
    ],
    regions: [
      { fillRule: 'nonzero', loops: [[0, 6, 4, 5]] },
      { fillRule: 'nonzero', loops: [[1, 2, 3, 6]] },
    ],
  };
}

function lens(): VectorNetworkData {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: 100 },
        tangentEnd: { x: 0, y: 100 },
      },
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: -100 },
        tangentEnd: { x: 0, y: -100 },
      },
    ],
    regions: [{ fillRule: 'nonzero', loops: [[0, 1]] }],
  };
}

function selfLoop(): VectorNetworkData {
  return {
    vertices: [{ x: 20, y: 30 }],
    segments: [
      {
        start: 0,
        end: 0,
        tangentStart: { x: 120, y: 120 },
        tangentEnd: { x: -120, y: 120 },
      },
    ],
    regions: [{ fillRule: 'nonzero', loops: [[0]] }],
  };
}

describe('vector network boundary invariants', () => {
  it('resolves a reversed first edge consistently for filling and SVG export', () => {
    const network = pathToVectorNetwork('M 0 0 L 100 0 L 50 100 Z');
    network.segments[0] = { start: 1, end: 0 };
    const walk = orientVectorLoop(network.segments, [0, 1, 2]);
    expect(walk![0].reversed).toBe(true);
    expect(meshArea(network)).toBeCloseTo(5000);
    expect(
      buildVectorNetworkFillPathD(
        network.vertices,
        network.segments,
        network.regions as VectorNetwork['regions'],
      ),
    ).toBe('M 0 0 L 100 0 L 50 100 L 0 0 Z');
  });

  it.each([
    [0, 1],
    [0, 99, 2],
    [0, 2, 1, 1],
  ])('rejects an invalid boundary %j', (...loop) => {
    const network = pathToVectorNetwork('M 0 0 L 100 0 L 50 100 Z');
    network.regions![0].loops = [loop];
    expect(
      contourFromSegmentLoop(network.vertices, network.segments, loop),
    ).toEqual([]);
    expect(meshArea(network)).toBe(0);
    expect(
      buildVectorNetworkFillPathD(
        network.vertices,
        network.segments,
        network.regions as VectorNetwork['regions'],
      ),
    ).toBe('');
  });

  it('keeps both faces when splitting a shared edge traversed in opposite directions', () => {
    const network = sharedSquares();
    const before = meshArea(network);
    splitSegmentAt(network, 6, 0.3);
    expect(network.regions![0].loops).toEqual([[0, 6, 7, 4, 5]]);
    expect(network.regions![1].loops).toEqual([[1, 2, 3, 7, 6]]);
    expect(meshArea(network)).toBeCloseTo(before);
  });

  it('preserves both faces when healing the split shared edge', () => {
    const network = sharedSquares();
    const inserted = splitSegmentAt(network, 6, 0.3);
    const result = deleteVertex(network, inserted);
    expect(result.regions).toHaveLength(2);
    expect(meshArea(result)).toBeCloseTo(10000);
  });

  it('preserves unrelated regions on deletion and cut, with remapped segment indices', () => {
    const network = sharedSquares();
    const cut = breakVertex(network, 0)!;
    expect(cut.regions).toHaveLength(1);
    expect(meshArea(cut)).toBeCloseTo(5000);
    const removed = deleteVertex(network, 0, { heal: false });
    expect(removed.regions).toHaveLength(1);
    expect(meshArea(removed)).toBeCloseTo(5000);
    expect(network.regions).toHaveLength(2);
    expect(network.segments).toHaveLength(7);
  });

  it('never fills a broken hole by silently dropping its boundary', () => {
    const network = pathToVectorNetwork(
      'M 0 0 H 100 V 100 H 0 Z M 25 25 V 75 H 75 V 25 Z',
    );
    const result = breakVertex(network, 4)!;
    expect(result.regions).toEqual([]);
    expect(meshArea(result)).toBe(0);
  });

  it('does not join disconnected contours in nonzero fills', () => {
    const network = pathToVectorNetwork(
      'M 0 0 H 10 V 10 H 0 Z M 20 0 H 30 V 10 H 20 Z',
    );
    expect(meshArea(network)).toBeCloseTo(200);
  });

  it.each(['nonzero', 'evenodd'] as CanvasFillRule[])(
    'handles nested holes and islands in any contour order (%s)',
    (rule) => {
      const network = pathToVectorNetwork(
        'M 0 0 H 100 V 100 H 0 Z M 20 20 V 80 H 80 V 20 Z M 40 40 H 60 V 60 H 40 Z',
        rule,
      );
      expect(meshArea(network)).toBeCloseTo(6800);
      network.regions![0].loops = [...network.regions![0].loops].reverse();
      expect(meshArea(network)).toBeCloseTo(6800);
    },
  );
});

describe('curved topology', () => {
  it.each([0.01, 0.2, 0.5, 0.85, 0.99])(
    'restores a cubic after splitting at t=%s then healing',
    (t) => {
      const network = pathToVectorNetwork('M 10 20 C 90 180 -40 70 160 30');
      const original = structuredClone(network);
      const inserted = splitSegmentAt(network, 0, t);
      const result = deleteVertex(network, inserted, { maxError: 1e-6 });
      expect(result.vertices).toHaveLength(2);
      for (let i = 0; i <= 20; i++) {
        const expected = getVectorSegmentPointAt(
          original.vertices,
          original.segments[0],
          i / 20,
        )!;
        const actual = getVectorSegmentPointAt(
          result.vertices,
          result.segments[0],
          i / 20,
        )!;
        expect(actual[0]).toBeCloseTo(expected[0], 4);
        expect(actual[1]).toBeCloseTo(expected[1], 4);
      }
    },
  );

  it('heals segments stored opposite to their chain direction', () => {
    const network = pathToVectorNetwork('M 0 0 C 0 100 100 100 100 0');
    const inserted = splitSegmentAt(network, 0, 0.4);
    const second = network.segments[1];
    network.segments[1] = {
      start: second.end,
      end: second.start,
      tangentStart: second.tangentEnd,
      tangentEnd: second.tangentStart,
    };
    const result = deleteVertex(network, inserted, { maxError: 1e-6 });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].tangentStart!.y).toBeCloseTo(100);
    expect(result.segments[0].tangentEnd!.y).toBeCloseTo(100);
  });

  it('rejects a heal exceeding tolerance and allows explicit plain deletion', () => {
    const network = pathToVectorNetwork(
      'M 0 0 C 0 100 50 100 50 0 C 50 -100 100 -100 100 0',
    );
    expect(deleteVertex(network, 1, { maxError: 1e-8 })).toBe(network);
    const removed = deleteVertex(network, 1, { heal: false });
    expect(removed.vertices).toHaveLength(2);
    expect(removed.segments).toHaveLength(0);
  });

  it('fits edited cubics within a supplied tolerance instead of straightening them', () => {
    const network = pathToVectorNetwork('M 0 0 C 0 100 100 100 100 0');
    const inserted = splitSegmentAt(network, 0, 0.5);
    network.segments[0].tangentStart!.y += 2;
    const result = deleteVertex(network, inserted, { maxError: 5 });
    expect(result.vertices).toHaveLength(2);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].tangentStart!.y).toBeGreaterThan(90);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const original = getVectorSegmentPointAt(
        network.vertices,
        network.segments[t <= 0.5 ? 0 : 1],
        t <= 0.5 ? t * 2 : (t - 0.5) * 2,
      )!;
      const fitted = getVectorSegmentPointAt(
        result.vertices,
        result.segments[0],
        t,
      )!;
      expect(
        Math.hypot(original[0] - fitted[0], original[1] - fitted[1]),
      ).toBeLessThan(5);
    }
  });

  it('recovers a subdivision at a stationary cubic join', () => {
    const network = pathToVectorNetwork('M 0 0 C 100 100 100 100 0 0 Z');
    const original = structuredClone(network.segments[0]);
    const inserted = splitSegmentAt(network, 0, 0.5);
    const result = deleteVertex(network, inserted, { maxError: 1e-6 });
    expect(result.vertices).toHaveLength(1);
    expect(result.segments[0]).toEqual(original);
  });

  it('supports filling, drawing, bounds and splitting a one-vertex cubic loop', () => {
    const network = selfLoop();
    expect(
      tessellateVectorSegment(network.vertices, network.segments[0]).length,
    ).toBeGreaterThan(4);
    expect(
      vectorNetworkToFlatStrokePoints(network.vertices, network.segments)
        .length,
    ).toBeGreaterThan(4);
    expect(
      VectorNetwork.getGeometryBounds(network as VectorNetwork).maxY,
    ).toBeGreaterThan(30);
    expect(meshArea(network)).toBeGreaterThan(1000);
    expect(
      findRegionLoopAtPoint(network.vertices, network.segments, [20, 80]),
    ).toEqual([0]);
    expect(
      findRegionLoopAtPoint(network.vertices, network.segments, [200, 80]),
    ).toBeNull();
    const inserted = splitSegmentAt(network, 0, 0.3);
    expect(network.regions![0].loops[0]).toHaveLength(2);
    const healed = deleteVertex(network, inserted, { maxError: 1e-6 });
    expect(healed.vertices).toHaveLength(1);
    expect(healed.regions![0].loops).toEqual([[0]]);
    expect(meshArea(healed)).toBeGreaterThan(1000);
  });

  it('cuts a cubic self-loop at its anchor without changing the curve', () => {
    const network = selfLoop();
    const result = breakVertex(network, 0)!;
    expect(result.vertices).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({ start: 0, end: 1 });
    expect(result.regions).toEqual([]);
    expect(
      tessellateVectorSegment(result.vertices, result.segments[0]),
    ).toEqual(tessellateVectorSegment(network.vertices, network.segments[0]));
    const merged = mergeVertices(result, 1, 0)!;
    expect(merged.segments).toHaveLength(1);
    expect(merged.segments[0]).toMatchObject({ start: 0, end: 0 });
  });

  it('detects both sides of three parallel curves independent of edge orientation', () => {
    const network = lens();
    network.segments.push({ start: 0, end: 1 });
    for (let mask = 0; mask < 8; mask++) {
      const segments = network.segments.map((s, i) =>
        mask & (1 << i)
          ? {
              start: s.end,
              end: s.start,
              tangentStart: s.tangentEnd,
              tangentEnd: s.tangentStart,
            }
          : s,
      );
      expect(
        findRegionLoopAtPoint(network.vertices, segments, [50, 20])!.sort(),
      ).toEqual([0, 2]);
      expect(
        findRegionLoopAtPoint(network.vertices, segments, [50, -20])!.sort(),
      ).toEqual([1, 2]);
    }
  });

  it('preserves a two-edge curved region when merging overlapping endpoints', () => {
    const network = lens();
    network.vertices.push({ ...network.vertices[1] });
    network.segments.push({ start: 1, end: 2 });
    network.segments[1].end = 2;
    network.regions![0].loops = [[0, 2, 1]];
    const result = mergeVertices(network, 2, 1)!;
    expect(result.segments).toHaveLength(2);
    expect(result.regions![0].loops).toEqual([[0, 1]]);
    expect(meshArea(result)).toBeGreaterThan(10000);
  });

  it('does not mutate frozen inputs to pure edit operations', () => {
    const network = lens();
    network.vertices.push({ x: 100, y: 0 });
    const freeze = (value: any) => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    };
    freeze(network);
    expect(() => breakVertex(network, 0)).not.toThrow();
    expect(() => mergeVertices(network, 2, 1)).not.toThrow();
    expect(() => deleteVertex(network, 2)).not.toThrow();
  });

  it('rejects a non-finite split parameter without mutating the network', () => {
    const network = lens();
    const original = structuredClone(network);
    expect(splitSegmentAt(network, 0, NaN)).toBe(-1);
    expect(network).toEqual(original);
  });
});
