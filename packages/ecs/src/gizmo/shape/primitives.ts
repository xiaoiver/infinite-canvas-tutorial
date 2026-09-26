/**
 * Low-level procedural geometry builders shared by gizmo shapes.
 *
 * These were previously private helpers in `utils/gizmo-geometry.ts`; they are
 * moved here unchanged so the shape classes own their geometry generation while
 * producing byte-for-byte identical meshes.
 */

/** Plain triangle-mesh geometry expressed as flat number arrays. */
export interface RawGeometry {
  positions: number[];
  normals: number[];
  indices: number[];
}

/**
 * Rotate geometry from Y-up to the target axis direction.
 */
export function rotateGeometry(
  geom: RawGeometry,
  axis: 'x' | 'y' | 'z',
): RawGeometry {
  if (axis === 'y') return geom;

  const { positions, normals, indices } = geom;
  const outPos: number[] = [];
  const outNorm: number[] = [];

  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = [positions[i], positions[i + 1], positions[i + 2]];
    const [nx, ny, nz] = [normals[i], normals[i + 1], normals[i + 2]];

    if (axis === 'x') {
      // Rotate 90° around Z: Y→X
      outPos.push(y, -x, z);
      outNorm.push(ny, -nx, nz);
    } else {
      // Rotate -90° around X: Y→Z
      outPos.push(x, -z, y);
      outNorm.push(nx, -nz, ny);
    }
  }

  return { positions: outPos, normals: outNorm, indices };
}

/**
 * Create a cylinder (shaft) along the Y-axis, then rotate to target axis.
 */
export function createCylinderAlongAxis(
  axis: 'x' | 'y' | 'z',
  radius: number,
  length: number,
  segments: number,
): RawGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Generate cylinder along Y-axis from 0 to length
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Bottom vertex
    positions.push(cos * radius, 0, sin * radius);
    normals.push(cos, 0, sin);

    // Top vertex
    positions.push(cos * radius, length, sin * radius);
    normals.push(cos, 0, sin);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }

  // Rotate to target axis
  return rotateGeometry({ positions, normals, indices }, axis);
}

/**
 * Create a cone (arrow tip) along Y-axis, then rotate to target axis.
 */
export function createConeAlongAxis(
  axis: 'x' | 'y' | 'z',
  radius: number,
  height: number,
  offset: number,
  segments: number,
): RawGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Tip vertex
  positions.push(0, offset + height, 0);
  normals.push(0, 1, 0);

  // Base ring
  const slope = radius / height;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * radius, offset, sin * radius);
    // Cone normal: outward + upward
    const nx = cos;
    const ny = slope;
    const nz = sin;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals.push(nx / len, ny / len, nz / len);
  }

  // Side faces (fan from tip)
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  // Base cap
  const baseCenter = positions.length / 3;
  positions.push(0, offset, 0);
  normals.push(0, -1, 0);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * radius, offset, sin * radius);
    normals.push(0, -1, 0);
  }
  for (let i = 1; i <= segments; i++) {
    indices.push(baseCenter, baseCenter + i + 1, baseCenter + i);
  }

  return rotateGeometry({ positions, normals, indices }, axis);
}

/**
 * Create a small square quad for plane-drag handles (e.g., XY plane).
 */
export function createPlaneQuad(
  plane: 'xy' | 'xz' | 'yz',
  size: number,
  offset: number,
): RawGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const o = offset;
  const s = size;

  if (plane === 'xy') {
    positions.push(o, o, 0, o + s, o, 0, o + s, o + s, 0, o, o + s, 0);
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
  } else if (plane === 'xz') {
    positions.push(o, 0, o, o + s, 0, o, o + s, 0, o + s, o, 0, o + s);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
  } else {
    positions.push(0, o, o, 0, o + s, o, 0, o + s, o + s, 0, o, o + s);
    normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
  }

  const indices = [0, 1, 2, 0, 2, 3];
  return { positions, normals, indices };
}

/**
 * Ring in XZ plane (Y-up cylinder default), then rotated to X / Z axis.
 */
export function createRotationRing(
  axis: 'x' | 'y' | 'z',
  radius: number,
  tube: number,
  segments: number,
): RawGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const inner = Math.max(radius - tube, radius * 0.7);

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);

    const outer0 = [c0 * radius, 0, s0 * radius];
    const outer1 = [c1 * radius, 0, s1 * radius];
    const inner0 = [c0 * inner, 0, s0 * inner];
    const inner1 = [c1 * inner, 0, s1 * inner];

    const base = positions.length / 3;
    for (const p of [outer0, outer1, inner1, inner0]) {
      positions.push(p[0], p[1], p[2]);
      normals.push(0, 1, 0);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  if (axis === 'y') {
    return { positions, normals, indices };
  }
  return rotateGeometry({ positions, normals, indices }, axis);
}

/**
 * Create an axis-aligned box centered at `offset` along its axis (scale handle).
 */
export function createBoxAlongAxis(
  axis: 'x' | 'y' | 'z',
  size: number,
  offset: number,
): RawGeometry {
  // Unit cube centered at origin, scaled to `size`, then shifted along +Y by
  // `offset`, then rotated onto the target axis (matches arrow/ring convention).
  const h = size / 2;
  const corners: Array<[number, number, number]> = [
    [-h, -h, -h],
    [h, -h, -h],
    [h, h, -h],
    [-h, h, -h],
    [-h, -h, h],
    [h, -h, h],
    [h, h, h],
    [-h, h, h],
  ];

  const faces: Array<{ idx: [number, number, number, number]; n: [number, number, number] }> = [
    { idx: [0, 3, 2, 1], n: [0, 0, -1] },
    { idx: [4, 5, 6, 7], n: [0, 0, 1] },
    { idx: [0, 4, 7, 3], n: [-1, 0, 0] },
    { idx: [1, 2, 6, 5], n: [1, 0, 0] },
    { idx: [0, 1, 5, 4], n: [0, -1, 0] },
    { idx: [3, 7, 6, 2], n: [0, 1, 0] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const face of faces) {
    const base = positions.length / 3;
    for (const ci of face.idx) {
      const c = corners[ci];
      positions.push(c[0], c[1] + offset, c[2]);
      normals.push(face.n[0], face.n[1], face.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return rotateGeometry({ positions, normals, indices }, axis);
}

/**
 * Create a UV sphere centered at the origin (uniform-scale / center handle).
 */
export function createSphere(radius: number, segments: number): RawGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const rings = Math.max(2, Math.round(segments / 2));

  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta) * sinPhi;
      const ny = cosPhi;
      const nz = Math.sin(theta) * sinPhi;
      positions.push(nx * radius, ny * radius, nz * radius);
      normals.push(nx, ny, nz);
    }
  }

  const stride = segments + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * stride + x;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return { positions, normals, indices };
}

/** Merge two geometries into one, offsetting the second's indices. */
export function mergeGeometry(a: RawGeometry, b: RawGeometry): RawGeometry {
  const offset = a.positions.length / 3;
  return {
    positions: [...a.positions, ...b.positions],
    normals: [...a.normals, ...b.normals],
    indices: [...a.indices, ...b.indices.map((i) => i + offset)],
  };
}
