import type { Mesh3DGeometryData } from './types';

/** 1×1 quad in the XY plane (normal +Z), centered at origin. */
export function createUnitPlaneGeometry(): Mesh3DGeometryData {
  const h = 0.5;
  return {
    positions: new Float32Array([
      -h, -h, 0,
      h, -h, 0,
      h, h, 0,
      -h, h, 0,
    ]),
    normals: new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}
