import { expect, test } from '@playwright/test';
import type {} from './fixtures/isometric-docs';

test('3D callouts follow the camera and edited SVG vertices', async ({
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
  const toggle = page.getByRole('button', { name: '显示标注' });
  await toggle.click();
  const cube = page.locator('[data-callout="cube"] circle');
  const ring = page.locator('[data-callout="ring"] circle');
  await expect(cube).toBeVisible();
  await expect(ring).toBeVisible();
  const anchor = async () => [
    Number(await ring.getAttribute('cx')),
    Number(await ring.getAttribute('cy')),
  ];
  const original = await anchor();
  await page.getByLabel('视角').selectOption('dimetric-2-1');
  await expect.poll(anchor).not.toEqual(original);
  const cubeAnchor = async () => [
    Number(await cube.getAttribute('cx')),
    Number(await cube.getAttribute('cy')),
  ];
  const cubeBeforeMove = await cubeAnchor();
  await page.evaluate(() => window.isometricDocs.moveCube(25));
  await expect.poll(cubeAnchor).not.toEqual(cubeBeforeMove);
  const afterCamera = await anchor();
  await page.getByRole('button', { name: '编辑 SVG 锚点' }).click();
  const handle = await page.locator('circle.path-anchor').first().boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2 + 18,
    handle!.y + handle!.height / 2 + 10,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect.poll(anchor).not.toEqual(afterCamera);
  await toggle.click();
  await expect(ring).toHaveCount(0);
  expect(errors).toEqual([]);
});

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
