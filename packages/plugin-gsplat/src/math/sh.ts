/**
 * Spherical-harmonics helpers for 3D Gaussian Splatting.
 *
 * 3DGS stores view-dependent color as SH coefficients. The degree-0 (DC) band
 * is a constant color scaled by `SH_C0`; the standard decoding used by the
 * INRIA reference implementation and PlayCanvas SuperSplat is:
 *
 *   rgb = 0.5 + SH_C0 * dc
 *
 * @see https://github.com/graphdeco-inria/gaussian-splatting
 */

/** Degree-0 SH basis constant `1 / (2 * sqrt(pi))`. */
export const SH_C0 = 0.28209479177387814;

/**
 * Decode a degree-0 (DC) SH coefficient channel to linear color in `[0, 1]`.
 * Values are clamped because reconstructed colors can slightly exceed the range.
 */
export function shDcToColor(dc: number): number {
  const c = 0.5 + SH_C0 * dc;
  return c < 0 ? 0 : c > 1 ? 1 : c;
}

/** Logistic sigmoid, used to decode PLY logit-encoded opacity. */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
