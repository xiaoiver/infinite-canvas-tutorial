import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

test('3D gizmo commits a pointer gesture once and restores the rendered pose through undo/redo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.mouse.move(125, 80);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
    .toBe(true);
  await page.mouse.move(145, 80, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const after = await page.evaluate(() => window.gizmoTest.state());
  expect(after.node.x).toBeCloseTo(80);
  expect(after.translation[0]).toBeCloseTo(100);
  expect(after.dragging).toBe(false);
  await page.evaluate(() => window.gizmoTest.api().undo());
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[0],
  ).toBeCloseTo(80);
  expect(
    await page.evaluate(() => window.gizmoTest.api().getHistoryState().canUndo),
  ).toBe(false);
  await page.evaluate(() => window.gizmoTest.api().redo());
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[0],
  ).toBeCloseTo(100);
  expect(errors).toEqual([]);
});

test('Escape cancels the preview and a later pointer release does not commit it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.mouse.move(80, 125);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
    .toBe(true);
  await page.mouse.move(80, 145);
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    (await page.evaluate(() => window.gizmoTest.state())).translation[1],
  ).toBeCloseTo(100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => window.gizmoTest.settle());
  const result = await page.evaluate(() => window.gizmoTest.state());
  expect(result.node.y).toBe(60);
  expect(result.translation[1]).toBeCloseTo(80);
  expect(result.dragging).toBe(false);
  expect(errors).toEqual([]);
});
