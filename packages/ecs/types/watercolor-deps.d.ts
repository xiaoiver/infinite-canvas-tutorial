declare module '@watercolorizer/convolution' {
  export const K_GAUSS_BLUR_5: readonly number[];
  export function convolution1D(
    kernel: readonly number[],
    input: number[],
    output: number[],
  ): number[];
}
