import { expect, test } from '@playwright/test';
import type {} from './fixtures/gizmo';

test('Shift marquee over the ground selects projected meshes while dragging', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?appCamera');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.replaceDocument(
        [
          {
            id: 'flat',
            type: 'rect',
            zIndex: 0,
            x: 0,
            y: 0,
            width: 200,
            height: 200,
          },
          {
            id: 'ground',
            type: 'mesh3d',
            zIndex: 1,
            geometry: { type: 'plane' },
            x: 0,
            y: 0,
            z: -50,
            width: 200,
            height: 200,
            scale3d: [200, 200, 1],
          },
          {
            id: 'cube',
            type: 'mesh3d',
            zIndex: 2,
            geometry: { type: 'cube' },
            x: 55,
            y: 75,
            width: 30,
            height: 30,
            scale3d: 30,
          },
        ],
        'remote',
      );
      editor.setCamera3D({
        preset: 'isometric',
        center: [100, 100, 0],
        distance: 500,
        orthographicHeight: 200,
      });
    });
    await window.gizmoTest.settle();
  });
  const bounds = await page.evaluate(() =>
    window.gizmoTest.projectedBounds('cube'),
  );
  expect(bounds).not.toBeNull();
  const left = Math.floor(bounds!.minX - 4);
  const top = Math.floor(bounds!.minY - 4);
  const right = Math.ceil(bounds!.maxX + 4);
  const bottom = Math.ceil(bounds!.maxY + 4);
  expect(
    [left, top, right, bottom].every((value) => value >= 0 && value <= 200),
  ).toBe(true);

  await page.keyboard.down('Shift');
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 4 });
  await expect
    .poll(async () => {
      await page.evaluate(() => window.gizmoTest.settle());
      return page.evaluate(() =>
        window.gizmoTest.api().getSelectedMesh3DLayerIds(),
      );
    })
    .toEqual(['cube']);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.evaluate(() => window.gizmoTest.settle());
  expect(
    await page.evaluate(() =>
      window.gizmoTest.api().getSelectedMesh3DLayerIds(),
    ),
  ).toEqual(['cube']);
  expect(
    await page.evaluate(
      () => window.gizmoTest.api().getAppState().layersSelected,
    ),
  ).toEqual(['cube']);
  expect(errors).toEqual([]);
});
