/** MATLAB `medfilt2(im, [3 3])` on a single-channel float image. */
export function medianFilter3x3(
  im: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const out = new Float32Array(width * height);
  const window = new Float32Array(9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) {
          continue;
        }
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx;
          if (sx < 0 || sx >= width) {
            continue;
          }
          window[n++] = im[sy * width + sx]!;
        }
      }
      const slice = window.subarray(0, n);
      slice.sort();
      out[y * width + x] = slice[Math.floor(n / 2)] ?? 0;
    }
  }
  return out;
}
