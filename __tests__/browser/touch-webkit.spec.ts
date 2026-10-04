import { expect, test, type Page } from '@playwright/test';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const node = (page: Page) =>
  page.evaluate(
    () => window.canvasRegression.state('left')!.nodes[0] as RectSerializedNode,
  );
async function position(page: Page, point: [number, number]) {
  const p = await page.evaluate(
    (point) => window.canvasRegression.viewportPoint('left', 'shape', point),
    point,
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + p.x, y: box.y + p.y };
}

// Playwright exposes native WebKit taps, but no touch-drag protocol. Exercise
// Safari's PointerEvent path for drags, and native touchscreen taps for selection.
async function pointerDrag(page: Page, start: { x: number; y: number }) {
  const canvas = page.locator('#left canvas');
  const init = {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    button: 0,
    buttons: 1,
    width: 20,
    height: 20,
  };
  await canvas.dispatchEvent('pointerdown', {
    ...init,
    clientX: start.x,
    clientY: start.y,
  });
  await frame(page);
  for (let step = 1; step <= 5; step++) {
    await canvas.dispatchEvent('pointermove', {
      ...init,
      clientX: start.x + step * 6,
      clientY: start.y + step * 4,
    });
    await frame(page);
  }
  await canvas.dispatchEvent('pointerup', {
    ...init,
    buttons: 0,
    clientX: start.x + 30,
    clientY: start.y + 20,
  });
  await frame(page);
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
  await page.addStyleTag({
    content: 'body{margin:8px}main{display:block}canvas{touch-action:none}',
  });
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'shape',
          type: 'rect',
          x: 40,
          y: 40,
          width: 120,
          height: 100,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#ff8400' }],
        },
      ],
      '',
    ),
  );
  await frame(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('WebKit native touch selects a shape without hover, then deselects on empty space', async ({
  page,
}) => {
  const body = await position(page, [30, 40]);
  await page.touchscreen.tap(body.x, body.y);
  await frame(page);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.layersSelected,
    ),
  ).toEqual(['shape']);
  await page.waitForTimeout(310);
  const empty = await position(page, [240, 150]);
  await page.touchscreen.tap(empty.x, empty.y);
  await frame(page);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.layersSelected,
    ),
  ).toEqual([]);
});

test('WebKit pointer events resize a padded corner after native selection, with undo and redo', async ({
  page,
}) => {
  const body = await position(page, [30, 40]);
  await page.touchscreen.tap(body.x, body.y);
  await frame(page);
  await page.waitForTimeout(310);
  const corner = await position(page, [120, 100]);
  await pointerDrag(page, { x: corner.x + 12, y: corner.y + 8 });
  const resized = await node(page);
  expect(Math.abs(resized.width! - 150)).toBeLessThan(1.5);
  expect(Math.abs(resized.height! - 120)).toBeLessThan(1.5);
  expect(resized.rotation ?? 0).toBe(0);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect(await node(page)).toMatchObject({ width: 120, height: 100 });
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await frame(page);
  expect((await node(page)).width).toBeCloseTo(resized.width!, 3);
});

test('WebKit preserves the press position when touch moves before the render frame', async ({
  page,
}) => {
  const body = await position(page, [30, 40]);
  await page.touchscreen.tap(body.x, body.y);
  await frame(page);
  await page.waitForTimeout(310);
  const corner = await position(page, [120, 100]);
  await page.locator('#left canvas').evaluate((canvas, corner) => {
    const init = {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 1,
    };
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        ...init,
        clientX: corner.x + 12,
        clientY: corner.y + 8,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        ...init,
        clientX: corner.x + 42,
        clientY: corner.y + 28,
      }),
    );
  }, corner);
  await frame(page);
  await page.locator('#left canvas').dispatchEvent('pointerup', {
    pointerType: 'touch',
    pointerId: 1,
    button: 0,
    buttons: 0,
    clientX: corner.x + 42,
    clientY: corner.y + 28,
  });
  await frame(page);
  const resized = await node(page);
  expect(Math.abs(resized.width! - 150)).toBeLessThan(1.5);
  expect(Math.abs(resized.height! - 120)).toBeLessThan(1.5);
  expect(resized.rotation ?? 0).toBe(0);
});
