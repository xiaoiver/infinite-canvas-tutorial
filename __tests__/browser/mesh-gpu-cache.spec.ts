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
      // A visible surface should retain its fill under the default lights.
      if (g > 70 && g > r * 1.4 && g > b * 1.4) green++;
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
      if (g > 70 && g > r * 1.4 && g > b * 1.4) darkGreen++;
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
      if (g > 70 && g > r * 1.4 && g > b * 1.4) restoredGreen++;
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

test('orbits a multi-Path isometric scene without rebuilding extrusion geometry', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?appCamera&width=640&height=400');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const ids = Array.from({ length: 12 }, (_, i) => `path-${i}`);
    await api.edit((editor) => {
      editor.replaceDocument(
        ids.map((id, i) => ({
          id,
          type: 'path' as const,
          zIndex: i,
          x: 90 + (i % 4) * 75,
          y: 70 + Math.floor(i / 4) * 75,
          d: 'M0 0 H36 V36 H0 Z M10 10 H26 V26 H10 Z',
          fillRule: 'evenodd' as const,
          fills: [{ type: 'solid' as const, value: '#dd8833' }],
          extrude3d: { depth: 24, z: 0 },
        })),
        'remote',
      );
      editor.setCamera3D({
        preset: 'isometric',
        center: [200, 150, 0],
        distance: 500,
        orthographicHeight: 300,
      });
    });
    await window.gizmoTest.settle();
    const baseline = ids.map((id) => window.gizmoTest.meshGeometry(id));
    const initialEye = window.gizmoTest.camera3DState().eye;
    window.gizmoTest.trackGeometryUploads();
    const frameBoundaryMs: number[] = [];
    let stable = true;
    const center: [number, number, number] = [200, 150, 0];
    const elevation = Math.atan(1 / Math.sqrt(2));
    for (let i = 0; i < 10; i++) {
      const azimuth = (25 + i * 5) * (Math.PI / 180);
      api.setCamera3D({
        projection: 'orthographic',
        center,
        eye: [
          center[0] + 500 * Math.cos(elevation) * Math.cos(azimuth),
          center[1] + 500 * Math.cos(elevation) * Math.sin(azimuth),
          center[2] + 500 * Math.sin(elevation),
        ],
        up: [0, 0, 1],
        orthographicHeight: 300,
      });
      const start = performance.now();
      await window.gizmoTest.frame();
      frameBoundaryMs.push(performance.now() - start);
      stable &&= ids.every((id, index) =>
        window.gizmoTest
          .meshGeometry(id)
          .every((array, component) => array === baseline[index][component]),
      );
    }
    await window.gizmoTest.settle();
    stable &&= ids.every((id, index) =>
      window.gizmoTest
        .meshGeometry(id)
        .every((array, component) => array === baseline[index][component]),
    );
    return {
      paths: ids.length,
      cameraMoved: window.gizmoTest
        .camera3DState()
        .eye.some((value, axis) => value !== initialEye[axis]),
      geometryStable: stable,
      geometryUploads: window.gizmoTest.geometryUploads(ids),
      frameBoundaryMs,
    };
  });
  await testInfo.attach('isometric-camera-frame-boundaries.json', {
    body: Buffer.from(JSON.stringify(result, null, 2)),
    contentType: 'application/json',
  });
  expect(result.paths).toBe(12);
  expect(result.cameraMoved).toBe(true);
  expect(result.geometryStable).toBe(true);
  expect(result.geometryUploads).toBe(0);
  expect(result.frameBoundaryMs).toHaveLength(10);
  expect(
    result.frameBoundaryMs.every((ms) => Number.isFinite(ms) && ms > 0),
  ).toBe(true);
  expect(errors).toEqual([]);
});
