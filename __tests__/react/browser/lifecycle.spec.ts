import { expect, test } from '@playwright/test';
import type { ExportFormat, Pen } from '@infinite-canvas-tutorial/ecs';

for (const locale of ['en', 'zh']) {
  test(`documentation controls edit, delete, and restore a document (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?playground=${locale}`);
    const left = page.locator('[data-canvas="A"]');
    const right = page.locator('[data-canvas="B"]');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2', {
      timeout: 45000,
    });
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await left.locator('[data-action="add"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="selected"]')).toHaveText('1');
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-action="enlarge"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('100');
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-action="delete"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-state="selected"]')).toHaveText('0');
    await expect(left.locator('[data-action="delete"]')).toBeDisabled();
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-action="replace"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-state="selected"]')).toHaveText('0');
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('initial nodes reach the renderer with current transforms and bounds in their commit frame', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?initialFrame&prepare');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await page.waitForFunction(
    () => Object.keys(window.initialFrames).length === 2,
  );
  const initialFrames = await page.evaluate(() => window.initialFrames);
  for (const initial of Object.values(initialFrames)) {
    expect(initial.rendered).toBe(initial.committed);
    expect(initial).toMatchObject({ x: 50, minX: 50, maxX: 150 });
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.nodeChanges.left.length)).toBe(1);
  expect(await page.evaluate(() => window.nodeChanges.right.length)).toBe(1);
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('selected nodes keep valid renderer references through consecutive hierarchy undo and redo', async ({
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
  const renderingFailed = new Promise<void>((resolve) =>
    page.once('pageerror', () => resolve()),
  );
  await Promise.race([
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const api = window.apis.left;
          api.runAtNextTick(() => {
            api.replaceDocument([
              {
                id: 'parent',
                type: 'rect',
                zIndex: 0,
                x: 0,
                y: 0,
                width: 50,
                height: 50,
              },
              {
                id: 'left',
                parentId: 'parent',
                type: 'rect',
                zIndex: 1,
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                fills: [{ type: 'solid', value: 'red' }],
              },
            ]);
            api.clearHistory();
            api.runAtNextTick(() => {
              api.selectNodes([api.getNodeById('left')!]);
              api.record('NEVER');
              api.runAtNextTick(() => {
                api.replaceDocument(
                  [
                    {
                      id: 'left',
                      type: 'rect',
                      zIndex: 1,
                      x: 0,
                      y: 0,
                      width: 10,
                      height: 10,
                    },
                  ],
                  'local',
                );
                api.undo();
                api.runAtNextTick(() => {
                  api.redo();
                  api.runAtNextTick(resolve);
                });
              });
            });
          });
        }),
    ),
    renderingFailed,
  ]);
  expect(errors).toEqual([]);
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('left-selection')).toHaveText('1');
  expect(
    await page.evaluate(() => {
      const node = window.apis.left.getNodeById('left');
      if (node?.type !== 'rect') throw new Error('Expected a rectangle');
      return { fills: node.fills, parentId: node.parentId };
    }),
  ).toEqual({ fills: undefined, parentId: undefined });
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('UI phases deliver current comment coordinates and deferred SVG export events', async ({
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
  await page.evaluate(() => {
    const api = window.apis.left;
    api.element.addEventListener(
      'ic-comment-added',
      (event) => {
        const { canvasX, canvasY, viewportX, viewportY } = (
          event as CustomEvent<{
            canvasX: number;
            canvasY: number;
            viewportX: number;
            viewportY: number;
          }>
        ).detail;
        const expected = api.viewport2Canvas({ x: viewportX, y: viewportY });
        api.element.dataset.commentProbe = JSON.stringify({
          actual: [canvasX, canvasY],
          expected: [expected.x, expected.y],
        });
      },
      { once: true },
    );
    return window.actions.left.setAppState(
      {
        penbarSelected: 'comment' as Pen,
        cameraZoom: 2,
      },
      { capture: 'NEVER' },
    );
  });
  await expect(page.getByTestId('left-zoom')).toHaveText('2');
  const canvas = page.locator('ic-spectrum-canvas').first();
  await canvas.locator('canvas').click({ position: { x: 120, y: 100 } });
  await expect(canvas).toHaveAttribute('data-comment-probe', /actual/);
  const coordinates = JSON.parse(
    (await canvas.getAttribute('data-comment-probe'))!,
  );
  expect(coordinates.actual).toEqual(coordinates.expected);
  const svg = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const api = window.apis.left;
        api.element.addEventListener(
          'ic-screenshot-downloaded',
          (event) => {
            resolve((event as CustomEvent<{ svg: string }>).detail.svg);
          },
          { once: true },
        );
        void api
          .edit(
            (editor) =>
              editor.export({
                format: 'svg' as ExportFormat,
                download: false,
                nodes: [editor.getNodeById('left')!],
              }),
            { capture: 'NEVER' },
          )
          .catch(reject);
      }),
  );
  expect(svg).toContain('<svg');
  expect(svg).toContain('<rect');
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('early edits rebuild hierarchy and renderer resources through replacement, deletion, and undo', async ({
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
  expect(
    await page.evaluate(() =>
      window.actions.left.replaceDocument(
        [
          { id: 'parent', type: 'g', zIndex: 0, x: 30, y: 0 },
          {
            id: 'left',
            type: 'rect',
            parentId: 'parent',
            zIndex: 0,
            x: 5,
            y: 50,
            width: 25,
            height: 20,
            fills: [{ type: 'solid', value: '#f00' }],
          },
        ],
        { capture: 'NEVER' },
      ),
    ),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.sceneGeometry('left')))
    .toEqual({
      x: 35,
      minX: 35,
      maxX: 60,
    });
  expect(await page.evaluate(() => window.boundFill('left'))).toBe('#f00');
  for (let i = 0; i < 2; i++) {
    expect(
      await page.evaluate(() => window.actions.left.deleteNodes(['parent'])),
    ).toBe(true);
    await expect(page.getByTestId('left-count')).toHaveText('0');
    await page.getByTestId('left-undo').click();
    await expect(page.getByTestId('left-count')).toHaveText('2');
    await expect
      .poll(() => page.evaluate(() => window.sceneGeometry('left')))
      .toEqual({
        x: 35,
        minX: 35,
        maxX: 60,
      });
    expect(await page.evaluate(() => window.boundFill('left'))).toBe('#f00');
  }
  expect(await page.evaluate(() => window.sceneGeometry('right'))).toEqual({
    x: 50,
    minX: 50,
    maxX: 150,
  });
  // Allow the real GPU renderer to consume the last restored entities.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('document actions update property hooks and replace the scene with one undo entry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  await page.evaluate(async () =>
    await window.actions.left.selectNodes(['left'], { capture: 'NEVER' }),
  );
  await expect(page.getByTestId('left-node-width')).toHaveText('100');
  await page.evaluate(() =>
    window.actions.left.edit((api) => {
      api.updateNode(api.getNodeById('left')!, { width: 120 });
    }),
  );
  await expect(page.getByTestId('left-node-width')).toHaveText('120');
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-node-width')).toHaveText('100');
  await page.evaluate(() => window.actions.left.clearHistory());
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() =>
      window.actions.left.replaceDocument([
        {
          id: 'replacement',
          type: 'rect',
          zIndex: 0,
          x: 20,
          y: 30,
          width: 70,
          height: 50,
        },
      ]),
    ),
  ).toBe(true);
  await expect(page.getByTestId('left-selected-ids')).toHaveText('');
  await expect(page.getByTestId('left-node-width')).toHaveText('');
  expect(
    await page.evaluate(() =>
      window.apis.left.getNodes().map((node) => node.id),
    ),
  ).toEqual(['replacement']);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-selected-ids')).toHaveText('left');
  await expect(page.getByTestId('left-node-width')).toHaveText('100');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await expect(page.getByTestId('left-selected-ids')).toHaveText('');
  expect(
    await page.evaluate(async () => {
      try {
        await window.actions.left.replaceDocument([
          { id: 'duplicate', type: 'rect', zIndex: 0 },
          { id: 'duplicate', type: 'rect', zIndex: 1 },
        ]);
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    }),
  ).toContain('Duplicate');
  expect(
    await page.evaluate(() =>
      window.apis.left.getNodes().map((node) => node.id),
    ),
  ).toEqual(['replacement']);
  await expect(page.getByTestId('right-count')).toHaveText('1');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

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
