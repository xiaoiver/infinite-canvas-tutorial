declare module 'gifenc' {
  export function GIFEncoder(opt?: {
    initialCapacity?: number;
    auto?: boolean;
  }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: [number, number, number][];
        delay?: number;
        transparent?: boolean;
        repeat?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    max: number,
  ): [number, number, number][];
  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: [number, number, number][],
  ): Uint8Array;
}
