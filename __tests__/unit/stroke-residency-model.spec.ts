import { createStrokeResidencyModel } from '../browser/fixtures/stroke-residency-model';
const part = (id: string, rows = 1, version = 1) => ({ id, rows, version });
describe('bounded optimistic stroke residency model', () => {
  it('charges geometry once and current placement on every page rebuild', () => {
    const m = createStrokeResidencyModel(1024);
    expect(m.page([part('a', 2)], 128)).toMatchObject({
      misses: 1,
      hits: 0,
      geometryBytes: 128,
      placementBytes: 32,
      peakBytes: 128,
    });
    expect(m.page([part('a', 2)], 128)).toMatchObject({
      hits: 1,
      geometryBytes: 0,
      placementBytes: 32,
    });
    expect(m.usedBytes).toBe(128);
  });
  it('reuses geometry across page offsets and placement/order changes', () => {
    const m = createStrokeResidencyModel(512);
    m.page([part('a'), part('b')], 128);
    expect(m.page([part('b'), part('a')], 128)).toMatchObject({
      hits: 2,
      misses: 0,
      geometryBytes: 0,
      placementBytes: 32,
    });
  });
  it('replaces changed geometry/precision even with an unchanged owner', () => {
    const m = createStrokeResidencyModel(512);
    m.page([part('a', 2)], 128);
    expect(m.page([part('a', 3, 2)], 192)).toMatchObject({
      invalidations: 1,
      misses: 1,
      geometryBytes: 192,
    });
    expect(m.usedBytes).toBe(192);
    expect(m.page([part('a', 2, 1)], 128).misses).toBe(1);
  });
  it('evicts the least recent unpinned owner and counts reentry as a miss', () => {
    const m = createStrokeResidencyModel(128);
    m.page([part('a'), part('b')], 128);
    m.page([part('a')], 64);
    expect(m.page([part('c')], 64)).toMatchObject({
      evictions: 1,
      geometryBytes: 64,
    });
    expect(m.page([part('a')], 64).hits).toBe(1);
    expect(m.page([part('b')], 64).misses).toBe(1);
    expect(m.usedBytes).toBe(128);
  });
  it('pins owners not yet visited in the current page', () => {
    const m = createStrokeResidencyModel(192);
    m.page([part('a'), part('b'), part('c')], 192);
    expect(m.page([part('d'), part('a'), part('b')], 192)).toMatchObject({
      hits: 2,
      misses: 1,
      evictions: 1,
    });
  });
  it('uses full packed fallback before mutating an oversized page', () => {
    const m = createStrokeResidencyModel(64);
    m.page([part('a')], 64);
    expect(m.page([part('a', 2, 2)], 128)).toMatchObject({
      fallbackPages: 1,
      fallbackBytes: 128,
      geometryBytes: 0,
      placementBytes: 0,
      invalidations: 0,
    });
    expect(m.page([part('a')], 64).hits).toBe(1);
  });
  it('keeps device/model instances independent and releases all numeric entries', () => {
    const a = createStrokeResidencyModel(64),
      b = createStrokeResidencyModel(64);
    a.page([part('a')], 64);
    expect(b.page([part('a')], 64).misses).toBe(1);
    a.clear();
    a.clear();
    expect(a.usedBytes).toBe(0);
    expect(a.page([part('a')], 64).misses).toBe(1);
    expect(b.page([part('a')], 64).hits).toBe(1);
  });
  it('does not retain zero-length owners, including after geometry becomes empty', () => {
    const m = createStrokeResidencyModel(64);
    m.page([part('a')], 64);
    m.page([part('a', 0, 2)], 0);
    expect(m.usedBytes).toBe(0);
    for (let i = 0; i < 100; i++)
      expect(m.page([part(String(i), 0)], 0).misses).toBe(0);
    expect(
      createStrokeResidencyModel(0).page([part('x')], 64).fallbackBytes,
    ).toBe(64);
  });
  it('validates complete input before changing residency', () => {
    const m = createStrokeResidencyModel(64);
    m.page([part('a')], 64);
    for (const bad of [
      [part('a'), part('a')],
      [part('b', -1)],
      [part('b', 1, NaN)],
    ])
      expect(() => m.page(bad, 64)).toThrow();
    expect(() => m.page([part('b')], -1)).toThrow();
    expect(m.page([part('a')], 64).hits).toBe(1);
    for (const b of [-1, NaN, Infinity, 1.5])
      expect(() => createStrokeResidencyModel(b)).toThrow();
  });
});
