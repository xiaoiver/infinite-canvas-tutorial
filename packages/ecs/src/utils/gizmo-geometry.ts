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

/** Translate arrow/plane vs rotation ring (combined gizmo uses both). */
export type GizmoPartKind = 'translate' | 'rotate';

export interface GizmoMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Color for this gizmo part [r, g, b, a]. */
  color: [number, number, number, number];
  /** Which axis or plane this part represents. */
  axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz';
  kind: GizmoPartKind;
}

/** Translate handles + rotation rings (Spline-style combined gizmo). */
export function createCombinedTransformGizmo(): GizmoMeshData[] {
  return [...createTranslateGizmo(), ...createRotateGizmo()];
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
    { axis: 'x', color: [1, 0.15, 0.15, 1] },
    { axis: 'y', color: [0.15, 1, 0.15, 1] },
    { axis: 'z', color: [0.2, 0.45, 1, 1] },
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
      kind: 'translate',
    });
  }

  // Plane handles
  const planes: Array<{ plane: 'xy' | 'xz' | 'yz'; color: [number, number, number, number] }> = [
    { plane: 'xy', color: [0.2, 0.45, 1, 0.35] },
    { plane: 'xz', color: [0.15, 1, 0.15, 0.35] },
    { plane: 'yz', color: [1, 0.15, 0.15, 0.35] },
  ];

  for (const { plane, color } of planes) {
    const quad = createPlaneQuad(plane, planeSize, planeOffset);
    parts.push({
      positions: new Float32Array(quad.positions),
      normals: new Float32Array(quad.normals),
      indices: new Uint32Array(quad.indices),
      color,
      axis: plane,
      kind: 'translate',
    });
  }

  return parts;
}

/** Translate arrow length in local gizmo units (shaft + cone). */
export const GIZMO_AXIS_ARROW_LENGTH = 0.9;

/** Rotate ring radius in local gizmo units (matches arrow length order of magnitude). */
export const GIZMO_ROTATE_RING_RADIUS = 0.85;

/**
 * Rotation rings (torus strips) in planes perpendicular to each local axis.
 */
export function createRotateGizmo(
  radius = GIZMO_ROTATE_RING_RADIUS,
  tube = 0.05,
  segments = 48,
): GizmoMeshData[] {
  const axes: Array<{ axis: 'x' | 'y' | 'z'; color: [number, number, number, number] }> = [
    { axis: 'x', color: [1, 0.15, 0.15, 1] },
    { axis: 'y', color: [0.15, 1, 0.15, 1] },
    { axis: 'z', color: [0.2, 0.45, 1, 1] },
  ];

  return axes.map(({ axis, color }) => {
    const ring = createRotationRing(axis, radius, tube, segments);
    return {
      positions: new Float32Array(ring.positions),
      normals: new Float32Array(ring.normals),
      indices: new Uint32Array(ring.indices),
      color,
      axis,
      kind: 'rotate',
    };
  });
}

/** Ring in XZ plane (Y-up cylinder default), then rotated to X / Z axis. */
function createRotationRing(
  axis: 'x' | 'y' | 'z',
  radius: number,
  tube: number,
  segments: number,
): { positions: number[]; normals: number[]; indices: number[] } {
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
  /**
   * Linked 2D canvas: eye.xy 跟随平移，屏幕尺寸只随深度 (eye.z − object.z) 变化，
   * 不应随物体在画布 XY 上移动而变。
   */
  linked = false,
): number {
  let distance: number;
  if (linked) {
    distance = Math.abs(eyePosition[2] - objectPosition[2]);
    if (distance < 1e-4) {
      distance = 1e-4;
    }
  } else {
    const dx = eyePosition[0] - objectPosition[0];
    const dy = eyePosition[1] - objectPosition[1];
    const dz = eyePosition[2] - objectPosition[2];
    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const worldPerPixel =
    (2 * distance * Math.tan(referenceFov / 2)) / viewportHeight;

  return worldPerPixel * desiredPixelSize;
}
