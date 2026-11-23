import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/mixed-renderer';
import { PNG } from 'pngjs';

for (const backend of ['core', 'ecs']) {
  test(`${backend} hand-mode idle frames submit no draws and edits wake rendering`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(installProbes);
    await page.goto(`/mixed-renderer.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(async () => {
      await window.mixedRenderer.configure(100, 'grouped', false);
      await window.mixedRenderer.handMode();
    });
    const before = await page.evaluate(() => window.mixedRenderer.raster());
    const idle = await page.evaluate(() =>
      window.mixedRenderer.measure('idle', 6, 5),
    );
    expect(idle.samples).toBe(6);
    expect(idle.nonemptyFrames).toBe(0);
    for (const frame of idle.nativeFrames) {
      expect(frame.drawcalls).toBe(0);
      expect(frame.bufferUploads).toBe(0);
      expect(frame.bufferCreates).toBe(0);
    }
    const onscreen = PNG.sync.read(await page.locator('canvas').screenshot());
    await page.evaluate(() => window.mixedRenderer.measure('idle', 4, 3));
    const retained = PNG.sync.read(await page.locator('canvas').screenshot());
    expect(onscreen.data.equals(retained.data)).toBe(true);
    let ink = 0;
    for (let y = 8; y < onscreen.height - 8; y++) {
      for (let x = 8; x < onscreen.width - 8; x++) {
        const index = (y * onscreen.width + x) * 4;
        if (
          onscreen.data[index] < 200 ||
          onscreen.data[index + 1] < 200 ||
          onscreen.data[index + 2] < 200
        )
          ink++;
      }
    }
    expect(ink).toBeGreaterThan(100);
    const after = await page.evaluate(() => window.mixedRenderer.raster());
    const pixels = (url: string) =>
      PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')).data;
    expect(pixels(before).equals(pixels(after))).toBe(true);
    const moved = await page.evaluate(() =>
      window.mixedRenderer.measure('pan', 3, 2),
    );
    expect(moved.nonemptyFrames).toBe(3);
    const edited = await page.evaluate(() =>
      window.mixedRenderer.measure('edit', 3, 2),
    );
    expect(edited.nonemptyFrames).toBe(3);
    const changedScreen = PNG.sync.read(
      await page.locator('canvas').screenshot(),
    );
    expect(onscreen.data.equals(changedScreen.data)).toBe(false);
    const changed = await page.evaluate(() => window.mixedRenderer.raster());
    expect(pixels(after).equals(pixels(changed))).toBe(false);
    const settled = await page.evaluate(() =>
      window.mixedRenderer.measure('idle', 4, 5),
    );
    expect(settled.nonemptyFrames).toBe(0);
    expect(settled.visible).toBe(idle.visible);
    expect(settled.allocatedBufferBytes).toBe(idle.allocatedBufferBytes);
    const baseline = await page.evaluate(() => window.mixedRenderer.destroy());
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
    expect(errors).toEqual([]);
  });
}
