import {
  pathToVectorNetwork,
  splitSegmentAt,
} from '../../packages/ecs/src/utils/vector-network-topology';
import {
  findVectorNetworkFaces,
  toggleVectorNetworkFace,
  vectorNetworkFaceAtPoint,
} from '../../packages/ecs/src/utils/vector-network-region';
import { buildVectorNetworkFillMesh } from '../../packages/ecs/src/utils/vector-network-fill';

function area(network: ReturnType<typeof pathToVectorNetwork>) {
  const { points, indices } = buildVectorNetworkFillMesh(
    network.vertices,
    network.segments,
    network.regions,
  );
  let sum = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((j) => points.slice(j * 2, j * 2 + 2));
    sum +=
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) /
      2;
  }
  return sum;
}

describe('vector network face filling', () => {
  it('finds nested faces with immediate holes, independently of winding', () => {
    const network = pathToVectorNetwork(
      'M 0 0 H 100 V 100 H 0 Z M 20 20 H 80 V 80 H 20 Z M 40 40 H 60 V 60 H 40 Z',
    );
    const faces = findVectorNetworkFaces(network.vertices, network.segments);
    expect(faces).toHaveLength(3);
    const outer = vectorNetworkFaceAtPoint(faces, [10, 10])!;
    const middle = vectorNetworkFaceAtPoint(faces, [30, 30])!;
    const inner = vectorNetworkFaceAtPoint(faces, [50, 50])!;
    expect(outer.region.loops).toHaveLength(2);
    expect(middle.region.loops).toHaveLength(2);
    expect(inner.region.loops).toHaveLength(1);
    expect(area({ ...network, regions: [outer.region] })).toBeCloseTo(6400);
    expect(area({ ...network, regions: [middle.region] })).toBeCloseTo(3200);
    expect(area({ ...network, regions: [inner.region] })).toBeCloseTo(400);
    expect(vectorNetworkFaceAtPoint(faces, [110, 10])).toBeNull();
    expect(vectorNetworkFaceAtPoint(faces, [20, 20])).toBeNull();
  });

  it('treats a disconnected subdivided component as one hole, not overlapping holes', () => {
    const network = pathToVectorNetwork(
      'M 0 0 H 100 V 100 H 0 Z M 20 20 H 80 V 80 H 20 Z',
    );
    network.segments.push({ start: 4, end: 6 });
    const faces = findVectorNetworkFaces(network.vertices, network.segments);
    expect(faces).toHaveLength(3);
    const outer = vectorNetworkFaceAtPoint(faces, [10, 10])!;
    expect(outer.region.loops).toHaveLength(2);
    expect(area({ ...network, regions: [outer.region] })).toBeCloseTo(6400);
  });

  it('toggles a single face out of an imported fill spanning multiple faces', () => {
    const network = pathToVectorNetwork('M 0 0 H 100 V 100 H 0 Z');
    network.segments.push({ start: 0, end: 2 });
    const faces = findVectorNetworkFaces(network.vertices, network.segments);
    const target = vectorNetworkFaceAtPoint(faces, [80, 20])!;
    const regions = toggleVectorNetworkFace(
      network.vertices,
      network.segments,
      network.regions,
      faces,
      target,
    );
    expect(regions).toHaveLength(1);
    expect(area({ ...network, regions })).toBeCloseTo(5000);
    const restored = toggleVectorNetworkFace(
      network.vertices,
      network.segments,
      regions,
      faces,
      target,
    );
    expect(area({ ...network, regions: restored })).toBeCloseTo(10000);
    expect(network.regions![0].loops).toEqual([[0, 1, 2, 3]]);
  });

  it.each(['nonzero', 'evenodd'] as const)(
    'preserves imported %s fill coverage while toggling an island',
    (rule) => {
      const network = pathToVectorNetwork(
        'M 0 0 H 100 V 100 H 0 Z M 20 20 H 80 V 80 H 20 Z M 40 40 H 60 V 60 H 40 Z',
        rule,
      );
      const faces = findVectorNetworkFaces(network.vertices, network.segments);
      const target = vectorNetworkFaceAtPoint(faces, [50, 50])!;
      const regions = toggleVectorNetworkFace(
        network.vertices,
        network.segments,
        network.regions,
        faces,
        target,
      );
      expect(area({ ...network, regions })).toBeCloseTo(
        rule === 'nonzero' ? 9600 : 6400,
      );
    },
  );

  it('does not lose neighbouring fills after a boundary split and a toggle', () => {
    const network = pathToVectorNetwork('M 0 0 H 100 V 100 H 0 Z');
    network.segments.push({ start: 0, end: 2 });
    let faces = findVectorNetworkFaces(network.vertices, network.segments);
    network.regions = faces.map((face) => face.region);
    splitSegmentAt(network, 4, 0.3);
    faces = findVectorNetworkFaces(network.vertices, network.segments);
    const target = vectorNetworkFaceAtPoint(faces, [80, 20])!;
    network.regions = toggleVectorNetworkFace(
      network.vertices,
      network.segments,
      network.regions,
      faces,
      target,
    );
    expect(area(network)).toBeCloseTo(5000);
  });

  it('fills concave faces using a sample inside the shape', () => {
    const network = pathToVectorNetwork('M 0 0 H 100 V 20 H 20 V 100 H 0 Z');
    const faces = findVectorNetworkFaces(network.vertices, network.segments);
    const target = vectorNetworkFaceAtPoint(faces, [10, 50])!;
    expect(
      toggleVectorNetworkFace(
        network.vertices,
        network.segments,
        network.regions,
        faces,
        target,
      ),
    ).toEqual([]);
    expect(vectorNetworkFaceAtPoint(faces, [50, 50])).toBeNull();
  });

  it('finds a face containing a dangling edge without treating the bridge as a hole', () => {
    const network = pathToVectorNetwork('M 0 0 H 100 V 100 H 0 Z');
    network.vertices.push({ x: 20, y: 20 });
    network.segments.push({ start: 0, end: 4 });
    const faces = findVectorNetworkFaces(network.vertices, network.segments);
    expect(faces).toHaveLength(1);
    expect(area({ ...network, regions: [faces[0].region] })).toBeCloseTo(10000);
  });

  it('has no fillable face for an open chain and no effect on geometry', () => {
    const network = pathToVectorNetwork('M 0 0 C 20 50 80 50 100 0');
    const before = structuredClone(network);
    expect(findVectorNetworkFaces(network.vertices, network.segments)).toEqual(
      [],
    );
    expect(network).toEqual(before);
  });
});
