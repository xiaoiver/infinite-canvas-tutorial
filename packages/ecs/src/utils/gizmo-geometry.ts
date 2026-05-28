/**
 * Generates geometry for 3D transform gizmo handles (arrows for translation).
 * All geometry is centered at origin and aligned along positive axes.
 */

/**
 * Create a cylinder (shaft) along the Y-axis, then rotate to target axis.
 */
function createCylinderAlongAxis(
  axis: 'x' | 'y' | 'z',
  radius: number,
  length: number,
  segments: number,
): { positions: number[]; normals: number[]; indices: number[] } {
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
function createConeAlongAxis(
  axis: 'x' | 'y' | 'z',
  radius: number,
  height: number,
  offset: number,
  segments: number,
): { positions: number[]; normals: number[]; indices: number[] } {
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
 * Rotate geometry from Y-up to target axis direction.
 */
function rotateGeometry(
  geom: { positions: number[]; normals: number[]; indices: number[] },
  axis: 'x' | 'y' | 'z',
): { positions: number[]; normals: number[]; indices: number[] } {
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
 * Create a small square quad for plane-drag handles (e.g., XY plane).
 */
function createPlaneQuad(
  plane: 'xy' | 'xz' | 'yz',
  size: number,
  offset: number,
): { positions: number[]; normals: number[]; indices: number[] } {
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

export interface GizmoMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Color for this gizmo part [r, g, b, a]. */
  color: [number, number, number, number];
  /** Which axis or plane this part represents. */
  axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';
}

/**
 * Create all gizmo parts for the translate mode.
 * Returns separate mesh data for each axis arrow and plane handle.
 */
export function createTranslateGizmo(
  shaftLength = 0.7,
  shaftRadius = 0.02,
  coneHeight = 0.2,
  coneRadius = 0.06,
  planeSize = 0.15,
  planeOffset = 0.25,
  segments = 12,
): GizmoMeshData[] {
  const parts: GizmoMeshData[] = [];

  const axes: Array<{ axis: 'x' | 'y' | 'z'; color: [number, number, number, number] }> = [
    { axis: 'x', color: [0.9, 0.2, 0.2, 1] }, // Red
    { axis: 'y', color: [0.2, 0.8, 0.2, 1] }, // Green
    { axis: 'z', color: [0.2, 0.4, 0.9, 1] }, // Blue
  ];

  for (const { axis, color } of axes) {
    // Shaft (cylinder)
    const shaft = createCylinderAlongAxis(axis, shaftRadius, shaftLength, segments);
    // Cone (arrow tip)
    const cone = createConeAlongAxis(axis, coneRadius, coneHeight, shaftLength, segments);

    // Merge shaft + cone into one mesh
    const mergedPositions = [...shaft.positions, ...cone.positions];
    const mergedNormals = [...shaft.normals, ...cone.normals];
    const shaftVertCount = shaft.positions.length / 3;
    const mergedIndices = [
      ...shaft.indices,
      ...cone.indices.map((idx) => idx + shaftVertCount),
    ];

    parts.push({
      positions: new Float32Array(mergedPositions),
      normals: new Float32Array(mergedNormals),
      indices: new Uint32Array(mergedIndices),
      color,
      axis,
    });
  }

  // Plane handles
  const planes: Array<{ plane: 'xy' | 'xz' | 'yz'; color: [number, number, number, number] }> = [
    { plane: 'xy', color: [0.2, 0.4, 0.9, 0.5] }, // Blue semi-transparent
    { plane: 'xz', color: [0.2, 0.8, 0.2, 0.5] }, // Green semi-transparent
    { plane: 'yz', color: [0.9, 0.2, 0.2, 0.5] }, // Red semi-transparent
  ];

  for (const { plane, color } of planes) {
    const quad = createPlaneQuad(plane, planeSize, planeOffset);
    parts.push({
      positions: new Float32Array(quad.positions),
      normals: new Float32Array(quad.normals),
      indices: new Uint32Array(quad.indices),
      color,
      axis: plane,
    });
  }

  return parts;
}

/**
 * Compute gizmo scale factor to maintain constant screen size.
 * @param eyePosition - Camera eye in world space.
 * @param objectPosition - Gizmo center (object translation) in world space.
 * @param referenceFov - Camera fov in radians (for perspective).
 * @param viewportHeight - Viewport height in pixels.
 * @param desiredPixelSize - Desired gizmo size in pixels.
 */
export function computeGizmoScale(
  eyePosition: [number, number, number],
  objectPosition: [number, number, number],
  referenceFov: number,
  viewportHeight: number,
  desiredPixelSize = 150,
): number {
  const dx = eyePosition[0] - objectPosition[0];
  const dy = eyePosition[1] - objectPosition[1];
  const dz = eyePosition[2] - objectPosition[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // For perspective: world units per pixel at that distance
  const worldPerPixel =
    (2 * distance * Math.tan(referenceFov / 2)) / viewportHeight;

  return worldPerPixel * desiredPixelSize;
}
