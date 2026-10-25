import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/isometric-docs';

test('rim light follows 3D materials and can be undone', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  const canvas = page.locator('ic-spectrum-canvas');
  const before = PNG.sync.read(await canvas.screenshot()).data;
  const toggle = page.getByRole('button', { name: '边缘光' });
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.rimStrengths()))
    .toEqual([0.9, 0.9]);
  await page.evaluate(() => window.isometricDocs.settle());
  const after = PNG.sync.read(await canvas.screenshot()).data;
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (
      Math.abs(before[i] - after[i]) +
        Math.abs(before[i + 1] - after[i + 1]) +
        Math.abs(before[i + 2] - after[i + 2]) >
      40
    )
      changed++;
  }
  expect(changed).toBeGreaterThan(300);
  await page.getByRole('button', { name: '倾斜 SVG' }).click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.rimStrengths()))
    .toEqual([0.9, 0.9]);
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.rimStrengths()))
    .toEqual([0, 0]);
  await page.evaluate(() => window.isometricDocs.undo());
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.rimStrengths()))
    .toEqual([0.9, 0.9]);
  expect(errors).toEqual([]);
});

test('opaque 3D outlines follow materials and remain undoable', async ({
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
  const canvas = page.locator('ic-spectrum-canvas');
  const original = PNG.sync.read(await canvas.screenshot()).data;
  const toggle = page.getByRole('button', { name: '显示轮廓' });
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.outlineWidths()))
    .toEqual([2, 2]);
  await page.evaluate(() => window.isometricDocs.settle());
  const outlined = PNG.sync.read(await canvas.screenshot()).data;
  let changed = 0;
  for (let i = 0; i < original.length; i += 4) {
    if (
      Math.abs(original[i] - outlined[i]) +
        Math.abs(original[i + 1] - outlined[i + 1]) +
        Math.abs(original[i + 2] - outlined[i + 2]) >
      40
    )
      changed++;
  }
  expect(changed).toBeGreaterThan(300);
  await page.getByRole('button', { name: '倾斜 SVG' }).click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.outlineWidths()))
    .toEqual([2, 2]);
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.outlineWidths()))
    .toEqual([0, 0]);
  await page.evaluate(() => window.isometricDocs.undo());
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.outlineWidths()))
    .toEqual([2, 2]);
  expect(errors).toEqual([]);
});

test('stepped tones affect both 3D objects and can be turned off', async ({
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
  const canvas = page.locator('ic-spectrum-canvas');
  const original = PNG.sync.read(await canvas.screenshot()).data;
  const toggle = page.getByRole('button', { name: '分层色阶' });
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.toneSteps()))
    .toEqual([4, 4]);
  await page.evaluate(() => window.isometricDocs.settle());
  const image = PNG.sync.read(await canvas.screenshot());
  const stepped = image.data;
  let changed = 0;
  for (let i = 0; i < original.length; i += 4) {
    if (
      Math.abs(original[i] - stepped[i]) +
        Math.abs(original[i + 1] - stepped[i + 1]) +
        Math.abs(original[i + 2] - stepped[i + 2]) >
      40
    )
      changed++;
  }
  expect(changed).toBeGreaterThan(200);
  // The cube's unlit-facing side should remain blue, not collapse to black.
  const cubeSide = (200 * image.width + 350) * 4;
  expect(stepped[cubeSide + 2]).toBeGreaterThan(80);
  await page.getByRole('button', { name: '倾斜 SVG' }).click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.toneSteps()))
    .toEqual([4, 4]);
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.toneSteps()))
    .toEqual([0, 0]);
  await page.evaluate(() => window.isometricDocs.undo());
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.toneSteps()))
    .toEqual([4, 4]);
  expect(errors).toEqual([]);
});

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
