declare module '@watercolorizer/watercolorizer' {
  export function watercolorize(
    polygon: [number, number][],
    options?: Record<string, unknown>,
  ): Iterable<[number, number][]>;
}
