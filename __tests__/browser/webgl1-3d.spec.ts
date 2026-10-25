import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';
import type {} from './fixtures/isometric-docs';

test.describe.configure({ timeout: 60000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (kind === 'webgl2') return null;
      return getContext.call(this, kind, ...args);
    } as typeof getContext;
  });
});

const difference = (a: Buffer, b: Buffer) => {
  let total = 0;
  for (let i = 0; i < a.length; i += 4)
    for (let channel = 0; channel < 3; channel++)
      total += Math.abs(a[i + channel] - b[i + channel]);
  return total;
};

test('WebGL1 draws depth-tested outlines in the isometric example', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  const canvas = page.locator('ic-spectrum-canvas');
  const before = PNG.sync.read(await canvas.screenshot()).data;
  await page.getByRole('button', { name: '显示轮廓' }).click();
  await page.evaluate(() => window.isometricDocs.settle());
  const after = PNG.sync.read(await canvas.screenshot()).data;
  expect(difference(before, after)).toBeGreaterThan(5000);
  await page.getByRole('button', { name: '边缘光' }).click();
  await page.evaluate(() => window.isometricDocs.settle());
  const rim = PNG.sync.read(await canvas.screenshot()).data;
  expect(difference(after, rim)).toBeGreaterThan(5000);
  expect(errors).toEqual([]);
});

test('WebGL1 renders imported vertex colors without shader errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/gizmo.html?gltfColor&width=300&height=190');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.colorState()), {
      timeout: 20000,
    })
    .toEqual([16, 16]);
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
      const gl = canvas.getContext('webgl')!;
      return gl.getParameter(gl.VERSION);
    }),
  ).toContain('WebGL 1.0');
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const pixel = (cssX: number, cssY: number) => {
    const x = Math.round((cssX / 300) * png.width);
    const y = Math.round((cssY / 190) * png.height);
    return png.data.subarray(
      (y * png.width + x) * 4,
      (y * png.width + x) * 4 + 3,
    );
  };
  const red = pixel(85, 95),
    blue = pixel(215, 95);
  expect(errors).toEqual([]);
  expect(red[0]).toBeGreaterThan(red[2] + 100);
  expect(blue[2]).toBeGreaterThan(blue[0] + 100);
});

test('WebGL1 evaluates multiple lights and both directional and point shadow slots', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) =>
      editor.updateNodes([
        {
          id: 'second-shadow',
          type: 'light3d',
          zIndex: 6,
          lightType: 'point',
          x: 35,
          y: 50,
          z: -80,
          intensity: 1.5,
          range: 500,
          castShadow: true,
        },
      ]),
    );
    await window.gizmoTest.settle();
  });
  const pixels = async () =>
    PNG.sync.read(await page.locator('#canvas').screenshot()).data;
  const shadows = await pixels();
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('alpha-sun'), { castShadow: false }),
    );
    await window.gizmoTest.settle();
  });
  const pointShadow = await pixels();
  expect(difference(shadows, pointShadow)).toBeGreaterThan(100);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.updateNode(editor.getNodeById('second-shadow'), {
        castShadow: false,
      });
    });
    await window.gizmoTest.settle();
  });
  const noShadows = await pixels();
  expect(difference(pointShadow, noShadows)).toBeGreaterThan(100);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.updateNode(editor.getNodeById('alpha-sun'), { intensity: 0 });
      editor.updateNode(editor.getNodeById('second-shadow'), { intensity: 0 });
    });
    await window.gizmoTest.settle();
  });
  expect(difference(noShadows, await pixels())).toBeGreaterThan(10000);
  expect(errors).toEqual([]);
});

test('WebGL1 uses authored tangent handedness for normal-map lighting', async ({
  page,
}) => {
  await page.goto('/gizmo.html?gltfTangent&width=300&height=190');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.tangentState()), {
      timeout: 20000,
    })
    .toMatchObject([
      { vertices: 4, handedness: 1, normalTextureStatus: 'ready' },
      { vertices: 4, handedness: -1, normalTextureStatus: 'ready' },
    ]);
  await page.evaluate(() => window.gizmoTest.settle());
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const luminance = (cssX: number) => {
    const x = Math.round((cssX / 300) * png.width);
    const y = Math.round((95 / 190) * png.height);
    const offset = (y * png.width + x) * 4;
    return png.data[offset] + png.data[offset + 1] + png.data[offset + 2];
  };
  expect(luminance(85)).toBeGreaterThan(luminance(215) + 60);
});
