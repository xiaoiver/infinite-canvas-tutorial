import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type { LayersPanel } from '@infinite-canvas-tutorial/webcomponents/spectrum';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';
type LayerDropEvent = {
  from: HTMLElement;
  to: HTMLElement;
  item: HTMLElement;
  oldIndex: number;
  newIndex: number;
};
// Only the public Sortable surface needed to dispatch its real onEnd callback.
type SortableHandle = {
  el: HTMLElement;
  option(name: 'onEnd'): (event: LayerDropEvent) => void;
};

declare global {
  interface Window {
    finishLayerCopy: () => void;
    copiedLayers: SerializedNode[];
    layerCutResult: boolean | 'pending';
  }
}

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(() => {
    void window.apis.left.edit(
      (api) => {
        for (const [id, x, y, zIndex] of [
          ['group-a', 100, 20, 2],
          ['group-b', 200, 80, 3],
        ] as const) {
          api.updateNode({
            id,
            type: 'g',
            name: id,
            x,
            y,
            width: 150,
            height: 100,
            zIndex,
          });
        }
        api.updateNode(api.getNodeById('left')!, {
          parentId: 'group-a',
          name: 'Left',
          x: 10,
          y: 15,
          zIndex: 1,
        });
        for (const [id, parentId] of [
          ['child-a', 'group-a'],
          ['child-b', 'group-b'],
        ] as const) {
          api.updateNode({
            id,
            type: 'rect',
            name: id,
            parentId,
            x: 30,
            y: 20,
            width: 40,
            height: 30,
            zIndex: 2,
          });
        }
        api.selectNodes([api.getNodeById('left')!]);
        api.setAppState({
          taskbarVisible: true,
          taskbarSelected: ['show-layers-panel'] as ReturnType<
            typeof api.getAppState
          >['taskbarSelected'],
          layersExpanded: ['group-a', 'group-b'],
        });
      },
      { capture: 'NEVER' },
    );
  });
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-layers-panel');
  await expect(panel.locator('#layers-panel-item-left')).toBeVisible();
  await expect(panel.locator('#layers-panel-item-child-b')).toBeAttached();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { panel, errors };
}

async function field(page: Page, id: string, key: string, expected: unknown) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ id, key }) =>
          (
            window.apis.left.getNodeById(id) as unknown as
              | Record<string, unknown>
              | undefined
          )?.[key],
        { id, key },
      ),
    )
    .toEqual(expected);
}
async function drain(page: Page) {
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
}
async function select(page: Page, ids: string[]) {
  await page.evaluate(
    (ids) =>
      window.apis.left.edit(
        (api) => api.selectNodes(ids.map((id) => api.getNodeById(id)!)),
        { capture: 'NEVER' },
      ),
    ids,
  );
}
async function key(page: Page, keys: string[]) {
  await page.evaluate((keys) => {
    const canvas = window.apis.left.getCanvasElement();
    canvas.focus();
    // Keep these native Web Component keys inside its shadow root. The React
    // wrapper has its own already-tested Backspace command in capture phase.
    keys.forEach((key) =>
      canvas.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      ),
    );
  }, keys);
}
function deleteButton(panel: Locator) {
  return panel.locator('sp-action-group.actions > sp-action-button').last();
}
async function drop(panel: Locator, id: string, toParentId: string, index = 0) {
  await expect
    .poll(() =>
      panel.evaluate(
        (element) =>
          (element as unknown as { sortableInstances: SortableHandle[] })
            .sortableInstances.length,
      ),
    )
    .toBe(3);
  await panel.evaluate(
    (element: LayersPanel, { id, toParentId, index }) => {
      const root = element.shadowRoot!;
      const item = root.querySelector<HTMLElement>(
        `.layer-branch[data-node-id="${id}"]`,
      )!;
      const from = item.parentElement!;
      const to = root.querySelector<HTMLElement>(
        `.layer-siblings[data-layer-parent-id="${toParentId}"]`,
      )!;
      const oldIndex = Array.from(from.children).indexOf(item);
      item.remove();
      to.insertBefore(item, to.children[index] ?? null);
      const sortable = (
        element as unknown as { sortableInstances: SortableHandle[] }
      ).sortableInstances.find((s) => s.el === from)!;
      const onEnd = sortable.option('onEnd')!;
      void onEnd({
        from,
        to,
        item,
        oldIndex,
        newIndex: index,
      });
      // The callback must restore Lit's DOM synchronously, before the edit runs.
      if (item.parentElement !== from || from.children[oldIndex] !== item)
        throw new Error('Sortable DOM was not restored');
    },
    { id, toParentId, index },
  );
}

for (const [arrow, axis, initial, delta] of [
  ['ArrowRight', 'x', 10, 10],
  ['ArrowLeft', 'x', 10, -10],
  ['ArrowDown', 'y', 15, 10],
  ['ArrowUp', 'y', 15, -10],
] as const) {
  test(`repeated ${arrow} accumulates live positions and has separate undo entries`, async ({
    page,
  }) => {
    const { errors } = await ready(page);
    await key(page, [arrow, arrow]);
    await field(page, 'left', axis, initial + delta * 2);
    for (const expected of [initial + delta, initial]) {
      await page.getByTestId('left-undo').click();
      await field(page, 'left', axis, expected);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('nudge captures targets while resolving their newest position', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          editor.updateNode(editor.getNodeById('left')!, { x: 25 });
          editor.selectNodes([editor.getNodeById('child-b')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await key(page, ['ArrowRight']);
  await field(page, 'left', 'x', 35);
  await field(page, 'child-b', 'x', 30);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'x', 25);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const stale of ['locked', 'deleted', 'replaced'] as const) {
  test(`nudge skips a ${stale} target without capturing pending edits`, async ({
    page,
  }) => {
    const { errors } = await ready(page);
    await page.evaluate((stale) => {
      const api = window.apis.left;
      const edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            if (stale === 'deleted') editor.deleteNodesById(['left']);
            else
              editor.updateNode(
                editor.getNodeById('left')!,
                stale === 'locked' ? { locked: true } : { type: 'ellipse' },
              );
          },
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          editor.updateNode(editor.getNodeById('child-b')!, {
            name: 'Pending',
          });
          update(editor);
        }, options);
      };
    }, stale);
    await key(page, ['ArrowRight']);
    await drain(page);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await field(page, 'left', 'x', stale === 'deleted' ? undefined : 10);
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await field(page, 'child-b', 'name', 'child-b');
    expect(errors).toEqual([]);
  });
}

test('panel deletion removes a whole branch, selects a surviving layer, and undoes once', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await select(page, ['group-a']);
  await deleteButton(panel).click();
  for (const id of ['group-a', 'left', 'child-a'])
    await field(page, id, 'id', undefined);
  expect(
    await page.evaluate(() => window.apis.left.getAppState().layersSelected),
  ).toEqual(['group-b']);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'parentId', 'group-a');
  await field(page, 'child-a', 'parentId', 'group-a');
  expect(
    await page.evaluate(() => window.apis.left.getAppState().layersSelected),
  ).toEqual(['group-a']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued panel deletion preserves a newer selection', async ({ page }) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => editor.selectNodes([editor.getNodeById('child-b')!]),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await deleteButton(panel).click();
  await field(page, 'left', 'id', undefined);
  expect(
    await page.evaluate(() => window.apis.left.getAppState().layersSelected),
  ).toEqual(['child-b']);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'id', 'left');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('native Backspace deletes captured targets once despite duplicate keys', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await key(page, ['Backspace', 'Backspace']);
  await field(page, 'left', 'id', undefined);
  await drain(page);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'id', 'left');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('native cut writes clipboard event data synchronously and deletes a deduplicated branch once', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await select(page, ['group-a', 'left']);
  const copied = await page.evaluate(() => {
    const api = window.apis.left;
    const canvas = api.getCanvasElement();
    canvas.focus();
    const data = new DataTransfer();
    canvas.dispatchEvent(
      new ClipboardEvent('cut', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    const copied = data.getData('text/plain');
    data.clearData();
    return copied;
  });
  expect(
    JSON.parse(copied)
      .map((node: SerializedNode) => node.id)
      .sort(),
  ).toEqual(['child-a', 'group-a', 'left']);
  await field(page, 'group-a', 'id', undefined);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'parentId', 'group-a');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

async function startCopy(page: Page, ids = ['left']) {
  await page.evaluate((ids) => {
    const api = window.apis.left;
    api.copyToClipboard = (nodes) => {
      window.copiedLayers = nodes;
      return new Promise<void>((resolve) => {
        window.finishLayerCopy = resolve;
      });
    };
    window.layerCutResult = 'pending';
    void window
      .cut(api, { ...api.getAppState(), layersSelected: ids })
      .then((result) => {
        window.layerCutResult = result;
      });
  }, ids);
}
async function cutResult(page: Page, expected: boolean) {
  await expect
    .poll(() => page.evaluate(() => window.layerCutResult))
    .toBe(expected);
}

test('async cut waits for copying and keeps its original targets after selection changes', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await startCopy(page);
  await drain(page);
  await field(page, 'left', 'id', 'left');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await select(page, ['child-b']);
  await page.evaluate(() => window.finishLayerCopy());
  await cutResult(page, true);
  await field(page, 'left', 'id', undefined);
  await field(page, 'child-b', 'id', 'child-b');
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'id', 'left');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const change of ['target', 'descendant', 'new-child'] as const) {
  test(`async cut preserves a ${change} changed during clipboard preparation`, async ({
    page,
  }) => {
    const { errors } = await ready(page);
    await startCopy(page, ['group-a']);
    await page.evaluate((change) => {
      const api = window.apis.left;
      // Leave the remote/user edit unrecorded, so cancellation must not consume it.
      api.runAtNextTick(() => {
        if (change === 'new-child')
          api.updateNode({
            id: 'new-child',
            type: 'rect',
            parentId: 'group-a',
            x: 0,
            y: 0,
            width: 5,
            height: 5,
            zIndex: 3,
          });
        else
          api.updateNode(
            api.getNodeById(change === 'target' ? 'group-a' : 'left')!,
            { name: 'Newer' },
          );
        window.finishLayerCopy();
      });
    }, change);
    await cutResult(page, false);
    await field(page, 'group-a', 'id', 'group-a');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(
      await page.evaluate(
        () => window.copiedLayers.find((node) => node.id === 'left')!.name,
      ),
    ).toBe('Left');
    await page.evaluate(() => window.apis.left.record());
    await expect(page.getByTestId('left-undo')).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

test('clipboard rejection leaves nodes intact and a later cut can succeed', async ({
  page,
}) => {
  const { errors } = await ready(page);
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(message.text());
  });
  expect(
    await page.evaluate(async () => {
      const api = window.apis.left;
      api.copyToClipboard = () => Promise.reject(new Error('copy rejected'));
      return window.cut(api, api.getAppState());
    }),
  ).toBe(false);
  await field(page, 'left', 'id', 'left');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(logged.join(' ')).toContain('copy rejected');
  expect(
    await page.evaluate(async () => {
      const api = window.apis.left;
      api.copyToClipboard = () => Promise.resolve();
      return window.cut(api, api.getAppState());
    }),
  ).toBe(true);
  await field(page, 'left', 'id', undefined);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'id', 'left');
  expect(errors).toEqual([]);
});

test('destroying the canvas during copying prevents the pending cut', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await startCopy(page);
  await page.evaluate(() =>
    window.flushReact(() => window.setShown(['right'])),
  );
  await expect(page.getByTestId('left-status')).toHaveCount(0);
  await page.evaluate(() => window.finishLayerCopy());
  await cutResult(page, false);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('reparent uses latest translations and restores both hierarchy and order with one undo', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) =>
          editor.updateNode(editor.getNodeById('group-a')!, { x: 150 }),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await drop(panel, 'left', 'group-b', 0);
  await field(page, 'left', 'parentId', 'group-b');
  await field(page, 'left', 'x', -40);
  await field(page, 'left', 'y', -45);
  await expect(
    panel.locator(
      '.layer-siblings[data-layer-parent-id="group-b"] > .layer-branch[data-node-id="left"]',
    ),
  ).toBeAttached();
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'parentId', 'group-a');
  await field(page, 'left', 'x', 10);
  await field(page, 'child-b', 'zIndex', 2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await field(page, 'left', 'parentId', 'group-b');
  expect(errors).toEqual([]);
});

test('sibling reorder and moving back to the root each commit once', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await drop(panel, 'left', 'group-a', 1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodeById('left')!.zIndex >
          window.apis.left.getNodeById('child-a')!.zIndex,
      ),
    )
    .toBe(true);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'zIndex', 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await drop(panel, 'left', '', 0);
  await field(page, 'left', 'parentId', undefined);
  await field(page, 'left', 'x', 110);
  await field(page, 'left', 'y', 35);
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'parentId', 'group-a');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const stale of [
  'parent-deleted',
  'sibling-deleted',
  'locked',
  'reparented',
  'cyclic-parent',
] as const) {
  test(`drop validation rejects ${stale} before any partial reparent`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await page.evaluate((stale) => {
      const api = window.apis.left;
      const edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            if (stale === 'parent-deleted') editor.deleteNodesById(['group-b']);
            else if (stale === 'sibling-deleted')
              editor.deleteNodesById(['child-b']);
            else if (stale === 'cyclic-parent')
              editor.updateNode(editor.getNodeById('group-b')!, {
                parentId: 'left',
              });
            else
              editor.updateNode(
                editor.getNodeById('left')!,
                stale === 'locked' ? { locked: true } : { parentId: undefined },
              );
          },
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          editor.updateNode(editor.getNodeById('child-a')!, {
            name: 'Pending',
          });
          update(editor);
        }, options);
      };
    }, stale);
    await drop(panel, 'left', 'group-b', 0);
    await drain(page);
    await field(
      page,
      'left',
      'parentId',
      stale === 'reparented' ? undefined : 'group-a',
    );
    await field(page, 'left', 'x', 10);
    await field(page, 'left', 'zIndex', 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await field(page, 'child-a', 'name', 'child-a');
    expect(errors).toEqual([]);
  });
}

test('a drop already applied by an earlier queued edit does not renumber or consume pending history', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) =>
          editor.updateNode(editor.getNodeById('left')!, { zIndex: 3 }),
        { capture: 'NEVER' },
      );
      return edit((editor) => {
        editor.updateNode(editor.getNodeById('child-b')!, { name: 'Pending' });
        update(editor);
      }, options);
    };
  });
  await drop(panel, 'left', 'group-a', 1);
  await drain(page);
  await field(page, 'left', 'zIndex', 3);
  await field(page, 'child-a', 'zIndex', 2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await field(page, 'child-b', 'name', 'child-b');
  expect(errors).toEqual([]);
});

test('rejected drop restores its DOM and can be retried', async ({ page }) => {
  const { panel, errors } = await ready(page);
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(message.text());
  });
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('drop rejected'));
    };
  });
  await drop(panel, 'left', 'group-b');
  await expect.poll(() => logged.join(' ')).toContain('drop rejected');
  await field(page, 'left', 'parentId', 'group-a');
  await expect(
    panel.locator(
      '.layer-siblings[data-layer-parent-id="group-a"] > .layer-branch[data-node-id="left"]',
    ),
  ).toBeAttached();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await drop(panel, 'left', 'group-b');
  await field(page, 'left', 'parentId', 'group-b');
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'parentId', 'group-a');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('native cut sees a new selection before the consumed context rerenders', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await select(page, []);
  const copied = await page.evaluate(() => {
    const api = window.apis.left;
    api.selectNodes([api.getNodeById('group-b')!]);
    const canvas = api.getCanvasElement();
    canvas.focus();
    const data = new DataTransfer();
    canvas.dispatchEvent(
      new ClipboardEvent('cut', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    return data.getData('text/plain');
  });
  expect(
    JSON.parse(copied)
      .map((node: SerializedNode) => node.id)
      .sort(),
  ).toEqual(['child-b', 'group-b']);
  await field(page, 'group-b', 'id', undefined);
  await page.getByTestId('left-undo').click();
  await field(page, 'group-b', 'id', 'group-b');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('pointer dragging a layer row updates order through the configured Sortable integration', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const source = panel.locator('#layers-panel-item-child-a');
  const target = panel.locator('#layers-panel-item-left');
  await source.dragTo(target, {
    sourcePosition: { x: 220, y: 32 },
    targetPosition: { x: 220, y: 8 },
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodeById('child-a')!.zIndex <
          window.apis.left.getNodeById('left')!.zIndex,
      ),
    )
    .toBe(true);
  await expect(
    panel
      .locator(
        '.layer-siblings[data-layer-parent-id="group-a"] > .layer-branch',
      )
      .first(),
  ).toHaveAttribute('data-node-id', 'child-a');
  await page.getByTestId('left-undo').click();
  await field(page, 'left', 'zIndex', 1);
  await field(page, 'child-a', 'zIndex', 2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
