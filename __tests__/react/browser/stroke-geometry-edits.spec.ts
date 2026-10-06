import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type { StrokeContent } from '@infinite-canvas-tutorial/webcomponents/spectrum';
import type { ThemeMode } from '@infinite-canvas-tutorial/ecs';

declare global {
  interface Window {
    strokeGeometrySetup: string;
  }
}

async function ready(page: Page, implicitDefaults = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate((implicitDefaults) => {
    const support = '/editing-test-support.ts';
    window.strokeGeometrySetup = 'pending';
    void import(support)
      .then(() =>
        window.apis.left.edit(
          (api) => {
            api.updateNode(api.getNodeById('left')!, {
              strokeDasharray: implicitDefaults ? '2 3' : '2,3',
              ...(implicitDefaults
                ? {}
                : {
                    strokeWidth: 3,
                    strokeAlignment: 'center' as const,
                    strokeLinecap: 'butt' as const,
                    strokeLinejoin: 'miter' as const,
                    strokeDashCap: 'none' as const,
                    markerStart: 'none' as const,
                    markerEnd: 'none' as const,
                  }),
              strokes: [{ type: 'solid', value: '#123456', opacity: 0.5 }],
            });
            api.updateNode({
              id: 'other-stroke',
              type: 'rect',
              x: 260,
              y: 120,
              width: 40,
              height: 40,
              strokeWidth: 7,
              zIndex: 2,
              fills: [{ type: 'solid', value: '#ffffff' }],
            });
            api.selectNodes([api.getNodeById('left')!]);
            window.editingProbe.properties();
            api.setAppState({
              variables: {
                width: { type: 'number', value: 4 },
                other: { type: 'number', value: 8 },
                color: { type: 'color', value: '#ff0000' },
              },
              propertiesPanelSectionsOpen: {
                ...api.getAppState().propertiesPanelSectionsOpen,
                transform: false,
                fillSection: false,
                strokeSection: true,
              },
            });
          },
          { capture: 'NEVER' },
        ),
      )
      .then(
        (ok) => {
          window.strokeGeometrySetup = ok ? 'ready' : 'cancelled';
        },
        (error) => {
          window.strokeGeometrySetup = String(error);
        },
      );
  }, implicitDefaults);
  await expect
    .poll(() => page.evaluate(() => window.strokeGeometrySetup))
    .toBe('ready');
  const section = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel-content')
    .locator('ic-spectrum-stroke-content');
  await expect(section.locator('#stroke-width')).toBeVisible();
  await expect(section.locator('#stroke-dash-length')).toBeVisible();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { section, errors };
}

async function value(page: Page, field: string, expected: unknown) {
  await expect
    .poll(() =>
      page.evaluate(
        (field) =>
          (
            window.apis.left.getNodeById('left') as unknown as Record<
              string,
              unknown
            >
          )?.[field],
        field,
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

async function change(control: Locator, value: string | number) {
  await control.evaluate(
    (element: HTMLElement & { value: unknown; selected: unknown[] }, value) => {
      if (element.localName === 'sp-action-group') element.selected = [value];
      else element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

async function bind(section: Locator, key: string) {
  await section
    .locator('ic-spectrum-design-variable-picker')
    .evaluate((element, key) => {
      element.dispatchEvent(
        new CustomEvent('ic-variable-pick', {
          detail: { key },
          bubbles: true,
          composed: true,
        }),
      );
    }, key);
}

test('rapid dash and gap changes preserve each other and undo separately', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element: StrokeContent) => {
    for (const [id, value] of [
      ['stroke-dash-length', 8.5],
      ['stroke-gap-length', 4.5],
      ['stroke-dash-length', 12],
    ] as const) {
      const control = element.shadowRoot!.getElementById(id) as HTMLElement & {
        value: number;
      };
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await value(page, 'strokeDasharray', '12,4.5');
  for (const wire of ['8.5,4.5', '8.5,3', '2,3']) {
    await page.getByTestId('left-undo').click();
    await value(page, 'strokeDasharray', wire);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await value(page, 'strokeDasharray', '8.5,3');
  await value(page, 'strokes', [
    { type: 'solid', value: '#123456', opacity: 0.5 },
  ]);
  expect(errors).toEqual([]);
});

test('solid and dashed switches resolve in order before queued segment changes', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element: StrokeContent) => {
    for (const [id, value] of [
      ['stroke-style', 'solid'],
      ['stroke-style', 'dashed'],
      ['stroke-dash-length', 8],
      ['stroke-gap-length', 4],
    ] as const) {
      const control = element.shadowRoot!.getElementById(id) as HTMLElement & {
        value: string | number;
      };
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await value(page, 'strokeDasharray', '8,4');
  for (const wire of ['8,6', '6,6', 'none', '2,3']) {
    await page.getByTestId('left-undo').click();
    await value(page, 'strokeDasharray', wire);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('the visible width input retains fractional and zero widths', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  const field = section.locator('#stroke-width');
  const input = field.locator('input');
  await input.fill('4.5');
  await input.press('Tab');
  await value(page, 'strokeWidth', 4.5);
  await input.fill('0');
  await input.press('Tab');
  await value(page, 'strokeWidth', 0);
  await expect(field).toHaveJSProperty('value', 0);
  for (const width of [4.5, 3]) {
    await page.getByTestId('left-undo').click();
    await value(page, 'strokeWidth', width);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const [id, field, initial, first, second] of [
  ['stroke-alignment', 'strokeAlignment', 'center', 'inner', 'outer'],
  ['stroke-linecap', 'strokeLinecap', 'butt', 'round', 'square'],
  ['stroke-linejoin', 'strokeLinejoin', 'miter', 'round', 'bevel'],
  ['stroke-dash-cap', 'strokeDashCap', 'none', 'round', 'square'],
  ['marker-start', 'markerStart', 'none', 'line', 'triangle'],
  ['marker-end', 'markerEnd', 'none', 'diamond', 'line'],
] as const) {
  test(`${field} choices keep their input and each undo once`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page);
    await section.locator(`#${id}`).evaluate(
      (
        element: HTMLElement & { value: string; selected: string[] },
        { first, second },
      ) => {
        for (const value of [first, second]) {
          if (element.localName === 'sp-action-group')
            element.selected = [value];
          else element.value = value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Mutating the event source after dispatch must not mutate queued input.
        if (element.localName === 'sp-action-group')
          element.selected[0] = first;
        else element.value = first;
      },
      { first, second },
    );
    await value(page, field, second);
    for (const expected of [first, initial]) {
      await page.getByTestId('left-undo').click();
      await value(page, field, expected);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('invalid and unchanged inputs do not capture unrelated pending history', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element: StrokeContent) => {
    const api = window.apis.left;
    api.updateNode(api.getNodeById('left')!, { name: 'Pending' });
    for (const [id, values] of [
      ['stroke-width', ['', NaN, Infinity, -1, '4px', 3]],
      ['stroke-dash-length', ['', NaN, Infinity, -1, 0, '4px', 2]],
      ['stroke-gap-length', ['', NaN, Infinity, -1, 0, '4px', 3]],
      ['stroke-style', ['', 'unknown', 'dashed']],
      ['stroke-dash-cap', ['', 'unknown', 'none']],
      ['marker-start', ['', 'unknown', 'none']],
      ['marker-end', ['', 'unknown', 'none']],
    ] as const) {
      const control = element.shadowRoot!.getElementById(id)!;
      for (const value of values) {
        // Exercise the command boundary without Spectrum normalizing invalid payloads first.
        Object.defineProperty(control, 'value', { value, configurable: true });
        control.dispatchEvent(new Event('change', { bubbles: true }));
        delete (control as HTMLElement & { value?: unknown }).value;
      }
    }
    for (const [id, selected] of [
      ['stroke-alignment', 'center'],
      ['stroke-linecap', 'butt'],
      ['stroke-linejoin', 'miter'],
    ] as const) {
      const control = element.shadowRoot!.getElementById(id)!;
      for (const value of [[], ['unknown'], [selected]]) {
        Object.defineProperty(control, 'selected', {
          value,
          configurable: true,
        });
        control.dispatchEvent(new Event('change', { bubbles: true }));
        delete (control as HTMLElement & { selected?: unknown }).selected;
      }
    }
  });
  await bind(section, 'missing');
  await bind(section, 'color');
  await drain(page);
  await value(page, 'strokeWidth', 3);
  await value(page, 'strokeDasharray', '2,3');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.name),
  ).not.toBe('Pending');
  expect(errors).toEqual([]);
});

test('implicit defaults and equivalent dash wire remain no-ops', async ({
  page,
}) => {
  const { section, errors } = await ready(page, true);
  for (const [id, val] of [
    ['stroke-width', 1],
    ['stroke-alignment', 'center'],
    ['stroke-linecap', 'butt'],
    ['stroke-linejoin', 'miter'],
    ['stroke-dash-cap', 'none'],
    ['marker-start', 'none'],
    ['marker-end', 'none'],
    ['stroke-style', 'dashed'],
    ['stroke-dash-length', 2],
    ['stroke-gap-length', 3],
  ] as const)
    await change(section.locator(`#${id}`), val);
  await drain(page);
  await value(page, 'strokeDasharray', '2 3');
  await value(page, 'strokeWidth', undefined);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('dash edits read the latest sibling value at commit', async ({ page }) => {
  const { section, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) =>
          editor.updateNode(editor.getNodeById('left')!, {
            strokeDasharray: '10,11',
          }),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await change(section.locator('#stroke-dash-length'), 8);
  await value(page, 'strokeDasharray', '8,11');
  await page.getByTestId('left-undo').click();
  await value(page, 'strokeDasharray', '10,11');
  expect(errors).toEqual([]);
});

test('accepted width edits keep their canvas and node when the panel is reused', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element: StrokeContent) => {
    const control = element.shadowRoot!.getElementById(
      'stroke-width',
    ) as HTMLElement & { value: number };
    control.value = 5;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.value = 9;
    window.apis.left.selectNodes([
      window.apis.left.getNodeById('other-stroke')!,
    ]);
    element.api = window.apis.right;
    element.node = window.apis.right.getNodeById('right')!;
  });
  await value(page, 'strokeWidth', 5);
  expect(
    await page.evaluate(
      () =>
        (
          window.apis.left.getNodeById('other-stroke') as {
            strokeWidth: number;
          }
        ).strokeWidth,
    ),
  ).toBe(7);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await page.getByTestId('left-undo').click();
  await value(page, 'strokeWidth', 3);
  expect(errors).toEqual([]);
});

test('width binding owns the key and detaches using the latest variable and theme', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section
    .locator('ic-spectrum-design-variable-picker')
    .evaluate((element) => {
      const detail = { key: 'width' };
      element.dispatchEvent(
        new CustomEvent('ic-variable-pick', {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
      detail.key = 'other';
    });
  await value(page, 'strokeWidth', '$width');
  await expect(section.locator('#stroke-width')).toHaveJSProperty('value', 4);
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
              width: {
                type: 'number',
                value: [{ value: 5 }, { value: 6.5, theme: { Mode: 'Dark' } }],
              },
            },
          }),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await section
    .locator('.dv-row sp-action-button')
    .evaluate((button: HTMLElement) => button.click());
  await value(page, 'strokeWidth', 6.5);
  await page.getByTestId('left-undo').click();
  await value(page, 'strokeWidth', '$width');
  expect(errors).toEqual([]);
});

test('consecutive width bindings and numeric edits each retain their undo entry', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element: StrokeContent) => {
    const picker = element.shadowRoot!.querySelector(
      'ic-spectrum-design-variable-picker',
    )!;
    for (const key of ['width', 'other'])
      picker.dispatchEvent(
        new CustomEvent('ic-variable-pick', {
          detail: { key },
          bubbles: true,
          composed: true,
        }),
      );
    const control = element.shadowRoot!.getElementById(
      'stroke-width',
    ) as HTMLElement & { value: number };
    control.value = 0;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await value(page, 'strokeWidth', 0);
  for (const width of ['$other', '$width', 3]) {
    await page.getByTestId('left-undo').click();
    await value(page, 'strokeWidth', width);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const invalid of ['missing', 'negative'] as const) {
  test(`a ${invalid} width variable cannot detach or capture pending history`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page);
    await bind(section, 'width');
    await value(page, 'strokeWidth', '$width');
    await page.evaluate(
      (invalid) =>
        window.apis.left.edit(
          (api) => {
            api.setAppState(
              {
                variables:
                  invalid === 'missing'
                    ? {}
                    : { width: { type: 'number', value: -2 } },
              },
              { replaceVariables: true },
            );
          },
          { capture: 'NEVER' },
        ),
      invalid,
    );
    await page.evaluate(() => window.apis.left.clearHistory());
    await page.evaluate(() =>
      window.apis.left.updateNode(window.apis.left.getNodeById('left')!, {
        name: 'Pending',
      }),
    );
    await section
      .locator('.dv-row sp-action-button')
      .evaluate((button: HTMLElement) => button.click());
    await drain(page);
    await value(page, 'strokeWidth', '$width');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    expect(
      await page.evaluate(() => window.apis.left.getNodeById('left')!.name),
    ).not.toBe('Pending');
    await value(page, 'strokeWidth', '$width');
    expect(errors).toEqual([]);
  });
}

for (const stale of ['locked', 'deleted', 'replaced'] as const) {
  test(`a ${stale} stroke target is skipped before writing`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page);
    await page.evaluate((stale) => {
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
    }, stale);
    await change(section.locator('#stroke-width'), 8);
    await drain(page);
    await value(page, 'strokeWidth', stale === 'deleted' ? undefined : 3);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a rejected stroke edit restores its control and permits retry', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('stroke geometry edit failed'));
    };
  });
  const field = section.locator('#stroke-width');
  await change(field, 9);
  await expect
    .poll(() =>
      consoleErrors.some((error) =>
        error.includes('stroke geometry edit failed'),
      ),
    )
    .toBe(true);
  await value(page, 'strokeWidth', 3);
  await expect(field).toHaveJSProperty('value', 3);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await change(field, 9);
  await value(page, 'strokeWidth', 9);
  expect(errors).toEqual([]);
});

test('stroke commands cancel when their canvas unmounts before committing', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section
    .locator('#stroke-width')
    .evaluate((control: HTMLElement & { value: number }) => {
      control.value = 9;
      control.dispatchEvent(new Event('change', { bubbles: true }));
      window.flushReact(() => window.setShown(['right']));
    });
  await expect(page.getByTestId('left-shortcuts')).toHaveCount(0);
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('property and context controls compose edits to the same stroke', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  const toolbar = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-context-common-bar');
  // The compact 400px fixture's taskbar overlaps this toolbar button.
  // Activate its normal click handler to test the two command sources together.
  await toolbar
    .locator('#stroke-options')
    .evaluate((button: HTMLElement) => button.click());
  const context = toolbar.locator('ic-spectrum-stroke-content');
  await expect(context.locator('#stroke-gap-length')).toBeVisible();
  const gap = await context.locator('#stroke-gap-length').elementHandle();
  await section
    .locator('#stroke-dash-length')
    .evaluate((dash: HTMLElement & { value: number }, gap) => {
      dash.value = 9;
      dash.dispatchEvent(new Event('change', { bubbles: true }));
      const control = gap as HTMLElement & { value: number };
      control.value = 7;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }, gap);
  await value(page, 'strokeDasharray', '9,7');
  await expect(context.locator('#stroke-dash-length')).toHaveJSProperty(
    'value',
    9,
  );
  await expect(section.locator('#stroke-gap-length')).toHaveJSProperty(
    'value',
    7,
  );
  for (const wire of ['9,3', '2,3']) {
    await page.getByTestId('left-undo').click();
    await value(page, 'strokeDasharray', wire);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
