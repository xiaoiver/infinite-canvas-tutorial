import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type {} from './fixtures/ecs-blend';
import type { ThemeMode, TesselationMethod } from '../../packages/ecs/src';

test('repaints inherited group color and fill rules through theme switches, overrides and undo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(
      () =>
        api.setAppState({
          themeMode: 'light' as ThemeMode,
          variables: {
            paint: {
              type: 'color',
              value: [
                { value: 'red' },
                { value: 'blue', theme: { Mode: 'Dark' } },
              ],
            },
          },
        }),
      { capture: 'NEVER' },
    );
    await window.blendTest.renderNodes([
      {
        id: 'group',
        type: 'g',
        zIndex: 0,
        x: 0,
        y: 0,
        fills: [{ type: 'solid', value: '$paint' }],
      },
      {
        id: 'child',
        type: 'rect',
        parentId: 'group',
        zIndex: 1,
        x: 40,
        y: 40,
        width: 100,
        height: 100,
      },
      {
        id: 'rough',
        type: 'rough-rect',
        parentId: 'group',
        zIndex: 2,
        x: 200,
        y: 40,
        width: 100,
        height: 100,
        roughFillStyle: 'solid',
        roughRoughness: 0,
        roughSeed: 1,
      },
      {
        id: 'rule',
        type: 'path',
        parentId: 'group',
        zIndex: 3,
        d: 'M400 40h100v100h-100Z M430 70h40v40h-40Z',
        // libtess supports both fill rules; Earcut uses contour winding.
        tessellationMethod: 'libtess' as TesselationMethod,
      },
    ]);
    api.clearHistory();
  });
  const pixel = async (x = 40) => {
    await page.evaluate(() => window.blendTest.settle());
    const url = await page
      .locator('#actual')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    const actual = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    return [
      ...actual.data.subarray(
        (40 * actual.width + x) * 4,
        (40 * actual.width + x) * 4 + 4,
      ),
    ];
  };
  expect(await pixel()).toEqual([255, 0, 0, 255]);
  expect(await pixel(120)).toEqual([255, 0, 0, 255]);
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() => api.setAppState({ themeMode: 'dark' as ThemeMode }), {
      capture: 'NEVER',
    });
  });
  expect(await pixel()).toEqual([0, 0, 255, 255]);
  expect(await pixel(120)).toEqual([0, 0, 255, 255]);
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() =>
      api.updateNode(api.getNodeById('child'), {
        fills: [{ type: 'solid', value: 'lime' }],
      }),
    );
  });
  expect(await pixel()).toEqual([0, 255, 0, 255]);
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() =>
      api.updateNode(api.getNodeById('child'), { fills: undefined }),
    );
  });
  expect(await pixel()).toEqual([0, 0, 255, 255]);
  await page.evaluate(() => window.blendTest.api().undo());
  expect(await pixel()).toEqual([0, 255, 0, 255]);
  await page.evaluate(() => window.blendTest.api().redo());
  expect(await pixel()).toEqual([0, 0, 255, 255]);
  expect(await pixel(225)).toEqual([0, 0, 255, 255]);
  await page.evaluate(async () => {
    const api = window.blendTest.api();
    await api.edit(() =>
      api.updateNode(api.getNodeById('group'), { fillRule: 'evenodd' }),
    );
  });
  const background = await pixel(310);
  expect(background).not.toEqual([0, 0, 255, 255]);
  expect(await pixel(225)).toEqual(background);
  await page.evaluate(() => window.blendTest.api().undo());
  expect(await pixel(225)).toEqual([0, 0, 255, 255]);
  expect(errors).toEqual([]);
});
