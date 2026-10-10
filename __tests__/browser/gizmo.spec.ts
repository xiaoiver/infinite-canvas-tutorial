import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

for (const scenario of [
  { width: 400, height: 240, zoom: 1, rotation: 0, z: 0, dpr: 1 },
  { width: 240, height: 400, zoom: 1.5, rotation: 0.3, z: 40, dpr: 2 },
  { width: 500, height: 250, zoom: 0.75, rotation: -0.4, z: -30, dpr: 2 },
]) {
  test(`displayed Z handle matches picking and drag distance: ${JSON.stringify(
    scenario,
  )}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const params = new URLSearchParams(
      Object.entries(scenario).map(([key, value]) => [key, String(value)]),
    );
    await page.goto(`/gizmo.html?${params}`);
    await expect(page.locator('#status')).toHaveText('Ready');
    const { center } = await page.evaluate(() => window.gizmoTest.state());
    const distance = 150 * Math.tan(Math.PI / 8) * 0.6;
    const direction = [0.5, 0.55].map((v) => v / Math.hypot(0.5, 0.55));
    const x = center.x + direction[0] * distance;
    const y = center.y + direction[1] * distance;
    // Inspect actual GPU output, independently of the picking/projection code.
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    const ratio = png.width / scenario.width;
    let bluePixels = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const offset =
          (Math.round(y * ratio + dy) * png.width +
            Math.round(x * ratio + dx)) *
          4;
        if (
          png.data[offset + 2] > 180 &&
          png.data[offset] < 100 &&
          png.data[offset + 1] < 170
        )
          bluePixels++;
      }
    }
    expect(bluePixels).toBeGreaterThan(0);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect
      .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
      .toBe(true);
    const active = await page.evaluate(() => window.gizmoTest.state());
    expect(active.axis).toBe('z');
    expect(active.partKind).toBe('translate');
    // Integer CSS deltas also work on touch WebKit's quantized mouse coordinates.
    await page.mouse.move(x + 10, y + 11, { steps: 4 });
    await page.mouse.up();
    await page.evaluate(() => window.gizmoTest.settle());
    const after = await page.evaluate(() => window.gizmoTest.state());
    expect(after.translation[2]).toBeCloseTo(
      scenario.z + Math.hypot(10, 11) / scenario.zoom,
      2,
    );
    expect(after.node.x).toBeCloseTo(60);
    expect(after.node.y).toBeCloseTo(60);
    await page.evaluate(() => window.gizmoTest.api().undo());
    await page.evaluate(() => window.gizmoTest.settle());
    expect(
      (await page.evaluate(() => window.gizmoTest.state())).translation[2],
    ).toBeCloseTo(scenario.z);
    expect(errors).toEqual([]);
  });
}

test('the visible arrow wins where it overlaps a rotation ring', async ({
  page,
}) => {
  await page.goto('/gizmo.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const x = 80 + 150 * Math.tan(Math.PI / 8) * 0.825;
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const ratio = png.width / 200;
  const offset =
    (Math.round(80 * ratio) * png.width + Math.round(x * ratio)) * 4;
  expect(png.data[offset]).toBeGreaterThan(180);
  expect(png.data[offset + 2]).toBeLessThan(100);
  await page.mouse.move(x, 80);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
    .toBe(true);
  const active = await page.evaluate(() => window.gizmoTest.state());
  expect(active.axis).toBe('x');
  expect(active.partKind).toBe('translate');
  await page.mouse.move(x + 20, 80);
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).node.x,
  ).toBeCloseTo(80);
});

test('3D gizmo commits a pointer gesture once and restores the rendered pose through undo/redo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.mouse.move(125, 80);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
    .toBe(true);
  await page.mouse.move(145, 80, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const after = await page.evaluate(() => window.gizmoTest.state());
  expect(after.node.x).toBeCloseTo(80);
  expect(after.translation[0]).toBeCloseTo(100);
  expect(after.dragging).toBe(false);
  await page.evaluate(() => window.gizmoTest.api().undo());
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[0],
  ).toBeCloseTo(80);
  expect(
    await page.evaluate(() => window.gizmoTest.api().getHistoryState().canUndo),
  ).toBe(false);
  await page.evaluate(() => window.gizmoTest.api().redo());
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[0],
  ).toBeCloseTo(100);
  expect(errors).toEqual([]);
});

test('Escape cancels the preview and a later pointer release does not commit it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.mouse.move(80, 125);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
    .toBe(true);
  await page.mouse.move(80, 145);
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[1],
  ).toBeCloseTo(100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const result = await page.evaluate(() => window.gizmoTest.state());
  expect(result.node.y).toBe(60);
  expect(result.translation[1]).toBeCloseTo(80);
  expect(result.dragging).toBe(false);
  expect(errors).toEqual([]);
});
