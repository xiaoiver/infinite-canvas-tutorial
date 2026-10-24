import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/gizmo';

test.setTimeout(60000);

async function setupScene(page: import('@playwright/test').Page) {
  await page.goto('/gizmo.html?appCamera&width=400&height=300');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.replaceDocument(
        [
          {
            id: 'floor',
            type: 'mesh3d',
            zIndex: 0,
            geometry: { type: 'plane' },
            x: 200,
            y: 150,
            z: -50,
            width: 320,
            height: 260,
            scale3d: [320, 260, 1],
            material3d: {
              baseColor: '#e6ebef',
              roughness: 1,
              castShadow: false,
              receiveShadow: true,
            },
          },
          {
            id: 'cube',
            type: 'mesh3d',
            zIndex: 1,
            geometry: { type: 'cube' },
            x: 125,
            y: 115,
            z: 0,
            width: 70,
            height: 70,
            scale3d: 70,
            material3d: {
              baseColor: '#4774df',
              roughness: 0.8,
              castShadow: true,
            },
          },
          {
            id: 'ring',
            type: 'path',
            zIndex: 2,
            d: 'M0 0H70V70H0ZM20 20H50V50H20Z',
            x: 255,
            y: 145,
            fills: [{ type: 'solid', value: '#ee9950' }],
            fillRule: 'evenodd',
            extrude3d: { depth: 30, z: 0 },
          },
          {
            id: 'ambient',
            type: 'light3d',
            zIndex: 3,
            lightType: 'ambient',
            intensity: 0.7,
          },
          {
            id: 'sun',
            type: 'light3d',
            zIndex: 4,
            lightType: 'directional',
            direction: [0.5, 0.4, -1],
            intensity: 1.5,
            castShadow: true,
          },
        ],
        'remote',
      );
      editor.setCamera3D({
        preset: 'isometric',
        center: [200, 150, 0],
        distance: 600,
        orthographicHeight: 300,
        clearColor: false,
      });
    });
    await window.gizmoTest.settle();
  });
}

function colorCounts(png: PNG) {
  let blue = 0;
  let orange = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const [r, g, b, a] = png.data.subarray(offset, offset + 4);
    if (a < 200) continue;
    if (b > 80 && b > r * 1.2 && b > g * 1.15) blue++;
    if (r > 100 && r > g * 1.15 && g > b * 1.5) orange++;
  }
  return { blue, orange };
}

function rgbDifference(a: PNG, b: PNG) {
  let total = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel++) {
      total += Math.abs(a.data[offset + channel] - b.data[offset + channel]);
    }
  }
  return total;
}

test('isometric and dimetric views keep lit cube and extruded Path visible', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setupScene(page);
  const screenshot = async () =>
    PNG.sync.read(await page.locator('#canvas').screenshot());
  const initial = colorCounts(await screenshot());
  expect(initial.blue).toBeGreaterThan(200);
  expect(initial.orange).toBeGreaterThan(200);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit(
      (editor) =>
        editor.setCamera3D({
          preset: 'dimetric-2-1',
          center: [200, 150, 0],
          distance: 600,
          orthographicHeight: 240,
          clearColor: false,
        }),
      { capture: 'NEVER' },
    );
    await window.gizmoTest.settle();
  });
  const withShadow = await screenshot();
  const changed = colorCounts(withShadow);
  expect(changed.blue).toBeGreaterThan(200);
  expect(changed.orange).toBeGreaterThan(200);
  expect(changed.blue).toBeGreaterThan(initial.blue * 1.1);
  expect(changed.orange).toBeGreaterThan(initial.orange * 1.1);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('sun'), { castShadow: false }),
    );
    await window.gizmoTest.settle();
  });
  expect(rgbDifference(withShadow, await screenshot())).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('camera changes only upload scene uniforms for multiple extruded paths', async ({
  page,
}) => {
  await setupScene(page);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      for (let index = 0; index < 4; index++) {
        editor.updateNode({
          id: `extra-path-${index}`,
          type: 'path',
          zIndex: 5 + index,
          d: 'M0 0H30V30H0Z',
          x: 50 + index * 45,
          y: 230,
          fills: [{ type: 'solid', value: '#52a894' }],
          extrude3d: 18,
        });
      }
    });
    await window.gizmoTest.settle();
    window.gizmoTest.trackGeometryUploads();
    window.gizmoTest.resetDerivedUpdates();
    await api.edit(
      (editor) =>
        editor.setCamera3D({
          preset: 'dimetric-2-1',
          center: [200, 150, 0],
          distance: 600,
          orthographicHeight: 240,
          clearColor: false,
        }),
      { capture: 'NEVER' },
    );
    await window.gizmoTest.settle();
  });
  expect(
    await page.evaluate(() =>
      window.gizmoTest.geometryUploads([
        'ring',
        'extra-path-0',
        'extra-path-1',
        'extra-path-2',
        'extra-path-3',
      ]),
    ),
  ).toBe(0);
  expect(
    await page.evaluate(() => window.gizmoTest.derivedUpdates()),
  ).toMatchObject({ modelUploads: 0, meshBindings: 0 });
  expect(
    (await page.evaluate(() => window.gizmoTest.derivedUpdates())).sceneUploads,
  ).toBeGreaterThan(0);
});
