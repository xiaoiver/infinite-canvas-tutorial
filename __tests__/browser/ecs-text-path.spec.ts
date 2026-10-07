import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { registerTextPathRenderingTests } from './text-path-rendering-cases';
import type {} from './fixtures/ecs-text-path';

registerTextPathRenderingTests('/ecs-text-path.html');
const settle = (page: Page) => page.evaluate(() => window.textTest.rendered());

async function expectSelectionFollowsInk(page: Page) {
  const { expected, anchors } = await page.evaluate(() => ({
    expected: window.ecsPathTest.corners(),
    anchors: window.textTest.anchors(),
  }));
  expected.forEach((point, i) => {
    expect(anchors[i].x).toBeCloseTo(point.x, 1);
    expect(anchors[i].y).toBeCloseTo(point.y, 1);
  });
}

test('picking follows glyphs and path edits keep selection, history and JSON in sync', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.textPathTest.render({
      path: 'M100 250Q300 20 500 250',
      textAlign: 'center',
    }),
  );
  await page.evaluate(() => window.textTest.select());
  const before = await page.evaluate(() => window.ecsPathTest.node());
  await expectSelectionFollowsInk(page);
  expect(
    await page.evaluate(() => {
      const point = window.ecsPathTest.glyphCenter(0);
      return window.ecsPathTest.hit(point.x, point.y);
    }),
  ).toBe(true);
  expect(await page.evaluate(() => window.ecsPathTest.hit(300, 220))).toBe(
    false,
  );
  await page.evaluate(() => window.textTest.resetCounts());
  await page.evaluate(() =>
    window.textPathTest.update({
      startOffset: 70,
      pathOffset: 15,
      side: 'right',
    }),
  );
  await expectSelectionFollowsInk(page);
  const after = await page.evaluate(() => window.ecsPathTest.node());
  expect(after).toMatchObject({
    startOffset: 70,
    pathOffset: 15,
    side: 'right',
  });
  expect(await page.evaluate(() => window.textTest.counts())).toMatchObject({
    draws: 0,
    uploads: 0,
  });
  await page.evaluate(() => window.textTest.api.undo());
  await settle(page);
  expect(await page.evaluate(() => window.ecsPathTest.node().startOffset)).toBe(
    before.startOffset,
  );
  await expectSelectionFollowsInk(page);
  await page.evaluate(() => window.textTest.api.redo());
  await settle(page);
  expect(await page.evaluate(() => window.ecsPathTest.node().startOffset)).toBe(
    70,
  );
  const glyphs = await page.evaluate(() => window.ecsPathTest.glyphs());
  await page.evaluate(async () => {
    const api = window.textTest.api;
    const saved = JSON.parse(JSON.stringify(api.getNodes()));
    await api.edit(() => api.replaceDocument([]));
    await api.edit(() => api.replaceDocument(saved));
    await window.textTest.rendered();
  });
  expect(await page.evaluate(() => window.ecsPathTest.glyphs())).toEqual(
    glyphs,
  );
  await page.evaluate(() => window.textTest.update({ path: '' }));
  expect(await page.evaluate(() => window.ecsPathTest.glyphs())).toEqual([]);
  await page.evaluate(() => window.textTest.api.undo());
  await settle(page);
  expect(await page.evaluate(() => window.ecsPathTest.glyphs())).toEqual(
    glyphs,
  );
});

test('transformer resize and rotation preserve the path and reuse its atlas', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.textPathTest.render({
      path: 'M100 200Q260 80 400 200',
      content: 'Curved',
      textAlign: 'center',
    }),
  );
  await page.evaluate(() => window.textTest.select());
  const before = await page.evaluate(() => window.ecsPathTest.node());
  const start = (await page.evaluate(() => window.textTest.anchors()))[2];
  await page.mouse.move(start.x, start.y);
  await settle(page);
  await page.mouse.down();
  await settle(page);
  await page.evaluate(() => window.textTest.resetCounts());
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(start.x + i * 5, start.y + i * 4);
    await settle(page);
  }
  await page.mouse.up();
  await settle(page);
  const resized = await page.evaluate(() => window.ecsPathTest.node());
  expect(resized.path).toBe(before.path);
  expect(resized.fontSize).toBe(before.fontSize);
  expect(resized.scaleX).toBeGreaterThan(1.1);
  expect(resized.scaleY).toBeGreaterThan(1.1);
  await expectSelectionFollowsInk(page);
  const anchors = await page.evaluate(() => window.textTest.anchors());
  const origin = { x: anchors[2].x + 12, y: anchors[2].y + 8 },
    pivot = anchors[4];
  await page.mouse.move(origin.x, origin.y);
  await settle(page);
  await page.mouse.down();
  await settle(page);
  for (let i = 1; i <= 5; i++) {
    const a = (i * Math.PI) / 25,
      x = origin.x - pivot.x,
      y = origin.y - pivot.y;
    await page.mouse.move(
      pivot.x + x * Math.cos(a) - y * Math.sin(a),
      pivot.y + x * Math.sin(a) + y * Math.cos(a),
    );
    await settle(page);
  }
  await page.mouse.up();
  await settle(page);
  expect(
    Math.abs((await page.evaluate(() => window.ecsPathTest.node())).rotation!),
  ).toBeGreaterThan(0.3);
  const rotated = await page.evaluate(() => window.ecsPathTest.node());
  expect(rotated.scaleX).toBeCloseTo(resized.scaleX!, 4);
  expect(rotated.scaleY).toBeCloseTo(resized.scaleY!, 4);
  await expectSelectionFollowsInk(page);
  expect(await page.evaluate(() => window.textTest.counts())).toMatchObject({
    draws: 0,
    uploads: 0,
  });
});

test('editing rotated, flipped path text preserves its path parameters', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.textPathTest.render({
      path: 'M60 170Q250 60 460 200',
      textAlign: 'center',
      startOffset: 10,
      pathOffset: 8,
    }),
  );
  await page.evaluate(() =>
    window.textTest.update({
      x: 450,
      y: 70,
      scaleX: -1,
      scaleY: 1.2,
      rotation: 0.3,
    }),
  );
  const before = await page.evaluate(() => window.ecsPathTest.node());
  const point = await page.evaluate(() => window.ecsPathTest.glyphCenter(0));
  await page
    .locator('#actual')
    .dispatchEvent('dblclick', { clientX: point.x, clientY: point.y });
  const input = page.locator('ic-spectrum-text-editor textarea');
  await expect(input).toBeVisible();
  const matrix = await input.evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { a: m.a, b: m.b, c: m.c, d: m.d };
  });
  expect(matrix.a).toBeCloseTo(-Math.cos(0.3), 4);
  expect(matrix.b).toBeCloseTo(-Math.sin(0.3), 4);
  expect(matrix.c).toBeCloseTo(-1.2 * Math.sin(0.3), 4);
  expect(matrix.d).toBeCloseTo(1.2 * Math.cos(0.3), 4);
  await input.fill('Edited path');
  await input.press('Escape');
  await settle(page);
  const after = await page.evaluate(() => window.ecsPathTest.node());
  expect(after.content).toBe('Edited path');
  for (const key of [
    'path',
    'side',
    'startOffset',
    'pathOffset',
    'scaleX',
    'scaleY',
    'rotation',
    'anchorX',
    'anchorY',
  ] as const)
    expect(after[key], key).toBe(before[key]);
  expect(
    await page.evaluate(() =>
      window.ecsPathTest
        .glyphs()
        .map((g) => g.glyph)
        .join(''),
    ),
  ).toBe('Edited path');
  await page.evaluate(() => window.textTest.api.undo());
  await settle(page);
  expect((await page.evaluate(() => window.ecsPathTest.node())).content).toBe(
    before.content,
  );
});

test('API resize preserves nonuniform scale across repeated operations', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.textPathTest.render({ path: 'M50 160H500', content: 'Resize' }),
  );
  const before = await page.evaluate(() => window.textPathTest.bounds());
  await page.evaluate(async () => {
    const api = window.textTest.api,
      node = window.ecsPathTest.node();
    const size = api.getAbsoluteTransformAndSize(node);
    await api.edit(() =>
      api.updateNodeOBB(node, {
        width: size.width * 1.5,
        height: size.height * 2,
      }),
    );
    await window.textTest.rendered();
  });
  const resized = await page.evaluate(() => window.textPathTest.bounds());
  expect(
    (resized.maxX - resized.minX) / (before.maxX - before.minX),
  ).toBeCloseTo(1.5, 4);
  expect(
    (resized.maxY - resized.minY) / (before.maxY - before.minY),
  ).toBeCloseTo(2, 4);
  expect(
    await page.evaluate(() =>
      window.textTest.api.getAbsoluteTransformAndSize(
        window.ecsPathTest.node(),
      ),
    ),
  ).toMatchObject({ scaleX: 1.5, scaleY: 2 });
  await page.evaluate(() =>
    window.textTest.update({ scaleX: -1.5, rotation: 0.4 }),
  );
  await page.evaluate(() => window.textTest.select());
  await expectSelectionFollowsInk(page);
});

test('custom fonts and gradient masks use the same rotated ink positions', async ({
  page,
}) => {
  for (const fontFamily of ['Gaegu', 'NotoItalic']) {
    await page.evaluate(
      (fontFamily) =>
        window.textTest.render({
          path: 'M100 100L500 200',
          anchorX: 0,
          anchorY: 0,
          fontFamily,
          fontSize: 72,
          content: 'jfj',
        }),
      fontFamily,
    );
    await page.evaluate((fontFamily) => {
      const canvas = document.querySelector<HTMLCanvasElement>('#reference')!;
      canvas.width = 640;
      canvas.height = 340;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 640, 340);
      ctx.fillStyle = 'black';
      ctx.font = `96px ${fontFamily}`;
      ctx.translate(100, 100);
      ctx.rotate(Math.atan2(100, 400));
      ctx.scale(0.75, 0.75);
      let x = 0;
      for (const char of 'jfj') {
        ctx.fillText(char, x, 0);
        x += ctx.measureText(char).width;
      }
    }, fontFamily);
    // Screenshot both canvases at the same device scale, including iPhone's 3x
    // interpolation. Comparing a 1x PNG directly biases dark-pixel area counts.
    const expected = PNG.sync.read(
      await page.locator('#reference').screenshot(),
    );
    for (const gradient of [false, true]) {
      if (gradient)
        await page.evaluate(() =>
          window.textTest.update({
            fills: [
              {
                type: 'gradient',
                value: 'linear-gradient(90deg, black, black)',
              },
            ],
          }),
        );
      const actual = PNG.sync.read(await page.locator('#actual').screenshot());
      const scale = actual.width / expected.width;
      let expectedInk = 0,
        actualInk = 0,
        missing = 0;
      for (let y = 0; y < expected.height; y++)
        for (let x = 0; x < expected.width; x++) {
          if (expected.data[(y * expected.width + x) * 4] >= 100) continue;
          expectedInk++;
          let found = false;
          const radius = Math.ceil(expected.width / 640);
          for (let dy = -radius; dy <= radius; dy++)
            for (let dx = -radius; dx <= radius; dx++) {
              const ax = Math.round((x + dx) * scale),
                ay = Math.round((y + dy) * scale);
              if (actual.data[(ay * actual.width + ax) * 4] < 100) found = true;
            }
          if (!found) missing++;
        }
      for (let i = 0; i < actual.data.length; i += 4)
        if (actual.data[i] < 100) actualInk++;
      expect(expectedInk).toBeGreaterThan(100);
      expect(
        missing / expectedInk,
        `${fontFamily} gradient=${gradient}`,
      ).toBeLessThan(0.03);
      // Gradient masks use device-resolution Canvas glyphs; SDF and the 1x
      // reference have different edge coverage on WebKit. Keep the same area
      // tolerance as the SVG comparisons while checking missing ink above.
      expect(actualInk / (scale * scale * expectedInk)).toBeGreaterThan(0.8);
      expect(actualInk / (scale * scale * expectedInk)).toBeLessThan(1.2);
    }
  }
});
