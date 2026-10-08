import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/icon-resize';

test.setTimeout(60000);
const settle = (page: Page) => page.evaluate(() => window.iconResize.settle());
const node = (page: Page, id: string) =>
  page.evaluate((id) => window.iconResize.node(id), id);
const children = (page: Page, id: string) =>
  page.evaluate((id) => window.iconResize.children(id), id);
const order = (page: Page) => page.evaluate(() => window.iconResize.order());
const corners = (page: Page) =>
  page.evaluate(() => window.iconResize.corners());
const pointDistance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/icon-resize.html');
  await expect
    .poll(
      async () => {
        expect(errors).toEqual([]);
        return page.evaluate(() => window.iconResize?.ready());
      },
      { timeout: 45000 },
    )
    .toBe(true);
  await settle(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.iconResize.unmount());
  expect(errors).toEqual([]);
});

const cases = [
  ['search-icon-lucide', 2], // Circle plus line; failed at StrokeLayers.write.
  ['atom-icon-lucide', 0], // Multiple ellipses and paths.
  ['carrot-icon-lucide', 3], // Stroked paths.
  ['gift-icon-pixelarticons', 1], // Filled paths.
  ['android-icon-material-icon-theme', 2], // Authored icon colors.
] as const;

for (const [id, corner] of cases) {
  test(`${id} resizes from corner ${corner}, keeps its opposite anchor and restores child geometry on undo`, async ({
    page,
    browserName,
  }) => {
    await page.evaluate((id) => window.iconResize.select(id), id);
    const original = await node(page, id);
    const originalOrder = await order(page);
    const originalChildren = await children(page, id);
    const originalCorners = await corners(page);
    const opposite = (corner + 2) % 4;
    const start = originalCorners[corner];
    const box = (await page.locator('canvas').first().boundingBox())!;
    const clientX = Math.round(box.x + start.x);
    const clientY = Math.round(box.y + start.y);
    const dx = corner === 0 || corner === 3 ? -32 : 32;
    const dy = corner === 0 || corner === 1 ? -32 : 32;
    const canvas = page.locator('canvas').first();
    const touch = browserName === 'webkit';
    const pointer = {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      bubbles: true,
      button: 0,
      buttons: 1,
    };
    if (touch)
      await canvas.dispatchEvent('pointerdown', {
        ...pointer,
        clientX,
        clientY,
      });
    else {
      await page.mouse.move(clientX, clientY);
      await page.mouse.down();
    }
    await settle(page);
    for (const progress of [0.5, 1]) {
      const x = clientX + dx * progress;
      const y = clientY + dy * progress;
      if (touch)
        await canvas.dispatchEvent('pointermove', {
          ...pointer,
          clientX: x,
          clientY: y,
        });
      else await page.mouse.move(x, y, { steps: 2 });
      await settle(page);
      expect(errors).toEqual([]);
      const resized = await node(page, id);
      expect(resized.width).toBeGreaterThan(original.width);
      expect(resized.width / resized.height).toBeCloseTo(
        original.width / original.height,
        3,
      );
      expect(
        pointDistance(
          (await corners(page))[opposite],
          originalCorners[opposite],
        ),
      ).toBeLessThan(0.1);
    }
    if (touch)
      await canvas.dispatchEvent('pointerup', {
        ...pointer,
        buttons: 0,
        clientX: clientX + dx,
        clientY: clientY + dy,
      });
    else await page.mouse.up();
    await settle(page);
    const resized = await node(page, id);
    const resizedChildren = await children(page, id);
    expect(resizedChildren).toHaveLength(originalChildren.length);
    expect(resizedChildren.map((child) => child.bounds)).not.toEqual(
      originalChildren.map((child) => child.bounds),
    );
    const paint = (items: typeof originalChildren) =>
      items.map(({ fills, strokes }) => ({ fills, strokes }));
    expect(paint(resizedChildren)).toEqual(paint(originalChildren));
    expect(await order(page)).toEqual(originalOrder);
    await page.evaluate(() => window.iconResize.undo());
    expect(await node(page, id)).toMatchObject({
      x: original.x,
      y: original.y,
      width: original.width,
      height: original.height,
    });
    expect(await children(page, id)).toEqual(originalChildren);
    expect(await order(page)).toEqual(originalOrder);
    await page.evaluate(() => window.iconResize.redo());
    expect(await node(page, id)).toMatchObject({
      x: resized.x,
      y: resized.y,
      width: resized.width,
      height: resized.height,
    });
    expect(await children(page, id)).toEqual(resizedChildren);
    expect(await order(page)).toEqual(originalOrder);
  });
}
