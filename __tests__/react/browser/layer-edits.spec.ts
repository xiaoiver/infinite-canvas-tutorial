import { expect, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type {
  LayerName,
  LayersPanelItem,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';

// Exercise the actual Spectrum controls with the real editor and history queue.
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
        api.updateNode(api.getNodeById('left')!, {
          name: 'Original',
          visibility: 'visible',
          locked: false,
          zIndex: 1,
        });
        for (const [id, zIndex] of [
          ['below', 0],
          ['above', 2],
        ] as const) {
          api.updateNode({
            id,
            type: 'rect',
            name: id,
            x: 240,
            y: 180,
            width: 30,
            height: 30,
            zIndex,
          });
        }
        api.selectNodes([api.getNodeById('left')!]);
        api.setAppState({
          taskbarVisible: true,
          taskbarSelected: ['show-layers-panel'] as ReturnType<
            typeof api.getAppState
          >['taskbarSelected'],
        });
      },
      { capture: 'NEVER' },
    );
  });
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-layers-panel');
  const row = panel.locator('#layers-panel-item-left');
  await expect(row.locator('ic-spectrum-layer-name span')).toHaveText(
    'Original',
  );
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { panel, row, name: row.locator('ic-spectrum-layer-name'), errors };
}

async function field(page: Page, key: string, expected: unknown, id = 'left') {
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, id }) => {
          const node = window.apis.left.getNodeById(id)!;
          return (node as unknown as Record<string, unknown>)[key];
        },
        { key, id },
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

async function contextMenu(page: Page) {
  // The existing context menu checks clipboard availability on open.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const host = page.getByTestId('left-shortcuts');
  await host.locator('canvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        clientX: rect.left + 180,
        clientY: rect.top + 120,
      }),
    );
  });
  const menu = host.locator('ic-spectrum-context-menu sp-menu').first();
  await expect(menu).toBeVisible();
  return menu;
}

for (const [key, initial, next, index] of [
  ['visibility', 'visible', 'hidden', 0],
  ['locked', false, true, 1],
] as const) {
  test(`rapid row ${key} toggles each form an undo entry without selecting the row`, async ({
    page,
  }) => {
    const { row, errors } = await ready(page);
    await page.evaluate(async () => {
      await window.apis.left.edit(
        (api) => api.selectNodes([api.getNodeById('above')!]),
        { capture: 'NEVER' },
      );
    });
    await row.evaluate((element, index) => {
      const button = element.shadowRoot!.querySelectorAll<HTMLElement>(
        '.layer-row > sp-action-button',
      )[index];
      button.click();
      button.click();
      button.click();
    }, index);
    await field(page, key, next);
    await drain(page);
    expect(
      await page.evaluate(() => window.apis.left.getAppState().layersSelected),
    ).toEqual(['above']);
    for (const expected of [initial, next, initial]) {
      await page.getByTestId('left-undo').click();
      await field(page, key, expected);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

for (const [action, key, next] of [
  ['toggle-visibility', 'visibility', 'hidden'],
  ['toggle-lock', 'locked', true],
  ['bring-to-front', 'zIndex', 3],
  ['bring-forward', 'zIndex', 500001],
  ['send-backward', 'zIndex', -500000],
  ['send-to-back', 'zIndex', -1],
] as const) {
  test(`context menu ${action} commits once and can be undone`, async ({
    page,
  }) => {
    const { errors } = await ready(page);
    const menu = await contextMenu(page);
    await menu.locator(`[value="${action}"]`).click();
    await field(page, key, next);
    await page.getByTestId('left-undo').click();
    await field(
      page,
      key,
      key === 'zIndex' ? 1 : key === 'locked' ? false : 'visible',
    );
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('panel arrangement and keyboard commands use current sibling order', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  // Keep both commands in one browser task so the second must resolve new state.
  await panel.evaluate((element) => {
    const menu =
      element.shadowRoot!.querySelectorAll<HTMLElement>('sp-menu-item');
    menu[1].click();
    menu[2].click();
  });
  await drain(page);
  await field(page, 'zIndex', 1);
  await page.getByTestId('left-undo').click();
  await field(page, 'zIndex', 500001);
  await page.getByTestId('left-undo').click();
  await field(page, 'zIndex', 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  const canvas = page.getByTestId('left-shortcuts').locator('canvas');
  await canvas.evaluate((canvas) => {
    canvas.focus();
    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: ']',
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      }),
    );
  });
  await field(page, 'zIndex', 3);
  await page.getByTestId('left-undo').click();
  await field(page, 'zIndex', 1);
  expect(errors).toEqual([]);
});

test('a submitted row command retains its canvas and target when the control is reused', async ({
  page,
}) => {
  const { row, errors } = await ready(page);
  await row.evaluate((element: LayersPanelItem) => {
    const api = element.api;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          editor.updateNode(editor.getNodeById('left')!, { locked: true });
          editor.selectNodes([editor.getNodeById('above')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    element
      .shadowRoot!.querySelectorAll<HTMLElement>(
        '.layer-row > sp-action-button',
      )[1]
      .click();
    // The row's thumbnail still consumes the left provider in this fixture.
    // Reuse the row with another left node while replacing its command API.
    element.api = window.apis.right;
    element.node = api.getNodeById('above')!;
  });
  await drain(page);
  await field(page, 'locked', false);
  await page.getByTestId('left-undo').click();
  await field(page, 'locked', true);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.right.getNodeById('right')!.locked),
  ).toBeFalsy();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const stale of ['deleted', 'replaced'] as const) {
  test(`a ${stale} target is skipped without capturing unrelated pending edits`, async ({
    page,
  }) => {
    const { row, errors } = await ready(page);
    await row.evaluate((element: LayersPanelItem, stale) => {
      const api = element.api;
      const edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            if (stale === 'deleted') editor.deleteNodesById(['left']);
            else
              editor.updateNode(editor.getNodeById('left')!, {
                type: 'ellipse',
              });
          },
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          // Leave a pending change before the stale command validates its target.
          editor.updateNode(editor.getNodeById('above')!, { name: 'Pending' });
          update(editor);
        }, options);
      };
      element
        .shadowRoot!.querySelectorAll<HTMLElement>(
          '.layer-row > sp-action-button',
        )[0]
        .click();
    }, stale);
    await drain(page);
    await field(page, 'name', 'Pending', 'above');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await expect(page.getByTestId('left-undo')).toBeEnabled();
    await page.getByTestId('left-undo').click();
    await field(page, 'name', 'above', 'above');
    expect(errors).toEqual([]);
  });
}

test('boundary order commands do not record unrelated pending changes', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => api.updateNode(api.getNodeById('left')!, { zIndex: 3 }),
      { capture: 'NEVER' },
    );
    window.apis.left.updateNode(window.apis.left.getNodeById('above')!, {
      name: 'Pending',
    });
  });
  await panel.locator('sp-menu-item').first().dispatchEvent('click');
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await field(page, 'name', 'above', 'above');
  expect(errors).toEqual([]);
});

test('rename commits the input once on Enter, including whitespace, and supports redo', async ({
  page,
}) => {
  const { name, errors } = await ready(page);
  await name.locator('span').dblclick();
  const input = name.locator('input');
  await input.fill('  New layer  ');
  await input.press('Enter');
  await field(page, 'name', '  New layer  ');
  await page.getByTestId('left-undo').click();
  await field(page, 'name', 'Original');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await field(page, 'name', '  New layer  ');
  expect(errors).toEqual([]);
});

for (const cancel of ['Escape', 'disconnect', 'reuse'] as const) {
  test(`rename draft is discarded on ${cancel}`, async ({ page }) => {
    const { name, errors } = await ready(page);
    await name.locator('span').dblclick();
    await name.locator('input').fill('Discard me');
    if (cancel === 'Escape') await name.locator('input').press('Escape');
    else
      await name.evaluate((element: LayerName, cancel) => {
        if (cancel === 'disconnect') element.remove();
        else element.node = window.apis.left.getNodeById('above')!;
      }, cancel);
    await drain(page);
    await field(page, 'name', 'Original');
    await field(page, 'name', 'above', 'above');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('unchanged and newly locked rename targets leave pending changes unrecorded', async ({
  page,
}) => {
  const { name, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    api.updateNode(api.getNodeById('above')!, { name: 'Pending' });
  });
  await name.locator('span').dblclick();
  await name.locator('input').press('Enter');
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await name.locator('span').dblclick();
  await name.locator('input').fill('Locked draft');
  await name.locator('input').evaluate((input) => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) =>
          editor.updateNode(editor.getNodeById('left')!, { locked: true }),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    (input as HTMLElement).blur();
  });
  await drain(page);
  await field(page, 'name', 'Original');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('rejected rename is observed and the control can retry', async ({
  page,
}) => {
  const { name, errors } = await ready(page);
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(message.text());
  });
  await name.locator('span').dblclick();
  await name.locator('input').fill('Retry');
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('layer edit rejected'));
    };
  });
  await name.locator('input').press('Enter');
  await expect(name.locator('span')).toHaveText('Original');
  await expect.poll(() => logged.join(' ')).toContain('layer edit rejected');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await name.locator('span').dblclick();
  await name.locator('input').fill('Retry');
  await name.locator('input').press('Enter');
  await field(page, 'name', 'Retry');
  await page.getByTestId('left-undo').click();
  await field(page, 'name', 'Original');
  expect(errors).toEqual([]);
});

test('destroying the owning canvas cancels a submitted command', async ({
  page,
}) => {
  const { row, errors } = await ready(page);
  await row.evaluate((element: LayersPanelItem) => {
    const api = element.api;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      window.flushReact(() => window.setShown(['right']));
      return edit(update, options);
    };
    element
      .shadowRoot!.querySelectorAll<HTMLElement>(
        '.layer-row > sp-action-button',
      )[1]
      .click();
  });
  await expect(page.getByTestId('left-status')).toHaveCount(0);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('submitted rename owns its input and target and ignores duplicate blur', async ({
  page,
}) => {
  const { name, errors } = await ready(page);
  await name.locator('span').dblclick();
  await name.locator('input').fill('Captured');
  await name.evaluate((element: LayerName) => {
    const api = element.api;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      element.api = window.apis.right;
      element.node = window.apis.right.getNodeById('right')!;
      void edit(
        (editor) => editor.selectNodes([editor.getNodeById('above')!]),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const textfield = element.shadowRoot!.querySelector(
      'sp-textfield',
    ) as HTMLElement & { value: string };
    textfield.dispatchEvent(new Event('blur'));
    textfield.value = 'Later input';
    textfield.dispatchEvent(new Event('blur'));
  });
  await field(page, 'name', 'Captured');
  await field(page, 'name', 'above', 'above');
  await page.getByTestId('left-undo').click();
  await field(page, 'name', 'Original');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
