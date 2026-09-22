/** 2D convolution with MATLAB `conv2(..., 'same')` semantics (accumulate, zero outside). */
export function conv2Same(
  im: Float32Array,
  width: number,
  height: number,
  kernel: Float32Array,
  kernelWidth: number,
  kernelHeight: number,
): Float32Array {
  const out = new Float32Array(width * height);
  const padY = Math.floor(kernelHeight / 2);
  const padX = Math.floor(kernelWidth / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kernelHeight; ky++) {
        const sy = y + ky - padY;
        if (sy < 0 || sy >= height) {
          continue;
        }
        for (let kx = 0; kx < kernelWidth; kx++) {
          const sx = x + kx - padX;
          if (sx < 0 || sx >= width) {
            continue;
          }
          sum +=
            im[sy * width + sx]! *
            kernel[ky * kernelWidth + kx]!;
        }
      }
      out[y * width + x] = sum;
    }
  }
  return out;
}
