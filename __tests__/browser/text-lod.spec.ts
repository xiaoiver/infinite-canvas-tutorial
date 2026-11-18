import { test, expect } from '@playwright/test';
import { installProbes } from './fixtures/probes';
import type { TextLODHarness } from './fixtures/text-lod';
declare global {
  interface Window {
    textLOD: TextLODHarness;
  }
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.goto('/text-lod.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.textLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});
test('hysteresis, immediate interactions, original geometry and feature-off pixels', async ({
  page,
}, testInfo) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.zoom(0.3);
    const full = h.screen();
    const original = h.state();
    await h.enable(true);
    const proxy = h.screen();
    const reduced = h.state();
    await h.zoom(0.55);
    const hysteresis = h.mode();
    await h.zoom(0.8);
    const restored = h.mode();
    await h.zoom(0.3);
    await h.select(true);
    const selected = h.mode();
    await h.select(false);
    await h.hover(true);
    const hovered = h.mode();
    await h.hover(false);
    await h.patch({ isEditing: true });
    const editing = h.mode();
    await h.patch({ isEditing: false });
    await h.enable(false);
    const off = h.screen();
    return {
      full,
      proxy,
      off,
      original,
      reduced,
      hysteresis,
      restored,
      selected,
      hovered,
      editing,
    };
  });
  for (const name of ['full', 'proxy', 'off'] as const) {
    await testInfo.attach(`${name}.png`, {
      body: Buffer.from(result[name].split(',')[1], 'base64'),
      contentType: 'image/png',
    });
  }
  expect(result.proxy).not.toBe(result.full);
  expect(result.off).toBe(result.full);
  expect(result.reduced.vertices).toBeLessThan(result.original.vertices);
  expect(result.reduced.nodes).toEqual(result.original.nodes);
  expect(result.reduced.bounds).toEqual(result.original.bounds);
  expect(result.hysteresis).toBe('text-proxy');
  for (const key of ['restored', 'selected', 'hovered', 'editing'] as const)
    expect(result[key], key).toBe('full');
});
test('full and partial export are independent of screen LOD and cycles retain bounded resources', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.zoom(0.3);
    const fullExport = await h.export(false);
    const partialExport = await h.export(true);
    await h.enable(true);
    const screen = h.screen();
    const exportFull = await h.export(false);
    const exportPartial = await h.export(true);
    // Camera writes cause redraw after the full export changed the onscreen framebuffer.
    await h.zoom(0.3);
    const after = h.state();
    const before = window.lifecycleProbes.resources();
    for (let i = 0; i < 12; i++) {
      await h.zoom(0.9);
      await h.zoom(0.3);
    }
    const end = window.lifecycleProbes.resources();
    const id = h.state().proxyIds;
    await h.zoom(0.35);
    const sameId = h.state().proxyIds;
    await h.patch({ visibility: 'hidden' });
    const hidden = h.state().drawcalls;
    await h.patch({ visibility: 'visible' });
    const visible = h.mode();
    return {
      fullExport,
      partialExport,
      exportFull,
      exportPartial,
      after,
      before,
      end,
      id,
      sameId,
      hidden,
      visible,
      screen,
    };
  });
  expect(result.exportFull).toBe(result.fullExport);
  expect(result.exportPartial).toBe(result.partialExport);
  expect(result.after.ctors).toContain('TextProxy');
  expect(result.end).toEqual(result.before);
  expect(result.sameId).toEqual(result.id);
  expect(result.hidden).toBe(0);
  expect(result.visible).toBe('text-proxy');
});

test('failed export restores the screen and same-frame deletion cannot revive a batch', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.zoom(0.3);
    await h.enable(true);
    const before = h.screen();
    const state = await h.failExport();
    const after = h.screen();
    const remaining = await h.deleteDuringZoom();
    return { before, after, state, remaining };
  });
  expect(result.state.ctors).toContain('TextProxy');
  expect(result.after).toBe(result.before);
  expect(result.remaining).toBe(0);
});

test('native hover, picking and marquee use the original text geometry', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.textLOD.zoom(0.3);
    await window.textLOD.enable(true);
  });
  const bounds = await page.evaluate(() => window.textLOD.state().bounds);
  await page.mouse.move(20, 11);
  await expect
    .poll(() => page.evaluate(() => window.textLOD.state().highlighted))
    .toBe(true);
  expect(await page.evaluate(() => window.textLOD.mode())).toBe('full');
  await page.mouse.click(20, 11);
  await expect
    .poll(() => page.evaluate(() => window.textLOD.state().selected))
    .toBe(true);
  await page.mouse.move(500, 500);
  await page.evaluate(() => window.textLOD.select(false));
  await page.mouse.move(1, 1);
  await page.mouse.down();
  await page.mouse.move(65, 25, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.textLOD.state().selected))
    .toBe(true);
  expect(await page.evaluate(() => window.textLOD.state().bounds)).toEqual(
    bounds,
  );
});
