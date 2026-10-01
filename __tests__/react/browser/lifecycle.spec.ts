import { expect, test } from '@playwright/test';

test('initialNodes stays outside history after async preparation creates a baseline', async ({
  page,
}) => {
  await page.goto('/?prepare');
  await page.waitForFunction(
    () =>
      Object.keys(window.apis).length === 2 &&
      Object.values(window.apis).every((api) => api.getNodes().length === 1),
  );
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await page.evaluate(() =>
    window.apis.left.runAtNextTick(() => {
      const api = window.apis.left;
      api.updateNodes([{ ...api.getNodes()[0], width: 150 }]);
      api.selectNodes([api.getNodes()[0]]);
      api.record();
    }),
  );
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  const beforeUndo = await page.evaluate(() => window.snapshots.left.length);
  await page.getByTestId('left-undo').click();
  await page.waitForFunction(
    () => window.apis.left.getNodes()[0].width === 100,
  );
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-selection')).toHaveText('0');
  expect(await page.evaluate(() => window.snapshots.left.length)).toBe(
    beforeUndo + 1,
  );
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
});

test('React Providers isolate real canvases through edits, history, zoom, and App restart', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.waitForFunction(
    () =>
      window.apis &&
      Object.keys(window.apis).length === 2 &&
      Object.values(window.apis).every((api) => api.getNodes().length === 1),
  );
  await expect(page.getByTestId('left-slot')).toBeAttached();
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.nodeChanges.left.length)).toBe(1);
  expect(await page.evaluate(() => window.nodeChanges.left[0][0].id)).toBe(
    'left',
  );
  await page.evaluate(() =>
    window.apis.left.runAtNextTick(() => {
      const api = window.apis.left;
      api.updateNodes([{ ...api.getNodes()[0], width: 150 }]);
      api.record();
    }),
  );
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await page.getByTestId('left-undo').click();
  await page.waitForFunction(
    () => window.apis.left.getNodes()[0].width === 100,
  );
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await page.getByTestId('left-redo').click();
  await page.waitForFunction(
    () => window.apis.left.getNodes()[0].width === 150,
  );
  await page.getByTestId('left-zoom-in').click();
  await expect(page.getByTestId('left-zoom')).toHaveText('2');
  await expect(page.getByTestId('right-zoom')).toHaveText('1');
  await page.evaluate(() =>
    window.apis.left.runAtNextTick(() => {
      window.apis.left.selectNodes([window.apis.left.getNodes()[0]]);
    }),
  );
  await expect(page.getByTestId('left-selection')).toHaveText('1');
  await expect(page.getByTestId('right-selection')).toHaveText('0');
  await page.evaluate(() =>
    window.apis.left.runAtNextTick(() => {
      window.apis.left.deselectNodes([window.apis.left.getNodes()[0]]);
    }),
  );
  await expect(page.getByTestId('left-selection')).toHaveText('0');
  await page.evaluate(() => window.apis.left.clearHistory());
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-redo')).toBeDisabled();
  await page.evaluate(() => window.setShown(['right']));
  await page.waitForFunction(() => Object.keys(window.apis).length === 1);
  await page.getByTestId('right-zoom-in').click();
  await expect(page.getByTestId('right-zoom')).toHaveText('2');
  await page.evaluate(() => window.setShown([]));
  await page.waitForFunction(() => Object.keys(window.apis).length === 0);
  // Let the last lease finish App.exit before exercising a new World.
  await page.waitForTimeout(200);
  await page.evaluate(() => window.setShown(['left', 'right']));
  await page.waitForFunction(
    () =>
      window.apis &&
      Object.keys(window.apis).length === 2 &&
      Object.values(window.apis).every((api) => api.getNodes().length === 1),
  );
  await expect(page.getByTestId('left-zoom')).toHaveText('1');
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-selection')).toHaveText('0');
  await page.evaluate(() => window.setShown([]));
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});
