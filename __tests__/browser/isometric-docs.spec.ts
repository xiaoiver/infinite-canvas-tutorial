import { expect, test } from '@playwright/test';
import type {} from './fixtures/isometric-docs';

test('the isometric example edits an SVG anchor after multi-selection and undoes it', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  expect(
    (await page.evaluate(() => window.isometricDocs.selectGroup())).sort(),
  ).toEqual(['iso-cube', 'iso-ring']);
  const original = await page.evaluate(() => window.isometricDocs.path());
  await page.getByRole('button', { name: '编辑 SVG 锚点' }).click();
  const anchors = page.locator('svg.isometric-preview circle.path-anchor');
  await expect(anchors.first()).toBeVisible();
  const handle = await anchors.first().boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2 + 14,
    handle!.y + handle!.height / 2 + 8,
    { steps: 4 },
  );
  await page.mouse.up();
  await page.evaluate(() => window.isometricDocs.settle());
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.path()))
    .not.toBe(original);
  await page.evaluate(() => window.isometricDocs.undo());
  expect(await page.evaluate(() => window.isometricDocs.path())).toBe(original);
  expect(errors).toEqual([]);
});
