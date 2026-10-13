import { expect, test } from '@playwright/test';

test('configured capacity supports shared StrictMode canvases and App restart', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?maxEntities=16384&maxLimboComponents=32768');
  for (const id of ['left', 'right']) {
    await expect(page.getByTestId(`${id}-status`)).toHaveText('ready', {
      timeout: 45000,
    });
    await expect(page.getByTestId(`${id}-count`)).toHaveText('1');
  }

  expect(
    await page.evaluate(() =>
      window.actions.left.updateNodes((nodes) =>
        nodes.map((node) => ({ ...node, width: 150 })),
      ),
    ),
  ).toBe(true);
  await expect(page.getByTestId('left-object-width')).toHaveText('150');
  await expect(page.getByTestId('right-object-width')).toHaveText('100');
  await page.evaluate(() => window.actions.left.undo());
  await expect(page.getByTestId('left-object-width')).toHaveText('100');

  await page.evaluate(() => window.setShown(['right']));
  await page.waitForFunction(() => Object.keys(window.apis).length === 1);
  expect(
    await page.evaluate(() => window.actions.right.deleteNodes(['right'])),
  ).toBe(true);
  await expect(page.getByTestId('right-count')).toHaveText('0');
  await page.evaluate(() => window.actions.right.undo());
  await expect(page.getByTestId('right-count')).toHaveText('1');

  await page.evaluate(() => window.setShown([]));
  await page.waitForFunction(() => Object.keys(window.apis).length === 0);
  await page.evaluate(() => window.setShown(['left', 'right']));
  for (const id of ['left', 'right']) {
    await expect(page.getByTestId(`${id}-status`)).toHaveText('ready');
    await expect(page.getByTestId(`${id}-count`)).toHaveText('1');
    await expect(page.getByTestId(`${id}-object-width`)).toHaveText('100');
    await expect(page.getByTestId(`${id}-undo`)).toBeDisabled();
  }
  expect(
    await page.evaluate(() => window.actions.left.deleteNodes(['left'])),
  ).toBe(true);
  await expect(page.getByTestId('left-count')).toHaveText('0');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await page.evaluate(() => window.setShown([]));
  await page.waitForFunction(() => Object.keys(window.apis).length === 0);
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

for (const [query, message] of [
  ['maxEntities=0', 'maxEntities must be an integer between 1 and 4194304'],
  [
    'maxEntities=16384&maxLimboComponents=0',
    'maxLimboComponents must be a positive safe integer',
  ],
]) {
  test(`invalid capacity reports a startup error to both canvases: ${query}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?${query}`);
    for (const id of ['left', 'right']) {
      await expect(page.getByTestId(`${id}-status`)).toHaveText('error', {
        timeout: 45000,
      });
    }
    expect(await page.evaluate(() => window.canvasErrors)).toEqual([
      message,
      message,
    ]);
    await expect(page.locator('ic-spectrum-canvas')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(window.apis))).toEqual([]);
    expect(errors).toEqual([]);
  });
}
