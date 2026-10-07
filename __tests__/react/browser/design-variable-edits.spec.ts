import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type { DesignVariablesMap } from '@infinite-canvas-tutorial/ecs';
import type { DocumentThemeSettings } from '@infinite-canvas-tutorial/webcomponents/spectrum';

type Control = HTMLElement & { value: string | number };
const initial: DesignVariablesMap = {
  accent: {
    type: 'color',
    value: [
      { value: '#123456', theme: { Mode: 'Light' } },
      { value: '#abcdef', theme: { Mode: 'Dark' } },
    ],
  },
  label: { type: 'string', value: 'Hello' },
  size: { type: 'number', value: 10 },
};
const columns = (light: string | number, dark: string | number) => [
  { value: light, theme: { Mode: 'Light' } },
  { value: dark, theme: { Mode: 'Dark' } },
];

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(async (initial) => {
    const support = '/editing-test-support.ts';
    await import(support);
    await window.apis.left.edit(
      (api) => {
        api.setAppState({ variables: initial }, { replaceVariables: true });
        api.updateNode(api.getNodeById('left')!, {
          fills: [{ type: 'solid', value: '$accent' }],
        });
        api.selectNodes([]);
        window.editingProbe.properties();
      },
      { capture: 'NEVER' },
    );
  }, initial);
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-document-theme-settings');
  await expect(panel.locator('.var-table-row')).toHaveCount(3);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { panel, errors };
}
function row(panel: Locator, key: string) {
  return panel.locator(`[data-variable-key="${key}"]`);
}
async function variables(page: Page, expected: DesignVariablesMap) {
  await expect
    .poll(() => page.evaluate(() => window.apis.left.getAppState().variables))
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
async function change(
  control: Locator,
  value: string | number,
  event = 'change',
) {
  await control.evaluate(
    (element: Control, { value, event }) => {
      element.value = value;
      element.dispatchEvent(new Event(event, { bubbles: true }));
    },
    { value, event },
  );
}
async function draft(panel: Locator, key: string, type: string, value: string) {
  await change(panel.locator('#dv-draft-type'), type);
  await change(panel.locator('#dv-draft-key'), key, 'input');
  await change(
    panel.locator('.draft-value-merge sp-textfield'),
    value,
    'input',
  );
}
const add = (panel: Locator) => panel.locator('.add-row > sp-action-button');

// Exercise the shipped controls, API queue, history and real renderer together.
test('same-frame Light and Dark changes preserve both values and undo independently', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await row(panel, 'accent').evaluate((element) => {
    const controls = element.querySelectorAll('ic-spectrum-input-solid');
    const detail = { type: 'solid', value: 'ff0000' };
    controls[0].dispatchEvent(new CustomEvent('color-change', { detail }));
    detail.value = '#000000';
    controls[1].dispatchEvent(
      new CustomEvent('color-change', {
        detail: { type: 'solid', value: '#00ff00' },
      }),
    );
  });
  await variables(page, {
    ...initial,
    accent: { type: 'color', value: columns('#ff0000', '#00ff00') },
  });
  await expect
    .poll(() => page.evaluate(() => window.boundFill('left')))
    .toBe('#ff0000');
  await page.getByTestId('left-undo').click();
  await variables(page, {
    ...initial,
    accent: { type: 'color', value: columns('#ff0000', '#abcdef') },
  });
  await page.getByTestId('left-undo').click();
  await variables(page, initial);
  await expect
    .poll(() => page.evaluate(() => window.boundFill('left')))
    .toBe('#123456');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await page.getByTestId('left-redo').click();
  await variables(page, {
    ...initial,
    accent: { type: 'color', value: columns('#ff0000', '#00ff00') },
  });
  expect(errors).toEqual([]);
});

test('number and string controls retain decimals, negative/zero values and empty strings', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const numbers = row(panel, 'size').locator('sp-number-field');
  await numbers.first().locator('input').fill('-2.5');
  await numbers.first().locator('input').press('Enter');
  await change(numbers.nth(1), 0);
  await change(
    row(panel, 'label').locator('.var-cell sp-textfield').first(),
    '',
  );
  await change(
    row(panel, 'label').locator('.var-cell sp-textfield').nth(1),
    '  Dark  ',
  );
  await variables(page, {
    ...initial,
    size: { type: 'number', value: columns(-2.5, 0) },
    label: { type: 'string', value: columns('', '  Dark  ') },
  });
  await expect(numbers.first()).toHaveJSProperty('value', -2.5);
  await expect(numbers.nth(1)).toHaveJSProperty('value', 0);
  for (let i = 0; i < 4; i++) await page.getByTestId('left-undo').click();
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('add submits once, preserves newer drafts and supports undo/redo', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await draft(panel, 'newColor', 'color', '   ');
  await add(panel).evaluate((button: HTMLElement) => {
    button.click();
    button.click();
    const key = button.parentElement!.querySelector('#dv-draft-key') as Control;
    key.value = 'nextColor';
    key.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const newColor = {
    type: 'color' as const,
    value: columns('#808080', '#808080'),
  };
  await variables(page, { ...initial, newColor });
  await expect(panel.locator('#dv-draft-key')).toHaveJSProperty(
    'value',
    'nextColor',
  );
  await page.getByTestId('left-undo').click();
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await variables(page, { ...initial, newColor });
  await add(panel).click();
  await variables(page, { ...initial, newColor, nextColor: newColor });
  await expect(panel.locator('#dv-draft-key')).toHaveJSProperty('value', '');
  expect(errors).toEqual([]);
});

test('rename and queued column edits follow the same variable through multiple names', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await row(panel, 'label').evaluate((element) => {
    const name = element.querySelector(
      '.var-name-block sp-textfield',
    ) as Control;
    const value = element.querySelector('.var-cell sp-textfield') as Control;
    for (const next of ['title', 'heading']) {
      name.value = next;
      name.dispatchEvent(new Event('change', { bubbles: true }));
    }
    value.value = 'Queued';
    value.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const { label, ...rest } = initial;
  await variables(page, {
    ...rest,
    heading: { type: 'string', value: columns('Queued', 'Hello') },
  });
  await expect(
    row(panel, 'heading').locator('.var-name-block sp-textfield'),
  ).toHaveJSProperty('value', 'heading');
  await page.getByTestId('left-undo').click();
  await variables(page, { ...rest, heading: label });
  await page.getByTestId('left-undo').click();
  await variables(page, { ...rest, title: label });
  await page.getByTestId('left-undo').click();
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('duplicate removal and late edits cannot recreate a removed variable or affect its neighbor', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await row(panel, 'size').evaluate((element) => {
    const button = element.querySelector('sp-action-button') as HTMLElement;
    button.click();
    button.click();
    const value = element.querySelector('sp-number-field') as Control;
    value.value = 99;
    value.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await drain(page);
  await variables(page, { accent: initial.accent, label: initial.label });
  await page.getByTestId('left-undo').click();
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid, duplicate and unchanged input restores controls without capturing pending document changes', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: DocumentThemeSettings) => {
    const api = element.api,
      edit = api.edit.bind(api);
    api.edit = (update, options) =>
      edit((editor) => {
        editor.updateNode(editor.getNodeById('left')!, { width: 210 });
        update(editor);
      }, options);
    const root = element.shadowRoot!;
    const number = root.querySelector(
      '[data-variable-key="size"] sp-number-field',
    ) as Control;
    for (const value of ['', 'bad', '12px', Infinity, NaN, 10]) {
      const own = Object.getOwnPropertyDescriptor(number, 'value');
      Object.defineProperty(number, 'value', { configurable: true, value });
      try {
        number.dispatchEvent(new Event('change', { bubbles: true }));
      } finally {
        if (own) Object.defineProperty(number, 'value', own);
        else delete (number as { value?: unknown }).value;
      }
    }
    const name = root.querySelector(
      '[data-variable-key="label"] .var-name-block sp-textfield',
    ) as Control;
    for (const value of ['', 'size', 'label']) {
      name.value = value;
      name.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const color = root.querySelector('ic-spectrum-input-solid')!;
    for (const value of ['', 'not-a-color', '#123456']) {
      color.dispatchEvent(
        new CustomEvent('color-change', { detail: { type: 'solid', value } }),
      );
    }
    api.edit = edit;
  });
  await drain(page);
  await variables(page, initial);
  await expect(
    row(panel, 'size').locator('sp-number-field').first(),
  ).toHaveJSProperty('value', 10);
  await expect(
    row(panel, 'label').locator('.var-name-block sp-textfield'),
  ).toHaveJSProperty('value', 'label');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('100');
  expect(errors).toEqual([]);
});

for (const replacement of ['same-type', 'other-type', 'deleted'] as const) {
  test(`external ${replacement} replacement cancels stale row commands without recording`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.evaluate((element: DocumentThemeSettings, replacement) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const variables = { ...editor.getAppState().variables };
            if (replacement === 'deleted') delete variables.size;
            else
              variables.size =
                replacement === 'same-type'
                  ? { type: 'number', value: 20 }
                  : { type: 'string', value: 'Replacement' };
            editor.setAppState({ variables }, { replaceVariables: true });
          },
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          editor.updateNode(editor.getNodeById('left')!, { width: 210 });
          update(editor);
        }, options);
      };
      const number = element.shadowRoot!.querySelector(
        '[data-variable-key="size"] sp-number-field',
      ) as Control;
      number.value = 99;
      number.dispatchEvent(new Event('change', { bubbles: true }));
    }, replacement);
    await drain(page);
    const expected = { ...initial };
    if (replacement === 'deleted') delete expected.size;
    else
      expected.size =
        replacement === 'same-type'
          ? { type: 'number', value: 20 }
          : { type: 'string', value: 'Replacement' };
    await variables(page, expected);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await expect(page.getByTestId('left-object-width')).toHaveText('100');
    expect(errors).toEqual([]);
  });
}

test('queued edits capture their canvas and value even when a panel is reused', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: DocumentThemeSettings) => {
    const number = element.shadowRoot!.querySelector(
      '[data-variable-key="size"] sp-number-field',
    ) as Control;
    number.value = 22;
    number.dispatchEvent(new Event('change', { bubbles: true }));
    number.value = 999;
    // Move the element to the other provider, updating both its context subscriptions.
    element.dataset.testid = 'reused-variable-panel';
    window.apis.right.element.append(element);
  });
  await variables(page, {
    ...initial,
    size: { type: 'number', value: columns(22, 10) },
  });
  expect(
    await page.evaluate(() => window.apis.right.getAppState().variables),
  ).toEqual({});
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await expect(
    page.getByTestId('reused-variable-panel').locator('.var-table-row'),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('failed submissions retain the draft, restore row controls and can be retried', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: DocumentThemeSettings) => {
    const api = element.api,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Expected variable failure'));
    };
    const number = element.shadowRoot!.querySelector(
      '[data-variable-key="size"] sp-number-field',
    ) as Control;
    number.value = 99;
    number.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(
    row(panel, 'size').locator('sp-number-field').first(),
  ).toHaveJSProperty('value', 10);
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await draft(panel, 'retry', 'number', '0');
  await panel.evaluate((element: DocumentThemeSettings) => {
    const api = element.api,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Expected add failure'));
    };
  });
  await add(panel).click();
  await expect(add(panel)).toBeEnabled();
  await expect(panel.locator('#dv-draft-key')).toHaveJSProperty(
    'value',
    'retry',
  );
  await add(panel).click();
  await variables(page, {
    ...initial,
    retry: { type: 'number', value: columns(0, 0) },
  });
  await expect(panel.locator('#dv-draft-key')).toHaveJSProperty('value', '');
  await page.getByTestId('left-undo').click();
  await variables(page, initial);
  expect(errors).toEqual([]);
});

test('disconnected events are ignored and destroying a canvas cancels queued edits', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: DocumentThemeSettings) => {
    const parent = element.parentElement!;
    const number = element.shadowRoot!.querySelector(
      '[data-variable-key="size"] sp-number-field',
    ) as Control;
    element.remove();
    number.value = 88;
    number.dispatchEvent(new Event('change', { bubbles: true }));
    parent.append(element);
  });
  await drain(page);
  await variables(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  const committed = await panel.evaluate(
    async (element: DocumentThemeSettings) => {
      const api = element.api,
        edit = api.edit.bind(api);
      let queued: Promise<boolean> | undefined;
      api.edit = (update, options) => (queued = edit(update, options));
      const number = element.shadowRoot!.querySelector(
        '[data-variable-key="size"] sp-number-field',
      ) as Control;
      number.value = 88;
      number.dispatchEvent(new Event('change', { bubbles: true }));
      window.flushReact(() => window.setShown(['right']));
      return queued;
    },
  );
  expect(committed).toBe(false);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const kind of ['add', 'rename'] as const) {
  test(`${kind} checks key collisions against the live table and retains input for retry`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    if (kind === 'add') await draft(panel, 'taken', 'number', '0');
    await panel.evaluate((element: DocumentThemeSettings, kind) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) =>
            editor.setAppState({
              variables: { taken: { type: 'string', value: 'External' } },
            }),
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          editor.updateNode(editor.getNodeById('left')!, { width: 210 });
          update(editor);
        }, options);
      };
      if (kind === 'add') {
        (
          element.shadowRoot!.querySelector(
            '.add-row > sp-action-button',
          ) as HTMLElement
        ).click();
      } else {
        const name = element.shadowRoot!.querySelector(
          '[data-variable-key="label"] .var-name-block sp-textfield',
        ) as Control;
        name.value = 'taken';
        name.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, kind);
    await drain(page);
    await variables(page, {
      ...initial,
      taken: { type: 'string', value: 'External' },
    });
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    if (kind === 'add')
      await expect(panel.locator('#dv-draft-key')).toHaveJSProperty(
        'value',
        'taken',
      );
    else
      await expect(
        row(panel, 'label').locator('.var-name-block sp-textfield'),
      ).toHaveJSProperty('value', 'label');
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await expect(page.getByTestId('left-object-width')).toHaveText('100');
    expect(errors).toEqual([]);
  });
}
