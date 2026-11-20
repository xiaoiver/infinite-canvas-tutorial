type Helpers =
  typeof import('../../packages/core/src/utils/text-layout-snapshot');
export function textLayoutSnapshotContract(h: Helpers) {
  it('owns nested metric data so in-place edits invalidate a successful snapshot', () => {
    const metrics = { lines: ['AB', 'CD'], font: { ascent: 12, descent: 3 } };
    const snapshot = h.captureTextLayout([metrics, 1, 2, 'font state']);
    expect(h.matchesTextLayout(snapshot, [metrics, 1, 2, 'font state'])).toBe(
      true,
    );
    metrics.lines[0] = 'Changed';
    expect(h.matchesTextLayout(snapshot, [metrics, 1, 2, 'font state'])).toBe(
      false,
    );
    metrics.lines[0] = 'AB';
    metrics.font.ascent = 13;
    expect(h.matchesTextLayout(snapshot, [metrics, 1, 2, 'font state'])).toBe(
      false,
    );
    metrics.font.ascent = 12;
    expect(h.matchesTextLayout(snapshot, [metrics, 1, 2, 'font state'])).toBe(
      true,
    );
  });
  it('ignores property insertion order while detecting additions, deletions and array shape changes', () => {
    const snapshot = h.captureTextLayout({ a: 1, b: [2, 3] });
    expect(h.matchesTextLayout(snapshot, { b: [2, 3], a: 1 })).toBe(true);
    for (const next of [
      { a: 1 },
      { a: 1, b: [2, 3], c: undefined },
      { a: 1, b: [2] },
      { a: 1, b: { 0: 2, 1: 3 } },
    ])
      expect(h.matchesTextLayout(snapshot, next)).toBe(false);
  });
  it('detects a previously empty array slot becoming a real line', () => {
    const lines = new Array<string>(1),
      snapshot = h.captureTextLayout(lines);
    lines[0] = 'Visible';
    expect(h.matchesTextLayout(snapshot, lines)).toBe(false);
  });
  it('does not collapse invalid numeric values into null during validation', () => {
    const snapshot = h.captureTextLayout([NaN, Infinity, undefined]);
    expect(h.matchesTextLayout(snapshot, [NaN, Infinity, undefined])).toBe(
      true,
    );
    expect(h.matchesTextLayout(snapshot, [null, Infinity, undefined])).toBe(
      false,
    );
    expect(h.matchesTextLayout(snapshot, [NaN, null, undefined])).toBe(false);
    expect(h.matchesTextLayout(snapshot, [NaN, Infinity, null])).toBe(false);
  });
}
