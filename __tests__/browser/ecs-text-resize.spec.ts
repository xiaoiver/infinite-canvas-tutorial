import { expect, test, type Page } from '@playwright/test';
import type {} from './fixtures/ecs-text';
import type { TextSerializedNode } from '@infinite-canvas-tutorial/ecs';

type Point = { x: number; y: number };
const settle = (page: Page) => page.evaluate(() => window.textTest.rendered());
const handles = [
  ['top left', 0, 0],
  ['top right', 1, 0],
  ['bottom right', 1, 1],
  ['bottom left', 0, 1],
  ['top', 0.5, 0],
  ['right', 1, 0.5],
  ['bottom', 0.5, 1],
  ['left', 0, 0.5],
] as const;

function point(corners: Point[], x: number, y: number): Point {
  return {
    x:
      corners[0].x +
      (corners[1].x - corners[0].x) * x +
      (corners[3].x - corners[0].x) * y,
    y:
      corners[0].y +
      (corners[1].y - corners[0].y) * x +
      (corners[3].y - corners[0].y) * y,
  };
}

function expectPoint(actual: Point, expected: Point) {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(
    0.1,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/ecs-text.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});

for (const wrapped of [false, true])
  for (const [name, x, y] of handles) {
    test(`${
      wrapped ? 'rotated wrapped' : 'plain'
    } ${name} resize keeps the opposite text anchor fixed`, async ({
      page,
    }) => {
      await page.evaluate(async (wrapped) => {
        await window.textTest.render(
          wrapped
            ? {
                fontSize: 24,
                anchorX: 270,
                anchorY: 130,
                fontFamily: 'NotoSans',
                content: 'one two three four five six',
                rotation: 0.4,
                wordWrap: true,
                wordWrapWidth: 140,
                textAlign: 'center',
                textBaseline: 'middle',
                lineHeight: 30,
                letterSpacing: 1,
              }
            : { fontSize: 48, anchorX: 240 },
        );
        await window.textTest.select();
      }, wrapped);
      const before = await page.evaluate(() => window.textTest.anchors());
      const fixed = point(before, 1 - x, 1 - y);
      const start = point(before, x, y);
      const original = await page.evaluate(
        () => window.textTest.api.getNodeById('text') as TextSerializedNode,
      );
      await page.mouse.move(start.x, start.y);
      await settle(page);
      await page.mouse.down();
      // Unequal horizontal/vertical changes deliberately exercise the difference
      // between the requested box and the measured font/wrapping dimensions.
      for (const ratio of [0.5, 1, 0.7]) {
        const target = point(
          before,
          x + (x - 0.5) * ratio,
          y + (y - 0.5) * ratio * 0.6,
        );
        await page.mouse.move(target.x, target.y);
        await settle(page);
        const actual = await page.evaluate(() => window.textTest.anchors());
        expectPoint(point(actual, 1 - x, 1 - y), fixed);
        await expectFrame(page);
      }
      const during = await page.evaluate(() => window.textTest.anchors());
      await page.mouse.up();
      await settle(page);
      const actual = await page.evaluate(() => window.textTest.anchors());
      expectPoint(point(actual, 1 - x, 1 - y), fixed);
      await expectFrame(page);
      actual.slice(0, 4).forEach((p, i) => expectPoint(p, during[i]));
      const resized = await page.evaluate(
        () => window.textTest.api.getNodeById('text') as TextSerializedNode,
      );
      if (y !== 0.5)
        expect(Number(resized.fontSize)).toBeGreaterThan(
          Number(original.fontSize),
        );
      if (wrapped && x !== 0.5)
        expect(resized.wordWrapWidth).toBeGreaterThan(original.wordWrapWidth!);
      await page.evaluate(() => window.textTest.api.undo());
      await settle(page);
      (await page.evaluate(() => window.textTest.anchors()))
        .slice(0, 4)
        .forEach((p, i) => expectPoint(p, before[i]));
      await page.evaluate(() => window.textTest.api.redo());
      await settle(page);
      (await page.evaluate(() => window.textTest.anchors()))
        .slice(0, 4)
        .forEach((p, i) => expectPoint(p, actual[i]));
      await expectFrame(page);
    });
  }

async function expectFrame(page: Page) {
  const { anchors, corners } = await page.evaluate(() => ({
    anchors: window.textTest.anchors(),
    corners: window.textTest.corners(),
  }));
  corners.forEach((p, i) => expectPoint(anchors[i], p));
}

for (const textBaseline of [
  'top',
  'hanging',
  'ideographic',
  'bottom',
] as const) {
  test(`${textBaseline} baseline resizes under a mirrored transform, parent and camera`, async ({
    page,
  }) => {
    await page.evaluate(async (textBaseline) => {
      await window.textTest.render({
        fontSize: 36,
        anchorX: 250,
        anchorY: 90,
        rotation: 0.2,
        scaleX: -1,
        textBaseline,
        textAlign: 'right',
        lockAspectRatio: textBaseline === 'hanging',
      });
      await window.textTest.api.edit((api) => {
        api.updateNode({
          id: 'parent',
          type: 'g',
          x: 15,
          y: 10,
          rotation: 0.2,
          scaleX: 1.1,
          scaleY: 1.1,
          zIndex: 0,
        });
        api.reparentNode(api.getNodeById('text')!, api.getNodeById('parent')!);
        api.setAppState({ cameraZoom: 1.15, cameraX: -10, cameraY: -5 });
      });
      await window.textTest.select();
    }, textBaseline);
    for (const [x, y] of [
      [0, 0],
      [1, 0],
    ]) {
      const before = await page.evaluate(() => window.textTest.anchors());
      const fixed = point(before, 1 - x, 1 - y);
      const start = point(before, x, y);
      await page.mouse.move(start.x, start.y);
      await settle(page);
      await page.mouse.down();
      const target = point(before, x + (x - 0.5) * 0.6, y - 0.2);
      await page.mouse.move(target.x, target.y, { steps: 3 });
      await settle(page);
      expectPoint(
        point(
          await page.evaluate(() => window.textTest.anchors()),
          1 - x,
          1 - y,
        ),
        fixed,
      );
      await expectFrame(page);
      await page.mouse.up();
      await settle(page);
      expectPoint(
        point(
          await page.evaluate(() => window.textTest.anchors()),
          1 - x,
          1 - y,
        ),
        fixed,
      );
      await expectFrame(page);
    }
  });
}

test('touch resize without hover keeps the opposite corner fixed', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.textTest.render({ fontSize: 48, anchorX: 240 });
    await window.textTest.select();
  });
  const before = await page.evaluate(() => window.textTest.anchors());
  const canvas = page.locator('#actual');
  const start = { x: before[0].x + 3, y: before[0].y + 3 };
  const init = {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: 1,
    width: 20,
    height: 20,
  };
  await canvas.dispatchEvent('pointerdown', {
    ...init,
    clientX: start.x,
    clientY: start.y,
  });
  await settle(page);
  for (const step of [1, 2, 3]) {
    await canvas.dispatchEvent('pointermove', {
      ...init,
      clientX: start.x - step * 10,
      clientY: start.y - step * 6,
    });
    await settle(page);
    expectPoint(
      (await page.evaluate(() => window.textTest.anchors()))[2],
      before[2],
    );
    await expectFrame(page);
  }
  await canvas.dispatchEvent('pointerup', {
    ...init,
    buttons: 0,
    clientX: start.x - 30,
    clientY: start.y - 18,
  });
  await settle(page);
  expectPoint(
    (await page.evaluate(() => window.textTest.anchors()))[2],
    before[2],
  );
  expect(
    await page.evaluate(() =>
      Number(
        (window.textTest.api.getNodeById('text') as TextSerializedNode)
          .fontSize,
      ),
    ),
  ).toBeGreaterThan(55);
});

for (const centered of [false, true]) {
  test(`text can flip through its ${
    centered ? 'center' : 'opposite corner'
  } and reverse`, async ({ page }) => {
    await page.evaluate(async () => {
      await window.textTest.render({
        fontSize: 48,
        anchorX: 250,
        anchorY: 130,
        rotation: 0.3,
      });
      window.textTest.api.setAppState({ flipEnabled: true });
      await window.textTest.select();
    });
    const before = await page.evaluate(() => window.textTest.anchors());
    const origin = centered ? 0.5 : 1;
    const fixed = point(before, origin, origin);
    await page.mouse.move(before[0].x, before[0].y);
    await settle(page);
    if (centered) await page.keyboard.down('Alt');
    await page.mouse.down();
    for (const [x, y] of [
      [-0.2, -0.3],
      [1.4, 1.3],
      [-0.4, -0.2],
    ]) {
      const target = point(before, x, y);
      await page.mouse.move(target.x, target.y);
      await settle(page);
      const after = await page.evaluate(() => window.textTest.anchors());
      expectPoint(point(after, origin, origin), fixed);
      await expectFrame(page);
      // Crossing actually reflects the text, instead of merely clamping it.
      const dot =
        (after[1].x - after[0].x) * (before[1].x - before[0].x) +
        (after[1].y - after[0].y) * (before[1].y - before[0].y);
      expect(Math.sign(dot)).toBe(x > origin ? -1 : 1);
    }
    await page.mouse.up();
    if (centered) await page.keyboard.up('Alt');
    await settle(page);
    expectPoint(
      point(
        await page.evaluate(() => window.textTest.anchors()),
        origin,
        origin,
      ),
      fixed,
    );
  });
}
