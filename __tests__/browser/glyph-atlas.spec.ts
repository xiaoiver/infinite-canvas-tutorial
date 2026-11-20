import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/glyph-atlas';

function compare(a: PNG, b: PNG) {
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let ink = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if ([0, 1, 2].some((c) => a.data[i + c] < 200)) ink++;
  expect(ink).toBeGreaterThan(100);
  // Repacking changes normalized texture coordinates and edge antialiasing.
  // Compare perceptual color differences rather than bit-identical AA pixels.
  expect(
    pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 }),
  ).toBeLessThan(10);
}
for (const backend of ['core', 'ecs']) {
  test(`${backend} requested glyphs preserve pixels, new-character edits, export and teardown`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes);
    async function load(ascii: boolean) {
      await page.goto(
        `/glyph-atlas.html?backend=${backend}&ascii=${Number(ascii)}`,
      );
      await expect(page.locator('output')).toHaveText('Ready');
      await page.evaluate(() =>
        window.mixedRenderer.configure(100, 'grouped', false),
      );
      const state = await page.evaluate(() => window.mixedRenderer.editText());
      expect(state.visible).toBe(100);
      expect(state.textProxy).toBe(0);
      expect(state.webglError).toBe(0);
      const glyphs = await page.evaluate(() => window.glyphAtlasProbe());
      expect(glyphs.atlasUploads).toBeGreaterThan(0);
      expect(glyphs.atlasUploads).toBeLessThanOrEqual(20);
      const image = PNG.sync.read(await page.locator('canvas').screenshot());
      const frame = await page.evaluate(() =>
        window.mixedRenderer.measure('pan', 3, 1),
      );
      expect(frame.webglError).toBe(0);
      expect(await page.evaluate(() => window.glyphAtlasProbe())).toEqual(
        glyphs,
      );
      await page.evaluate(() => window.mixedRenderer.editText('Ω中'));
      const edited = await page.evaluate(() => window.glyphAtlasProbe());
      expect(edited.glyphDraws - glyphs.glyphDraws).toBeGreaterThan(0);
      expect(edited.glyphDraws - glyphs.glyphDraws).toBeLessThanOrEqual(ascii ? 200 : 6);
      const updated = PNG.sync.read(await page.locator('canvas').screenshot());
      const data = await page.evaluate(() => window.mixedRenderer.raster());
      const exported = PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'));
      const baseline = await page.evaluate(() =>
        window.mixedRenderer.destroy(),
      );
      const resources = await page.evaluate(() =>
        window.lifecycleProbes.resources(),
      );
      if (backend === 'core') expect(resources).toEqual(baseline);
      else
        expect(
          resources.every((context) =>
            Object.values(context.live).every((n) => n === 0),
          ),
        ).toBe(true);
      return { image, updated, exported, glyphs };
    }
    const requested = await load(false),
      preloaded = await load(true);
    expect(requested.glyphs.glyphDraws).toBeLessThan(
      preloaded.glyphs.glyphDraws / 4,
    );
    expect(requested.glyphs.uploadedBytes).toBeLessThan(
      preloaded.glyphs.uploadedBytes,
    );
    compare(requested.image, preloaded.image);
    compare(requested.updated, preloaded.updated);
    compare(requested.exported, preloaded.exported);
    expect(errors).toEqual([]);
  });
}
