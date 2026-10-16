import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

test('an imported SVG hole produces a visible 3D companion and restores its 2D source', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const before = await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const state = window.gizmoTest.svgExtrusionState();
    await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
    await window.gizmoTest.settle();
    return state;
  });
  expect(before).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    depth: 20,
  });
  expect(before.triangles).toBeGreaterThan(0);
  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 70) teal++;
  }
  expect(teal).toBeGreaterThan(100);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), { extrude3d: false }),
    );
    await window.gizmoTest.settle();
  });
  expect(
    await page.evaluate(() => {
      const node = window.gizmoTest.api().getNodeById('model');
      return 'extrude3d' in node ? node.extrude3d : undefined;
    }),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('an SVG ellipse renders its curved extrusion mesh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePrimitive');
  await expect(page.locator('#status')).toHaveText('Ready');
  const state = await page.evaluate(() => window.gizmoTest.svgExtrusionState());
  expect(state).toMatchObject({ type: 'path', depth: 20 });
  expect(state.triangles).toBeGreaterThan(20);

  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 20) teal++;
  }
  expect(teal).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('side color paints only the walls without rebuilding SVG geometry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const uploads = await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
    await window.gizmoTest.settle();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        extrude3d: { depth: 20, rotation: [0.6, -0.5, 0] },
      }),
    );
    await window.gizmoTest.settle();
    window.gizmoTest.trackGeometryUploads();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        extrude3d: {
          depth: 20,
          rotation: [0.6, -0.5, 0],
          sideColor: '#ff00ff',
        },
      }),
    );
    await window.gizmoTest.settle();
    return window.gizmoTest.geometryUploads();
  });
  expect(uploads).toBe(0);

  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let magenta = 0;
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (r > g * 1.4 && b > g * 1.4 && r > 40 && b > 40) magenta++;
    if (g > r * 1.3 && b > r * 1.3 && g > 40) teal++;
  }
  expect(magenta).toBeGreaterThan(20);
  expect(teal).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
