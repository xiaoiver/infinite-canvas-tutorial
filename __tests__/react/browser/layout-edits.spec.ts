import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  RectSerializedNode,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import type { PropertiesPanelContent } from '@infinite-canvas-tutorial/webcomponents/spectrum';

declare global {
  interface Window {
    layoutSetupStatus: string;
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
    const support = '/editing-test-support.ts';
    window.layoutSetupStatus = 'pending';
    // Keep setup completion in the page: Chromium can collect a CDP-awaited
    // promise while this large properties panel mounts.
    void import(support)
      .then(() =>
        window.apis.left.edit(
          (api) => {
            api.updateNode({
              id: 'layout-parent',
              type: 'g',
              x: 0,
              y: 0,
              width: 600,
              height: 400,
              zIndex: 0,
              display: 'flex',
            });
            api.updateNode({
              id: 'layout-b',
              type: 'rect',
              x: 250,
              y: 180,
              width: 40,
              height: 30,
              zIndex: 1,
              gap: 99,
            });
            api.updateNode(api.getNodeById('left')!, {
              parentId: 'layout-parent',
              display: 'flex',
              flexHugWidth: false,
              flexHugHeight: false,
              padding: [10, 20],
              margin: 5,
              gap: 6,
              rowGap: 2,
              columnGap: 3,
              flexDirection: 'row',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              flexWrap: 'nowrap',
              alignSelf: 'center',
              flexGrow: 2,
              flexShrink: 1,
              flexBasis: 40,
              minWidth: 20,
              maxWidth: 200,
              minHeight: 10,
              maxHeight: 150,
              cornerRadius: 4,
            });
            api.selectNodes([api.getNodeById('left')!]);
            window.editingProbe.properties();
            api.setAppState({
              variables: {
                radius: { type: 'number', value: 8 },
                other: { type: 'number', value: 12 },
              },
              propertiesPanelSectionsOpen: {
                ...api.getAppState().propertiesPanelSectionsOpen,
                fillSection: false,
                strokeSection: false,
                shape: true,
                transform: false,
                layout: true,
                flexItem: true,
              },
            });
          },
          { capture: 'NEVER' },
        ),
      )
      .then(
        (committed) => {
          window.layoutSetupStatus = committed ? 'ready' : 'cancelled';
        },
        (error) => {
          window.layoutSetupStatus = String(error);
        },
      );
  });
  await expect
    .poll(() => page.evaluate(() => window.layoutSetupStatus))
    .toBe('ready');
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel-content');
  await expect(panel.locator('#flex-gap')).toBeVisible();
  return { panel, errors };
}

async function change(control: Locator, value: number | string) {
  await control.evaluate((element, value) => {
    (element as HTMLElement & { value: number | string }).value = value;
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, value);
}

async function field(page: Page, key: string, expected: unknown) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (
            window.apis.left.getNodeById('left')! as unknown as Record<
              string,
              unknown
            >
          )[key],
        key,
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

test('container number controls preserve decimals and clear optional gap overrides with one undo', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  for (const [id, key, initial, next] of [
    ['flex-margin', 'margin', 5, 7.5],
    ['flex-gap', 'gap', 6, 9.5],
    ['flex-rowgap', 'rowGap', 2, 4.5],
    ['flex-colgap', 'columnGap', 3, 5.5],
  ] as const) {
    const input = panel.locator(`#${id} input`);
    await input.fill(String(next));
    await input.press('Enter');
    await field(page, key, next);
    await page.getByTestId('left-undo').click();
    await field(page, key, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await field(page, key, next);
    await input.fill('');
    await input.press('Enter');
    await field(page, key, undefined);
    await page.getByTestId('left-undo').click();
    await field(page, key, next);
    await page.getByTestId('left-undo').click();
    await field(page, key, initial);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const [label, controls] of [
  [
    'sizing',
    [
      ['flex-grow', 'flexGrow', 2],
      ['flex-shrink', 'flexShrink', 1],
      ['flex-basis', 'flexBasis', 40],
    ],
  ],
  [
    'constraints',
    [
      ['fi-minw-left', 'minWidth', 20],
      ['fi-maxw-left', 'maxWidth', 200],
      ['fi-minh-left', 'minHeight', 10],
      ['fi-maxh-left', 'maxHeight', 150],
    ],
  ],
] as const) {
  test(`flex item ${label} controls retain explicit zero and restore auto when cleared`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    for (const [id, key, initial] of controls) {
      const input = panel.locator(`#${id} input`);
      await input.fill('0');
      await input.press('Enter');
      await field(page, key, 0);
      await input.fill('');
      await input.press('Enter');
      await field(page, key, undefined);
      await page.getByTestId('left-undo').click();
      await field(page, key, 0);
      await page.getByTestId('left-undo').click();
      await field(page, key, initial);
      await expect(page.getByTestId('left-undo')).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
}

test('layout pickers and align-self auto submit independently and undo to their original values', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  for (const [option, key, initial, next] of [
    ['column', 'flexDirection', 'row', 'column'],
    ['baseline', 'alignItems', 'stretch', 'center'],
    ['space-between', 'justifyContent', 'flex-start', 'space-between'],
    ['wrap', 'flexWrap', 'nowrap', 'wrap-reverse'],
    ['auto', 'alignSelf', 'center', 'auto'],
  ] as const) {
    const picker = panel
      .locator(`sp-picker:has(sp-menu-item[value="${option}"])`)
      .first();
    await change(picker, next);
    await field(page, key, next === 'auto' ? undefined : next);
    await page.getByTestId('left-undo').click();
    await field(page, key, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
  }
  expect(errors).toEqual([]);
});

for (const box of ['padding', 'margin'] as const) {
  test(`queued ${box} sides merge the latest box without redirecting after selection changes`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.evaluate((element: PropertiesPanelContent, box) => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            editor.updateNode(editor.getNodeById('left')!, {
              [box]: [1, 2, 3, 4],
            });
            editor.selectNodes([editor.getNodeById('layout-b')!]);
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
      for (const [side, value] of [
        ['t', 11],
        ['r', 22],
      ] as const) {
        const input = element.shadowRoot!.querySelector(
          `#${box === 'padding' ? 'pad' : 'mar'}-${side}`,
        ) as HTMLElement & { value: number };
        input.value = value;
        input.dispatchEvent(
          new Event('change', { bubbles: true, composed: true }),
        );
        input.value = 999;
      }
      element.node = api.getNodeById('layout-b')!;
    }, box);
    await field(page, box, [11, 22, 3, 4]);
    expect(
      await page.evaluate(
        (box) => window.apis.left.getNodeById('layout-b')![box],
        box,
      ),
    ).toBeUndefined();
    await page.getByTestId('left-undo').click();
    await field(page, box, [11, 2, 3, 4]);
    await page.getByTestId('left-undo').click();
    await field(page, box, [1, 2, 3, 4]);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('uniform padding and flex-item side controls share one history-aware editor', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await change(panel.locator('#fi-pad-left-1'), 10);
  await change(panel.locator('#fi-pad-left-3'), 10);
  await field(page, 'padding', 10);
  await expect(panel.locator('#flex-pad')).toHaveJSProperty('readonly', false);
  await panel.locator('#flex-pad input').fill('13.5');
  await panel.locator('#flex-pad input').press('Enter');
  await field(page, 'padding', 13.5);
  await panel.locator('#fi-pad-main-left input').fill('');
  await panel.locator('#fi-pad-main-left input').press('Enter');
  await field(page, 'padding', undefined);
  await change(panel.locator('#fi-mar-left-2'), 9);
  await field(page, 'margin', [5, 5, 9, 5]);
  for (let i = 0; i < 5; i++) await page.getByTestId('left-undo').click();
  await field(page, 'padding', [10, 20]);
  await field(page, 'margin', 5);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('unchanged boxes, invalid numbers, and invalid choices leave unrelated pending history alone', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('layout-b')!, {
      x: 300,
    }),
  );
  await panel.evaluate((element: PropertiesPanelContent) => {
    for (const id of [
      'flex-gap',
      'pad-t',
      'mar-t',
      'corner-radius',
      'flex-basis',
    ]) {
      const control = element.shadowRoot!.querySelector(
        `#${id}`,
      ) as HTMLElement;
      control.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
      const own = Object.getOwnPropertyDescriptor(control, 'value');
      try {
        for (const value of [
          '12oops',
          NaN,
          Infinity,
          -Infinity,
          ...(id === 'corner-radius' ? [] : [-1]),
        ]) {
          Object.defineProperty(control, 'value', {
            configurable: true,
            value,
          });
          control.dispatchEvent(
            new Event('change', { bubbles: true, composed: true }),
          );
        }
      } finally {
        if (own) Object.defineProperty(control, 'value', own);
        else delete (control as HTMLElement & { value?: unknown }).value;
      }
    }
    const picker = element.shadowRoot!.querySelector(
      'sp-picker',
    ) as HTMLElement & { value: string };
    picker.value = 'invalid';
    picker.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  });
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await field(page, 'padding', [10, 20]);
  await field(page, 'gap', 6);
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('layout-b')!.x),
  ).toBe(250);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const action of ['delete', 'replace', 'unmount'] as const) {
  test(`queued layout edits are harmless after target ${action}`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await page.evaluate((action) => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        if (action !== 'unmount')
          void edit(
            (editor) => {
              editor.deleteNodesById(['left']);
              if (action === 'replace')
                editor.updateNode({
                  id: 'left',
                  type: 'ellipse',
                  width: 100,
                  height: 80,
                  zIndex: 0,
                  gap: 7,
                });
            },
            { capture: 'NEVER' },
          );
        const pending = edit(update, options);
        if (action === 'unmount')
          window.flushReact(() => window.setShown(['right']));
        return pending;
      };
    }, action);
    await change(panel.locator('#flex-gap'), 20);
    if (action === 'unmount') {
      await expect(page.getByTestId('left-status')).toHaveCount(0);
      await page.evaluate(() => window.setShown(['left', 'right']));
      await expect(page.getByTestId('left-status')).toHaveText('ready', {
        timeout: 45000,
      });
      await field(page, 'gap', undefined);
    } else {
      await expect
        .poll(() =>
          page.evaluate(() => {
            const node = window.apis.left.getNodeById('left');
            return !node || node.isDeleted ? 'deleted' : node.type;
          }),
        )
        .toBe(action === 'delete' ? 'deleted' : 'ellipse');
      if (action === 'replace') await field(page, 'gap', 7);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('corner radius edits undo once and clearing does not erase the existing radius', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const input = panel.locator('#corner-radius input');
  await input.fill('15');
  await input.press('Enter');
  await field(page, 'cornerRadius', 15);
  await input.fill('');
  await input.press('Enter');
  await drain(page);
  await field(page, 'cornerRadius', 15);
  await expect(panel.locator('#corner-radius')).toHaveJSProperty('value', 15);
  await page.getByTestId('left-undo').click();
  await field(page, 'cornerRadius', 4);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await field(page, 'cornerRadius', 15);
  expect(errors).toEqual([]);
});

test('variable binding owns the picked key and original target even when the event and panel are reused', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: PropertiesPanelContent) => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => editor.selectNodes([editor.getNodeById('layout-b')!]),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const detail = { key: 'other' };
    element
      .shadowRoot!.querySelector('ic-spectrum-design-variable-picker')!
      .dispatchEvent(
        new CustomEvent('ic-variable-pick', {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    detail.key = 'radius';
    element.node = api.getNodeById('layout-b')!;
  });
  await field(page, 'cornerRadius', '$other');
  expect(
    await page.evaluate(
      () =>
        (window.apis.left.getNodeById('layout-b')! as RectSerializedNode)
          .cornerRadius,
    ),
  ).toBeUndefined();
  await page.getByTestId('left-undo').click();
  await field(page, 'cornerRadius', 4);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('detaching a radius resolves the current binding, variable values and theme at commit time', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel
    .locator(
      'sp-overlay[trigger^="props-corner-radius"] ic-spectrum-design-variable-picker',
    )
    .evaluate((element) =>
      element.dispatchEvent(
        new CustomEvent('ic-variable-pick', {
          detail: { key: 'radius' },
          bubbles: true,
          composed: true,
        }),
      ),
    );
  await field(page, 'cornerRadius', '$radius');
  const detach = panel.locator(
    'sp-overlay[trigger^="props-corner-radius"] .dv-row sp-action-button',
  );
  await expect(detach).toHaveCount(1);
  await page.evaluate(() => window.apis.left.clearHistory());
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          editor.updateNode(editor.getNodeById('left')!, {
            cornerRadius: '$other' as unknown as number,
          });
          editor.setAppState({
            variables: {
              other: {
                type: 'number',
                value: [{ value: 20 }, { value: 32, theme: { Mode: 'Dark' } }],
              },
            },
            themeMode: 'dark' as ThemeMode,
          });
          editor.selectNodes([editor.getNodeById('layout-b')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await detach.evaluate((element: HTMLElement) => element.click());
  await field(page, 'cornerRadius', 32);
  await page.getByTestId('left-undo').click();
  await field(page, 'cornerRadius', '$other');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('missing variables cannot be newly bound or detached into invalid radius values', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const picker = panel.locator(
    'sp-overlay[trigger^="props-corner-radius"] ic-spectrum-design-variable-picker',
  );
  await picker.evaluate((element) =>
    element.dispatchEvent(
      new CustomEvent('ic-variable-pick', {
        detail: { key: 'missing' },
        bubbles: true,
        composed: true,
      }),
    ),
  );
  await drain(page);
  await field(page, 'cornerRadius', 4);
  await picker.evaluate((element) =>
    element.dispatchEvent(
      new CustomEvent('ic-variable-pick', {
        detail: { key: 'radius' },
        bubbles: true,
        composed: true,
      }),
    ),
  );
  await field(page, 'cornerRadius', '$radius');
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => api.setAppState({ variables: {} }, { replaceVariables: true }),
      {
        capture: 'NEVER',
      },
    );
    window.apis.left.clearHistory();
  });
  await panel
    .locator(
      'sp-overlay[trigger^="props-corner-radius"] .dv-row sp-action-button',
    )
    .evaluate((element: HTMLElement) => element.click());
  await drain(page);
  await field(page, 'cornerRadius', '$radius');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a rejected layout edit is observed and restores the displayed document value', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('layout edit rejected'));
  });
  await change(panel.locator('#flex-gap'), 20);
  await expect
    .poll(() =>
      reported.some((message) => message.includes('layout edit rejected')),
    )
    .toBe(true);
  await field(page, 'gap', 6);
  await expect(panel.locator('#flex-gap')).toHaveJSProperty('value', 6);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
