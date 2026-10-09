import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/ecs-blend';

test('repaints rough parameter edits and restores the same pixels through undo and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    await window.blendTest.renderNodes([
      {
        id: 'rough',
        type: 'rough-rect',
        zIndex: 0,
        x: 80,
        y: 60,
        width: 360,
        height: 160,
        fills: [{ type: 'solid', value: 'red' }],
        strokes: [{ type: 'solid', value: 'black' }],
        strokeWidth: 4,
        roughSeed: 7,
        roughRoughness: 0,
      },
    ]);
    window.blendTest.api().clearHistory();
  });
  const pixels = async () => {
    await page.evaluate(() => window.blendTest.settle());
    const url = await page
      .locator('#actual')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    return PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')).data;
  };
  const before = await pixels();
  expect(before.some((value, index) => index % 4 === 3 && value > 0)).toBe(
    true,
  );
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() =>
      api.updateNode(api.getNodeById('rough'), { roughRoughness: 4 }),
    );
  });
  const after = await pixels();
  expect(after.equals(before)).toBe(false);
  await page.evaluate(() => window.blendTest.api().undo());
  expect((await pixels()).equals(before)).toBe(true);
  await page.evaluate(() => window.blendTest.api().redo());
  expect((await pixels()).equals(after)).toBe(true);
  await page.evaluate(async () => {
    await window.blendTest.renderNodes(
      structuredClone(window.blendTest.api().getNodes()),
    );
  });
  expect((await pixels()).equals(after)).toBe(true);
  expect(errors).toEqual([]);
});
