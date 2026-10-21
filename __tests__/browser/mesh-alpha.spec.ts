import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

const pixel = (png: PNG, x: number, y: number) => [
  ...png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3),
];

test('mesh alpha cutout and camera-depth blend order render in WebGL', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.gizmoTest.settle());
  const canvas = page.locator('#canvas');
  const masked = PNG.sync.read(await canvas.screenshot());
  const left = pixel(masked, 35, 40);
  const right = pixel(masked, 75, 40);
  const glass = pixel(masked, 140, 90);
  expect(Math.abs(left[0] - left[2])).toBeLessThan(10);
  expect(right[0]).toBeGreaterThan(right[2] + 150);
  // Scene order intentionally places the nearer red pane before the farther
  // blue pane. The renderer must still draw blue first.
  expect(glass[0]).toBeGreaterThan(glass[2]);
  expect(glass[2]).toBeGreaterThan(glass[1]);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const mask = api.getNodeById('alpha-mask');
    if (mask.type !== 'mesh3d') throw new Error('Missing mask mesh');
    api.updateNode(
      mask,
      {
        material3d: { ...mask.material3d, alphaMode: 'opaque' },
      },
      false,
    );
    await window.gizmoTest.settle();
  });
  const opaque = PNG.sync.read(await canvas.screenshot());
  const opaqueLeft = pixel(opaque, 35, 40);
  expect(opaqueLeft[0]).toBeLessThan(left[0] - 100);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    api.updateNode(api.getNodeById('alpha-near'), { z: 50 }, false);
    api.updateNode(api.getNodeById('alpha-far'), { z: 0 }, false);
    await window.gizmoTest.settle();
  });
  const swapped = PNG.sync.read(await canvas.screenshot());
  const glassSwapped = pixel(swapped, 140, 90);
  expect(glassSwapped[2]).toBeGreaterThan(glassSwapped[0]);
  expect(errors).toEqual([]);
});

test('GLB export rasterizes an SVG cutout texture and keeps its alpha', async ({
  page,
}) => {
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready');
  const bytes = Uint8Array.from(
    await page.evaluate(async () => {
      const api = window.gizmoTest.api();
      await window.gizmoTest.settle();
      return Array.from(
        await api.exportGlb({
          nodes: [api.getNodeById('alpha-mask')],
          download: false,
        }),
      );
    }),
  );
  const view = new DataView(bytes.buffer);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)),
  );
  expect(json.images).toHaveLength(1);
  expect(json.images[0].mimeType).toBe('image/png');
  expect(json.materials[0].alphaMode).toBe('MASK');
  const imageView = json.bufferViews[json.images[0].bufferView];
  const imageOffset = 20 + jsonLength + 8 + imageView.byteOffset;
  const image = PNG.sync.read(
    Buffer.from(
      bytes.subarray(imageOffset, imageOffset + imageView.byteLength),
    ),
  );
  expect(image.width).toBe(2);
  expect(image.height).toBe(2);
  expect(image.data[3]).toBe(255);
  expect(image.data[7]).toBe(0);
});

test('metallic-roughness texture blue channel changes lit mesh pixels', async ({
  page,
}) => {
  const pbrMap = (metallic: number) => {
    const image = new PNG({ width: 1, height: 1 });
    image.data.set([0, 255, metallic, 255]);
    return `data:image/png;base64,${PNG.sync.write(image).toString('base64')}`;
  };
  const metal = pbrMap(255);
  const dielectric = pbrMap(0);
  await page.goto('/gizmo.html?alpha');
  await expect(page.locator('#status')).toHaveText('Ready');
  const setMap = async (metallicRoughnessMap: string) => {
    await page.evaluate(async (url) => {
      const api = window.gizmoTest.api();
      const mesh = api.getNodeById('alpha-mask');
      if (mesh.type !== 'mesh3d') throw new Error('Missing test mesh');
      api.updateNode(
        mesh,
        {
          material3d: {
            ...mesh.material3d,
            metallic: 1,
            roughness: 0.5,
            metallicRoughnessMap: url,
          },
        },
        false,
      );
      await window.gizmoTest.settle();
    }, metallicRoughnessMap);
  };
  const redPixel = async () =>
    pixel(PNG.sync.read(await page.locator('#canvas').screenshot()), 75, 40);
  await setMap(metal);
  const before = await redPixel();
  await setMap(dielectric);
  await expect
    .poll(async () => (await redPixel())[0] - before[0])
    .toBeGreaterThan(8);
});
