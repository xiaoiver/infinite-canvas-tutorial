import { expect, type Locator } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo-worlds';

async function expectRedArrow(canvas: Locator, centerX: number) {
  const png = PNG.sync.read(await canvas.screenshot());
  const ratio = png.width / 200;
  const offset =
    (Math.round(80 * ratio) * png.width + Math.round((centerX + 45) * ratio)) *
    4;
  expect(png.data[offset]).toBeGreaterThan(180);
  expect(png.data[offset + 1]).toBeLessThan(100);
  expect(png.data[offset + 2]).toBeLessThan(100);
}

test('canvas gizmos survive another canvas disposal and an App restart', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo-worlds.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await expectRedArrow(page.locator('#first'), 60);
  await expectRedArrow(page.locator('#second'), 60);
  await page.evaluate(() => window.gizmoWorlds.move(0, 60));
  await expectRedArrow(page.locator('#first'), 80);
  await expectRedArrow(page.locator('#second'), 60);
  await page.evaluate(() => window.gizmoWorlds.destroySecond());
  await page.evaluate(() => window.gizmoWorlds.move(0, 80));
  await expectRedArrow(page.locator('#first'), 100);
  await page.evaluate(() => window.gizmoWorlds.restart());
  await expectRedArrow(page.locator('#first'), 60);
  await expectRedArrow(page.locator('#second'), 60);
  expect(errors).toEqual([]);
});

test('a rejected concurrent World cannot replace an active renderer', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo-worlds.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(() => window.gizmoWorlds.rejectSecondWorld()),
  ).toContain('already in use in another world');
  await page.evaluate(() => window.gizmoWorlds.move(0, 60));
  await expectRedArrow(page.locator('#first'), 80);
  await expectRedArrow(page.locator('#second'), 60);
  expect(errors).toEqual([]);
});
