import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type {
  FillActionButton,
  StrokeActionButton,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';
import type {
  FillAttributes,
  StrokeAttributes,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';

type PaintButton = FillActionButton | StrokeActionButton;
type Mode = 'fill' | 'stroke';

async function ready(page: Page, mode: Mode) {
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
        const paints = [
          { type: 'solid' as const, value: '#123456', opacity: 0.8 },
          {
            type: 'solid' as const,
            value: '#abcdef',
            opacity: 0.3,
            enabled: false,
          },
        ];
        api.updateNode(api.getNodeById('left')!, {
          fills: paints,
          strokes: paints.map((p) => ({ ...p })),
          strokeWidth: 3,
        });
        api.updateNode({
          id: 'other',
          type: 'rect',
          x: 200,
          y: 100,
          width: 40,
          height: 40,
          fills: [{ type: 'solid', value: '#ffffff' }],
          zIndex: 2,
        });
        api.selectNodes([api.getNodeById('left')!]);
        api.setAppState({
          variables: {
            color: { type: 'color', value: '#445566' },
            alpha: { type: 'number', value: 0.5 },
          },
        });
      },
      { capture: 'NEVER' },
    );
  });
  const button = page
    .getByTestId('left-shortcuts')
    .locator(`ic-spectrum-${mode}-action-button`);
  await expect(button.locator(`#${mode}`)).toBeVisible();
  await expect(button.locator('ic-spectrum-color-picker')).toHaveCount(1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { button, picker: button.locator('ic-spectrum-color-picker'), errors };
}

async function paint(page: Page, mode: Mode, expected: unknown) {
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

const initial = [
  { type: 'solid', value: '#123456', opacity: 0.8 },
  { type: 'solid', value: '#abcdef', opacity: 0.3, enabled: false },
];
function expected(patch: object) {
  return [{ ...initial[0], ...patch }, initial[1]];
}

async function emit(picker: Locator, name: string, detail: object) {
  await picker.evaluate(
    (element, { name, detail }) => {
      element.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true }),
      );
    },
    { name, detail },
  );
}

async function drain(page: Page) {
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
}

for (const mode of ['fill', 'stroke'] as const) {
  test(`${mode} rapid color and opacity edits preserve the stack and undo independently`, async ({
    page,
  }) => {
    const { picker, errors } = await ready(page, mode);
    await picker.evaluate((element, mode) => {
      for (const [name, detail] of [
        ['color-change', { type: 'solid', value: 'ff0000' }],
        ['opacity-change', { [`${mode}Opacity`]: 0 }],
        [
          'color-change',
          { type: 'gradient', value: 'linear-gradient(to right, #000, #fff)' },
        ],
      ] as const)
        element.dispatchEvent(
          new CustomEvent(name, { detail, bubbles: true, composed: true }),
        );
    }, mode);
    await paint(
      page,
      mode,
      expected({
        type: 'gradient',
        value: 'linear-gradient(to right, #000, #fff)',
        opacity: 0,
      }),
    );
    for (const patch of [
      { value: '#ff0000', opacity: 0 },
      { value: '#ff0000' },
      {},
    ]) {
      await page.getByTestId('left-undo').click();
      await paint(page, mode, expected(patch));
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await paint(page, mode, expected({ value: '#ff0000' }));
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} submitted input owns its canvas and target after button reuse`, async ({
    page,
  }) => {
    const { button, errors } = await ready(page, mode);
    await button.evaluate((element: PaintButton) => {
      const picker = element.shadowRoot!.querySelector(
        'ic-spectrum-color-picker',
      )!;
      const detail = { type: 'solid', value: '#ff0000' };
      picker.dispatchEvent(
        new CustomEvent('color-change', {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
      detail.value = '#00ff00';
      element.node = window.apis.left.getNodeById('other')!;
      element.api = window.apis.right;
      window.apis.left.selectNodes([window.apis.left.getNodeById('other')!]);
    });
    await paint(page, mode, expected({ value: '#ff0000' }));
    expect(
      await page.evaluate(
        () =>
          (window.apis.left.getNodeById('other')! as FillAttributes).fills?.[0]
            .value,
      ),
    ).toBe('#ffffff');
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} uses the latest layer metadata and siblings at commit`, async ({
    page,
  }) => {
    const { picker, errors } = await ready(page, mode);
    await page.evaluate((mode) => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const field = mode === 'fill' ? 'fills' : 'strokes';
            const node = editor.getNodeById('left')!;
            const layers = (node as FillAttributes & StrokeAttributes)[field]!;
            editor.updateNode(node, {
              [field]: [
                { ...layers[0], opacity: 0.2, enabled: false },
                ...layers.slice(1),
                { type: 'solid', value: '#000000' },
              ],
            });
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    }, mode);
    await emit(picker, 'color-change', { type: 'solid', value: '#ff0000' });
    await paint(page, mode, [
      { ...initial[0], value: '#ff0000', opacity: 0.2, enabled: false },
      initial[1],
      { type: 'solid', value: '#000000' },
    ]);
    await page.getByTestId('left-undo').click();
    await paint(page, mode, [
      { ...initial[0], opacity: 0.2, enabled: false },
      initial[1],
      { type: 'solid', value: '#000000' },
    ]);
    expect(errors).toEqual([]);
  });

  test(`${mode} variable binding and detaching use current values and theme`, async ({
    page,
  }) => {
    const { button, picker, errors } = await ready(page, mode);
    // Real picker event wiring, including opacity events bubbling through shadow roots.
    await emit(picker, 'opacity-variable-pick', { mode, key: 'alpha' });
    await paint(page, mode, expected({ opacity: '$alpha' }));
    await button
      .locator('[role="tab"]')
      .nth(1)
      .evaluate((element: HTMLElement) => element.click());
    await emit(
      button.locator('ic-spectrum-design-variable-picker'),
      'ic-variable-pick',
      { key: 'color' },
    );
    await paint(page, mode, expected({ value: '$color', opacity: '$alpha' }));
    await page.evaluate(() => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) =>
            editor.setAppState({
              themeMode: 'dark' as ThemeMode,
              variables: {
                color: {
                  type: 'color',
                  value: [
                    { value: '#000000' },
                    { value: '#aabbcc', theme: { Mode: 'Dark' } },
                  ],
                },
                alpha: { type: 'number', value: 0.25 },
              },
            }),
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    });
    await button
      .locator('.dv-row sp-action-button')
      .evaluate((element: HTMLElement) => element.click());
    await paint(page, mode, expected({ value: '#aabbcc', opacity: '$alpha' }));
    await emit(
      button.locator('ic-spectrum-color-picker'),
      'opacity-variable-unbind',
      { mode },
    );
    await paint(page, mode, expected({ value: '#aabbcc', opacity: 0.25 }));
    await page.getByTestId('left-undo').click();
    await paint(page, mode, expected({ value: '#aabbcc', opacity: '$alpha' }));
    await page.getByTestId('left-undo').click();
    await paint(page, mode, expected({ value: '$color', opacity: '$alpha' }));
    expect(errors).toEqual([]);
  });

  test(`${mode} invalid and unchanged events leave unrelated pending history untouched`, async ({
    page,
  }) => {
    const { picker, errors } = await ready(page, mode);
    await page.evaluate(() =>
      window.apis.left.updateNode(window.apis.left.getNodeById('left')!, {
        name: 'Pending',
      }),
    );
    await picker.evaluate((element, mode) => {
      for (const [name, detail] of [
        ['color-change', { type: 'solid', value: '#123456' }],
        ['opacity-change', { [`${mode}Opacity`]: NaN }],
        [
          'color-change',
          { type: 'solid', value: '#ff0000', [`${mode}Opacity`]: Infinity },
        ],
        ['opacity-variable-pick', { mode, key: 'missing' }],
        ['opacity-variable-pick', { mode, key: 'color' }],
        ['opacity-variable-unbind', { mode }],
      ] as const)
        element.dispatchEvent(
          new CustomEvent(name, { detail, bubbles: true, composed: true }),
        );
    }, mode);
    await drain(page);
    await paint(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await expect(page.getByTestId('left-undo')).toBeEnabled();
    await page.getByTestId('left-undo').click();
    expect(
      await page.evaluate(() => window.apis.left.getNodeById('left')!.name),
    ).not.toBe('Pending');
    expect(errors).toEqual([]);
  });

  for (const stale of ['locked', 'deleted', 'replaced'] as const) {
    test(`${mode} skips a ${stale} target before writing`, async ({ page }) => {
      const { button, errors } = await ready(page, mode);
      await button.evaluate((element: PaintButton, stale) => {
        const api = window.apis.left,
          edit = api.edit.bind(api);
        api.edit = (update, options) => {
          api.edit = edit;
          void edit(
            (editor) => {
              const node = editor.getNodeById('left')!;
              if (stale === 'locked') editor.updateNode(node, { locked: true });
              else if (stale === 'deleted') editor.deleteNodesById(['left']);
              else editor.updateNode(node, { type: 'ellipse' });
            },
            { capture: 'NEVER' },
          );
          return edit(update, options);
        };
        element
          .shadowRoot!.querySelector('ic-spectrum-color-picker')!
          .dispatchEvent(
            new CustomEvent('color-change', {
              detail: { type: 'solid', value: '#ff0000' },
              bubbles: true,
              composed: true,
            }),
          );
      }, stale);
      await drain(page);
      if (stale === 'deleted') {
        expect(
          await page.evaluate(() => window.apis.left.getNodeById('left')),
        ).toBeUndefined();
      } else await paint(page, mode, initial);
      await expect(page.getByTestId('left-undo')).toBeDisabled();
      expect(errors).toEqual([]);
    });
  }

  test(`${mode} observes a rejected edit and allows retry`, async ({
    page,
  }) => {
    const { button, picker, errors } = await ready(page, mode);
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await button.evaluate((element: PaintButton) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = () => {
        api.edit = edit;
        return Promise.reject(new Error('paint edit failed'));
      };
      element
        .shadowRoot!.querySelector('ic-spectrum-color-picker')!
        .dispatchEvent(
          new CustomEvent('color-change', {
            detail: { type: 'solid', value: '#ff0000' },
            bubbles: true,
            composed: true,
          }),
        );
    });
    await expect
      .poll(() =>
        consoleErrors.some((error) => error.includes('paint edit failed')),
      )
      .toBe(true);
    await paint(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await emit(picker, 'color-change', { type: 'solid', value: '#ff0000' });
    await paint(page, mode, expected({ value: '#ff0000' }));
    expect(errors).toEqual([]);
  });
}

test('fill image changes preserve current fit and can explicitly clear position', async ({
  page,
}) => {
  const { picker, errors } = await ready(page, 'fill');
  const value =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"%3E%3C/svg%3E';
  await emit(picker, 'color-change', {
    type: 'image',
    value,
    objectFit: 'cover',
    objectPosition: '  20% 30%  ',
  });
  await paint(
    page,
    'fill',
    expected({
      type: 'image',
      value,
      objectFit: 'cover',
      objectPosition: '20% 30%',
    }),
  );
  await emit(picker, 'color-change', {
    type: 'image',
    value,
    objectPosition: '  ',
  });
  await paint(
    page,
    'fill',
    expected({ type: 'image', value, objectFit: 'cover' }),
  );
  await page.getByTestId('left-undo').click();
  await paint(
    page,
    'fill',
    expected({
      type: 'image',
      value,
      objectFit: 'cover',
      objectPosition: '20% 30%',
    }),
  );
  expect(errors).toEqual([]);
});

test('paint edits cancel when their canvas unmounts before the queued callback', async ({
  page,
}) => {
  const { button, errors } = await ready(page, 'fill');
  await button.evaluate((element: PaintButton) => {
    element
      .shadowRoot!.querySelector('ic-spectrum-color-picker')!
      .dispatchEvent(
        new CustomEvent('color-change', {
          detail: { type: 'solid', value: '#ff0000' },
          bubbles: true,
          composed: true,
        }),
      );
    window.flushReact(() => window.setShown(['right']));
  });
  await expect(page.getByTestId('left-shortcuts')).toHaveCount(0);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const mode of ['fill', 'stroke'] as const) {
  test(`${mode} visible opacity control displays zero and commits once`, async ({
    page,
  }) => {
    const { button, errors } = await ready(page, mode);
    await button.locator(`#${mode}`).click();
    const opacity = button.locator(
      'ic-spectrum-input-solid sp-number-field[aria-label="Opacity percent"]',
    );
    await expect(opacity).toBeVisible();
    await expect(opacity).toHaveJSProperty('value', 80);
    await opacity.locator('input').fill('0');
    await opacity.locator('input').press('Enter');
    await paint(page, mode, expected({ opacity: 0 }));
    await expect(opacity).toHaveJSProperty('value', 0);
    await page.getByTestId('left-undo').click();
    await paint(page, mode, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${mode} missing opacity binding stays intact without capturing pending edits`, async ({
    page,
  }) => {
    const { picker, errors } = await ready(page, mode);
    await page.evaluate(async (mode) => {
      await window.apis.left.edit(
        (api) => {
          const field = mode === 'fill' ? 'fills' : 'strokes';
          const node = api.getNodeById('left')!;
          const layers = (node as FillAttributes & StrokeAttributes)[field]!;
          api.updateNode(node, {
            [field]: [{ ...layers[0], opacity: '$alpha' }, ...layers.slice(1)],
          });
        },
        { capture: 'NEVER' },
      );
    }, mode);
    await paint(page, mode, expected({ opacity: '$alpha' }));
    await page.evaluate(async () => {
      const api = window.apis.left;
      await api.edit(
        (editor) =>
          editor.setAppState({ variables: {} }, { replaceVariables: true }),
        { capture: 'NEVER' },
      );
      api.updateNode(api.getNodeById('left')!, { name: 'Pending' });
    });
    await emit(picker, 'opacity-variable-unbind', { mode });
    await drain(page);
    await paint(page, mode, expected({ opacity: '$alpha' }));
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    // Recording now must still capture the pending name independently.
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    await paint(page, mode, expected({ opacity: '$alpha' }));
    await expect
      .poll(() =>
        page.evaluate(() => window.apis.left.getNodeById('left')!.name),
      )
      .not.toBe('Pending');
    expect(errors).toEqual([]);
  });
}

test('empty fill stack uses an owned default when adding its first paint', async ({
  page,
}) => {
  const { button, errors } = await ready(page, 'fill');
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => api.updateNode(api.getNodeById('left')!, { fills: [] }),
      { capture: 'NEVER' },
    );
  });
  await button.evaluate((element: FillActionButton) => {
    element.defaultFill = { type: 'solid', value: '#000000', opacity: 0.4 };
    element
      .shadowRoot!.querySelector('ic-spectrum-color-picker')!
      .dispatchEvent(
        new CustomEvent('color-change', {
          detail: { type: 'solid', value: '#ff0000' },
          bubbles: true,
          composed: true,
        }),
      );
    element.defaultFill.opacity = 1;
  });
  await paint(page, 'fill', [
    { type: 'solid', value: '#ff0000', opacity: 0.4 },
  ]);
  await page.getByTestId('left-undo').click();
  await paint(page, 'fill', []);
  expect(errors).toEqual([]);
});
