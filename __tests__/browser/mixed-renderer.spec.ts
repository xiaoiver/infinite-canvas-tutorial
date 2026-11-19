import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/mixed-renderer';
import { PNG } from 'pngjs';

for (const backend of ['core', 'ecs']) {
  test(`${backend} mixed benchmark observes rendered frames and releases owned resources`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes);
    async function load(
      layout: 'grouped' | 'interleaved',
      enabled: boolean,
      textCap = 200,
    ) {
      await page.goto(`/mixed-renderer.html?backend=${backend}`);
      await expect(page.locator('output')).toHaveText('Ready');
      const state = await page.evaluate(
        ({ layout, enabled, textCap }) =>
          window.mixedRenderer.configure(100, layout, enabled, textCap),
        { layout, enabled, textCap },
      );
      expect(state.visible).toBe(100);
      expect(state.primitiveCounts).toEqual({
        rect: textCap === 4 ? 24 : 20,
        ellipse: textCap === 4 ? 24 : 20,
        text: Math.min(20, textCap),
        polyline: textCap === 4 ? 24 : 20,
        path: textCap === 4 ? 24 : 20,
      });
      const image = PNG.sync.read(await page.locator('canvas').screenshot());
      let ink = 0;
      for (let i = 0; i < image.data.length; i += 4)
        if (
          image.data[i] < 200 ||
          image.data[i + 1] < 200 ||
          image.data[i + 2] < 200
        )
          ink++;
      expect(ink).toBeGreaterThan(100);
      const measured = await page.evaluate(() =>
        window.mixedRenderer.measure('pan', 6, 3),
      );
      expect(measured.webglError).toBe(0);
      expect(measured.allocatedBufferBytes).toBeGreaterThan(0);
      expect(measured.samples).toBe(6);
      expect(measured.nonemptyFrames).toBe(6);
      expect(measured.native.uniformUploads).toBe(1);
      expect(measured.native.uniformBytes).toBe(192);
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
      return { state, image };
    }
    const off = await load('grouped', false);
    const interleaved = await load('interleaved', false);
    expect(interleaved.image.data.equals(off.image.data)).toBe(true);
    const on = await load('grouped', true);
    expect(on.state.native.drawcalls).toBeLessThan(off.state.native.drawcalls);
    if (backend === 'ecs') {
      expect(on.state.textProxy).toBe(20);
      expect(on.state.native.indices).toBeLessThan(off.state.native.indices);
    }
    const capped = await load('grouped', true, 4);
    expect(capped.state.textProxy).toBe(backend === 'ecs' ? 4 : 0);
    expect(errors).toEqual([]);
  });
}
