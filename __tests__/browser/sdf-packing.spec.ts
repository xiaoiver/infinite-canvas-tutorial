import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/glyph-atlas';

for (const backend of ['core', 'ecs'])
  test(`${backend} SDF instance rows match full paint, shadows, attenuation and export`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'grouped', false),
    );
    await page.evaluate(() => window.mixedRenderer.solidStyles());
    const image = async () =>
      PNG.sync.read(await page.locator('canvas').screenshot({ scale: 'css' }));
    const equal = (a: PNG, b: PNG) =>
      expect(
        pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 }),
      ).toBeLessThan(64);
    await page.evaluate(() => window.mixedRenderer.solidBatching(false));
    const full = await image();
    const fullExport = await page.evaluate(() => window.mixedRenderer.raster());
    const independent = await page.evaluate(() =>
      window.mixedRenderer.measure('pan', 2, 1),
    );
    await page.evaluate(() => window.mixedRenderer.solidBatching(true));
    equal(full, await image());
    const batched = await page.evaluate(() =>
      window.mixedRenderer.measure('pan', 2, 1),
    );
    expect(batched.native.drawcalls).toBeLessThan(independent.native.drawcalls);
    expect(batched.native.indices).toBe(independent.native.indices);
    const batchExport = await page.evaluate(() =>
      window.mixedRenderer.raster(),
    );
    equal(
      PNG.sync.read(Buffer.from(fullExport.split(',')[1], 'base64')),
      PNG.sync.read(Buffer.from(batchExport.split(',')[1], 'base64')),
    );
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.mixedRenderer.measure('edit', 2, 1));
      const changed = await image();
      await page.evaluate(() => window.mixedRenderer.solidBatching(false));
      equal(changed, await image());
      await page.evaluate(() => window.mixedRenderer.solidBatching(true));
      equal(changed, await image());
    }
    const baseline = await page.evaluate(() => window.mixedRenderer.destroy());
    const resources = await page.evaluate(() =>
      window.lifecycleProbes.resources(),
    );
    if (backend === 'core') expect(resources).toEqual(baseline);
    else
      expect(
        resources.every((c) => Object.values(c.live).every((n) => n === 0)),
      ).toBe(true);
  });

for (const backend of ['core', 'ecs'])
  test(`${backend} unchanged SDF pages preserve foreground depth after another text is deleted`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(10, 'interleaved', false),
    );
    await page.evaluate(() => window.mixedRenderer.solidDepthScene());
    await page.evaluate(() => window.mixedRenderer.removeTexts(1));
    const image = async () =>
      PNG.sync.read(await page.locator('canvas').screenshot({ scale: 'css' }));
    const after = await image();
    await page.evaluate(() => window.mixedRenderer.solidBatching(false));
    const full = await image();
    expect(
      pixelmatch(after.data, full.data, null, after.width, after.height, {
        threshold: 0.1,
      }),
    ).toBeLessThan(64);
    await page.evaluate(() => window.mixedRenderer.destroy());
  });
