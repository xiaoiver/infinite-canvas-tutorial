import type { Mesh3DGeometryData } from './types';

/**
 * UV for a cube face vertex in mesh3d canvas space (Y+ points down).
 * Planar faces: map position to [0,1]² with unpackFlipY (OpenGL (0,0) at face bottom-left).
 */
function cubeVertexUv(
  x: number,
  y: number,
  z: number,
  normal: [number, number, number],
  h: number,
): [number, number] {
  const uCoord = (c: number) => (c + h) / (2 * h);
  const vCoord = (c: number) => (c + h) / (2 * h);

  const [nx, ny, nz] = normal;
  if (Math.abs(nz) > 0) {
    return [uCoord(x), vCoord(y)];
  }
  if (Math.abs(ny) > 0) {
    return [uCoord(x), vCoord(z)];
  }
  return [uCoord(z), vCoord(y)];
}

/** Unit cube centered at origin with per-face normals (24 verts, indexed). */
export function createUnitCubeGeometry(): Mesh3DGeometryData {
  const h = 0.5;
  const faces: {
    normal: [number, number, number];
    verts: [number, number, number][];
  }[] = [
    { normal: [0, 0, 1], verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
    { normal: [0, 0, -1], verts: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    { normal: [0, 1, 0], verts: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
    { normal: [0, -1, 0], verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
    { normal: [1, 0, 0], verts: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
    { normal: [-1, 0, 0], verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const { normal, verts } of faces) {
    for (const [vx, vy, vz] of verts) {
      positions.push(vx, vy, vz);
      normals.push(...normal);
      const [u, v] = cubeVertexUv(vx, vy, vz, normal, h);
      uvs.push(u, v);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
