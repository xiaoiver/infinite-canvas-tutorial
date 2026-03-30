import { vec2 } from 'gl-matrix';

import {
  convolution1D as conv1d,
  K_GAUSS_BLUR_5,
} from '@watercolorizer/convolution';

const minmax = (list: number[]): [min: number, max: number] =>
  list.reduce<[number, number]>(
    ([min, max], i) => [Math.min(min, i), Math.max(max, i)],
    [Infinity, -Infinity],
  );

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Any point with [0]/[1] (vec2 from gl-matrix or tuples from geometry libs). */
type Point2 = vec2 | readonly [number, number];

export function randomWeights(
  points: readonly Point2[],
  floor: number = 0,
): number[] {
  const { length } = points;
  const initialWeights = Array.from({ length }, () => Math.random());

  const smoothed = conv1d(
    K_GAUSS_BLUR_5,
    initialWeights,
    Array.from<number>({ length }),
  );

  const [min, max] = minmax(smoothed);
  return smoothed
    .map((it) => (it - min) / (max - min))
    .map((it) => it * (1 - floor) + floor);
}

/**
 * Same pipeline as {@link randomWeights} (Gaussian-smoothed random weights) but
 * uses a seeded PRNG so ECS / SVG export stay reproducible for a given seed.
 */
export function seededRandomWeights(
  length: number,
  seed: number,
  floor = 0.1,
): number[] {
  if (length === 0) {
    return [];
  }
  const rand = mulberry32(seed >>> 0);
  const initialWeights = Array.from({ length }, () => rand());

  const smoothed = conv1d(
    K_GAUSS_BLUR_5,
    initialWeights,
    Array.from<number>({ length }),
  );

  const [min, max] = minmax(smoothed);
  const span = max - min;
  if (span <= 1e-12) {
    return Array.from({ length }, () => 1);
  }
  return smoothed
    .map((it) => (it - min) / span)
    .map((it) => it * (1 - floor) + floor);
}
