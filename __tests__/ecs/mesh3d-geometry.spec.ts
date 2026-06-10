import {
  createGeometry,
  createUnitCubeGeometry,
  createUnitCylinderGeometry,
  createUnitPlaneGeometry,
  createUnitSphereGeometry,
  normalizeGeometry,
} from '../../packages/ecs/src/utils/geometry3d';

describe('mesh3d geometry primitives', () => {
  it('normalizes string shorthand to spec', () => {
    expect(normalizeGeometry('sphere')).toEqual({ type: 'sphere' });
    expect(normalizeGeometry(undefined)).toEqual({ type: 'cube' });
    expect(normalizeGeometry('unknown' as 'cube')).toEqual({ type: 'cube' });
  });

  it('creates non-empty cube mesh', () => {
    const mesh = createUnitCubeGeometry();
    expect(mesh.positions.length).toBe(72);
    expect(mesh.normals.length).toBe(72);
    expect(mesh.indices!.length).toBe(36);
  });

  it('creates sphere with expected topology', () => {
    const mesh = createUnitSphereGeometry([8, 4]);
    expect(mesh.positions.length / 3).toBe((8 + 1) * (4 + 1));
    expect(mesh.indices!.length).toBe(8 * 4 * 6);
  });

  it('creates sphere with equirectangular UVs in [0, 1]', () => {
    const mesh = createUnitSphereGeometry([8, 4]);
    expect(mesh.uvs).toBeInstanceOf(Float32Array);
    // One (u, v) pair per vertex.
    expect(mesh.uvs!.length).toBe((mesh.positions.length / 3) * 2);
    for (const value of mesh.uvs!) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    // First vertex maps to UV origin, last to (1, 1).
    expect(mesh.uvs![0]).toBe(0);
    expect(mesh.uvs![1]).toBe(0);
    expect(mesh.uvs![mesh.uvs!.length - 2]).toBe(1);
    expect(mesh.uvs![mesh.uvs!.length - 1]).toBe(1);
  });

  it('creates capped cylinder with outward-facing cap normals', () => {
    const segments = 12;
    const mesh = createUnitCylinderGeometry(segments, true);
    const { positions, indices } = mesh;
    const sideVerts = (segments + 1) * 2;
    const bottomRingStart = sideVerts;
    const topRingStart = bottomRingStart + (segments + 1);

    const triNormal = (i0: number, i1: number, i2: number) => {
      const p = (i: number) => positions.slice(i * 3, i * 3 + 3);
      const [x0, y0, z0] = p(i0);
      const [x1, y1, z1] = p(i1);
      const [x2, y2, z2] = p(i2);
      const ax = x1 - x0;
      const ay = y1 - y0;
      const az = z1 - z0;
      const bx = x2 - x0;
      const by = y2 - y0;
      const bz = z2 - z0;
      return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx] as const;
    };

    const sideTriCount = segments * 2;
    const capTriCount = (segments - 1) * 2;
    expect(indices!.length).toBe((sideTriCount + capTriCount) * 3);

    const bottomTriStart = sideTriCount * 3;
    expect(triNormal(
      indices![bottomTriStart],
      indices![bottomTriStart + 1],
      indices![bottomTriStart + 2],
    )[1]).toBeLessThan(0);
    expect(indices![bottomTriStart]).toBe(bottomRingStart);

    const topTriStart = bottomTriStart + (segments - 1) * 3;
    expect(triNormal(
      indices![topTriStart],
      indices![topTriStart + 1],
      indices![topTriStart + 2],
    )[1]).toBeGreaterThan(0);
    expect(indices![topTriStart]).toBe(topRingStart);
  });

  it('creates plane quad', () => {
    const mesh = createUnitPlaneGeometry();
    expect(mesh.positions.length / 3).toBe(4);
    expect(mesh.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
  });

  it('routes createGeometry by spec type', () => {
    const sphere = createGeometry({ type: 'sphere', segments: [6, 4] });
    expect(sphere.positions.length).toBeGreaterThan(0);
    const cylinder = createGeometry({ type: 'cylinder' });
    expect(cylinder.indices!.length).toBeGreaterThan(0);
    const plane = createGeometry({ type: 'plane' });
    expect(plane.positions.length).toBe(12);
  });
});
