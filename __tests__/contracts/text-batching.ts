type Helpers = typeof import('../../packages/core/src/utils/text-batching');
export function textBatchingContract(h: Helpers) {
  const matrix = { a: 2, b: 0, c: 0, d: 2, tx: 2 ** 36, ty: 2 ** 36 };
  it('limits ordinary text to bounded stock-font ASCII and a conservative glyph budget', () => {
    expect(h.ordinaryTextCount('AB\nCD', 'sans-serif', 12, 24, 30)).toBe(5);
    for (const [text, font, size, width, height] of [
      ['中', 'sans-serif', 12, 24, 30],
      ['ABC', 'CustomFont', 12, 24, 30],
      [' ', 'serif', 12, 24, 30],
      ['A'.repeat(4097), 'serif', 12, 24, 30],
      ['A', 'serif', 0, 24, 30],
      ['A', 'serif', 257, 24, 30],
      ['A', 'serif', 12, 8193, 30],
      ['A', 'serif', 12, 24, NaN],
    ] as [string, string, number, number, number][])
      expect(h.ordinaryTextCount(text, font, size, width, height)).toBe(0);
  });
  it('keys common linear transforms within a bounded local cell', () => {
    expect(h.textBatchMatrixKey(matrix)).toEqual(
      h.textBatchMatrixKey({ ...matrix, tx: matrix.tx + 12 }),
    );
    expect(h.textBatchMatrixKey(matrix)).not.toEqual(
      h.textBatchMatrixKey({ ...matrix, a: 3 }),
    );
    expect(h.textBatchMatrixKey(matrix)).not.toEqual(
      h.textBatchMatrixKey({ ...matrix, tx: matrix.tx + 20000 }),
    );
    for (const change of [
      { tx: Infinity },
      { a: 0 },
      { a: 1e-12 },
      { a: 1e8 },
      { ty: 2 ** 41 },
    ])
      expect(h.textBatchMatrixKey({ ...matrix, ...change })).toBeNull();
  });
  it('subtracts large translations before baking local anchors, preserving offsets and depth', () => {
    const positions = [10.125, 20.25, 0.25, 10.125, 20.25, 0.75];
    h.bakeTextVertices(positions, matrix, {
      ...matrix,
      tx: matrix.tx + 4,
      ty: matrix.ty + 8,
    });
    expect(positions).toEqual([12.125, 24.25, 0.25, 12.125, 24.25, 0.75]);
    expect([...new Float32Array(positions)]).toEqual(positions);
  });
}
