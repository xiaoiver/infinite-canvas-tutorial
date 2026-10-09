import { expect, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type {
  LayersPanel,
  ContextMenu,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';

declare global {
  interface Window {
    selectionCommits: string[][];
    selectionSetupStatus: string;
  }
}

async function ready(page: Page, selectBoth = false) {
  await page.goto('/');
  for (const side of ['left', 'right']) {
    await expect(page.getByTestId(`${side}-status`)).toHaveText('ready', {
      timeout: 45000,
    });
  }
  await page.evaluate((selectBoth) => {
    window.selectionSetupStatus = 'pending';
    // Chromium can collect the Promise awaited by CDP while these panels mount.
    // Observe completion in the page so edit failures/cancellation still fail setup.
    void (async () => {
      const support = '/editing-test-support.ts';
      await import(support);
      for (const [id, api] of Object.entries(window.apis)) {
        const committed = await api.edit(
          (editor) => {
            editor.updateNode({
              id: `${id}-second`,
              type: 'rect',
              name: 'Second',
              x: 210,
              y: 60,
              width: 40,
              height: 40,
              zIndex: 1,
            });
            editor.selectNodes([]);
            editor.setAppState({
              taskbarVisible: true,
              taskbarSelected: ['show-layers-panel'] as ReturnType<
                typeof api.getAppState
              >['taskbarSelected'],
            });
          },
          { capture: 'NEVER' },
        );
        if (!committed) throw new Error(`Panel setup cancelled for ${id}`);
      }
      window.selectionCommits = [];
      window.apis.left.subscribe(({ appState }) =>
        window.selectionCommits.push([...appState.layersSelected]),
      );
      if (selectBoth) {
        for (const [id, api] of Object.entries(window.apis)) {
          const committed = await api.edit(
            (editor) => editor.selectNodes([editor.getNodeById(id)!]),
            { capture: 'NEVER' },
          );
          if (!committed)
            throw new Error(`Selection setup cancelled for ${id}`);
        }
      }
    })().then(
      () => {
        window.selectionSetupStatus = 'ready';
      },
      (error) => {
        window.selectionSetupStatus = String(error);
      },
    );
  }, selectBoth);
  await expect
    .poll(() => page.evaluate(() => window.selectionSetupStatus))
    .not.toBe('pending');
  expect(await page.evaluate(() => window.selectionSetupStatus)).toBe('ready');
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-layers-panel');
  await expect(panel.locator('#layers-panel-item-left')).toBeVisible();
  return panel;
}

async function drain(page: Page) {
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function selected(page: Page, ids: string[], side = 'left') {
  await expect
    .poll(() =>
      page.evaluate(
        (side) => window.apis[side].getAppState().layersSelected,
        side,
      ),
    )
    .toEqual(ids);
  await expect
    .poll(() =>
      page.evaluate(
        (side) => window.editingProbe.selectedEntities(side).sort(),
        side,
      ),
    )
    .toEqual([...ids].sort());
}

test('row clicks and Escape commit in event order, with one undo step per change', async ({
  page,
}) => {
  const panel = await ready(page);
  const immediate = await panel.evaluate((element) => {
    const row = (id: string) =>
      element.shadowRoot!.querySelector(`#layers-panel-item-${id}`)!;
    const click = (id: string, shiftKey = false) =>
      row(id).dispatchEvent(
        new MouseEvent('click', { bubbles: true, shiftKey }),
      );
    click('left');
    click('left-second', true);
    click('left-second', true); // duplicate additive selection is a no-op
    const canvas = window.apis.left.getCanvasElement();
    canvas.focus();
    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    canvas.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Escape',
        bubbles: true,
        composed: true,
      }),
    );
    click('left');
    return window.apis.left.getAppState().layersSelected;
  });
  expect(immediate).toEqual([]);
  await drain(page);
  await selected(page, ['left']);
  expect(await page.evaluate(() => window.selectionCommits)).toEqual([
    ['left'],
    ['left', 'left-second'],
    [],
    ['left'],
  ]);
  for (const ids of [[], ['left', 'left-second'], ['left'], []]) {
    await page.evaluate(() => window.apis.left.undo());
    await selected(page, ids);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  for (const ids of [['left'], ['left', 'left-second'], [], ['left']]) {
    await page.evaluate(() => window.apis.left.redo());
    await selected(page, ids);
  }
  await expect(page.getByTestId('left-redo')).toBeDisabled();
});

test('native Escape belongs to the focused canvas and leaves shadow inputs alone', async ({
  page,
}) => {
  await ready(page, true);
  await page.getByTestId('left-shortcuts').locator('canvas').focus();
  await page.keyboard.press('Escape');
  await drain(page);
  await selected(page, []);
  await selected(page, ['right'], 'right');
  await page.evaluate(() => window.apis.left.undo());
  await selected(page, ['left']);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'selection-input';
    host.attachShadow({ mode: 'open' }).append(document.createElement('input'));
    document.querySelector('[data-testid="left-shortcuts"]')!.append(host);
  });
  await page.locator('#selection-input input').focus();
  await page.keyboard.press('Escape');
  await drain(page);
  await selected(page, ['left']);
  await selected(page, ['right'], 'right');
  await expect(page.getByTestId('left-redo')).toBeEnabled();
});

test('duplicate selection and empty Escape preserve pending changes and redo', async ({
  page,
}) => {
  const panel = await ready(page);
  await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit((editor) => editor.selectNodes(editor.getNodes()), {
      capture: 'NEVER',
    });
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('left')!, { width: 180 }),
    );
    api.undo();
  });
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await panel
    .locator('#layers-panel-item-left')
    .dispatchEvent('click', { shiftKey: true });
  await drain(page);
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
    await new Promise<void>((resolve) =>
      api.runAtNextTick(() => {
        api.updateNode(api.getNodeById('left')!, { height: 170 });
        resolve();
      }),
    );
  });
  await page.getByTestId('left-shortcuts').locator('canvas').focus();
  await page.keyboard.press('Escape');
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await page.evaluate(() => window.apis.left.record());
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  await page.evaluate(() => window.apis.left.undo());
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.height),
    )
    .toBe(80);
});

for (const invalidation of ['locked', 'deleted', 'type'] as const) {
  test(`queued selection rejects a ${invalidation} target`, async ({
    page,
  }) => {
    const panel = await ready(page);
    await panel.evaluate((element, invalidation) => {
      const api = window.apis.left;
      void api.edit(
        (editor) => {
          const node = editor.getNodeById('left')!;
          if (invalidation === 'locked')
            editor.updateNode(node, { locked: true });
          else if (invalidation === 'deleted') editor.deleteNodesById(['left']);
          else
            editor.replaceDocument(
              editor
                .getNodes()
                .map((n) =>
                  n.id === 'left'
                    ? { ...n, type: 'ellipse', cx: 50, cy: 50, rx: 50, ry: 50 }
                    : n,
                ),
            );
        },
        { capture: 'NEVER' },
      );
      element
        .shadowRoot!.querySelector('#layers-panel-item-left')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, invalidation);
    await drain(page);
    await selected(page, []);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
  });
}

test('accepted selections stay on their canvas when the panel is reused or detached', async ({
  page,
}) => {
  const panel = await ready(page);
  await panel.evaluate(async (element: LayersPanel) => {
    const api = element.api;
    const parent = element.parentNode!;
    const row = element.shadowRoot!.querySelector('#layers-panel-item-left')!;
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.api = window.apis.right;
    element.remove();
    // A detached control cannot submit new selections to the replacement API.
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const controller = new AbortController();
    await api.edit(() => controller.abort(), { signal: controller.signal });
    element.api = api;
    parent.appendChild(element);
  });
  await selected(page, ['left']);
  await selected(page, [], 'right');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
});

test('Escape listeners follow component reconnection and API replacement', async ({
  page,
}) => {
  await ready(page);
  const menu = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-context-menu');
  await menu.evaluate(async (element: ContextMenu) => {
    const api = element.api;
    const parent = element.parentNode!;
    element.remove();
    parent.appendChild(element);
    await element.updateComplete;
    const rightMenu = document
      .querySelector('[data-testid="right-shortcuts"] ic-spectrum-canvas')!
      .shadowRoot!.querySelector('ic-spectrum-context-menu');
    if (!rightMenu) throw new Error('expected the right canvas context menu');
    rightMenu.remove();
    element.api = window.apis.right;
    element.requestUpdate();
    await element.updateComplete;
    for (const [editor, id] of [
      [api, 'left'],
      [window.apis.right, 'right'],
    ] as const) {
      await editor.edit((a) => a.selectNodes([a.getNodeById(id)!]), {
        capture: 'NEVER',
      });
    }
    // Non-composed events exercise only the component's listener, independently
    // of the already-covered global ECS keyboard writer.
    api.getCanvasElement().focus();
    api.getCanvasElement().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await drain(page);
  await selected(page, ['left']);
  await menu.evaluate(() => {
    const canvas = window.apis.right.getCanvasElement();
    canvas.focus();
    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await selected(page, [], 'right');
  await selected(page, ['left']);
  await page.evaluate(() => window.apis.right.undo());
  await selected(page, ['right'], 'right');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
});

test('selection failures are contained and retryable; destruction cancels queued work', async ({
  page,
}) => {
  const panel = await ready(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await panel.evaluate(async (element: LayersPanel) => {
    const api = element.api;
    const select = api.selectNodes;
    api.selectNodes = () => {
      throw new Error('selection rejected');
    };
    element
      .shadowRoot!.querySelector('#layers-panel-item-left')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const controller = new AbortController();
    await api.edit(() => controller.abort(), { signal: controller.signal });
    api.selectNodes = select;
  });
  await selected(page, []);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await panel.locator('#layers-panel-item-left').click();
  await selected(page, ['left']);
  await panel.evaluate((element: LayersPanel) => {
    element
      .shadowRoot!.querySelector('#layers-panel-item-left-second')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const canvas = element.api.getCanvasElement();
    canvas.focus();
    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    element.api.destroy();
    window.setShown(['right']);
  });
  await expect(page.getByTestId('left-status')).toHaveCount(0);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  expect(errors).toEqual([]);
});
