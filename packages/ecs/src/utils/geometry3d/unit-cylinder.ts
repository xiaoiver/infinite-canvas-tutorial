import type { Mesh3DGeometryData } from './types';

function pushTriangle(
  indices: number[],
  i0: number,
  i1: number,
  i2: number,
  positions: number[],
  targetNormal: [number, number, number],
) {
  const p = (i: number) => [
    positions[i * 3],
    positions[i * 3 + 1],
    positions[i * 3 + 2],
  ] as const;
  const [x0, y0, z0] = p(i0);
  const [x1, y1, z1] = p(i1);
  const [x2, y2, z2] = p(i2);
  const ax = x1 - x0;
  const ay = y1 - y0;
  const az = z1 - z0;
  const bx = x2 - x0;
  const by = y2 - y0;
  const bz = z2 - z0;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const dot = nx * targetNormal[0] + ny * targetNormal[1] + nz * targetNormal[2];
  if (dot >= 0) {
    indices.push(i0, i1, i2);
  } else {
    indices.push(i0, i2, i1);
  }
}

/** Cylinder along Y axis, height 1, radius 0.5, centered at origin. */
export function createUnitCylinderGeometry(
  segments = 24,
  cap = true,
): Mesh3DGeometryData {
  const r = 0.5;
  const h = 0.5;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * r, -h, sin * r, cos * r, h, sin * r);
    normals.push(cos, 0, sin, cos, 0, sin);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }

  if (cap) {
    const bottomRingStart = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * r, -h, Math.sin(angle) * r);
      normals.push(0, -1, 0);
    }
    const bottomNormal: [number, number, number] = [0, -1, 0];
    for (let i = 1; i < segments; i++) {
      pushTriangle(
        indices,
        bottomRingStart,
        bottomRingStart + i,
        bottomRingStart + i + 1,
        positions,
        bottomNormal,
      );
    }

    const topRingStart = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * r, h, Math.sin(angle) * r);
      normals.push(0, 1, 0);
    }
    const topNormal: [number, number, number] = [0, 1, 0];
    for (let i = 1; i < segments; i++) {
      pushTriangle(
        indices,
        topRingStart,
        topRingStart + i + 1,
        topRingStart + i,
        positions,
        topNormal,
      );
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
