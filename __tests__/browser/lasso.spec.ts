import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/lasso';

// Mounting the complete docs UI plus several gestures needs more than the
// 30-second budget of the small renderer fixtures on software WebGL.
test.setTimeout(60000);

type Point = [number, number];
const outline: Point[] = [
  [80, 80],
  [420, 80],
  [420, 220],
  [80, 220],
  [80, 80],
];
const settle = (page: Page) => page.evaluate(() => window.lassoTest.settle());
const selected = (page: Page) =>
  page.evaluate(() => [...window.lassoTest.state().layersSelected].sort());
const highlighted = (page: Page) =>
  page.evaluate(() => [...window.lassoTest.state().layersHighlighted].sort());
const hits = ['lasso-polyline', 'lasso-rect-1'];
async function expectPreview(page: Page, ids: string[]) {
  expect(await highlighted(page)).toEqual(ids);
  expect(await page.evaluate(() => window.lassoTest.highlighted())).toEqual(
    ids,
  );
}

// Playwright has native WebKit taps but no native touch-drag command.
// Use real mouse events on Chromium and Safari's touch PointerEvent path on WebKit.
async function drag(
  page: Page,
  points: Point[],
  touch: boolean,
  beforeRelease?: () => Promise<void>,
  afterMove?: (index: number) => Promise<void>,
) {
  const canvas = page.locator('canvas').first();
  const box = (await canvas.boundingBox())!;
  const viewport = await page.evaluate(
    (points) => points.map(([x, y]) => window.lassoTest.point(x, y)),
    points,
  );
  const init = {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    button: 0,
    buttons: 1,
  };
  const start = viewport[0];
  if (touch) {
    await canvas.dispatchEvent('pointerdown', {
      ...init,
      clientX: Math.round(box.x + start.x),
      clientY: Math.round(box.y + start.y),
    });
  } else {
    await page.mouse.move(
      Math.round(box.x + start.x),
      Math.round(box.y + start.y),
    );
    await page.mouse.down();
  }
  await settle(page);
  for (let i = 1; i < viewport.length; i++) {
    const { x, y } = viewport[i];
    if (touch)
      await canvas.dispatchEvent('pointermove', {
        ...init,
        clientX: Math.round(box.x + x),
        clientY: Math.round(box.y + y),
      });
    else
      await page.mouse.move(Math.round(box.x + x), Math.round(box.y + y), {
        steps: 4,
      });
    await settle(page);
    await afterMove?.(i);
  }
  await beforeRelease?.();
  const end = viewport[viewport.length - 1];
  if (touch)
    await canvas.dispatchEvent('pointerup', {
      ...init,
      buttons: 0,
      clientX: Math.round(box.x + end.x),
      clientY: Math.round(box.y + end.y),
    });
  else await page.mouse.up();
  await settle(page);
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lasso.html');
  await expect
    .poll(
      async () => {
        expect(errors).toEqual([]);
        return page.evaluate(() => window.lassoTest?.ready());
      },
      { timeout: 20000 },
    )
    .toBe(true);
  await settle(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.lassoTest.unmount());
  expect(errors).toEqual([]);
});

test('the lesson lasso previews hits before release, commits once and can be reused', async ({
  page,
  browserName,
}) => {
  const history = await page.evaluate(() => window.lassoTest.history());
  await drag(page, outline, browserName === 'webkit', async () => {
    expect(errors).toEqual([]);
    await expectPreview(page, hits);
    expect(await selected(page)).toEqual([]);
    expect(await page.evaluate(() => window.lassoTest.history())).toEqual(
      history,
    );
  });
  expect(await selected(page)).toEqual(hits);
  await expectPreview(page, []);
  await page.evaluate(() => window.lassoTest.undo());
  expect(await selected(page)).toEqual([]);
  await expectPreview(page, []);
  await page.evaluate(() => window.lassoTest.redo());
  expect(await selected(page)).toEqual(hits);
  const tool = page.locator('ic-spectrum-penbar-lasso sp-action-button');
  if (browserName === 'webkit') await tool.tap();
  else await tool.click();
  await expect
    .poll(() => page.evaluate(() => window.lassoTest.state().penbarSelected))
    .toBe('lasso');
  await page.evaluate(() => window.lassoTest.activate()); // Unset mode defaults to selection, e.g. after drawing a mask.
  await drag(
    page,
    [
      [290, 90],
      [410, 90],
      [410, 210],
      [290, 210],
    ],
    browserName === 'webkit',
  );
  expect(await selected(page)).toEqual(['lasso-polyline']);
});

test('the moving closing edge adds and removes live hits before release', async ({
  page,
  browserName,
}) => {
  await drag(
    page,
    [
      [60, 60],
      [440, 60],
      [440, 240],
      [380, 80],
    ],
    browserName === 'webkit',
    undefined,
    async (index) => {
      // The unfinished path closes back to its start on every move. The last
      // point narrows that polygon, excluding the rectangle again.
      await expectPreview(page, index === 2 ? hits : []);
      expect(await selected(page)).toEqual([]);
    },
  );
  expect(await selected(page)).toEqual([]);
});

for (const zoomed of [false, true]) {
  test(`switching from lasso keeps the marquee aligned with the pointer (${
    zoomed ? 'zoomed, reverse drag' : 'forward drag'
  })`, async ({ page, browserName }) => {
    const touch = browserName === 'webkit';
    // Match a documentation embed with content above it and a scrolled page.
    await page.locator('#demo').evaluate((element) => {
      element.style.margin = '160px 0 0 20px';
      element.style.width = 'min(560px, calc(100vw - 40px))';
      document.body.style.minHeight = '1100px';
      window.scrollTo(0, 90);
    });
    await settle(page);
    await drag(
      page,
      [
        [80, 80],
        [230, 80],
        [230, 220],
        [80, 220],
      ],
      touch,
      async () => {
        await page.keyboard.press('Escape');
        await settle(page);
      },
    );
    const selectTool = page.locator(
      'ic-spectrum-penbar sp-action-button[value="select"]',
    );
    if (touch) await selectTool.tap();
    else await selectTool.click();
    await expect
      .poll(() => page.evaluate(() => window.lassoTest.state().penbarSelected))
      .toBe('select');
    if (zoomed) await page.evaluate(() => window.lassoTest.camera());
    const points: Point[] = zoomed
      ? [
          [230, 220],
          [80, 80],
        ]
      : [
          [80, 80],
          [230, 220],
        ];
    await drag(page, points, touch, async () => {
      const box = (await page.locator('canvas').first().boundingBox())!;
      const [start, end] = await page.evaluate(
        (points) => points.map(([x, y]) => window.lassoTest.point(x, y)),
        points,
      );
      const rect = await page.evaluate(() => window.lassoTest.marquee());
      expect(rect).toBeDefined();
      expect(rect.x).toBeCloseTo(
        Math.min(Math.round(box.x + start.x), Math.round(box.x + end.x)),
        0,
      );
      expect(rect.y).toBeCloseTo(
        Math.min(Math.round(box.y + start.y), Math.round(box.y + end.y)),
        0,
      );
      expect(rect.width).toBeCloseTo(
        Math.abs(Math.round(box.x + end.x) - Math.round(box.x + start.x)),
        0,
      );
      expect(rect.height).toBeCloseTo(
        Math.abs(Math.round(box.y + end.y) - Math.round(box.y + start.y)),
        0,
      );
      expect(await selected(page)).toEqual(['lasso-rect-1']);
    });
    expect(await selected(page)).toEqual(['lasso-rect-1']);
    expect(
      await page.evaluate(() => window.lassoTest.marquee()),
    ).toBeUndefined();
  });
}

test('taps, straight drags and cancelled gestures leave no stale selection', async ({
  page,
  browserName,
}) => {
  const touch = browserName === 'webkit';
  if (touch) {
    const box = (await page.locator('canvas').first().boundingBox())!;
    await page.touchscreen.tap(box.x + 120, box.y + 120);
    await settle(page);
  } else await drag(page, [[120, 120]], false);
  expect(await selected(page)).toEqual([]);
  await drag(
    page,
    [
      [120, 120],
      [180, 180],
    ],
    touch,
  );
  expect(await selected(page)).toEqual([]);
  await drag(page, outline, touch, async () => {
    await expectPreview(page, hits);
    await page.keyboard.press('Escape');
    await settle(page);
    await expectPreview(page, []);
  });
  expect(await selected(page)).toEqual([]);
  await drag(page, outline, true, async () => {
    await expectPreview(page, hits);
    await page.locator('canvas').first().dispatchEvent('pointercancel', {
      pointerType: 'touch',
      pointerId: 1,
      bubbles: true,
    });
    await settle(page);
    await expectPreview(page, []);
  });
  expect(await selected(page)).toEqual([]);
  // A two-finger gesture cancels even when pointerup is set in the same frame.
  await drag(page, outline, true, async () => {
    await expectPreview(page, hits);
    const canvas = page.locator('canvas').first();
    await canvas.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 2,
      bubbles: true,
      button: 0,
      clientX: 250,
      clientY: 150,
    });
    await settle(page);
    await expectPreview(page, []);
    await canvas.dispatchEvent('pointerup', {
      pointerType: 'touch',
      pointerId: 2,
      bubbles: true,
      button: 0,
      clientX: 250,
      clientY: 150,
    });
  });
  expect(await selected(page)).toEqual([]);
  await drag(page, [[120, 120]], touch);
  expect(await selected(page)).toEqual([]);
  await drag(page, outline, touch);
  expect(await selected(page)).toEqual(['lasso-polyline', 'lasso-rect-1']);
});

test('changing tools or lasso mode clears the preview without committing', async ({
  page,
  browserName,
}) => {
  await drag(page, outline, browserName === 'webkit', async () => {
    await expectPreview(page, hits);
    await page.evaluate(() => window.lassoTest.selectTool());
    await expectPreview(page, []);
  });
  expect(await selected(page)).toEqual([]);
  await page.evaluate(() => window.lassoTest.activate('select'));
  await drag(page, outline, browserName === 'webkit', async () => {
    await expectPreview(page, hits);
    await page.evaluate(() => window.lassoTest.activate('draw'));
    await expectPreview(page, []);
  });
  expect(await selected(page)).toEqual([]);
  expect(await page.evaluate(() => window.lassoTest.masks())).toEqual([]);
  expect(await page.evaluate(() => window.lassoTest.drawn())).toEqual([]);
});

test('hit testing respects parent transforms, rotation, flips, camera zoom and locked/hidden shapes', async ({
  page,
  browserName,
}) => {
  await page.evaluate(async () => {
    await window.lassoTest.scene([
      {
        id: 'parent',
        zIndex: 0,
        type: 'g',
        x: 230,
        y: 120,
        rotation: 0.3,
        scaleX: -1,
        scaleY: 1.2,
      },
      {
        id: 'child',
        zIndex: 0,
        parentId: 'parent',
        type: 'rect',
        x: 20,
        y: 10,
        width: 50,
        height: 40,
        rotation: 0.3,
        fills: [{ type: 'solid', value: 'blue' }],
      },
      {
        id: 'locked',
        zIndex: 0,
        type: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 80,
        locked: true,
        fills: [{ type: 'solid', value: 'red' }],
      },
      {
        id: 'hidden',
        zIndex: 0,
        type: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 80,
        visibility: 'hidden',
        fills: [{ type: 'solid', value: 'red' }],
      },
      {
        id: 'ellipse',
        zIndex: 0,
        type: 'ellipse',
        x: 300,
        y: 110,
        width: 70,
        height: 50,
        rotation: -0.3,
        fills: [{ type: 'solid', value: 'green' }],
      },
    ]);
    await window.lassoTest.camera();
  });
  await drag(
    page,
    [
      [80, 60],
      [410, 60],
      [410, 230],
      [80, 230],
    ],
    browserName === 'webkit',
    async () => {
      await expectPreview(page, ['child', 'ellipse']);
    },
  );
  expect(await selected(page)).toEqual(['child', 'ellipse']);
});

test('open polylines have no phantom interior or closing edge', async ({
  page,
  browserName,
}) => {
  await drag(
    page,
    [
      [307, 145],
      [315, 145],
      [315, 160],
      [307, 160],
    ],
    browserName === 'webkit',
  );
  expect(await selected(page)).toEqual([]);
  await page.evaluate(() => window.lassoTest.activate('select'));
  // Cross a segment with both of its endpoints outside the lasso.
  await drag(
    page,
    [
      [342, 140],
      [358, 140],
      [358, 160],
      [342, 160],
    ],
    browserName === 'webkit',
  );
  expect(await selected(page)).toEqual(['lasso-polyline']);
});

test('draw mode still creates one closed mask and emits its event', async ({
  page,
  browserName,
}) => {
  await page.evaluate(() => window.lassoTest.mask());
  await drag(
    page,
    [
      [120, 120],
      [180, 120],
      [180, 180],
      [120, 180],
    ],
    browserName === 'webkit',
    async () => {
      expect(await page.evaluate(() => window.lassoTest.masks())).toEqual([]);
      await expectPreview(page, []);
    },
  );
  const masks = await page.evaluate(() => window.lassoTest.masks());
  expect(masks).toHaveLength(1);
  expect(masks[0].parentId).toBe('lasso-rect-1');
  expect(masks[0].d).toMatch(/Z$/);
  expect(await page.evaluate(() => window.lassoTest.drawn())).toEqual([
    masks[0].id,
  ]);
  expect(
    await page.evaluate(() => window.lassoTest.state().layersLassoing),
  ).toEqual([]);
  await page.evaluate(() => window.lassoTest.undo());
  expect(await page.evaluate(() => window.lassoTest.masks())).toEqual([]);
});

test('unmounting an active lasso leaves the next demo usable', async ({
  page,
  browserName,
}) => {
  await drag(page, outline, browserName === 'webkit', async () => {
    await expectPreview(page, hits);
    await page.evaluate(async () => {
      window.lassoTest.unmount();
      await window.lassoTest.settle();
      window.lassoTest.mount();
    });
    await expect
      .poll(() => page.evaluate(() => window.lassoTest.ready()))
      .toBe(true);
    await settle(page);
    await expectPreview(page, []);
  });
  await drag(page, outline, browserName === 'webkit');
  expect(await selected(page)).toEqual(['lasso-polyline', 'lasso-rect-1']);
});
