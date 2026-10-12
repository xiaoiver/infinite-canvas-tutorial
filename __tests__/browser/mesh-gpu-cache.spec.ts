import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

for (const extrude of [false, true]) {
  test(`reuses ${
    extrude ? 'extrusion' : 'mesh'
  } geometry while rendering changed pose and material`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/gizmo.html${extrude ? '?extrude' : ''}`);
    await expect(page.locator('#status')).toHaveText('Ready');
    await page.evaluate(async () => {
      window.gizmoTest.resetDerivedUpdates();
      await window.gizmoTest.settle();
    });
    expect(
      await page.evaluate(() => window.gizmoTest.derivedUpdates()),
    ).toEqual({
      modelUploads: 0,
      sceneUploads: 0,
      meshBindings: 0,
      layerScans: 0,
    });
    await page.evaluate(async (extrude) => {
      window.gizmoTest.trackGeometryUploads();
      const api = window.gizmoTest.api();
      for (let i = 0; i < 4; i++) {
        await api.edit((editor) =>
          editor.updateNode(
            editor.getNodeById('model'),
            extrude
              ? { x: 60 + i * 3, extrude3d: { depth: 20 + i, z: 10 + i } }
              : { z: i * 3, rotation3d: [0, i * 0.1, 0] },
          ),
        );
      }
      await api.edit((editor) =>
        editor.updateNode(
          editor.getNodeById('model'),
          extrude
            ? { fills: [{ type: 'solid', value: '#00ff00' }] }
            : { material3d: { baseColor: '#00ff00' } },
        ),
      );
      // Exclude the green Y handle from the pixel assertion below.
      await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
      await window.gizmoTest.settle();
    }, extrude);
    expect(await page.evaluate(() => window.gizmoTest.geometryUploads())).toBe(
      0,
    );
    expect(
      (await page.evaluate(() => window.gizmoTest.derivedUpdates()))
        .modelUploads,
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => window.gizmoTest.derivedUpdates()),
    ).toMatchObject({ sceneUploads: 0, meshBindings: 0 });
    await page.evaluate(async () => {
      const api = window.gizmoTest.api();
      await api.edit((editor) =>
        editor.updateNode(editor.getNodeById('model'), {
          name: 'Renamed mesh',
        }),
      );
      await window.gizmoTest.settle();
      window.gizmoTest.resetDerivedUpdates();
      await api.edit(
        (editor) => editor.gotoLandmark({ x: 1, y: 1 }, { duration: 0 }),
        { capture: 'NEVER' },
      );
      await window.gizmoTest.settle();
    });
    const panUpdates = await page.evaluate(() =>
      window.gizmoTest.derivedUpdates(),
    );
    expect(panUpdates).toMatchObject({
      modelUploads: 0,
      meshBindings: 0,
      layerScans: 0,
    });
    expect(panUpdates.sceneUploads).toBeGreaterThan(0);
    await page.evaluate(async () => {
      window.gizmoTest.resetDerivedUpdates();
      await window.gizmoTest.settle();
    });
    expect(
      await page.evaluate(() => window.gizmoTest.derivedUpdates()),
    ).toEqual({
      modelUploads: 0,
      sceneUploads: 0,
      meshBindings: 0,
      layerScans: 0,
    });
    expect(
      await page.evaluate(
        () => window.gizmoTest.api().getMesh3DLayers()[0].name,
      ),
    ).toBe('Renamed mesh');
    await page.evaluate(async () => {
      const api = window.gizmoTest.api();
      await api.edit((editor) => editor.selectMesh3DLayer('model'), {
        capture: 'NEVER',
      });
      await window.gizmoTest.settle();
    });
    expect(
      await page.evaluate(() =>
        window.gizmoTest.api().getSelectedMesh3DLayerIds(),
      ),
    ).toEqual(['model']);
    await page.evaluate(async () => {
      await window.gizmoTest
        .api()
        .edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
      await window.gizmoTest.settle();
    });
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    let green = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const [r, g, b] = png.data.subarray(i, i + 3);
      // Extrusion faces may receive only the default ambient light.
      if (g > 20 && g > r * 1.4 && g > b * 1.4) green++;
    }
    expect(green).toBeGreaterThan(100);
    await page.evaluate(async () => {
      window.gizmoTest.resetDerivedUpdates();
      await window.gizmoTest.api().edit((editor) =>
        editor.updateNodes([
          {
            id: 'ambient',
            type: 'light3d',
            lightType: 'ambient',
            zIndex: 1,
            x: 0,
            y: 0,
            intensity: 0,
          },
          {
            id: 'directional',
            type: 'light3d',
            lightType: 'directional',
            zIndex: 2,
            x: 0,
            y: 0,
            intensity: 0,
          },
        ]),
      );
      await window.gizmoTest.settle();
    });
    const dark = PNG.sync.read(await page.locator('#canvas').screenshot());
    let darkGreen = 0;
    for (let i = 0; i < dark.data.length; i += 4) {
      const [r, g, b] = dark.data.subarray(i, i + 3);
      if (g > 20 && g > r * 1.4 && g > b * 1.4) darkGreen++;
    }
    expect(darkGreen).toBe(0);
    const lightingUpdates = await page.evaluate(() =>
      window.gizmoTest.derivedUpdates(),
    );
    expect(lightingUpdates.sceneUploads).toBeGreaterThan(0);
    expect(lightingUpdates).toMatchObject({ modelUploads: 0, meshBindings: 0 });
    await page.evaluate(async () => {
      const api = window.gizmoTest.api();
      await api.edit((editor) =>
        editor.deleteNodesById(['ambient', 'directional']),
      );
      await window.gizmoTest.settle();
    });
    const restored = PNG.sync.read(await page.locator('#canvas').screenshot());
    let restoredGreen = 0;
    for (let i = 0; i < restored.data.length; i += 4) {
      const [r, g, b] = restored.data.subarray(i, i + 3);
      if (g > 20 && g > r * 1.4 && g > b * 1.4) restoredGreen++;
    }
    expect(restoredGreen).toBeGreaterThan(100);
    if (!extrude) {
      await page.evaluate(async () => {
        window.gizmoTest.resetDerivedUpdates();
        const api = window.gizmoTest.api();
        await api.edit((editor) =>
          editor.updateNode(editor.getNodeById('model'), {
            geometry: 'sphere',
          }),
        );
        await window.gizmoTest.settle();
      });
      expect(
        await page.evaluate(() => window.gizmoTest.geometryUploads()),
      ).toBe(4);
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        await page.evaluate(() => window.gizmoTest.geometryUploads()),
      ).toBe(4);
    }
    expect(
      await page.evaluate(() => window.gizmoTest.derivedUpdates()),
    ).toMatchObject({ meshBindings: extrude ? 0 : 1 });
    expect(errors).toEqual([]);
  });
}
