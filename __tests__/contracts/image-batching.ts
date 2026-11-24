interface Packing {
  reuseAdjacentImageTokens<T>(
    resolve: (shape: T) => string,
  ): (shape: T) => string;
  ImageBatchTextures: new () => {
    sync(
      requests: readonly any[],
      bind: (leases: readonly any[]) => void,
    ): void;
    dispose(): void;
  };
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
  it('resolves each shape once per plan without changing row or sampler boundaries', () => {
    const shapes = Array.from({ length: 300 }, (_, i) => ({
      token: String(i % 9),
    }));
    const resolve = jest.fn((shape: { token: string }) => shape.token);
    const token = pack.reuseAdjacentImageTokens(resolve);
    const pages: (typeof shapes)[] = [];
    let page: typeof shapes = [];
    for (const shape of shapes) {
      if (!pack.imagePageAccepts(page, shape, token)) page = [];
      if (!page.length) pages.push(page);
      page.push(shape);
    }
    expect(pages.map((p) => p.length)).toEqual([...Array(37).fill(8), 4]);
    expect(pages.flat()).toEqual(shapes);
    expect(resolve).toHaveBeenCalledTimes(300);
    for (const shape of shapes)
      expect(resolve.mock.calls.filter(([s]) => s === shape)).toHaveLength(1);
    // A rejected ninth sampler must never become a slot in the previous page.
    expect(pack.imagePageAccepts(pages[0], shapes[0], token)).toBe(true);
    expect(pack.imagePageAccepts(pages[0], shapes[8], token)).toBe(false);
  });
  it('only reuses an adjacent shape identity, not an equal token or an older member', () => {
    const a = { token: 'same' },
      b = { token: 'same' };
    const resolve = jest.fn((shape: typeof a) => shape.token);
    const token = pack.reuseAdjacentImageTokens(resolve);
    expect(token(a)).toBe('same');
    expect(token(a)).toBe('same');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(token(b)).toBe('same');
    expect(token(b)).toBe('same');
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(token(a)).toBe('same');
    expect(resolve).toHaveBeenCalledTimes(3);
  });
  it('refreshes edited variants in each new plan and retries failed descriptions', () => {
    const a = { token: '' },
      b = { token: 'old' };
    const resolve = jest.fn((shape: typeof a) => shape.token);
    const first = pack.reuseAdjacentImageTokens(resolve);
    expect(first(a)).toBe('');
    expect(first(a)).toBe('');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(first(b)).toBe('old');
    b.token = 'edited';
    const next = pack.reuseAdjacentImageTokens(resolve);
    expect(next(b)).toBe('edited');
    expect(next(a)).toBe('');
    const unstable = jest
      .fn(() => 'recovered')
      .mockImplementationOnce(() => {
        throw new Error('description failed');
      });
    const retry = pack.reuseAdjacentImageTokens(unstable);
    expect(() => retry(a)).toThrow('description failed');
    expect(retry(a)).toBe('recovered');
    expect(retry(a)).toBe('recovered');
    expect(unstable).toHaveBeenCalledTimes(2);
  });
  it('retains live texture leases on reorder and releases only removed variants', () => {
    const a = { texture: { id: 'a' }, release: jest.fn() },
      b = { texture: { id: 'b' }, release: jest.fn() };
    const ra = { token: 'a', acquire: jest.fn(() => a) },
      rb = { token: 'b', acquire: jest.fn(() => b) };
    const page = new pack.ImageBatchTextures(),
      bindings: any[][] = [];
    page.sync([ra, rb], (leases) => bindings.push([...leases]));
    page.sync([rb, ra], (leases) => bindings.push([...leases]));
    expect(bindings[1]).toEqual([b, a]);
    expect(ra.acquire).toHaveBeenCalledTimes(1);
    expect(rb.acquire).toHaveBeenCalledTimes(1);
    expect(a.release).not.toHaveBeenCalled();
    expect(b.release).not.toHaveBeenCalled();
    page.sync([ra], () => {});
    expect(b.release).toHaveBeenCalledTimes(1);
    page.dispose();
    page.dispose();
    expect(a.release).toHaveBeenCalledTimes(1);
    expect(b.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back new leases while preserving the prior live set on failure', () => {
    const a = { texture: { id: 'a' }, release: jest.fn() },
      b = { texture: { id: 'b' }, release: jest.fn() },
      c = { texture: { id: 'c' }, release: jest.fn() };
    const ra = { token: 'a', acquire: () => a },
      rb = { token: 'b', acquire: () => b };
    const page = new pack.ImageBatchTextures();
    page.sync([ra, rb], () => {});
    expect(() =>
      page.sync(
        [
          rb,
          { token: 'c', acquire: () => c },
          {
            token: 'fail',
            acquire: () => {
              throw new Error('upload failed');
            },
          },
        ],
        () => {},
      ),
    ).toThrow('upload failed');
    expect(c.release).toHaveBeenCalledTimes(1);
    expect(a.release).not.toHaveBeenCalled();
    expect(b.release).not.toHaveBeenCalled();
    expect(() =>
      page.sync([rb, { token: 'c', acquire: () => c }], () => {
        throw new Error('binding failed');
      }),
    ).toThrow('binding failed');
    expect(a.release).not.toHaveBeenCalled();
    expect(b.release).not.toHaveBeenCalled();
    page.dispose();
    expect(a.release).toHaveBeenCalledTimes(1);
    expect(b.release).toHaveBeenCalledTimes(1);
  });
}
