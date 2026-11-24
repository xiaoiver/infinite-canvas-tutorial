import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/mixed-renderer';
import { PNG } from 'pngjs';
for (const backend of ['core', 'ecs'])
  for (const background of ['transparent', '#102030']) {
    test(`${backend} applies startup background ${background} before selection or navigation`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(installProbes);
      await page.goto(
        `/mixed-renderer.html?backend=${backend}&startupBackground=${encodeURIComponent(
          background,
        )}`,
      );
      await expect(page.locator('output')).toHaveText('Ready');
      const startup = await page.evaluate(() => window.mixedRenderer.startupFrame());
      expect(startup.native.drawcalls).toBeGreaterThan(0);
      await page.evaluate(() =>
        window.mixedRenderer.configure(100, 'grouped', false),
      );
      const url = await page.evaluate(() => window.mixedRenderer.raster(true));
      const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
      const i = ((png.height - 10) * png.width + png.width - 10) * 4;
      expect([...png.data.slice(i, i + 4)]).toEqual(
        background === 'transparent' ? [0, 0, 0, 0] : [16, 32, 48, 255],
      );
      await page.evaluate(() => window.mixedRenderer.handMode());
      const idle = await page.evaluate(() =>
        window.mixedRenderer.measure('idle', 4, 5),
      );
      expect(idle.nonemptyFrames).toBe(0);
      const later = PNG.sync.read(
        Buffer.from(
          (await page.evaluate(() => window.mixedRenderer.raster(true))).split(
            ',',
          )[1],
          'base64',
        ),
      );
      expect(png.data.equals(later.data)).toBe(true);
      await page.evaluate(() => window.mixedRenderer.destroy());
      expect(errors).toEqual([]);
    });
  }
