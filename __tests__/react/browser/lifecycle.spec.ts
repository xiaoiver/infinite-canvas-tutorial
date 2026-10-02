import { expect, test } from '@playwright/test';

test('core edits commit once, resolve bindings, isolate failures, and support cancellation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-count')).toHaveText('1', {
    timeout: 45000,
  });
  const before = await page.evaluate(() => window.snapshots.left.length);
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const applied = await api.edit((editor) => {
      const node = editor.getNodes()[0];
      if (node.type !== 'rect') throw new Error('Expected a rectangle');
      editor.setAppState({
        variables: { accent: { type: 'color', value: '#f00' } },
      });
      editor.updateNodes([
        {
          ...node,
          width: 160,
          fills: [{ type: 'solid', value: '$accent' }],
        },
      ]);
      editor.record();
      editor.setAppState({
        variables: { accent: { type: 'color', value: '#0f0' } },
      });
      editor.selectNodes([editor.getNodes()[0]]);
      editor.record('NEVER');
    });
    return {
      applied,
      width: api.getNodes()[0].width,
      selection: api.getAppState().layersSelected,
      variables: api.getAppState().variables,
      fill: window.boundFill('left'),
    };
  });
  expect(result).toEqual({
    applied: true,
    width: 160,
    selection: ['left'],
    variables: { accent: { type: 'color', value: '#0f0' } },
    fill: '#0f0',
  });
  expect(await page.evaluate(() => window.snapshots.left.length)).toBe(
    before + 1,
  );
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-selection')).toHaveText('0');
  expect(await page.evaluate(() => window.apis.left.getNodes()[0].width)).toBe(
    100,
  );
  const checks = await page.evaluate(async () => {
    const api = window.apis.left;
    const controller = new AbortController();
    const cancelled = api.edit(
      (editor) => editor.updateNodes([{ ...editor.getNodes()[0], width: 999 }]),
      {
        signal: controller.signal,
      },
    );
    controller.abort();
    const failed = api
      .edit(() => {
        throw new Error('invalid edit');
      })
      .catch((error: Error) => error.message);
    const asynchronous = api
      .edit(async () => {})
      .catch((error: Error) => error.message);
    const applied = api.edit((editor) =>
      editor.updateNodes([{ ...editor.getNodes()[0], width: 120 }]),
    );
    return {
      outcomes: await Promise.all([cancelled, failed, asynchronous, applied]),
      width: api.getNodes()[0].width,
      otherWidth: window.apis.right.getNodes()[0].width,
    };
  });
  expect(checks).toEqual({
    outcomes: [
      false,
      'invalid edit',
      'Canvas edits must be synchronous. Await work before edit().',
      true,
    ],
    width: 120,
    otherWidth: 100,
  });
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.apis.left.getNodes()[0].width)).toBe(
    100,
  );
  expect(errors).toEqual([]);
});

test('editing hooks compose live updates, group undo, and refresh view settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-count')).toHaveText('1', {
    timeout: 45000,
  });
  const committed = await page.evaluate(async () => {
    const actions = window.actions.left;
    const enlarge = () =>
      actions.updateNodes((nodes) =>
        nodes.map((node) => ({ ...node, width: node.width! + 20 })),
      );
    return Promise.all([enlarge(), enlarge()]);
  });
  expect(committed).toEqual([true, true]);
  expect(await page.evaluate(() => window.apis.left.getNodes()[0].width)).toBe(
    140,
  );
  expect(await page.evaluate(() => window.apis.right.getNodes()[0].width)).toBe(
    100,
  );
  await page.getByTestId('left-undo').click();
  await page.waitForFunction(
    () => window.apis.left.getNodes()[0].width === 120,
  );
  await page.getByTestId('left-undo').click();
  await page.waitForFunction(
    () => window.apis.left.getNodes()[0].width === 100,
  );
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.actions.left.clearHistory());
  const before = await page.evaluate(() => window.snapshots.left.length);
  await page.getByTestId('left-batch-edit').click();
  await expect(page.getByTestId('left-selection')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  expect(await page.evaluate(() => window.snapshots.left.length)).toBe(
    before + 1,
  );
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-selection')).toHaveText('0');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.apis.left.getNodes()[0].width)).toBe(
    100,
  );
  await page.evaluate(() =>
    window.actions.left.setAppState(
      { penbarVisible: false },
      { capture: 'NEVER' },
    ),
  );
  await expect(page.getByTestId('left-penbar')).toHaveText('false');
  await expect(page.getByTestId('right-penbar')).toHaveText('true');
  await expect(
    page
      .locator('ic-spectrum-canvas')
      .first()
      .locator('ic-spectrum-penbar sp-action-group'),
  ).toHaveCount(0);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

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
