import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';
import type {} from './fixtures/gltf-material-docs';

const pixels = async (page: import('@playwright/test').Page) =>
  PNG.sync.read(await page.locator('#canvas').screenshot()).data;

const difference = (a: Buffer, b: Buffer) => {
  let total = 0;
  for (let i = 0; i < a.length; i += 4)
    total +=
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
  return total;
};

test('Khronos GLB normal and occlusion textures change the rendered material', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?gltfMaterial&width=300&height=270');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  await expect
    .poll(() =>
      page.evaluate(() => window.gizmoTest.materialGeometryVertices()),
    )
    .toBeGreaterThan(1000);
  await page.evaluate(() => window.gizmoTest.settle());
  const features = () =>
    page.evaluate(() => window.gizmoTest.materialFeatures());
  await expect.poll(features).toMatchObject({
    normalMap: true,
    normalTextureStatus: 'ready',
    occlusionMap: true,
    occlusionTextureStatus: 'ready',
  });
  const setMaterial = async (material3d: Record<string, unknown>) => {
    await page.evaluate(async (material) => {
      const api = window.gizmoTest.api();
      api.updateNode(
        api.getNodeById('material-model'),
        { material3d: material },
        false,
      );
      await window.gizmoTest.settle();
    }, material3d);
  };
  await setMaterial({ normalScale: 0 });
  await expect.poll(features).toMatchObject({ normalScale: 0 });
  const flat = await pixels(page);
  await setMaterial({ normalScale: 1 });
  await expect.poll(features).toMatchObject({
    normalMap: true,
    normalScale: 1,
    normalTextureStatus: 'ready',
  });
  await expect
    .poll(async () => difference(flat, await pixels(page)), { timeout: 20000 })
    .toBeGreaterThan(10000);
  const full = await pixels(page);
  await setMaterial({ normalMap: null });
  await expect.poll(features).toMatchObject({ normalMap: false });
  await expect
    .poll(async () => difference(full, await pixels(page)), { timeout: 20000 })
    .toBeGreaterThan(10000);
  const noNormal = await pixels(page);
  await setMaterial({ normalMap: null, occlusionMap: null });
  await expect.poll(features).toMatchObject({
    normalMap: false,
    occlusionMap: false,
  });
  await expect
    .poll(async () => difference(noNormal, await pixels(page)), {
      timeout: 20000,
    })
    .toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test('authored tangent handedness changes normal-map lighting', async ({
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
  const luminance = (cssX: number, cssY: number) => {
    const x = Math.round((cssX / 300) * png.width);
    const y = Math.round((cssY / 190) * png.height);
    const offset = (y * png.width + x) * 4;
    return png.data[offset] + png.data[offset + 1] + png.data[offset + 2];
  };
  expect(luminance(85, 95)).toBeGreaterThan(luminance(215, 95) + 60);
});

test('imported COLOR_0 colors shade an unlit mesh', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?gltfColor&width=300&height=190');
  await expect(page.locator('#status')).toHaveText('Ready', {
    timeout: 20000,
  });
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.colorState()))
    .toEqual([16, 16]);
  await page.evaluate(() => window.gizmoTest.settle());
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const color = (x: number, y: number) => {
    const px = Math.round((x / 300) * png.width);
    const py = Math.round((y / 190) * png.height);
    const offset = (py * png.width + px) * 4;
    return Array.from(png.data.subarray(offset, offset + 3));
  };
  const left = color(85, 95);
  const right = color(215, 95);
  expect(errors).toEqual([]);
  expect(left[0]).toBeGreaterThan(left[2] + 100);
  expect(right[2]).toBeGreaterThan(right[0] + 100);
});

test('the documented normalized COLOR_0 asset loads and renders', async ({
  page,
}) => {
  await page.goto('/gizmo.html?gltfColorAsset&width=300&height=190');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => window.gizmoTest.colorAssetState()))
    .toEqual([1, Math.fround(48 / 255), Math.fround(48 / 255), 1]);
  await page.evaluate(() => window.gizmoTest.settle());
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const x = Math.round((85 / 300) * png.width);
  const y = Math.round((95 / 190) * png.height);
  const offset = (y * png.width + x) * 4;
  const rgb = png.data.subarray(offset, offset + 3);
  expect(Math.max(...rgb) - Math.min(...rgb)).toBeGreaterThan(25);
});

test('double-sided material draws the back of a plane', async ({ page }) => {
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 20000 });
  const setDoubleSided = async (doubleSided: boolean) => {
    await page.evaluate(async (enabled) => {
      const api = window.gizmoTest.api();
      const mesh = api.getNodeById('alpha-mask');
      if (mesh.type !== 'mesh3d') throw new Error('Missing test plane');
      api.updateNode(
        mesh,
        {
          rotation3d: [0, 0, 0],
          material3d: { baseColor: '#ff0000', map: null, doubleSided: enabled },
        },
        false,
      );
      await window.gizmoTest.settle();
    }, doubleSided);
  };
  await setDoubleSided(false);
  const culled = await pixels(page);
  await setDoubleSided(true);
  const visible = await pixels(page);
  expect(difference(culled, visible)).toBeGreaterThan(5000);
});

test('documentation controls toggle imported material features', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gltf-material-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.gltfMaterialDocs?.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  const material = () =>
    page.evaluate(() => window.gltfMaterialDocs.material());
  expect(await material()).toMatchObject({ doubleSided: true });
  expect((await material()).normalMap).toMatch(/^data:image\/png;base64,/);
  expect((await material()).occlusionMap).toMatch(/^data:image\/png;base64,/);
  await page.getByLabel('Normal map').uncheck();
  await page.evaluate(() => window.gltfMaterialDocs.settle());
  await expect.poll(async () => (await material()).normalMap).toBeNull();
  await page.getByLabel('Occlusion').uncheck();
  await page.evaluate(() => window.gltfMaterialDocs.settle());
  await expect.poll(async () => (await material()).occlusionMap).toBeNull();
  await page.getByLabel('Double sided').uncheck();
  await page.evaluate(() => window.gltfMaterialDocs.settle());
  await expect.poll(async () => (await material()).doubleSided).toBe(false);
  await page.getByLabel('Normal map').check();
  await page.evaluate(() => window.gltfMaterialDocs.settle());
  await expect
    .poll(async () => (await material()).normalMap)
    .toMatch(/^data:image\/png;base64,/);
  await page.evaluate(() => window.gltfMaterialDocs.unmount());
  expect(errors).toEqual([]);
});
