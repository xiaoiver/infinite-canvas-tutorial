import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type {
  FillSection,
  StrokeSection,
  FillActionButton,
  StrokeActionButton,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';
import type {
  FillAttributes,
  StrokeAttributes,
  SerializedFillLayerItem,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';

type Mode = 'fill' | 'stroke';
type Section = FillSection | StrokeSection;
type PaintButton = FillActionButton | StrokeActionButton;
const initial: SerializedFillLayerItem[] = [
  { type: 'solid', value: '#123456', opacity: 0.8 },
  { type: 'solid', value: '#123456', opacity: 0.6 },
  { type: 'solid', value: '#abcdef', opacity: 0.4 },
];

declare global {
  interface Window {
    paintStackSetup: string;
  }
}

async function ready(page: Page, mode: Mode, single = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(
    ({ mode, single, initial }) => {
      const support = '/editing-test-support.ts';
      window.paintStackSetup = 'pending';
      void import(support)
        .then(() =>
          window.apis.left.edit(
            (api) => {
              const layers = single ? initial.slice(0, 1) : initial;
              api.updateNode(api.getNodeById('left')!, {
                fills: layers,
                strokes: layers.map((layer) => ({ ...layer })),
                strokeWidth: 3,
              });
              api.updateNode({
                id: 'other-paint',
                type: 'rect',
                x: 250,
                y: 100,
                width: 40,
                height: 40,
                fills: [{ type: 'solid', value: '#ffffff' }],
                zIndex: 2,
              });
              api.selectNodes([api.getNodeById('left')!]);
              window.editingProbe.properties();
              api.setAppState({
                variables: { alpha: { type: 'number', value: 0.5 } },
                propertiesPanelSectionsOpen: {
                  ...api.getAppState().propertiesPanelSectionsOpen,
                  transform: false,
                  fillSection: mode === 'fill',
                  strokeSection: mode === 'stroke',
                },
              });
            },
            { capture: 'NEVER' },
          ),
        )
        .then(
          (ok) => {
            window.paintStackSetup = ok ? 'ready' : 'cancelled';
          },
          (error) => {
            window.paintStackSetup = String(error);
          },
        );
    },
    { mode, single, initial },
  );
  await expect
    .poll(() => page.evaluate(() => window.paintStackSetup))
    .toBe('ready');
  const section = page
    .getByTestId('left-shortcuts')
    .locator(`ic-spectrum-${mode}-section`);
  await expect(section.locator('.row')).toHaveCount(single ? 1 : 3);
  await expect(section.locator('.add-layer-cta')).toBeVisible();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { section, errors };
}

async function layers(page: Page, mode: Mode, expected: unknown) {
  await expect
    .poll(() =>
      page.evaluate((mode) => {
        const node = window.apis.left.getNodeById('left')! as FillAttributes &
          StrokeAttributes;
        return node[mode === 'fill' ? 'fills' : 'strokes'];
      }, mode),
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

async function emit(control: Locator, name: string, detail: object) {
  await control.evaluate(
    (element, { name, detail }) =>
      element.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true }),
      ),
    { name, detail },
  );
}

for (const mode of ['fill', 'stroke'] as const) {
  test(`${mode} rapid adds append to the live stack and each undo once`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section.locator('.add-layer-cta').evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    const added = {
      type: 'solid',
      value: mode === 'fill' ? '#CCCCCC' : '#888888',
      opacity: 1,
    };
    await layers(page, mode, [...initial, added, added]);
    for (const count of [1, 0]) {
      await page.getByTestId('left-undo').click();
      await layers(page, mode, [...initial, ...Array(count).fill(added)]);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await layers(page, mode, [...initial, added]);
    expect(errors).toEqual([]);
  });

  test(`${mode} queued visibility toggles follow one logical layer across patches`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section
      .locator('.row')
      .nth(1)
      .locator('.row-actions')
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
        button.click();
      });
    await layers(page, mode, [
      initial[0],
      { ...initial[1], enabled: false },
      initial[2],
    ]);
    for (const enabled of [true, false, undefined]) {
      await page.getByTestId('left-undo').click();
      await layers(page, mode, [
        initial[0],
        enabled === undefined ? initial[1] : { ...initial[1], enabled },
        initial[2],
      ]);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} removing an earlier identical-color layer keeps queued edits on the original row`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section.evaluate((element: Section) => {
      const rows = element.shadowRoot!.querySelectorAll('.row');
      (
        rows[0].querySelector(
          ':scope > sp-action-button:not(.row-actions)',
        ) as HTMLElement
      ).click();
      const value = rows[1].querySelector('.value-input') as HTMLElement & {
        value: string;
      };
      value.value = 'ff0000';
      value.dispatchEvent(new Event('change', { bubbles: true }));
      const opacity = rows[1].querySelector('.opacity-field') as HTMLElement & {
        value: number;
      };
      opacity.value = 37.5;
      opacity.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await layers(page, mode, [
      { ...initial[1], value: '#ff0000', opacity: 0.375 },
      initial[2],
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [{ ...initial[1], value: '#ff0000' }, initial[2]]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial.slice(1));
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} duplicate removal and an edit from a removed row cannot change its successor`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section
      .locator('.row')
      .first()
      .evaluate((row) => {
        const button = row.querySelector(
          ':scope > sp-action-button:not(.row-actions)',
        ) as HTMLElement;
        button.click();
        button.click();
        row.querySelector('ic-spectrum-color-picker')!.dispatchEvent(
          new CustomEvent('color-change', {
            detail: { type: 'solid', value: '#ff0000' },
            bubbles: true,
            composed: true,
          }),
        );
      });
    await drain(page);
    await layers(page, mode, initial.slice(1));
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} a queued row edit follows object-preserving reorder and latest metadata`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section.evaluate((element: Section, mode) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const node = editor.getNodeById('left')!;
            const field = mode === 'fill' ? 'fills' : 'strokes';
            const paints = (node as FillAttributes & StrokeAttributes)[field]!;
            paints[1].opacity = 0.2;
            editor.updateNode(node, {
              [field]: [paints[2], paints[0], paints[1]],
            });
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
      element
        .shadowRoot!.querySelectorAll('ic-spectrum-color-picker')[1]
        .dispatchEvent(
          new CustomEvent('color-change', {
            detail: { type: 'solid', value: '#ff0000' },
            bubbles: true,
            composed: true,
          }),
        );
    }, mode);
    await layers(page, mode, [
      initial[2],
      initial[0],
      { ...initial[1], value: '#ff0000', opacity: 0.2 },
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [
      initial[2],
      initial[0],
      { ...initial[1], opacity: 0.2 },
    ]);
    expect(errors).toEqual([]);
  });

  test(`${mode} external layer replacement invalidates old rows without recording pending edits`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section.evaluate((element: Section, mode) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const field = mode === 'fill' ? 'fills' : 'strokes';
            const node = editor.getNodeById('left')!;
            editor.updateNode(node, {
              [field]: (node as FillAttributes & StrokeAttributes)[field]!.map(
                (layer) => ({ ...layer }),
              ),
            });
          },
          { capture: 'NEVER' },
        );
        return edit((editor) => {
          editor.updateNode(editor.getNodeById('other-paint')!, {
            name: 'Pending',
          });
          update(editor);
        }, options);
      };
      (
        element.shadowRoot!.querySelector('.row-actions') as HTMLElement
      ).click();
    }, mode);
    await drain(page);
    await layers(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await expect
      .poll(() =>
        page.evaluate(() => window.apis.left.getNodeById('other-paint')!.name),
      )
      .not.toBe('Pending');
    expect(errors).toEqual([]);
  });

  test(`${mode} toolbar and property row edits share layer identity in the same queue`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    const toolbar = page
      .getByTestId('left-shortcuts')
      .locator(`ic-spectrum-${mode}-action-button`);
    await toolbar.evaluate((element: PaintButton, mode) => {
      element
        .shadowRoot!.querySelector('ic-spectrum-color-picker')!
        .dispatchEvent(
          new CustomEvent('color-change', {
            detail: { type: 'solid', value: '#ff0000' },
            bubbles: true,
            composed: true,
          }),
        );
      // Locate the actual properties panel through nested shadow roots in this canvas.
      const find = (root: Element | ShadowRoot): Element | undefined => {
        for (const child of Array.from(root.children)) {
          if (child.localName === `ic-spectrum-${mode}-section`) return child;
          const result =
            find(child) ??
            (child.shadowRoot ? find(child.shadowRoot) : undefined);
          if (result) return result;
        }
      };
      const panel = find(
        document.querySelector('[data-testid="left-shortcuts"]')!,
      )!;
      (panel.shadowRoot!.querySelector('.row-actions') as HTMLElement).click();
    }, mode);
    await layers(page, mode, [
      { ...initial[0], value: '#ff0000', enabled: false },
      ...initial.slice(1),
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [
      { ...initial[0], value: '#ff0000' },
      ...initial.slice(1),
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial);
    await expect(section.locator('.row')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test(`${mode} row color input captures payload and source when the panel is reused`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    await section.evaluate((element: Section) => {
      const detail = {
        type: 'gradient',
        value: 'linear-gradient(to right, #000, #fff)',
      };
      element
        .shadowRoot!.querySelectorAll('ic-spectrum-color-picker')[1]
        .dispatchEvent(
          new CustomEvent('color-change', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      detail.value = 'none';
      element.node = window.apis.left.getNodeById('other-paint')!;
      element.api = window.apis.right;
    });
    await layers(page, mode, [
      initial[0],
      {
        ...initial[1],
        type: 'gradient',
        value: 'linear-gradient(to right, #000, #fff)',
      },
      initial[2],
    ]);
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} opacity accepts decimals and zero while invalid and unchanged values do not record`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode);
    const input = section
      .locator('.row')
      .nth(1)
      .locator('.opacity-field input');
    await input.fill('37.5');
    await input.press('Enter');
    await layers(page, mode, [
      initial[0],
      { ...initial[1], opacity: 0.375 },
      initial[2],
    ]);
    await input.fill('0');
    await input.press('Enter');
    await layers(page, mode, [
      initial[0],
      { ...initial[1], opacity: 0 },
      initial[2],
    ]);
    await expect(
      section.locator('.row').nth(1).locator('.opacity-field'),
    ).toHaveJSProperty('value', 0);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [
      initial[0],
      { ...initial[1], opacity: 0.375 },
      initial[2],
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial);
    await page.evaluate(() =>
      window.apis.left.updateNode(
        window.apis.left.getNodeById('other-paint')!,
        { name: 'Pending' },
      ),
    );
    await section.evaluate((element: Section) => {
      const root = element.shadowRoot!;
      const control = root.querySelector('.opacity-field') as HTMLElement & {
        value: string | number;
      };
      // Bypass Spectrum's coercion so malformed event payloads reach the handler.
      for (const value of ['', 'bad', Infinity, NaN, '80px', 80]) {
        const own = Object.getOwnPropertyDescriptor(control, 'value');
        Object.defineProperty(control, 'value', { configurable: true, value });
        try {
          control.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
          if (own) Object.defineProperty(control, 'value', own);
          else delete (control as { value?: unknown }).value;
        }
      }
      const text = root.querySelector('.value-input') as HTMLElement & {
        value: string;
      };
      text.value = '';
      text.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await drain(page);
    await layers(page, mode, initial);
    await expect(section.locator('.opacity-field').first()).toHaveJSProperty(
      'value',
      80,
    );
    await expect(section.locator('.value-input').first()).toHaveJSProperty(
      'value',
      '#123456',
    );
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} single-layer picker binds opacity and detaches the current themed value`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode, true);
    const picker = section.locator('ic-spectrum-color-picker');
    await emit(picker, 'opacity-variable-pick', { mode, key: 'alpha' });
    await layers(page, mode, [{ ...initial[0], opacity: '$alpha' }]);
    await expect(picker).toHaveJSProperty(`${mode}Opacity`, '$alpha');
    await section.evaluate((element: Section, mode) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) =>
            editor.setAppState({
              themeMode: 'dark' as ThemeMode,
              variables: {
                alpha: {
                  type: 'number',
                  value: [
                    { value: 0.5 },
                    { value: 0.25, theme: { Mode: 'Dark' } },
                  ],
                },
              },
            }),
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
      element
        .shadowRoot!.querySelector('ic-spectrum-color-picker')!
        .dispatchEvent(
          new CustomEvent('opacity-variable-unbind', {
            detail: { mode },
            bubbles: true,
            composed: true,
          }),
        );
    }, mode);
    await layers(page, mode, [{ ...initial[0], opacity: 0.25 }]);
    await emit(picker, 'opacity-change', { [`${mode}Opacity`]: 0 });
    await layers(page, mode, [{ ...initial[0], opacity: 0 }]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [{ ...initial[0], opacity: 0.25 }]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, [{ ...initial[0], opacity: '$alpha' }]);
    expect(errors).toEqual([]);
  });
}

for (const mode of ['fill', 'stroke'] as const) {
  test(`${mode} removing the last paint retains an empty stack and can be undone after adding`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, mode, true);
    await section
      .locator(`sp-action-button[label="Remove ${mode} layer"]`)
      .click();
    await layers(page, mode, []);
    await expect(section.locator('.row')).toHaveCount(0);
    await section.locator('.add-layer-cta').click();
    await layers(page, mode, [
      {
        type: 'solid',
        value: mode === 'fill' ? '#CCCCCC' : '#888888',
        opacity: 1,
      },
    ]);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, []);
    await page.getByTestId('left-undo').click();
    await layers(page, mode, initial.slice(0, 1));
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a rejected row edit restores the field and allows retry', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'fill');
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await section.evaluate((element: Section) => {
    const api = element.api,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('row edit failed'));
    };
    const field = element.shadowRoot!.querySelector(
      '.value-input',
    ) as HTMLElement & { value: string };
    field.value = '#ff0000';
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect
    .poll(() =>
      consoleErrors.some((message) => message.includes('row edit failed')),
    )
    .toBe(true);
  const field = section.locator('.value-input').first();
  await expect(field).toHaveJSProperty('value', '#123456');
  await layers(page, 'fill', initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await field.evaluate((element: HTMLElement & { value: string }) => {
    element.value = '#ff0000';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await layers(page, 'fill', [
    { ...initial[0], value: '#ff0000' },
    ...initial.slice(1),
  ]);
  expect(errors).toEqual([]);
});
