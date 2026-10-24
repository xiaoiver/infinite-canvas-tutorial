import { expect, test, type Page } from '@playwright/test';
import type {} from './fixtures/isometric-docs';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
test.setTimeout(90000);

async function prepareAnchor(page: Page) {
  await page.goto('/isometric-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
      timeout: 30000,
    })
    .toBe(true);
  expect(
    (await page.evaluate(() => window.isometricDocs.selectGroup())).sort(),
  ).toEqual(['iso-cube', 'iso-ring']);
  const original = await page.evaluate(() => window.isometricDocs.path());
  await page.getByRole('button', { name: '编辑 SVG 锚点' }).click();
  const anchor = page
    .locator('svg.isometric-preview circle.path-anchor')
    .first();
  await expect(anchor).toBeVisible();
  const box = await anchor.boundingBox();
  expect(box).not.toBeNull();
  const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  expect(point.x).toBeGreaterThan(0);
  expect(point.x).toBeLessThan(390);
  return { point, original };
}

async function dragTouch(
  page: Page,
  start: { x: number; y: number },
  delta: [number, number] = [18, 12],
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1, radiusX: 9, radiusY: 9, force: 1 }],
    });
    await page.evaluate(() => window.isometricDocs.settle());
    for (let step = 1; step <= 4; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: start.x + (delta[0] * step) / 4,
            y: start.y + (delta[1] * step) / 4,
            id: 1,
            radiusX: 9,
            radiusY: 9,
            force: 1,
          },
        ],
      });
      await page.evaluate(() => window.isometricDocs.settle());
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.evaluate(() => window.isometricDocs.settle());
  } finally {
    await session.detach();
  }
}

async function dragPen(
  page: Page,
  start: { x: number; y: number },
  delta: [number, number] = [18, 12],
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...start,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'pen',
    });
    await page.evaluate(() => window.isometricDocs.settle());
    for (let step = 1; step <= 4; step++) {
      await session.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: start.x + (delta[0] * step) / 4,
        y: start.y + (delta[1] * step) / 4,
        button: 'none',
        buttons: 1,
        pointerType: 'pen',
      });
      await page.evaluate(() => window.isometricDocs.settle());
    }
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: start.x + delta[0],
      y: start.y + delta[1],
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'pen',
    });
    await page.evaluate(() => window.isometricDocs.settle());
  } finally {
    await session.detach();
  }
}

for (const pointerType of ['touch', 'pen'] as const) {
  test(`the isometric example edits an SVG anchor with trusted ${pointerType} input`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const { point, original } = await prepareAnchor(page);
    if (pointerType === 'touch') await dragTouch(page, point);
    else await dragPen(page, point);
    expect(
      await page.evaluate(() => window.isometricDocs.lastAnchorPointer()),
    ).toEqual({ pointerType, trusted: true });
    expect(
      await page.evaluate(() => window.isometricDocs.anchorEvents()),
    ).toContain(`pointerup:${pointerType}`);
    await expect
      .poll(() => page.evaluate(() => window.isometricDocs.path()))
      .not.toBe(original);
    await page.evaluate(() => window.isometricDocs.undo());
    expect(await page.evaluate(() => window.isometricDocs.path())).toBe(
      original,
    );
    expect(errors).toEqual([]);
  });

  test(`the shared isometric gizmo moves both meshes with trusted ${pointerType} input`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/isometric-docs.html');
    await expect
      .poll(() => page.evaluate(() => window.isometricDocs.ready()), {
        timeout: 30000,
      })
      .toBe(true);
    expect(
      (await page.evaluate(() => window.isometricDocs.selectGroup())).sort(),
    ).toEqual(['iso-cube', 'iso-ring']);
    const before = await page.evaluate(() =>
      window.isometricDocs.groupPositions(),
    );
    const { point, delta } = await page.evaluate(() =>
      window.isometricDocs.groupXHandle(),
    );
    if (pointerType === 'touch') await dragTouch(page, point, delta);
    else await dragPen(page, point, delta);
    const after = await page.evaluate(() =>
      window.isometricDocs.groupPositions(),
    );
    expect(after.cube! - before.cube!).toBeGreaterThan(4);
    expect(after.ring! - before.ring!).toBeCloseTo(
      after.cube! - before.cube!,
      2,
    );
    await page.evaluate(() => window.isometricDocs.undo());
    expect(
      await page.evaluate(() => window.isometricDocs.groupPositions()),
    ).toEqual(before);
    expect(errors).toEqual([]);
  });
}
