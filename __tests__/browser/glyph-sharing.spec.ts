import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/glyph-atlas';
for (const backend of ['core', 'ecs']) {
  test(`${backend} shared snapshots preserve peers across edits, deletion and export`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes);
    async function load(privateAtlas: boolean) {
      await page.goto(
        `/glyph-atlas.html?backend=${backend}&private=${Number(privateAtlas)}`,
      );
      await expect(page.locator('output')).toHaveText('Ready');
      await page.evaluate(() =>
        window.mixedRenderer.configure(100, 'grouped', false),
      );
      await page.evaluate(() => window.mixedRenderer.editText(['AB', 'BA']));
      const permutations = PNG.sync.read(
        await page.locator('canvas').screenshot(),
      );
      await page.evaluate(() => window.mixedRenderer.editText('AA'));
      const initial = await page.evaluate(() => window.mixedRenderer.state());
      const before = PNG.sync.read(await page.locator('canvas').screenshot());
      const removed = await page.evaluate(() =>
        window.mixedRenderer.removeTexts(1),
      );
      expect(removed.visible).toBe(99);
      if (!privateAtlas)
        expect(removed.resources.map((c) => c.live.Texture)).toEqual(
          initial.resources.map((c) => c.live.Texture),
        );
      const uploads = await page.evaluate(
        () => window.glyphAtlasProbe().atlasUploads,
      );
      await page.evaluate(async () => {
        // Adding an already-loaded face need not emit a loading event.
        const font = new FontFace(
          'AtlasStateProbe',
          `url(${window.glyphAtlasFontURL})`,
        );
        await font.load();
        (
          document.fonts as FontFaceSet & { add(face: FontFace): FontFaceSet }
        ).add(font);
        await window.mixedRenderer.editOneText(0, 'AAA');
      });
      expect(
        await page.evaluate(() => window.glyphAtlasProbe().atlasUploads),
      ).toBeGreaterThan(uploads);
      const fontChanged = PNG.sync.read(
        await page.locator('canvas').screenshot(),
      );
      const live: number[] = [];
      for (let i = 0; i < 9; i++) {
        const state = await page.evaluate(
          (content) => window.mixedRenderer.editOneText(0, content),
          ['Ω中', 'AB', 'XYZ'][i % 3],
        );
        if (i >= 3)
          live.push(state.resources.reduce((n, c) => n + c.live.Texture, 0));
      }
      expect(new Set(live).size).toBe(1);
      await page.evaluate(() => window.mixedRenderer.editOneText(0, 'Ω中'));
      const after = PNG.sync.read(await page.locator('canvas').screenshot());
      const data = await page.evaluate(() => window.mixedRenderer.raster());
      const exported = PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'));
      const cleared = await page.evaluate(() =>
        window.mixedRenderer.removeTexts(1000),
      );
      expect(cleared.visible).toBe(80);
      expect(cleared.webglError).toBe(0);
      const baseline = await page.evaluate(() =>
        window.mixedRenderer.destroy(),
      );
      const resources = await page.evaluate(() =>
        window.lifecycleProbes.resources(),
      );
      if (backend === 'core') expect(resources).toEqual(baseline);
      else
        expect(
          resources.every((c) => Object.values(c.live).every((n) => n === 0)),
        ).toBe(true);
      return { initial, permutations, before, fontChanged, after, exported };
    }
    const shared = await load(false),
      independent = await load(true);
    const textures = (r: typeof shared) =>
      r.initial.resources.reduce((n, c) => n + c.live.Texture, 0);
    expect(textures(shared)).toBeLessThan(textures(independent));
    for (const key of [
      'permutations',
      'before',
      'fontChanged',
      'after',
      'exported',
    ] as const) {
      const a = shared[key],
        b = independent[key];
      expect([a.width, a.height]).toEqual([b.width, b.height]);
      expect(
        pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 }),
      ).toBeLessThan(10);
    }
    expect(errors).toEqual([]);
  });
}
