import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => {
        api.updateNode({
          id: 'second',
          type: 'rect',
          x: 180,
          y: 70,
          width: 40,
          height: 30,
          zIndex: 1,
        });
        api.selectNodes(['left', 'second'].map((id) => api.getNodeById(id)!));
      },
      { capture: 'NEVER' },
    );
  });
  // edit completion precedes rendering; commands using bounds need a laid-out scene.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const api = window.apis.left;
        return api.getBounds([api.getNodeById('second')!]).maxX;
      }),
    )
    .toBe(220);
}

async function groupCount(page: Page, count: number) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left
            .getNodes()
            .filter((node) => !node.isDeleted && node.type === 'g').length,
      ),
    )
    .toBe(count);
}

async function shortcut(page: Page, shiftKey = false) {
  await page.evaluate((shiftKey) => {
    const api = window.apis.left;
    api.getCanvasElement().focus();
    api.getCanvasElement().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        shiftKey,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  }, shiftKey);
}

async function cropMenu(page: Page) {
  // Opening the menu reads the clipboard to decide whether Paste is enabled.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const canvas = page.getByTestId('left-shortcuts').locator('canvas');
  const box = (await canvas.boundingBox())!;
  // Empty canvas space keeps the existing multiple selection.
  await canvas.dispatchEvent('contextmenu', {
    clientX: box.x + 350,
    clientY: box.y + 240,
  });
  const item = page
    .getByTestId('left-shortcuts')
    .locator('sp-menu-item[value="crop"]');
  await expect(item).toBeVisible();
  await item.click();
}

test('group and ungroup shortcuts each commit hierarchy and selection once', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await shortcut(page);
  await groupCount(page, 1);
  const groupId = await page.evaluate(() => {
    const api = window.apis.left;
    const [id] = api.getAppState().layersSelected;
    return id;
  });
  expect(
    await page.evaluate((id) => {
      const api = window.apis.left;
      return {
        type: api.getNodeById(id)!.type,
        parents: ['left', 'second'].map((id) => api.getNodeById(id)!.parentId),
      };
    }, groupId),
  ).toEqual({ type: 'g', parents: [groupId, groupId] });
  await page.getByTestId('left-undo').click();
  await groupCount(page, 0);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.left.getAppState().layersSelected),
  ).toEqual(['left', 'second']);
  await page.getByTestId('left-redo').click();
  await groupCount(page, 1);
  await shortcut(page, true);
  await groupCount(page, 0);
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      return {
        selected: api.getAppState().layersSelected,
        nodes: ['left', 'second'].map((id) => {
          const node = api.getNodeById(id)!;
          return { parent: node.parentId ?? null, x: node.x, y: node.y };
        }),
      };
    }),
  ).toEqual({
    selected: ['left', 'second'],
    nodes: [
      { parent: null, x: 50, y: 50 },
      { parent: null, x: 180, y: 70 },
    ],
  });
  await page.getByTestId('left-undo').click();
  await groupCount(page, 1);
  await page.getByTestId('left-redo').click();
  await groupCount(page, 0);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('crop menu creates one undoable parent and reuses an existing clip', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await cropMenu(page);
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getAppState().layersCropping.length),
    )
    .toBe(1);
  const clip = await page.evaluate(() => {
    const api = window.apis.left;
    const [id] = api.getAppState().layersCropping;
    const node = api.getNodeById(id)!;
    return {
      id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      clipMode: node.clipMode,
      parents: ['left', 'second'].map((id) => api.getNodeById(id)!.parentId),
    };
  });
  expect(clip).toEqual({
    id: expect.any(String),
    x: 50,
    y: 50,
    width: 170,
    height: 80,
    clipMode: 'soft',
    parents: [clip.id, clip.id],
  });
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodes().filter((node) => !node.isDeleted).length,
      ),
    )
    .toBe(2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodes().filter((node) => !node.isDeleted).length,
      ),
    )
    .toBe(3);
  await page.evaluate(async (id) => {
    await window.apis.left.edit(
      (api) => {
        api.setAppState({ layersCropping: [] });
        api.selectNodes([api.getNodeById(id)!]);
      },
      { capture: 'NEVER' },
    );
  }, clip.id);
  await cropMenu(page);
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getAppState().layersCropping),
    )
    .toEqual([clip.id]);
  expect(
    await page.evaluate(
      () =>
        window.apis.left.getNodes().filter((node) => !node.isDeleted).length,
    ),
  ).toBe(3);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued grouping keeps the original targets when selection and context change', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const menu = api.element.shadowRoot!.querySelector(
      'ic-spectrum-context-menu',
    )!;
    // The consumed Lit context may lag behind an API selection change.
    menu.appState = { ...api.getAppState(), layersSelected: ['second'] };
    api.getCanvasElement().focus();
    api.getCanvasElement().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    api.selectNodes([api.getNodeById('second')!]);
  });
  await groupCount(page, 1);
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      const [group] = api.getAppState().layersSelected;
      return ['left', 'second'].every(
        (id) => api.getNodeById(id)!.parentId === group,
      );
    }),
  ).toBe(true);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
});

test('deleted targets and invalid ungroup selections are harmless', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.evaluate(async () => {
    const api = window.apis.left;
    const deletion = api.edit((editor) => editor.deleteNodesById(['second']), {
      capture: 'NEVER',
    });
    api.getCanvasElement().focus();
    api.getCanvasElement().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    await deletion;
    await api.edit(() => {}, { capture: 'NEVER' });
  });
  await groupCount(page, 0);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await shortcut(page, true);
  await page.evaluate(() =>
    window.apis.left.edit(() => {}, { capture: 'NEVER' }),
  );
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued structural edits are cancelled when their canvas unmounts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const results = await page.evaluate(async () => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    const pending: Promise<boolean>[] = [];
    api.edit = (update, options) => {
      const result = edit(update, options);
      pending.push(result);
      return result;
    };
    api.getCanvasElement().focus();
    api.getCanvasElement().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    window.flushReact(() => window.setShown(['right']));
    return Promise.all(pending);
  });
  expect(results).toEqual([false]);
  await expect(page.getByTestId('left-status')).toHaveCount(0);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.getByTestId('right-batch-edit').click();
  await expect(page.getByTestId('right-node-width')).toHaveText('120');
  expect(
    await page.evaluate(() =>
      window.apis.right.getNodes().map((node) => node.id),
    ),
  ).toEqual(['right']);
  expect(errors).toEqual([]);
});

test('menu edit rejections are reported without unhandled promises', async ({
  page,
}) => {
  const errors: string[] = [];
  const reported: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await ready(page);
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('Rejected structural edit'));
  });
  await shortcut(page);
  await expect
    .poll(() =>
      reported.some((message) => message.includes('Rejected structural edit')),
    )
    .toBe(true);
  await groupCount(page, 0);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
