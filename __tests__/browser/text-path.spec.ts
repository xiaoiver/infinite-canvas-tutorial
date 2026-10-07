import { expect, test, type Page } from '@playwright/test';
import { registerTextPathRenderingTests } from './text-path-rendering-cases';

registerTextPathRenderingTests('/text-path.html');

async function demo(page: Page) {
  await page.evaluate(() => window.textPathTest.mountDemo());
  const panel = page.getByTestId('text-path-demo');
  await expect(panel.locator('span[role="status"]')).toHaveText('Ready');
  await panel.scrollIntoViewIfNeeded();
  return panel;
}
test('documentation controls and keyboard handles update the actual demo', async ({
  page,
}) => {
  const panel = await demo(page);
  await panel.getByLabel('Text', { exact: true }).fill('Curved text');
  await panel.getByLabel('Path', { exact: true }).selectOption('circle');
  await panel.getByLabel('Direction').selectOption('right');
  await panel.getByLabel('Alignment').selectOption('start');
  await panel.getByRole('button', { name: 'Move text along the path' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    panel.getByRole('slider', { name: 'Along-path offset' }),
  ).toHaveValue('2');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(
    panel.getByRole('slider', { name: 'Along-path offset' }),
  ).toHaveValue('12');
  await page.evaluate(() => window.textPathTest.unmountDemo());
  await expect(panel).toHaveCount(0);
  await demo(page);
});
test('dragging text changes arc-length offset and Escape restores a curve edit', async ({
  page,
}) => {
  const panel = await demo(page);
  const handle = panel.getByRole('button', {
    name: 'Move text along the path',
  });
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      panel.getByRole('slider', { name: 'Along-path offset' }).inputValue(),
    )
    .not.toBe('0');
  const path = panel.locator('svg > path');
  const original = await path.getAttribute('d');
  const point = panel.getByRole('button', {
    name: 'Adjust curve control point 2',
  });
  const p = (await point.boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await page.mouse.move(p.x + p.width / 2 + 35, p.y + p.height / 2 + 55, {
    steps: 5,
  });
  await expect(path).not.toHaveAttribute('d', original!);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(path).toHaveAttribute('d', original!);
});

test('native touch drag moves text and touch cancellation restores its offset', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright only exposes native touch-drag injection through Chromium CDP.',
  );
  const panel = await demo(page);
  const handle = panel.getByRole('button', {
    name: 'Move text along the path',
  });
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const offset = panel.getByRole('slider', { name: 'Along-path offset' });
  const before = await offset.inputValue();
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const point = (x: number) => [
    { x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 },
  ];
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(x),
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(x + 55),
    });
    await expect(offset).not.toHaveValue(before);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await expect(offset).toHaveValue(before);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(x),
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(x + 40),
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(offset).not.toHaveValue(before);
  } finally {
    await session.detach();
  }
});
