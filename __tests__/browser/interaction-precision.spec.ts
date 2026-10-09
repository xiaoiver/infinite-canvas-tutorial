import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/ecs-blend';
import type { Pen } from '../../packages/ecs/src';

test('preserves subpixel movement and resize on a CSS-scaled canvas through undo and redo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    // This rendering fixture has no mobile viewport metadata. Keep browser
    // page scaling at 1 so the gesture measures only the canvas CSS transform.
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    document.head.append(viewport);
    document.body.style.overflow = 'hidden';
    const api = window.blendTest.api();
    await window.blendTest.renderNodes([
      {
        id: 'shape',
        type: 'rect',
        x: 40,
        y: 40,
        width: 80,
        height: 60,
        zIndex: 0,
        fills: [{ type: 'solid', value: 'red' }],
      },
    ]);
    await api.edit(() => {
      api.gotoLandmark({ x: 0, y: 0, zoom: 1, rotation: 0 }, { duration: 0 });
      api.setAppState({
        penbarSelected: 'select' as Pen,
        snapToObjectsEnabled: false,
        snapToPixelGridEnabled: false,
      });
      api.selectNodes([api.getNodeById('shape')]);
    });
    api.clearHistory();
  });
  const frame = () => page.evaluate(() => window.blendTest.settle());
  await frame();
  await page.locator('#actual').evaluate((canvas: HTMLCanvasElement) => {
    canvas.style.transform = 'scale(2)';
    canvas.style.transformOrigin = 'top left';
    canvas.style.position = 'relative';
    canvas.style.zIndex = '1';
  });
  const box = (await page.locator('#actual').boundingBox())!;
  // Whole client pixels become half CSS pixels inside the scaled canvas.
  await page.mouse.move(box.x + 131, box.y + 111);
  await page.mouse.down();
  await frame();
  await page.mouse.move(box.x + 132, box.y + 112);
  await frame();
  await page.mouse.up();
  await frame();
  const geometry = () =>
    page.evaluate(() => {
      const { x, y, width, height } = window.blendTest
        .api()
        .getNodeById('shape');
      return { x, y, width, height };
    });
  const moved = await geometry();
  expect(moved.x).toBeCloseTo(40.5, 3);
  expect(moved.y).toBeCloseTo(40.5, 3);
  await page.mouse.move(
    box.x + 2 * (moved.x + moved.width),
    box.y + 2 * (moved.y + moved.height),
  );
  await page.mouse.down();
  await frame();
  await page.mouse.move(
    box.x + 2 * (moved.x + moved.width + 30.5),
    box.y + 2 * (moved.y + moved.height + 10.5),
  );
  await frame();
  await page.mouse.up();
  await frame();
  const resized = await geometry();
  expect(resized.x).toBeCloseTo(moved.x, 3);
  expect(resized.y).toBeCloseTo(moved.y, 3);
  expect(resized.width).toBeCloseTo(110.5, 3);
  expect(resized.height).toBeCloseTo(70.5, 3);
  await page.evaluate(() => window.blendTest.api().undo());
  await frame();
  expect(await geometry()).toEqual(moved);
  await page.evaluate(() => window.blendTest.api().redo());
  await frame();
  expect(await geometry()).toEqual(resized);
  expect(errors).toEqual([]);
});

test('partial camera landmarks preserve position and rotation and keep a zoom anchor fixed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() =>
      api.gotoLandmark(
        { x: 30, y: 50, zoom: 1.5, rotation: Math.PI / 6 },
        { duration: 0 },
      ),
    );
    await window.blendTest.settle();
    await api.edit(() => api.gotoLandmark({ zoom: 2 }, { duration: 0 }));
    await window.blendTest.settle();
    const partial = api.createLandmark();
    const anchor = { x: 120.25, y: 80.5 };
    const before = api.viewport2Canvas(anchor);
    await api.edit(() =>
      api.gotoLandmark(
        { zoom: 3, viewportX: anchor.x, viewportY: anchor.y },
        { duration: 0 },
      ),
    );
    await window.blendTest.settle();
    return {
      partial,
      before,
      after: api.viewport2Canvas(anchor),
      final: api.createLandmark(),
    };
  });
  expect(result.partial.x).toBeCloseTo(30, 3);
  expect(result.partial.y).toBeCloseTo(50, 3);
  expect(result.partial.zoom).toBeCloseTo(2, 3);
  expect(result.partial.rotation).toBeCloseTo(Math.PI / 6, 4);
  expect(result.final.zoom).toBeCloseTo(3, 3);
  expect(result.after.x).toBeCloseTo(result.before.x, 3);
  expect(result.after.y).toBeCloseTo(result.before.y, 3);
  expect(errors).toEqual([]);
});
