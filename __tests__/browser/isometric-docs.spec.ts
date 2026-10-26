import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/isometric-docs';

test('moving spotlight updates light and shadows without rebuilding the cube', async ({
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
  expect(await page.evaluate(() => window.isometricDocs.cubeMeshStable())).toBe(
    true,
  );
  expect(
    await page.evaluate(() => window.isometricDocs.sweepLight()),
  ).toMatchObject({
    intensity: 0,
    castShadow: false,
  });
  const canvas = page.locator('ic-spectrum-canvas');
  const unlit = PNG.sync.read(await canvas.screenshot()).data;

  const toggle = page.getByRole('button', { name: '动态聚光灯' });
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.sweepLight()))
    .toMatchObject({ intensity: 8, castShadow: true });
  const firstX = (await page.evaluate(() => window.isometricDocs.sweepLight()))!
    .x;
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.sweepLight()?.x))
    .not.toBeCloseTo(firstX, 1);
  expect(await page.evaluate(() => window.isometricDocs.cubeMeshStable())).toBe(
    true,
  );
  const lit = PNG.sync.read(await canvas.screenshot()).data;
  let changed = 0;
  for (let i = 0; i < unlit.length; i += 4)
    if (
      Math.abs(unlit[i] - lit[i]) +
        Math.abs(unlit[i + 1] - lit[i + 1]) +
        Math.abs(unlit[i + 2] - lit[i + 2]) >
      40
    )
      changed++;
  expect(changed).toBeGreaterThan(500);

  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.sweepLight()))
    .toMatchObject({ intensity: 0, castShadow: false });
  expect(errors).toEqual([]);
});

test('the shared 3D scale handle resizes a Mesh and extruded SVG in one undo step', async ({
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
  await page.evaluate(() => window.isometricDocs.selectGroup());
  const before = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  const handle = await page.evaluate(() =>
    window.isometricDocs.groupScaleHandle(),
  );
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y - 35, { steps: 3 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => window.isometricDocs.settle());
  expect(
    await page.evaluate(() => window.isometricDocs.groupScaleState()),
  ).toEqual(before);
  await page.evaluate(() => window.isometricDocs.selectGroup());
  const resumed = await page.evaluate(() =>
    window.isometricDocs.groupScaleHandle(),
  );
  await page.mouse.move(resumed.x, resumed.y);
  await page.mouse.down();
  await page.mouse.move(resumed.x, resumed.y - 60, { steps: 5 });
  await page.evaluate(() => window.isometricDocs.settle());
  const preview = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(preview.cube.scale[0]).toBeGreaterThan(before.cube.scale[0] * 1.3);
  expect(preview.ring.scale[2]).toBeGreaterThan(before.ring.scale[2] * 1.3);
  expect(preview.ring.documentScale).toEqual(before.ring.documentScale);
  await page.mouse.up();
  await page.evaluate(() => window.isometricDocs.settle());
  const after = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(after.cube.scale[0]).toBeGreaterThan(before.cube.scale[0] * 1.3);
  expect(after.ring.scale[2]).toBeGreaterThan(before.ring.scale[2] * 1.3);
  expect(after.ring.documentScale[0]).toBeGreaterThan(1.3);
  expect(after.ring.documentScale[1]).toBeGreaterThan(1.3);
  await page.evaluate(() => window.isometricDocs.undo());
  const undone = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(undone.cube.scale).toEqual(before.cube.scale);
  expect(undone.ring.scale).toEqual(before.ring.scale);
  expect(undone.ring.documentScale).toEqual(before.ring.documentScale);
  expect(errors).toEqual([]);
});

test('group scaling preserves a flipped SVG source', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  await page.evaluate(() => window.isometricDocs.flipRing());
  await page.evaluate(() => window.isometricDocs.selectGroup());
  const before = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(before.ring.documentScale[0]).toBe(-1);
  const handle = await page.evaluate(() =>
    window.isometricDocs.groupScaleHandle(),
  );
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y - 60, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => window.isometricDocs.settle());
  const after = await page.evaluate(() =>
    window.isometricDocs.groupScaleState(),
  );
  expect(after.ring.documentScale[0]).toBeLessThan(-1.3);
  expect(after.ring.documentScale[1]).toBeGreaterThan(1.3);
  await page.evaluate(() => window.isometricDocs.undo());
  expect(
    await page.evaluate(() => window.isometricDocs.groupScaleState()),
  ).toEqual(before);
  expect(errors).toEqual([]);
});

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
