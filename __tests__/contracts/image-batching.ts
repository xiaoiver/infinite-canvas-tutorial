interface Packing {
  IMAGE_BATCH_STRIDE: number;
  imageBatchToken(source: object, variant: string): string;
  imageBatchRow(
    matrix: readonly number[],
    bounds: readonly number[],
    opacity: number,
    slot: number,
    depth: number,
    width: number,
    fillOpacity: number,
    alignment: number,
    stroke?: readonly number[],
  ): number[];
  imagePageAccepts<T>(
    shapes: readonly T[],
    next: T,
    token: (shape: T) => string,
  ): boolean;
}
export function imageBatchContract(pack: Packing) {
  it('packs native affine placement, dimensions, opacity, slot, depth and transparent stroke RGB independently', () => {
    const matrix = Object.freeze([1, 0.2, -0.3, 1, 100, -40]),
      bounds = Object.freeze([30, 20, 15, 10]);
    const row = pack.imageBatchRow(
      matrix,
      bounds,
      0.7,
      5,
      0.012,
      1,
      0.4,
      2,
      [1, 0.5, 0.2, 0],
    );
    expect(row).toEqual([
      1, 0.2, -0.3, 1, 100, -40, 0.7, 5, 30, 20, 15, 10, 0.012, 1, 0.4, 2, 1,
      0.5, 0.2, 0,
    ]);
    expect(row).toHaveLength(pack.IMAGE_BATCH_STRIDE);
  });
  it('distinguishes source generations and raster variants while sharing exact identities', () => {
    const a = {},
      b = {};
    expect(pack.imageBatchToken(a, '24x22')).toBe(
      pack.imageBatchToken(a, '24x22'),
    );
    expect(pack.imageBatchToken(a, '24x22')).not.toBe(
      pack.imageBatchToken(b, '24x22'),
    );
    expect(pack.imageBatchToken(a, '24x22')).not.toBe(
      pack.imageBatchToken(a, '48x44'),
    );
  });
  it.each([
    [300, 6, [256, 44]],
    [18, 9, [8, 8, 2]],
  ])(
    'bounds append-only pages for %i items / %i textures',
    (count, variants, expected) => {
      const pages: string[][] = [];
      let page: string[] = [];
      for (let i = 0; i < count; i++) {
        const next = String(i % variants);
        if (!pack.imagePageAccepts(page, next, (v) => v)) page = [];
        if (!page.length) pages.push(page);
        page.push(next);
      }
      expect(pages.map((p) => p.length)).toEqual(expected);
      expect(pages.flat()).toEqual(
        Array.from({ length: count }, (_, i) => String(i % variants)),
      );
    },
  );
}
