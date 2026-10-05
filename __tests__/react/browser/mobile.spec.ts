import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';

declare global {
  interface Window {
    mobileApis: Record<string, ExtendedAPI>;
  }
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

async function frame(page: Page) {
  await page.evaluate(async () => {
    // Wait for complete ECS frames without recording an edit during the drag.
    for (let i = 0; i < 2; i++) {
      await new Promise<void>((resolve) =>
        window.mobileApis.A.runAtNextTick(resolve),
      );
    }
  });
}

async function openPlayground(page: Page, locale: string) {
  await page.addInitScript(() => {
    window.mobileApis = {};
    document.addEventListener(
      'ic-ready',
      (event) => {
        const target = event.target as HTMLElement;
        const id = target.closest<HTMLElement>('[data-canvas]')?.dataset.canvas;
        if (id)
          window.mobileApis[id] = (event as CustomEvent<ExtendedAPI>).detail;
      },
      true,
    );
  });
  await page.goto(`/?playground=${locale}`);
  const left = page.locator('[data-canvas="A"]');
  const right = page.locator('[data-canvas="B"]');
  await expect(left.locator('[data-action="pick"]')).toBeEnabled({
    timeout: 45000,
  });
  await expect(right.locator('[data-action="pick"]')).toBeEnabled();
  return { left, right };
}

async function resizeWithTouch(
  page: Page,
  canvas: Locator,
  browserName: 'chromium' | 'firefox' | 'webkit',
  start: { x: number; y: number },
) {
  if (browserName === 'webkit') {
    // WebKit exposes native taps, but no native touch-drag protocol. Keep the
    // same geometry/history assertions while exercising its PointerEvent path.
    const init = {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      bubbles: true,
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
    await frame(page);
    for (let step = 1; step <= 5; step++) {
      await canvas.dispatchEvent('pointermove', {
        ...init,
        clientX: start.x + step * 6,
        clientY: start.y + step * 4,
      });
      await frame(page);
    }
    await canvas.dispatchEvent('pointerup', {
      ...init,
      buttons: 0,
      clientX: start.x + 30,
      clientY: start.y + 20,
    });
    await frame(page);
    return;
  }

  // Chromium supplies trusted native touch drags through CDP.
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1, radiusX: 10, radiusY: 10, force: 1 }],
    });
    await frame(page);
    for (let step = 1; step <= 5; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: start.x + step * 6,
            y: start.y + step * 4,
            id: 1,
            radiusX: 10,
            radiusY: 10,
            force: 1,
          },
        ],
      });
      await frame(page);
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await frame(page);
  } finally {
    await session.detach();
  }
}

for (const locale of ['en', 'zh']) {
  test(`phone taps the palette to add one undoable rectangle at the view center (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { left, right } = await openPlayground(page, locale);
    await page.evaluate(() => {
      window.mobileApis.A.gotoLandmark(
        { x: 20, y: -10, zoom: 1.5, rotation: Math.PI / 6 },
        { duration: 0 },
      );
    });
    await expect
      .poll(() =>
        page.evaluate(() => window.mobileApis.A.getAppState().cameraRotation),
      )
      .toBeCloseTo(Math.PI / 6, 5);
    await left.locator('[data-action="place"]').tap();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="selected"]')).toHaveText('1');
    const box = (await left.locator('canvas').boundingBox())!;
    const center = await page.evaluate(() => {
      const api = window.mobileApis.A;
      const node = api.getNodeById(api.getAppState().layersSelected[0])!;
      return api.canvas2Viewport({
        x: Number(node.x) + 40,
        y: Number(node.y) + 30,
      });
    });
    expect(center.x).toBeCloseTo(box.width / 2, 2);
    expect(center.y).toBeCloseTo(box.height / 2, 2);
    await left.locator('[data-action="undo"]').tap();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`phone fits the scene through the React camera controls (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { left, right } = await openPlayground(page, locale);
    const box = await left.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    await left.locator('[data-action="fit"]').tap();
    const expectedZoom = Math.min(box!.width / 230, box!.height / 150);
    await expect
      .poll(() =>
        page.evaluate(() => window.mobileApis.A.getAppState().cameraZoom),
      )
      .toBeCloseTo(expectedZoom, 4);
    const center = await page.evaluate(() =>
      window.mobileApis.A.canvas2Viewport({ x: 155, y: 120 }),
    );
    expect(center.x).toBeCloseTo(box!.width / 2, 2);
    expect(center.y).toBeCloseTo(box!.height / 2, 2);
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await expect(right.locator('[data-state="zoom"]')).toHaveText('100%');
    expect(errors).toEqual([]);
  });

  test(`phone touch selects and resizes the documentation rectangle (${locale})`, async ({
    page,
    browserName,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { left, right } = await openPlayground(page, locale);
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2', {
      timeout: 45000,
    });
    const canvas = left.locator('canvas');
    const box = (await canvas.boundingBox())!;
    await page.touchscreen.tap(box.x + 70, box.y + 80);
    await expect(left.locator('[data-state="selected"]')).toHaveText('1');
    await expect(left.locator('[data-state="width"]')).toHaveText('100');
    await page.waitForTimeout(310);
    const corner = await page.evaluate(() =>
      window.mobileApis.A.canvas2Viewport({ x: 140, y: 125 }),
    );
    const start = { x: box.x + corner.x + 12, y: box.y + corner.y + 8 };
    await resizeWithTouch(page, canvas, browserName, start);
    const resized = await page.evaluate(() => {
      const n = window.mobileApis.A.getNodeById('A-rect')!;
      return { width: n.width!, height: n.height!, rotation: n.rotation ?? 0 };
    });
    expect(Math.abs(resized.width - 130)).toBeLessThan(1.5);
    expect(Math.abs(resized.height - 100)).toBeLessThan(1.5);
    expect(resized.rotation).toBe(0);
    await expect
      .poll(() =>
        left.locator('[data-state="width"]').textContent().then(Number),
      )
      .toBeCloseTo(resized.width, 3);
    await left.locator('[data-action="undo"]').tap();
    await expect
      .poll(() =>
        page.evaluate(() => window.mobileApis.A.getNodeById('A-rect')!.width),
      )
      .toBe(100);
    await left.locator('[data-action="redo"]').tap();
    await expect
      .poll(() =>
        left.locator('[data-state="width"]').textContent().then(Number),
      )
      .toBeCloseTo(resized.width, 3);
    await expect(right.locator('[data-state="selected"]')).toHaveText('0');
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`phone picks canvas coordinates through the React event hook (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { left, right } = await openPlayground(page, locale);
    await left.locator('[data-action="zoom-in"]').tap();
    await expect(left.locator('[data-state="zoom"]')).toHaveText('125%');
    const pick = left.locator('[data-action="pick"]');
    await pick.tap();
    await expect(pick).toHaveText(
      locale === 'zh' ? '取消取点' : 'Cancel picking',
    );
    const box = (await left.locator('canvas').boundingBox())!;
    const cancelled = {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: box.x + 60,
      clientY: box.y + 100,
    };
    const canvas = left.locator('canvas');
    await canvas.dispatchEvent('pointerdown', cancelled);
    await frame(page);
    await canvas.dispatchEvent('pointercancel', cancelled);
    await canvas.dispatchEvent('pointerup', { ...cancelled, buttons: 0 });
    await frame(page);
    await expect(left.locator('[data-state="point"] output')).toHaveCount(0);
    await expect(pick).toHaveText(
      locale === 'zh' ? '取消取点' : 'Cancel picking',
    );
    const tap = { x: Math.round(box.x + 95), y: Math.round(box.y + 160) };
    const expected = await page.evaluate(
      (point) => window.mobileApis.A.viewport2Canvas(point),
      // Input stores press positions in integer viewport coordinates.
      { x: Math.trunc(tap.x - box.x), y: Math.trunc(tap.y - box.y) },
    );
    await page.touchscreen.tap(tap.x, tap.y);
    const coordinates = left.locator('[data-state="point"] output');
    await expect(coordinates).toBeVisible();
    expect(Number(await coordinates.getAttribute('data-x'))).toBeCloseTo(
      expected.x,
      1,
    );
    expect(Number(await coordinates.getAttribute('data-y'))).toBeCloseTo(
      expected.y,
      1,
    );
    await expect(pick).toHaveText(
      locale === 'zh' ? '取点坐标' : 'Pick coordinates',
    );
    await expect
      .poll(() =>
        page.evaluate(() => window.mobileApis.A.getAppState().penbarSelected),
      )
      .toBe('select');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await expect(right.locator('[data-state="point"]')).toBeEmpty();
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    await pick.tap();
    await expect(pick).toHaveText(
      locale === 'zh' ? '取消取点' : 'Cancel picking',
    );
    await pick.tap();
    await expect(pick).toHaveText(
      locale === 'zh' ? '取点坐标' : 'Pick coordinates',
    );
    await expect(left.locator('[data-state="point"]')).toBeEmpty();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
