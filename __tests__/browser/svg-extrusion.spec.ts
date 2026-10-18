import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

function glbJson(bytes: number[]) {
  const buffer = Uint8Array.from(bytes);
  const view = new DataView(buffer.buffer);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(buffer.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  return JSON.parse(
    new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)),
  );
}

test('App linked 3D camera renders an imported SVG extrusion', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/gizmo.html?extrudePath&appCamera&width=800&height=800&zoom=0.35',
  );
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(() => window.gizmoTest.svgExtrusionState().triangles),
  ).toBeGreaterThan(0);
  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 70) teal++;
  }
  expect(teal).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('App SVG import, extrusion editing and GLB export work together', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(() =>
    window.gizmoTest.importAndExportSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"
      viewBox="0 0 200 100"><g fill="#33aabb">
      <path d="M60 20 H140 V80 H60 Z M80 40 H120 V60 H80 Z" fill-rule="evenodd"/>
      <path d="M10 10 L30 30" fill="none" stroke="black"/>
      </g></svg>`),
  );
  const extruded = result.nodes.filter(
    (node) => 'extrude3d' in node && node.extrude3d,
  );
  expect(extruded).toHaveLength(1);
  expect(extruded[0]).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    extrude3d: {
      depth: 32,
      bevelSize: 3,
      bevelSegments: 4,
      sideColor: '#ff00ff',
    },
  });
  expect(result.nodes.filter((node) => node.type === 'path')).toHaveLength(2);
  const initial = glbJson(result.initialGlb);
  const edited = glbJson(result.editedGlb);
  expect(initial.meshes).toHaveLength(1);
  expect(edited.meshes).toHaveLength(1);
  expect(edited.meshes[0].primitives).toHaveLength(2);
  expect(
    edited.materials.some(
      (material: { pbrMetallicRoughness: { baseColorFactor: number[] } }) =>
        material.pbrMetallicRoughness.baseColorFactor[0] > 0.9 &&
        material.pbrMetallicRoughness.baseColorFactor[1] < 0.1,
    ),
  ).toBe(true);
  expect(result.editedGlb.length).toBeGreaterThan(result.initialGlb.length);
  expect(errors).toEqual([]);
});

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

test('switching an SVG extrusion from straight to rounded bevel updates its rendered mesh', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const profile = async (bevelSegments: number) =>
    page.evaluate(async (segments) => {
      const api = window.gizmoTest.api();
      await api.edit((editor) => {
        editor.selectNodes([]);
        editor.updateNode(editor.getNodeById('model'), {
          extrude3d: {
            depth: 20,
            bevelSize: 4,
            bevelSegments: segments,
            rotation: [0.6, -0.5, 0],
            sideColor: '#ff00ff',
          },
        });
      });
      await window.gizmoTest.settle();
      return window.gizmoTest.svgExtrusionState().triangles;
    }, bevelSegments);

  const straight = await profile(1);
  const straightPixels = PNG.sync.read(
    await page.locator('#canvas').screenshot(),
  );
  const rounded = await profile(4);
  const roundedPixels = PNG.sync.read(
    await page.locator('#canvas').screenshot(),
  );
  expect(rounded).toBeGreaterThan(straight);

  let magenta = 0;
  let changed = 0;
  for (let i = 0; i < roundedPixels.data.length; i += 4) {
    const [r, g, b] = roundedPixels.data.subarray(i, i + 3);
    if (r > g * 1.4 && b > g * 1.4 && r > 40 && b > 40) magenta++;
    if (
      Math.max(
        Math.abs(r - straightPixels.data[i]),
        Math.abs(g - straightPixels.data[i + 1]),
        Math.abs(b - straightPixels.data[i + 2]),
      ) > 20
    )
      changed++;
  }
  expect(magenta).toBeGreaterThan(20);
  expect(changed).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
