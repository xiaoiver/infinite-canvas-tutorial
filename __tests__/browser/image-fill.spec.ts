import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type { SerializedNode } from '../../packages/ecs/src';
import type {} from './fixtures/ecs-blend';

const png = new PNG({ width: 2, height: 1 });
png.data.set([220, 60, 30, 255, 25, 90, 220, 255]);
const image = PNG.sync.write(png);
const dataUrl = `data:image/png;base64,${image.toString('base64')}`;

test('shares a high-resolution SVG source across cover and contain fills without baking either crop', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const source =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><path fill="red" d="M0 0h5v10H0z"/><path fill="lime" d="M5 0h5v10H5z"/><path fill="blue" d="M10 0h5v10h-5z"/><path fill="yellow" d="M15 0h5v10h-5z"/></svg>',
    );
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async (value) => {
    await window.blendTest.renderNodes([
      {
        id: 'cover',
        type: 'rect',
        x: 40,
        y: 40,
        width: 160,
        height: 160,
        zIndex: 0,
        fills: [
          {
            type: 'image',
            value,
            objectFit: 'cover',
            objectPosition: 'left top',
          },
        ],
      },
      {
        id: 'contain',
        type: 'path',
        d: 'M280 40h160v160H280Z',
        zIndex: 1,
        fills: [{ type: 'image', value, objectFit: 'contain' }],
      },
    ]);
  }, source);
  const dpr = await page.evaluate(() => Math.max(1, devicePixelRatio));
  await expect
    .poll(() =>
      page.evaluate((value) => window.blendTest.imageRasterSize(value), source),
    )
    .toEqual([320 * dpr, 160 * dpr]);
  await page.evaluate(() => window.blendTest.settle());
  const pixels = await page
    .locator('#actual')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const actual = PNG.sync.read(Buffer.from(pixels.split(',')[1], 'base64'));
  const at = (x: number, y: number) => [
    ...actual.data.subarray(
      (y * actual.width + x) * 4,
      (y * actual.width + x) * 4 + 4,
    ),
  ];
  expect(at(35, 60)).toEqual([255, 0, 0, 255]);
  expect(at(85, 60)).toEqual([0, 255, 0, 255]);
  expect([150, 170, 190, 210].map((x) => at(x, 60))).toEqual([
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
  ]);
  expect(at(160, 25)[3]).toBe(0);
  expect(at(160, 95)[3]).toBe(0);
  expect(errors).toEqual([]);
});

for (const kind of ['rect', 'path'] as const) {
  test(`${kind} renders migrated image fills on load and after an edit`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let releaseImage!: () => void;
    const imageReady = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    await page.route('**/legacy-image.png', (route) =>
      imageReady.then(() =>
        route.fulfill({
          contentType: 'image/png',
          body: image,
        }),
      ),
    );
    await page.goto('/ecs-blend.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    for (const wire of ['fills', 'fillLayers', 'fill'] as const) {
      const source = wire === 'fills' ? '/legacy-image.png' : dataUrl;
      await page.evaluate(
        async ({ kind, wire, source }) => {
          const paint =
            wire === 'fill'
              ? { fill: source, fillOpacity: 1 }
              : { [wire]: [{ type: 'solid', value: source, opacity: 1 }] };
          await window.blendTest.renderNodes([
            {
              id: 'picture',
              type: kind,
              zIndex: 0,
              ...(kind === 'rect'
                ? { x: 40, y: 40, width: 200, height: 160 }
                : { d: 'M40 40h200v160h-200Z' }),
              ...paint,
            } as SerializedNode,
          ]);
        },
        { kind, wire, source },
      );
      // Finish the initial scene frames before the network image can decode.
      // Its arrival must update the texture without another node edit.
      await page.evaluate(() => window.blendTest.settle());
      releaseImage();

      await expect
        .poll(
          async () => {
            const url = await page
              .locator('#actual')
              .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
            const actual = PNG.sync.read(
              Buffer.from(url.split(',')[1], 'base64'),
            );
            return [35, 105].map((x) =>
              Array.from(
                actual.data.subarray(
                  (60 * actual.width + x) * 4,
                  (60 * actual.width + x) * 4 + 4,
                ),
              ),
            );
          },
          { timeout: 10000 },
        )
        .toEqual([
          [220, 60, 30, 255],
          [25, 90, 220, 255],
        ]);

      expect(
        await page.evaluate(() => {
          const node = window.blendTest.api().getNodeById('picture')!;
          return 'fills' in node ? node.fills?.[0]?.type : undefined;
        }),
      ).toBe('image');
    }

    await page.evaluate(async (source) => {
      const api = window.blendTest.api();
      await api.edit(() =>
        api.updateNode(api.getNodeById('picture')!, {
          fills: [{ type: 'solid', value: source, opacity: 0.5 }],
        }),
      );
      await window.blendTest.rendered();
    }, dataUrl);
    expect(
      await page.evaluate(() => {
        const node = window.blendTest.api().getNodeById('picture')!;
        return 'fills' in node ? node.fills?.[0] : undefined;
      }),
    ).toEqual({ type: 'image', value: dataUrl, opacity: 0.5 });
    const url = await page
      .locator('#actual')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    const actual = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    expect(actual.data[(60 * actual.width + 35) * 4 + 3]).toBeCloseTo(128, -1);
    expect(errors).toEqual([]);
  });
}
