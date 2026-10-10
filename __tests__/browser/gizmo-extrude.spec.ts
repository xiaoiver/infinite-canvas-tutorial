import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

test('disabling extrusion restores a usable 2D transformer', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html?extrude');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.updateNode(editor.getNodeById('model'), { extrude3d: false });
    });
    await window.gizmoTest.settle();
  });
  await page.mouse.move(100, 100);
  await page.evaluate(() => window.gizmoTest.settle());
  await page.mouse.down();
  await page.evaluate(() => window.gizmoTest.settle());
  await page.mouse.move(120, 120, { steps: 4 });
  await page.evaluate(() => window.gizmoTest.settle());
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const node = await page.evaluate(() =>
    window.gizmoTest.api().getNodeById('model'),
  );
  expect(node.width).toBeCloseTo(60);
  expect(node.height).toBeCloseTo(60);
  expect(errors).toEqual([]);
});

for (const reason of ['commit', 'cancel'] as const) {
  test(`extruded rect XY preview can ${reason} without losing its rendered pose`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/gizmo.html?extrude');
    await expect(page.locator('#status')).toHaveText('Ready');
    await page.mouse.move(125, 80);
    await page.mouse.down();
    await expect
      .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
      .toBe(true);
    await page.mouse.move(145, 80, { steps: 4 });
    await page.evaluate(() => window.gizmoTest.settle());
    const preview = await page.evaluate(() => window.gizmoTest.state());
    expect(preview.node.x).toBe(60);
    expect(preview.translation[0]).toBeCloseTo(100);
    if (reason === 'cancel') await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.evaluate(() => window.gizmoTest.settle());
    const after = await page.evaluate(() => window.gizmoTest.state());
    expect(after.node.x).toBeCloseTo(reason === 'commit' ? 80 : 60);
    expect(after.translation[0]).toBeCloseTo(reason === 'commit' ? 100 : 80);
    expect(after.scale).toEqual([40, 40, 20]);
    if (reason === 'commit') {
      const png = PNG.sync.read(await page.locator('#canvas').screenshot());
      const ratio = png.width / 200;
      const offset =
        (Math.round(80 * ratio) * png.width + Math.round(145 * ratio)) * 4;
      expect(png.data[offset]).toBeGreaterThan(180);
      expect(png.data[offset + 2]).toBeLessThan(100);
      await page.evaluate(() => window.gizmoTest.api().undo());
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        (await page.evaluate(() => window.gizmoTest.state())).translation[0],
      ).toBeCloseTo(80);
      await page.evaluate(() => window.gizmoTest.api().redo());
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        (await page.evaluate(() => window.gizmoTest.state())).translation[0],
      ).toBeCloseTo(100);
    }
    expect(errors).toEqual([]);
  });
}

test('extruded rect Z translation changes elevation while preserving thickness on reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html?extrude');
  await expect(page.locator('#status')).toHaveText('Ready');
  const distance = 150 * Math.tan(Math.PI / 8) * 0.6;
  const x = 80 + (distance * 0.5) / Math.hypot(0.5, 0.55);
  const y = 80 + (distance * 0.55) / Math.hypot(0.5, 0.55);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().axis))
    .toBe('z');
  await page.mouse.move(x + 10, y + 11, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const pose = await page.evaluate(() => window.gizmoTest.state());
  expect(pose.translation[2]).toBeCloseTo(Math.hypot(10, 11), 2);
  expect(pose.scale).toEqual([40, 40, 20]);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const saved = structuredClone(api.getNodes());
    await api.edit((editor) => editor.replaceDocument([], 'remote'), {
      capture: 'NEVER',
    });
    await window.gizmoTest.settle();
    await api.edit(
      (editor) => {
        editor.replaceDocument(saved, 'remote');
        editor.selectNodes([editor.getNodeById('model')]);
      },
      { capture: 'NEVER' },
    );
    await window.gizmoTest.settle();
  });
  const reloaded = await page.evaluate(() => window.gizmoTest.state());
  expect(reloaded.translation[2]).toBeCloseTo(pose.translation[2], 4);
  expect(reloaded.scale).toEqual(pose.scale);
  expect(errors).toEqual([]);
});
