import { expect, test, type Locator, type Page } from '@playwright/test';
import type {} from './fixtures/isometric-docs';

test.setTimeout(90000);

async function ready(page: Page) {
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  expect(
    (await page.evaluate(() => window.isometricDocs.selectGroup())).sort(),
  ).toEqual(['iso-cube', 'iso-ring']);
}

async function pointerDrag(
  page: Page,
  target: Locator,
  moveTarget: Locator,
  start: { x: number; y: number },
  delta: [number, number],
) {
  const init = {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    button: 0,
    buttons: 1,
    width: 18,
    height: 18,
  };
  await page.mouse.move(start.x, start.y);
  await target.dispatchEvent('pointerdown', {
    ...init,
    clientX: start.x,
    clientY: start.y,
  });
  await page.evaluate(() => window.isometricDocs.settle());
  for (let step = 1; step <= 4; step++) {
    await moveTarget.dispatchEvent('pointermove', {
      ...init,
      clientX: start.x + (delta[0] * step) / 4,
      clientY: start.y + (delta[1] * step) / 4,
    });
    await page.evaluate(() => window.isometricDocs.settle());
  }
  await moveTarget.dispatchEvent('pointerup', {
    ...init,
    buttons: 0,
    clientX: start.x + delta[0],
    clientY: start.y + delta[1],
  });
  await page.evaluate(() => window.isometricDocs.settle());
}

test('mobile WebKit taps and drags an isometric SVG anchor', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const original = await page.evaluate(() => window.isometricDocs.path());
  await page.getByRole('button', { name: '编辑 SVG 锚点' }).click();
  const anchor = page
    .locator('svg.isometric-preview circle.path-anchor')
    .first();
  const svg = page.locator('svg.isometric-preview');
  await expect(anchor).toBeVisible();
  await anchor.scrollIntoViewIfNeeded();
  const box = (await anchor.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.touchscreen.tap(start.x, start.y);
  await page.evaluate(() => window.isometricDocs.settle());
  expect(
    await page.evaluate(() => window.isometricDocs.lastAnchorPointer()),
  ).toEqual({ pointerType: 'touch', trusted: true });
  expect(await page.evaluate(() => window.isometricDocs.path())).toBe(original);
  await pointerDrag(page, anchor, svg, start, [18, 12]);
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.path()))
    .not.toBe(original);
  await page.evaluate(() => window.isometricDocs.undo());
  expect(await page.evaluate(() => window.isometricDocs.path())).toBe(original);
  expect(errors).toEqual([]);
});

test('mobile WebKit drags one shared isometric gizmo and undoes both meshes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const before = await page.evaluate(() =>
    window.isometricDocs.groupPositions(),
  );
  const { point, delta } = await page.evaluate(() =>
    window.isometricDocs.groupXHandle(),
  );
  const canvas = page.locator('ic-spectrum-canvas canvas');
  await pointerDrag(page, canvas, canvas, point, delta);
  const after = await page.evaluate(() =>
    window.isometricDocs.groupPositions(),
  );
  expect(after.cube! - before.cube!).toBeGreaterThan(4);
  expect(after.ring! - before.ring!).toBeCloseTo(after.cube! - before.cube!, 2);
  await page.evaluate(() => window.isometricDocs.undo());
  expect(
    await page.evaluate(() => window.isometricDocs.groupPositions()),
  ).toEqual(before);
  expect(errors).toEqual([]);
});

test('mobile WebKit scales an isometric Mesh and SVG with the shared handle', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const before = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  const point = await page.evaluate(() =>
    window.isometricDocs.groupScaleHandle(),
  );
  const canvas = page.locator('ic-spectrum-canvas canvas');
  await pointerDrag(page, canvas, canvas, point, [0, -60]);
  const after = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(after.cube.scale[0]).toBeGreaterThan(before.cube.scale[0] * 1.3);
  expect(after.ring.documentScale[0]).toBeGreaterThan(1.3);
  await page.evaluate(() => window.isometricDocs.undo());
  expect(
    await page.evaluate(() => window.isometricDocs.groupScaleState()),
  ).toEqual(before);
  expect(errors).toEqual([]);
});
