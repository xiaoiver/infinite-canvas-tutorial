import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type { BlendCase } from './fixtures/ecs-blend';

// Each matrix exercises 18 offscreen blend passes across four alpha/color cases.
test.setTimeout(90000);
const modes = [
  'normal',
  'darken',
  'multiply',
  'linearBurn',
  'colorBurn',
  'light',
  'screen',
  'linearDodge',
  'colorDodge',
  'overlay',
  'softLight',
  'hardLight',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];
test.beforeEach(async ({ page }) => {
  await page.goto('/ecs-blend.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
for (const kind of ['node', 'fill', 'path'] as const) {
  test(`${kind} blending matches Canvas 2D, including alpha and boundary colors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [backdrop, source, opacity] of [
      ['rgb(36,128,219)', 'rgb(210,85,164)', 1],
      ['rgba(36,128,219,0.4)', 'rgba(210,85,164,0.6)', 0.7],
      ['transparent', 'rgba(210,85,164,0.6)', 1],
      ['rgb(255,0,64)', 'rgb(0,255,210)', 1],
    ] as const) {
      await page.evaluate((options) => window.blendTest.render(options), {
        kind,
        backdrop,
        source,
        opacity,
      } satisfies BlendCase);
      const urls = await page.evaluate(() =>
        ['actual', 'reference'].map((id) =>
          (document.getElementById(id) as HTMLCanvasElement).toDataURL(),
        ),
      );
      const [actual, expected] = urls.map((url) =>
        PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')),
      );
      for (let i = 0; i < modes.length; i++) {
        for (const [px, py] of kind === 'path' && i !== 0
          ? [
              [30, 30],
              [17, 30],
              [30, 17],
            ]
          : [[30, 30]]) {
          const offset =
            ((Math.floor(i / 6) * 50 + py) * actual.width + (i % 6) * 50 + px) *
            4;
          for (let c = 0; c < 4; c++)
            expect
              .soft(
                Math.abs(actual.data[offset + c] - expected.data[offset + c]),
                `${kind} ${modes[i]}, ${backdrop}/${source}, channel ${c}: ${
                  actual.data[offset + c]
                } vs ${expected.data[offset + c]}`,
              )
              .toBeLessThanOrEqual(3);
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

test('text participates in node blending and later normal nodes preserve its backdrop', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const text = {
      id: 'text',
      type: 'text' as const,
      anchorX: 60,
      anchorY: 60,
      content: 'BLEND',
      fontSize: 64,
      fontFamily: 'system-ui',
      fills: [{ type: 'solid' as const, value: '#d255a4' }],
      zIndex: 1,
    };
    await window.blendTest.renderNodes([text]);
    const actual = document.getElementById('actual') as HTMLCanvasElement;
    const image = new Image();
    image.src = actual.toDataURL();
    await image.decode();
    const reference = document.getElementById('reference') as HTMLCanvasElement;
    const ctx = reference.getContext('2d')!;
    ctx.fillStyle = '#2480db';
    ctx.fillRect(0, 0, 320, 160);
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'yellow';
    ctx.fillRect(300, 140, 10, 10);
    await window.blendTest.renderNodes([
      {
        id: 'bg',
        type: 'rect',
        x: 0,
        y: 0,
        width: 640,
        height: 320,
        zIndex: 0,
        fills: [{ type: 'solid', value: '#2480db' }],
      },
      { ...text, blendMode: 'difference' },
      {
        id: 'last',
        type: 'rect',
        x: 600,
        y: 280,
        width: 20,
        height: 20,
        zIndex: 2,
        fills: [{ type: 'solid', value: 'yellow' }],
      },
    ]);
    return [actual.toDataURL(), reference.toDataURL(), image.src];
  });
  const [actual, expected, source] = result.map((url) =>
    PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')),
  );
  let glyphs = 0,
    maxError = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    const x = (i / 4) % actual.width,
      y = Math.floor(i / 4 / actual.width);
    // Compare the glyph region; the canvas/SDF rectangle edges have different MSAA coverage.
    if (x < 20 || x > 150 || y < 2 || y > 48) continue;
    if (source.data[i + 3] > 240) glyphs++;
    for (let c = 0; c < 4; c++)
      maxError = Math.max(
        maxError,
        Math.abs(actual.data[i + c] - expected.data[i + c]),
      );
  }
  expect(
    Array.from(
      actual.data.subarray((145 * 320 + 305) * 4, (145 * 320 + 305) * 4 + 4),
    ),
  ).toEqual([255, 255, 0, 255]);
  expect(glyphs).toBeGreaterThan(100);
  expect(maxError).toBeLessThanOrEqual(3);
});

test('blended children retain the parent clipping stencil', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.blendTest.renderNodes([
      {
        id: 'bg',
        type: 'rect',
        x: 0,
        y: 0,
        width: 640,
        height: 320,
        zIndex: 0,
        fills: [{ type: 'solid', value: '#5080c0' }],
      },
      {
        id: 'clip',
        type: 'rect',
        x: 100,
        y: 80,
        width: 100,
        height: 120,
        zIndex: 1,
        clipMode: 'clip',
        fills: [{ type: 'solid', value: '#c0c080' }],
      },
      {
        id: 'child',
        parentId: 'clip',
        type: 'rect',
        x: 50,
        y: 40,
        width: 120,
        height: 80,
        zIndex: 0,
        fills: [{ type: 'solid', value: '#c04080' }],
        blendMode: 'multiply',
      },
    ]),
  );
  const url = await page
    .locator('#actual')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const pixel = (x: number, y: number) =>
    Array.from(
      png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
    );
  expect(pixel(90, 70)).toEqual([145, 48, 64, 255]);
  expect(pixel(110, 70)).toEqual([80, 128, 192, 255]);
});

test('WebGL1 fallback preserves node blending through a normal continuation pass', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args);
    } as typeof getContext;
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() =>
    window.blendTest.render({ backdrop: '#2480db', source: '#d255a4' }),
  );
  const urls = await page.evaluate(() =>
    ['actual', 'reference'].map((id) =>
      (document.getElementById(id) as HTMLCanvasElement).toDataURL(),
    ),
  );
  const [actual, expected] = urls.map((url) =>
    PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')),
  );
  for (let i = 0; i < modes.length; i++) {
    const offset =
      ((Math.floor(i / 6) * 50 + 30) * actual.width + (i % 6) * 50 + 30) * 4;
    for (let c = 0; c < 4; c++)
      expect
        .soft(
          Math.abs(actual.data[offset + c] - expected.data[offset + c]),
          `${modes[i]} channel ${c}`,
        )
        .toBeLessThanOrEqual(3);
  }
});

test('three translucent paint layers preserve alpha through intermediate textures', async ({
  page,
}) => {
  for (const type of ['rect', 'path'] as const) {
    const urls = await page.evaluate(async (type) => {
      await window.blendTest.renderNodes([
        {
          id: 'paint',
          type,
          x: 0,
          y: 0,
          width: 160,
          height: 160,
          d: 'M0 0h160v160H0Z',
          zIndex: 0,
          fills: [
            { type: 'solid', value: 'rgba(36,128,219,0.4)', opacity: 0.5 },
            {
              type: 'solid',
              value: 'red',
              enabled: false,
              blendMode: 'colorBurn',
            },
            {
              type: 'solid',
              value: 'rgba(210,85,164,0.6)',
              opacity: 0.7,
              blendMode: 'softLight',
            },
            {
              type: 'solid',
              value: 'rgba(128,219,36,0.8)',
              opacity: 0.4,
              blendMode: 'hue',
            },
          ],
        },
      ]);
      const ref = document.getElementById('reference') as HTMLCanvasElement;
      const ctx = ref.getContext('2d')!;
      ctx.clearRect(0, 0, 320, 160);
      for (const [color, opacity, mode] of [
        ['rgba(36,128,219,0.4)', 0.5, 'source-over'],
        ['rgba(210,85,164,0.6)', 0.7, 'soft-light'],
        ['rgba(128,219,36,0.8)', 0.4, 'hue'],
      ] as const) {
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = mode;
        ctx.fillRect(0, 0, 80, 80);
      }
      return [
        (document.getElementById('actual') as HTMLCanvasElement).toDataURL(),
        ref.toDataURL(),
      ];
    }, type);
    const [actual, expected] = urls.map((url) =>
      PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')),
    );
    const offset = (40 * actual.width + 40) * 4;
    for (let c = 0; c < 4; c++)
      expect(
        Math.abs(actual.data[offset + c] - expected.data[offset + c]),
        `${type} channel ${c}`,
      ).toBeLessThanOrEqual(3);
  }
});
