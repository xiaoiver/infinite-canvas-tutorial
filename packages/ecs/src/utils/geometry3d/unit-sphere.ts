import type { Mesh3DGeometryData } from './types';

/** UV sphere centered at origin, diameter 1 (radius 0.5). */
export function createUnitSphereGeometry(
  segments: [number, number] = [24, 16],
): Mesh3DGeometryData {
  const [uSeg, vSeg] = segments;
  const r = 0.5;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let v = 0; v <= vSeg; v++) {
    const phi = (v / vSeg) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let u = 0; u <= uSeg; u++) {
      const theta = (u / uSeg) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const x = r * sinPhi * cosTheta;
      const y = r * cosPhi;
      const z = r * sinPhi * sinTheta;
      positions.push(x, y, z);
      normals.push(x / r, y / r, z / r);
    }
  }

  for (let v = 0; v < vSeg; v++) {
    for (let u = 0; u < uSeg; u++) {
      const a = v * (uSeg + 1) + u;
      const b = a + uSeg + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
