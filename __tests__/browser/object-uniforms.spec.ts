import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { PNG } from 'pngjs';
import type { PolylineLODHarness } from './fixtures/polyline-lod';

declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installProbes);
  await page.goto('/polyline-lod.html');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 30000 });
});
test('camera-only frames upload only the scene UBO and edits still update object data', async ({
  page,
}) => {
  const pan = await page.evaluate(async () => {
    window.polylineLOD.resetWork();
    await window.polylineLOD.camera(1);
    return window.polylineLOD.state().native;
  });
  expect(pan.uniformUploads).toBe(1);
  expect(pan.uniformBytes).toBe(192);
  const zoom = await page.evaluate(async () => {
    window.polylineLOD.resetWork();
    await window.polylineLOD.zoom(1.1);
    return window.polylineLOD.state().native;
  });
  expect(zoom.uniformUploads).toBe(1);
  for (const patch of [
    { strokeWidth: 8 },
    { x: 80 },
    { strokes: [{ type: 'solid', value: 'red', opacity: 0.7 }] },
  ]) {
    const work = await page.evaluate(async (patch) => {
      window.polylineLOD.resetWork();
      await window.polylineLOD.patch(patch);
      return window.polylineLOD.state().native;
    }, patch);
    expect(work.uniformUploads).toBeGreaterThan(1);
  }
  const repeat = await page.evaluate(async () => {
    window.polylineLOD.resetWork();
    await window.polylineLOD.camera(2);
    return window.polylineLOD.state().native;
  });
  expect(repeat.uniformUploads).toBe(1);
});
test('gradient text bake, multiple paint passes, and raster export restore current uniforms', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.polylineLOD.document([
      {
        id: 'shape',
        type: 'rect',
        x: 220,
        y: 20,
        width: 130,
        height: 90,
        fills: [
          { type: 'solid', value: 'red' },
          { type: 'solid', value: 'blue', opacity: 0.5 },
        ],
      },
      {
        id: 'text',
        type: 'text',
        x: 20,
        y: 40,
        width: 180,
        height: 60,
        fontSize: 40,
        fontFamily: 'sans-serif',
        content: 'TEXT',
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, red, blue)',
            opacity: 1,
          },
        ],
      },
    ] as any),
  );
  const initial = await page.locator('canvas').screenshot();
  for (const partial of [false, true])
    await page.evaluate(
      (partial) => window.polylineLOD.export(partial, 'text'),
      partial,
    );
  expect(await page.locator('canvas').screenshot()).toEqual(initial);
  await page.evaluate(() =>
    window.polylineLOD.patch(
      { fills: [{ type: 'solid', value: 'green', opacity: 1 }] },
      'text',
    ),
  );
  expect(await page.locator('canvas').screenshot()).not.toEqual(initial);
  await page.evaluate(() =>
    window.polylineLOD.patch(
      {
        fills: [
          {
            type: 'gradient',
            value: 'linear-gradient(90deg, red, blue)',
            opacity: 1,
          },
        ],
      },
      'text',
    ),
  );
  expect(await page.locator('canvas').screenshot()).toEqual(initial);
  await page.evaluate(() => window.polylineLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
});
test('WebGL1 reapplies shared program uniforms for independent text and shapes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl2') return null;
      return (get as any).call(this, type, ...args);
    } as typeof get;
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 30000 });
  await page.evaluate(() =>
    window.polylineLOD.document([
      {
        id: 'red',
        type: 'text',
        x: 30,
        y: 20,
        width: 100,
        height: 60,
        fontSize: 40,
        fontFamily: 'sans-serif',
        content: 'HH',
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      },
      {
        id: 'blue',
        type: 'text',
        x: 230,
        y: 20,
        width: 100,
        height: 60,
        fontSize: 40,
        fontFamily: 'sans-serif',
        content: 'HH',
        fills: [{ type: 'solid', value: 'blue', opacity: 1 }],
      },
      {
        id: 'rect-red',
        type: 'rect',
        x: 30,
        y: 150,
        width: 80,
        height: 60,
        fills: [{ type: 'solid', value: 'red', opacity: 1 }],
      },
      {
        id: 'rect-blue',
        type: 'rect',
        x: 230,
        y: 150,
        width: 80,
        height: 60,
        fills: [{ type: 'solid', value: 'blue', opacity: 1 }],
      },
    ] as any),
  );
  const initial = await page.locator('canvas').screenshot();
  const image = PNG.sync.read(initial);
  let red = 0,
    blue = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i] > 200 && image.data[i + 2] < 50) red++;
    if (image.data[i + 2] > 200 && image.data[i] < 50) blue++;
  }
  expect(red).toBeGreaterThan(1000);
  expect(blue).toBeGreaterThan(1000);
  await page.evaluate(async () => {
    await window.polylineLOD.camera(1);
    await window.polylineLOD.camera(2);
    await window.polylineLOD.camera(0);
  });
  expect(await page.locator('canvas').screenshot()).toEqual(initial);
});
