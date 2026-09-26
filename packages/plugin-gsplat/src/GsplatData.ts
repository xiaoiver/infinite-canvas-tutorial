/**
 * Decoded 3D Gaussian Splatting scene, stored as a Structure-of-Arrays (SoA).
 *
 * All values are already decoded into render-ready linear space:
 * - {@link centers}: gaussian means `(x, y, z)`, interleaved (`count * 3`).
 * - {@link scales}: per-axis standard deviations `(sx, sy, sz)`, **linear**
 *   (PLY stores `log(scale)`; the parser applies `exp`). Interleaved (`count * 3`).
 * - {@link rotations}: unit quaternions `(x, y, z, w)`, interleaved (`count * 4`).
 * - {@link colors}: RGBA in `[0, 1]`. RGB is the view-independent SH degree-0
 *   (DC) color; A is opacity (PLY stores logit opacity; the parser applies the
 *   logistic sigmoid). Interleaved (`count * 4`).
 *
 * Higher-order spherical harmonics are intentionally omitted in this MVP
 * (degree 0 / DC only); {@link shDegree} records the captured degree so a future
 * renderer can detect when richer view-dependent color is available.
 *
 * @see https://github.com/playcanvas/supersplat
 * @see https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
 */
export class GsplatData {
  /** Number of gaussians. */
  readonly count: number;

  /** Gaussian means `(x, y, z)`, length `count * 3`. */
  readonly centers: Float32Array;

  /** Per-axis linear scales `(sx, sy, sz)`, length `count * 3`. */
  readonly scales: Float32Array;

  /** Unit quaternions `(x, y, z, w)`, length `count * 4`. */
  readonly rotations: Float32Array;

  /** RGBA in `[0, 1]` (RGB = DC color, A = opacity), length `count * 4`. */
  readonly colors: Float32Array;

  /** Captured spherical-harmonics degree (0 means DC color only). */
  readonly shDegree: number;

  constructor(init: {
    count: number;
    centers: Float32Array;
    scales: Float32Array;
    rotations: Float32Array;
    colors: Float32Array;
    shDegree?: number;
  }) {
    const { count, centers, scales, rotations, colors } = init;
    if (centers.length !== count * 3) {
      throw new Error(
        `GsplatData: centers length ${centers.length} !== count*3 (${count * 3})`,
      );
    }
    if (scales.length !== count * 3) {
      throw new Error(
        `GsplatData: scales length ${scales.length} !== count*3 (${count * 3})`,
      );
    }
    if (rotations.length !== count * 4) {
      throw new Error(
        `GsplatData: rotations length ${rotations.length} !== count*4 (${count * 4})`,
      );
    }
    if (colors.length !== count * 4) {
      throw new Error(
        `GsplatData: colors length ${colors.length} !== count*4 (${count * 4})`,
      );
    }
    this.count = count;
    this.centers = centers;
    this.scales = scales;
    this.rotations = rotations;
    this.colors = colors;
    this.shDegree = init.shDegree ?? 0;
  }

  /**
   * Axis-aligned bounding box of the gaussian centers.
   * Returns `min` and `max` in scene space; an empty scene returns zeros.
   */
  computeBounds(): { min: [number, number, number]; max: [number, number, number] } {
    if (this.count === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = this.centers[i * 3 + 0];
      const y = this.centers[i * 3 + 1];
      const z = this.centers[i * 3 + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  /** Centroid of the gaussian centers (mean position). */
  computeCentroid(): [number, number, number] {
    if (this.count === 0) {
      return [0, 0, 0];
    }
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < this.count; i++) {
      sx += this.centers[i * 3 + 0];
      sy += this.centers[i * 3 + 1];
      sz += this.centers[i * 3 + 2];
    }
    return [sx / this.count, sy / this.count, sz / this.count];
  }
}
