/**
 * 3D covariance helpers for gaussian splats.
 *
 * Each gaussian's anisotropic shape is described by a covariance matrix
 * `Σ = R · S · Sᵀ · Rᵀ`, where `S = diag(sx, sy, sz)` are the per-axis scales
 * and `R` is the rotation built from the gaussian's unit quaternion.
 *
 * The renderer projects `Σ` to a 2D screen-space covariance in the vertex
 * shader (EWA splatting); this module provides a CPU reference used by tests
 * and by any CPU-side culling/sorting heuristics.
 */

/**
 * Build a column-major 3×3 rotation matrix from a unit quaternion `(x, y, z, w)`.
 * Returns the 9 entries in column-major order (matching gl-matrix conventions).
 */
export function quatToMat3(
  x: number,
  y: number,
  z: number,
  w: number,
): number[] {
  // Normalize defensively; decoded quaternions should already be unit-length.
  const len = Math.hypot(x, y, z, w) || 1;
  x /= len;
  y /= len;
  z /= len;
  w /= len;

  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  // Column-major: m[col * 3 + row].
  return [
    1 - 2 * (yy + zz),
    2 * (xy + wz),
    2 * (xz - wy),

    2 * (xy - wz),
    1 - 2 * (xx + zz),
    2 * (yz + wx),

    2 * (xz + wy),
    2 * (yz - wx),
    1 - 2 * (xx + yy),
  ];
}

/**
 * Compute the symmetric 3D covariance `Σ = R S Sᵀ Rᵀ`.
 *
 * Returns the 6 unique upper-triangular entries
 * `[σxx, σxy, σxz, σyy, σyz, σzz]`.
 */
export function computeCovariance3D(
  scale: [number, number, number],
  quat: [number, number, number, number],
): [number, number, number, number, number, number] {
  const [sx, sy, sz] = scale;
  const r = quatToMat3(quat[0], quat[1], quat[2], quat[3]);

  // M = R * S (scale columns of R). Column-major: column j scaled by s_j.
  const m = [
    r[0] * sx,
    r[1] * sx,
    r[2] * sx,
    r[3] * sy,
    r[4] * sy,
    r[5] * sy,
    r[6] * sz,
    r[7] * sz,
    r[8] * sz,
  ];

  // Σ = M * Mᵀ. Row i of M is (m[i], m[3+i], m[6+i]).
  const row = (i: number): [number, number, number] => [m[i], m[3 + i], m[6 + i]];
  const dot = (a: [number, number, number], b: [number, number, number]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const r0 = row(0);
  const r1 = row(1);
  const r2 = row(2);

  const sigmaXX = dot(r0, r0);
  const sigmaXY = dot(r0, r1);
  const sigmaXZ = dot(r0, r2);
  const sigmaYY = dot(r1, r1);
  const sigmaYZ = dot(r1, r2);
  const sigmaZZ = dot(r2, r2);

  return [sigmaXX, sigmaXY, sigmaXZ, sigmaYY, sigmaYZ, sigmaZZ];
}
