import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import type {} from './fixtures/d2-docs';

test.setTimeout(60000);

async function expectUnfilledEdge(page: Page) {
  const image = PNG.sync.read(
    await page
      .locator('ic-spectrum-canvas canvas')
      .first()
      .screenshot({ scale: 'css' }),
  );
  let blue = 0;
  // Between the two boxes: a thin blue stroke is expected, not a filled wedge.
  for (let y = 85; y < 175; y++) {
    for (let x = 170; x < 390; x++) {
      const i = (y * image.width + x) * 4;
      if (
        image.data[i + 2] > 100 &&
        image.data[i] < 80 &&
        image.data[i + 1] < 100
      ) {
        blue++;
      }
    }
  }
  expect(blue).toBeGreaterThan(50);
  expect(blue).toBeLessThan(1000);
}

test('D2 documentation keeps curved edges unfilled when a connected node is dragged', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/d2-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.d2Docs?.ready()), { timeout: 30000 })
    .toBe(true);
  await page.evaluate(() => window.d2Docs.arrange());
  await expectUnfilledEdge(page);

  const before = await page.evaluate(() => window.d2Docs.nodes());
  const edge = before.find((node) => node.type === 'path')!;
  expect(edge).toMatchObject({
    fromId: 'x',
    toId: 'y',
    markerEnd: 'triangle',
    curved: true,
  });
  const label = before.find(
    (node) => node.type === 'text' && node.parentId === edge.id,
  )!;
  expect(label).toMatchObject({
    content: 'hello world',
    edgeLabelPosition: 0.5,
  });
  const center = await page.evaluate(() => window.d2Docs.dragPoint('y'));
  await page.mouse.move(center.x, center.y);
  await page.evaluate(() => window.d2Docs.settle());
  await page.mouse.down();
  await page.evaluate(() => window.d2Docs.settle());
  await page.mouse.move(center.x + 45, center.y, { steps: 8 });
  await page.evaluate(() => window.d2Docs.settle());
  await page.mouse.up();
  await page.evaluate(() => window.d2Docs.settle());
  const after = await page.evaluate(() => window.d2Docs.nodes());
  expect(after.find((node) => node.id === 'y')!.x).toBeCloseTo(205, 0);
  expect(after.find((node) => node.id === edge.id)).toMatchObject({
    fromId: 'x',
    toId: 'y',
    markerEnd: 'triangle',
  });
  expect(after.find((node) => node.id === label.id)!.parentId).toBe(edge.id);
  await expectUnfilledEdge(page);
  await page.evaluate(() => window.d2Docs.unmount());
  expect(errors).toEqual([]);
});
