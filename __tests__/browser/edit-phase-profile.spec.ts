import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/glyph-atlas';

for (const backend of ['core', 'ecs']) {
  test(`${backend} optional phase scopes preserve pixels, native work and teardown`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'grouped', false),
    );
    const control = await page.evaluate(() =>
      window.mixedRenderer.measure('edit', 2, 1),
    );
    expect(control.phaseSamples).toEqual([]);
    const pixels = await page.locator('canvas').screenshot({ scale: 'css' });
    // Reinstallation must restore the old methods rather than nesting wrappers.
    await page.evaluate(async () => {
      await window.mixedRenderer.profile(true);
      await window.mixedRenderer.profile(true);
    });
    const profiled = await page.evaluate(() =>
      window.mixedRenderer.measure('edit', 2, 1),
    );
    expect(profiled.phaseSamples).toHaveLength(2);
    for (const frame of profiled.phaseSamples) {
      expect(
        frame[backend === 'core' ? 'core.render' : 'edit.apply'].calls,
      ).toBe(1);
      expect(frame['batch.submit'].calls).toBeGreaterThan(0);
    }
    expect(profiled.native).toEqual(control.native);
    expect(await page.locator('canvas').screenshot({ scale: 'css' })).toEqual(
      pixels,
    );
    await page.evaluate(() => window.mixedRenderer.profile(false));
    const restored = await page.evaluate(() =>
      window.mixedRenderer.measure('edit', 2, 1),
    );
    expect(restored.phaseSamples).toEqual([]);
    expect(restored.native).toEqual(control.native);
    // Destruction must also restore any still-enabled profiling wrappers.
    await page.evaluate(() => window.mixedRenderer.profile(true));
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
}
