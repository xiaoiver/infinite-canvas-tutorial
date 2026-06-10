import type { Mesh3DGeometryData } from './types';

/** UV sphere centered at origin, diameter 1 (radius 0.5). */
export function createUnitSphereGeometry(
  segments: [number, number] = [24, 16],
): Mesh3DGeometryData {
  const [uSeg, vSeg] = segments;
  const r = 0.5;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let v = 0; v <= vSeg; v++) {
    const phi = (v / vSeg) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let u = 0; u <= uSeg; u++) {
      const theta = (u / uSeg) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      // Match Three.js SphereGeometry handedness for equirectangular maps.
      const x = -r * sinPhi * cosTheta;
      const y = r * cosPhi;
      const z = r * sinPhi * sinTheta;
      positions.push(x, y, z);
      normals.push(x / r, y / r, z / r);
      // Equirectangular: negated X mirrors longitude → flip U; north (Y+) → v=1 (unpackFlipY).
      uvs.push(1 - u / uSeg, 1 - v / vSeg);
    }
  }

  for (let v = 0; v < vSeg; v++) {
    for (let u = 0; u < uSeg; u++) {
      const a = v * (uSeg + 1) + u;
      const b = a + uSeg + 1;
      // Negated X mirrors winding; swap corners so front faces point outward (BACK cull).
      indices.push(a, b, a + 1, b + 1, a + 1, b);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
