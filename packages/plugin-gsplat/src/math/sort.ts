/**
 * Depth sorting for back-to-front alpha-blended gaussian splats.
 *
 * Correct over-compositing requires drawing gaussians farthest-first. Sorting a
 * million floats every frame with `Array.prototype.sort` is too slow, so this
 * uses a 16-bit counting sort over quantized view-space depth — `O(n)` and
 * stable, which is sufficient for the CPU-sort path of the MVP. A WebGPU GPU
 * radix sort is planned for very large scenes.
 */

const BUCKETS = 1 << 16;

/**
 * Order gaussian indices farthest → nearest in view space.
 *
 * @param centers Interleaved `(x, y, z)` centers, length `count * 3`.
 * @param count Number of gaussians.
 * @param viewMatrix Column-major 4×4 view matrix (camera looks down `-z`).
 * @param out Optional reusable output buffer (`length >= count`).
 * @returns A `Uint32Array` of `count` indices, farthest gaussian first.
 */
export function sortByDepth(
  centers: Float32Array,
  count: number,
  viewMatrix: ArrayLike<number>,
  out?: Uint32Array,
): Uint32Array {
  const indices =
    out && out.length >= count ? out.subarray(0, count) : new Uint32Array(count);
  if (count === 0) {
    return indices;
  }

  // View-space z for each center. Smaller (more negative) z is farther away.
  const depths = new Float32Array(count);
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  const m2 = viewMatrix[2];
  const m6 = viewMatrix[6];
  const m10 = viewMatrix[10];
  const m14 = viewMatrix[14];
  for (let i = 0; i < count; i++) {
    const x = centers[i * 3 + 0];
    const y = centers[i * 3 + 1];
    const z = centers[i * 3 + 2];
    const d = m2 * x + m6 * y + m10 * z + m14;
    depths[i] = d;
    if (d < minDepth) minDepth = d;
    if (d > maxDepth) maxDepth = d;
  }

  const range = maxDepth - minDepth;
  if (range <= 0) {
    // All at the same depth: identity order.
    for (let i = 0; i < count; i++) {
      indices[i] = i;
    }
    return indices;
  }

  // Quantize depth to 16-bit buckets. Farthest = most negative z = minDepth, so
  // `key = (depth - minDepth)` makes farther points get the smallest key and be
  // emitted first when buckets are scanned in ascending order.
  const scale = (BUCKETS - 1) / range;
  const keys = new Uint32Array(count);
  const counts = new Uint32Array(BUCKETS);
  for (let i = 0; i < count; i++) {
    const key = ((depths[i] - minDepth) * scale) | 0;
    keys[i] = key;
    counts[key]++;
  }

  // Prefix sums → start offset per bucket (ascending key = farthest first).
  let total = 0;
  for (let b = 0; b < BUCKETS; b++) {
    const c = counts[b];
    counts[b] = total;
    total += c;
  }

  for (let i = 0; i < count; i++) {
    const key = keys[i];
    indices[counts[key]++] = i;
  }

  return indices;
}
