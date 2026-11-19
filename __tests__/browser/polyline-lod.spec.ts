import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type { PolylineLODHarness } from './fixtures/polyline-lod';
import { PNG } from 'pngjs';

declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.polylineLOD.state());
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installProbes);
  await page.goto('/polyline-lod.html');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 30000 });
});
test('simplifies only screen geometry, reuses buffers while panning, and restores full for interactions and styles', async ({
  page,
}) => {
  const initial = await state(page);
  expect(initial.segments[0]).toBe(512);
  await page.evaluate(async () => {
    await window.polylineLOD.enable(true);
    await window.polylineLOD.zoom(0.25);
  });
  const low = await state(page);
  expect(low.segments[0]).toBeLessThan(60);
  expect(low.document).toEqual(initial.document);
  await page.evaluate(() => window.polylineLOD.camera(1));
  expect((await state(page)).builds).toBe(low.builds);
  await page.evaluate(() => window.polylineLOD.zoom(0.249));
  expect((await state(page)).builds).toBe(low.builds);
  for (const kind of ['select', 'hover', 'edit'] as const) {
    await page.evaluate(
      (kind) => window.polylineLOD.interact(kind, true),
      kind,
    );
    expect((await state(page)).segments[0]).toBe(512);
    await page.evaluate(
      (kind) => window.polylineLOD.interact(kind, false),
      kind,
    );
    expect((await state(page)).segments[0]).toBeLessThan(60);
  }
  for (const patch of [
    { strokeDasharray: '4 4' },
    { strokeLinejoin: 'miter' },
    { markerEnd: 'triangle' },
  ]) {
    await page.evaluate((p) => window.polylineLOD.patch(p), patch);
    expect((await state(page)).segments[0]).toBeGreaterThanOrEqual(512);
    await page.evaluate(() =>
      window.polylineLOD.patch({
        strokeDasharray: 'none',
        strokeLinejoin: 'round',
        markerEnd: 'none',
      }),
    );
    expect((await state(page)).segments[0]).toBeLessThan(60);
  }
  await page.evaluate(() => window.polylineLOD.enable(false));
  expect((await state(page)).segments[0]).toBe(512);
});
test('exports identical full-precision pixels with LOD on/off and retains screen resources across culling and deletion', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.enable(true);
    await window.polylineLOD.zoom(0.25);
  });
  const before = await state(page);
  for (const partial of [false, true]) {
    const on = await page.evaluate(
      (p) => window.polylineLOD.export(p),
      partial,
    );
    await page.evaluate(() => window.polylineLOD.enable(false));
    const off = await page.evaluate(
      (p) => window.polylineLOD.export(p),
      partial,
    );
    expect(on).toBe(off);
    const image = PNG.sync.read(Buffer.from(on.split(',')[1], 'base64'));
    expect(
      image.data.some(
        (v, i) =>
          i % 4 === 0 && v + 5 < image.data[i + 2] && image.data[i + 3] > 0,
      ),
    ).toBe(true);
    await page.evaluate(() => window.polylineLOD.enable(true));
  }
  expect((await state(page)).segments).toEqual(before.segments);
  const baseline = (await state(page)).resources;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.polylineLOD.camera(100000));
    expect((await state(page)).visible).toBe(0);
    await page.evaluate(() => window.polylineLOD.camera(0));
    expect((await state(page)).segments).toEqual(before.segments);
  }
  expect((await state(page)).resources).toEqual(baseline);
  for (const zoom of [1, 0.25, 2, 0.25, 4, 0.25])
    await page.evaluate((zoom) => window.polylineLOD.zoom(zoom), zoom);
  expect((await state(page)).resources).toEqual(baseline);
  expect(await page.evaluate(() => window.polylineLOD.removeDuringZoom())).toBe(
    0,
  );
  await page.evaluate(() => window.polylineLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
});

test.describe('projected geometry at DPR 3', () => {
  test.use({ deviceScaleFactor: 3 });
  test('preserves visible ink under a nonuniform reflection and catches edits made while full', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.polylineLOD.patch({
        scaleX: -1.5,
        scaleY: 0.75,
        rotation: 0.3,
        x: 300,
        y: 100,
      }),
    );
    const full = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    await page.evaluate(() => window.polylineLOD.enable(true));
    const reduced = await state(page);
    expect(reduced.segments[0]).toBeLessThan(150);
    const low = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    let ink = 0,
      changed = 0;
    for (let i = 0; i < full.data.length; i += 4) {
      if (full.data[i] + 5 < full.data[i + 2]) ink++;
      if (Math.abs(full.data[i] - low.data[i]) > 100) changed++;
    }
    expect(ink).toBeGreaterThan(300);
    expect(changed).toBeLessThan(100);
    await page.evaluate(async () => {
      await window.polylineLOD.interact('select', true);
      await window.polylineLOD.mutatePoints();
      await window.polylineLOD.interact('select', false);
    });
    const edited = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    expect(edited.data.equals(low.data)).toBe(false);
    const after = await state(page);
    expect(after.builds).toBeGreaterThan(reduced.builds);
    await page.evaluate(() => window.polylineLOD.enable(false));
    const editedFull = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    let defects = 0;
    for (let i = 0; i < edited.data.length; i += 4)
      if (Math.abs(edited.data[i] - editedFull.data[i]) > 100) defects++;
    expect(defects).toBeLessThan(150);
  });
});

test('path cache precision transitions preserve raster exports and invalidate source edits', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.document([
      {
        id: 'curve',
        type: 'path',
        x: 30,
        y: 30,
        width: 300,
        height: 300,
        d: 'M0 0 C0 300 300 -300 300 0 Z',
        strokeWidth: 6,
        fills: [{ type: 'solid', value: '#00ff00', opacity: 1 }],
        strokes: [{ type: 'solid', value: '#0000ff', opacity: 1 }],
      },
    ] as any);
    await window.polylineLOD.zoom(0.2);
  });
  for (const partial of [false, true]) {
    const initial = await page.evaluate(
      (p) => window.polylineLOD.export(p, 'curve'),
      partial,
    );
    await page.evaluate(async () => {
      await window.polylineLOD.zoom(8);
      await window.polylineLOD.zoom(0.2);
    });
    expect(
      await page.evaluate(
        (p) => window.polylineLOD.export(p, 'curve'),
        partial,
      ),
    ).toBe(initial);
    await page.evaluate(() =>
      window.polylineLOD.patch({ d: 'M0 0 Q150 300 300 0 Z' }, 'curve'),
    );
    expect(
      await page.evaluate(
        (p) => window.polylineLOD.export(p, 'curve'),
        partial,
      ),
    ).not.toBe(initial);
    await page.evaluate(() =>
      window.polylineLOD.patch({ d: 'M0 0 C0 300 300 -300 300 0 Z' }, 'curve'),
    );
    expect(
      await page.evaluate(
        (p) => window.polylineLOD.export(p, 'curve'),
        partial,
      ),
    ).toBe(initial);
  }
  await page.evaluate(() => window.polylineLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
});
