import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/ecs-text';
import type { TextSerializedNode } from '@infinite-canvas-tutorial/ecs';

const settle = (page: Page) => page.evaluate(() => window.textTest.rendered());

test.beforeEach(async ({ page }) => {
  await page.goto('/ecs-text.html');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.textTest?.dispose());
});

test('Gaegu j and italic overhangs retain the same ink as Canvas text', async ({
  page,
}) => {
  for (const [fontFamily, content] of [
    ['Gaegu', 'hijk'],
    ['NotoItalic', 'jfj'],
    ['NotoSans', 'Wj'],
  ]) {
    await page.evaluate(
      ({ fontFamily, content }) =>
        window.textTest.render({ fontFamily, content }),
      { fontFamily, content },
    );
    const reference = await page.evaluate(
      ({ fontFamily, content }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 320;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 640, 320);
        ctx.fillStyle = 'black';
        ctx.font = `96px ${fontFamily}`;
        let x = 100;
        // Compare the atlas renderer's individual glyphs, independent of whole-run kerning.
        for (const char of content) {
          ctx.fillText(char, x, 180);
          x += ctx.measureText(char).width;
        }
        return canvas.toDataURL();
      },
      { fontFamily, content },
    );
    const actual = PNG.sync.read(await page.locator('#actual').screenshot());
    const expected = PNG.sync.read(
      Buffer.from(reference.split(',')[1], 'base64'),
    );
    const ratio = actual.width / expected.width;
    const ink = (image: PNG, x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < image.width &&
      y < image.height &&
      image.data[(y * image.width + x) * 4] < 100;
    // Font line boxes and SDF antialiasing differ from Canvas fillText. Align
    // ink bounds before comparing glyph coverage; keep the extent check so
    // cropping a whole overhang cannot disappear into the alignment.
    const bounds = (image: PNG) => {
      let minX = image.width,
        minY = image.height,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++)
          if (ink(image, x, y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
      return { minX, minY, width: maxX - minX, height: maxY - minY };
    };
    const a = bounds(actual),
      e = bounds(expected);
    expect(Math.abs(a.width / ratio - e.width)).toBeLessThan(2);
    expect(Math.abs(a.height / ratio - e.height)).toBeLessThan(2);
    const offsetX = a.minX / ratio - e.minX,
      offsetY = a.minY / ratio - e.minY;
    let total = 0,
      missing = 0;
    for (let y = 0; y < expected.height; y++)
      for (let x = 0; x < expected.width; x++) {
        if (!ink(expected, x, y)) continue;
        total++;
        let found = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (
              ink(
                actual,
                Math.round((x + dx + offsetX) * ratio),
                Math.round((y + dy + offsetY) * ratio),
              )
            )
              found = true;
          }
        if (!found) missing++;
      }
    expect(total).toBeGreaterThan(500);
    expect(missing / total, `${fontFamily}: missing ink`).toBeLessThan(0.02);
  }
});

test('resizing with the transformer reuses glyphs and the atlas texture', async ({
  page,
}) => {
  await page.evaluate(() => window.textTest.render({ fontSize: 48 }));
  await page.evaluate(() => window.textTest.select());
  const before = await page.evaluate(() => ({
    anchors: window.textTest.anchors(),
    fontSize: (window.textTest.api.getNodeById('text') as TextSerializedNode)
      .fontSize,
  }));
  const start = before.anchors[2];
  await page.mouse.move(start.x, start.y);
  await settle(page);
  await page.mouse.down();
  await page.evaluate(() => window.textTest.resetCounts());
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(start.x + i * 5, start.y + i * 3);
    await settle(page);
  }
  await page.mouse.up();
  await settle(page);
  const after = await page.evaluate(() => ({
    counts: window.textTest.counts(),
    fontSize: (window.textTest.api.getNodeById('text') as TextSerializedNode)
      .fontSize,
  }));
  expect(Number(after.fontSize)).toBeGreaterThan(Number(before.fontSize) + 10);
  expect(after.counts.draws).toBe(0);
  expect(after.counts.uploads).toBe(0);
});

test('content and font changes still refresh the atlas after a resize', async ({
  page,
}) => {
  await page.evaluate(() => window.textTest.render());
  await page.evaluate(() => window.textTest.update({ fontSize: 64 }));
  await page.evaluate(() => window.textTest.resetCounts());
  await page.evaluate(() => window.textTest.update({ content: 'hijké' }));
  expect(await page.evaluate(() => window.textTest.counts())).toMatchObject({
    draws: 1,
    uploads: 1,
  });
  await page.evaluate(() => window.textTest.resetCounts());
  await page.evaluate(() => window.textTest.update({ fontFamily: 'NotoSans' }));
  const changed = await page.evaluate(() => window.textTest.counts());
  expect(changed.draws).toBeGreaterThan(0);
  expect(changed.uploads).toBe(1);
  await page.evaluate(() => window.textTest.resetCounts());
  await page.evaluate(() => window.textTest.update({ fontSize: 80 }));
  expect(await page.evaluate(() => window.textTest.counts())).toMatchObject({
    draws: 0,
    uploads: 0,
  });
});

async function expectEditorCorners(page: Page) {
  const result = await page.evaluate(() => {
    const editor = document.querySelector('ic-spectrum-text-editor')!;
    const input = editor.shadowRoot!.querySelector('textarea')!;
    const style = getComputedStyle(input);
    const matrix = new DOMMatrix(style.transform);
    const width = parseFloat(style.width),
      height = parseFloat(style.height);
    const x = parseFloat(style.left),
      y = parseFloat(style.top);
    return {
      expected: window.textTest.corners(),
      actual: [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ].map(([px, py]) => {
        const p = new DOMPoint(px, py).matrixTransform(matrix);
        return { x: x + p.x, y: y + p.y };
      }),
    };
  });
  result.actual.forEach((point, i) => {
    expect(point.x).toBeCloseTo(result.expected[i].x, 1);
    expect(point.y).toBeCloseTo(result.expected[i].y, 1);
  });
}

test('double-click editing follows transformer rotation and camera changes', async ({
  page,
}) => {
  await page.evaluate(() => window.textTest.render({ fontSize: 48 }));
  await page.evaluate(() => window.textTest.select());
  const original = await page.evaluate(
    () => window.textTest.api.getNodeById('text') as TextSerializedNode,
  );
  const anchors = await page.evaluate(() => window.textTest.anchors());
  const start = { x: anchors[2].x + 12, y: anchors[2].y + 8 };
  const pivot = anchors[4],
    angle = Math.PI / 5;
  await page.mouse.move(start.x, start.y);
  await settle(page);
  await page.mouse.down();
  await settle(page);
  for (let i = 1; i <= 5; i++) {
    const theta = (angle * i) / 5;
    await page.mouse.move(
      pivot.x +
        (start.x - pivot.x) * Math.cos(theta) -
        (start.y - pivot.y) * Math.sin(theta),
      pivot.y +
        (start.x - pivot.x) * Math.sin(theta) +
        (start.y - pivot.y) * Math.cos(theta),
    );
    await settle(page);
  }
  await page.mouse.up();
  await settle(page);
  expect(
    Math.abs(
      await page.evaluate(
        () => window.textTest.api.getNodeById('text')!.rotation!,
      ),
    ),
  ).toBeGreaterThan(0.3);
  expect(await page.evaluate(() => window.textTest.api.getNodeById('text'))).toMatchObject({
    fontSize: original.fontSize,
    anchorX: original.anchorX,
    anchorY: original.anchorY,
    width: original.width,
    height: original.height,
  });
  const corners = await page.evaluate(() => window.textTest.corners());
  await page.mouse.dblclick(
    (corners[0].x + corners[2].x) / 2,
    (corners[0].y + corners[2].y) / 2,
  );
  const input = page.locator('ic-spectrum-text-editor textarea');
  await expect(input).toBeVisible();
  await expectEditorCorners(page);
  await page.evaluate(() =>
    window.textTest.api.setAppState({
      cameraZoom: 1.4,
      cameraX: -20,
      cameraY: -10,
      cameraRotation: 0.2,
    }),
  );
  await settle(page);
  await expectEditorCorners(page);
  const rotation = await page.evaluate(
    () => window.textTest.api.getNodeById('text')!.rotation,
  );
  await input.fill('hijk edited');
  await input.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.textTest.api.getNodeById('text') as TextSerializedNode)
            .content,
      ),
    )
    .toBe('hijk edited');
  expect(
    await page.evaluate(
      () => window.textTest.api.getNodeById('text')!.rotation,
    ),
  ).toBe(rotation);
});

test('editing preserves negative scale and rotated parent transforms', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.textTest.render({
      fontSize: 48,
      scaleX: -1,
      rotation: -0.3,
      anchorX: 200,
    });
    await window.textTest.api.edit((api) => {
      api.updateNode({
        id: 'parent',
        type: 'g',
        x: 50,
        y: 20,
        rotation: 0.5,
        scaleX: 1.2,
        scaleY: 0.8,
        zIndex: 0,
      });
      api.reparentNode(api.getNodeById('text')!, api.getNodeById('parent')!);
    });
    await window.textTest.rendered();
  });
  const corners = await page.evaluate(() => window.textTest.corners());
  await page.locator('#actual').dispatchEvent('dblclick', {
    clientX: (corners[0].x + corners[2].x) / 2,
    clientY: (corners[0].y + corners[2].y) / 2,
  });
  await expect(page.locator('textarea')).toBeVisible();
  await expectEditorCorners(page);
});
