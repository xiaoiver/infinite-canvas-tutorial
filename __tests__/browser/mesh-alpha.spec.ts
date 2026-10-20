import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

const pixel = (png: PNG, x: number, y: number) => [
  ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3),
];

test('mesh alpha cutout and camera-depth blend order render in WebGL', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.gizmoTest.settle());
  const canvas = page.locator('#canvas');
  const masked = PNG.sync.read(await canvas.screenshot());
  const left = pixel(masked, 35, 40);
  const right = pixel(masked, 75, 40);
  const glass = pixel(masked, 140, 90);
  expect(Math.abs(left[0] - left[2])).toBeLessThan(10);
  expect(right[0]).toBeGreaterThan(right[2] + 150);
  // Scene order intentionally places the nearer red pane before the farther
  // blue pane. The renderer must still draw blue first.
  expect(glass[0]).toBeGreaterThan(glass[2]);
  expect(glass[2]).toBeGreaterThan(glass[1]);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const mask = api.getNodeById('alpha-mask');
    if (mask.type !== 'mesh3d') throw new Error('Missing mask mesh');
    api.updateNode(
      mask,
      {
        material3d: { ...mask.material3d, alphaMode: 'opaque' },
      },
      false,
    );
    await window.gizmoTest.settle();
  });
  const opaque = PNG.sync.read(await canvas.screenshot());
  const opaqueLeft = pixel(opaque, 35, 40);
  expect(opaqueLeft[0]).toBeLessThan(left[0] - 100);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    api.updateNode(api.getNodeById('alpha-near'), { z: 50 }, false);
    api.updateNode(api.getNodeById('alpha-far'), { z: 0 }, false);
    await window.gizmoTest.settle();
  });
  const swapped = PNG.sync.read(await canvas.screenshot());
  const glassSwapped = pixel(swapped, 140, 90);
  expect(glassSwapped[2]).toBeGreaterThan(glassSwapped[0]);
  expect(errors).toEqual([]);
});
