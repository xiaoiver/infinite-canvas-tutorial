import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  TextSerializedNode,
  ThemeMode,
} from '@infinite-canvas-tutorial/ecs';
import type { TextContent } from '@infinite-canvas-tutorial/webcomponents/spectrum';

declare global {
  interface Window {
    typographySetupStatus: string;
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
    window.typographySetupStatus = 'pending';
    // Observe setup in-page: Chromium can collect CDP-awaited promises during
    // the properties panel's initial mount.
    void import(support)
      .then(() =>
        window.apis.left.edit(
          (api) => {
            api.updateNodes(
              ['Alpha', 'Beta'].map((content, index) => ({
                id: `typography-${index}`,
                type: 'text',
                content,
                anchorX: 100 + index * 150,
                anchorY: 180,
                fontFamily: 'sans-serif',
                fontSize: 20,
                letterSpacing: 2,
                lineHeight: 28,
                textAlign: 'start',
                textBaseline: 'top',
                fills: [{ type: 'solid', value: '#000' }],
                zIndex: index + 1,
              })),
            );
            api.selectNodes([api.getNodeById('typography-0')!]);
            window.editingProbe.properties();
            api.setAppState({
              variables: {
                size: { type: 'number', value: 24 },
                other: { type: 'number', value: 32 },
                color: { type: 'color', value: '#000' },
              },
              propertiesPanelSectionsOpen: {
                ...api.getAppState().propertiesPanelSectionsOpen,
                transform: false,
                fillSection: false,
                strokeSection: false,
                typographySection: true,
              },
            });
          },
          { capture: 'NEVER' },
        ),
      )
      .then(
        (committed) => {
          window.typographySetupStatus = committed ? 'ready' : 'cancelled';
        },
        (error) => {
          window.typographySetupStatus = String(error);
        },
      );
  });
  await expect
    .poll(() => page.evaluate(() => window.typographySetupStatus))
    .toBe('ready');
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-text-content');
  await expect(panel.locator('#font-size')).toBeVisible();
  return { panel, errors };
}

async function change(control: Locator, value: number | string | string[]) {
  await control.evaluate((element, value) => {
    const input = element as HTMLElement & {
      value: number | string;
      selected: string[];
    };
    if (Array.isArray(value)) input.selected = value;
    else input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
}

async function field(
  page: Page,
  key: keyof TextSerializedNode,
  expected: unknown,
) {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (
            window.apis.left.getNodeById('typography-0') as TextSerializedNode
          )?.[key],
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

const numbers = [
  ['font-size', 'fontSize', 20, 25.5],
  ['ic-text-content-letter-spacing', 'letterSpacing', 2, -1.5],
  ['ic-text-content-line-height', 'lineHeight', 28, 0],
] as const;

for (const [id, key, initial, next] of numbers) {
  test(`${key} accepts valid numbers, keeps cleared input unchanged, and undoes once`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    const input = panel.locator(`#${id} input`);
    await input.fill(String(next));
    await input.press('Enter');
    await field(page, key, next);
    await input.fill('');
    await input.press('Enter');
    await drain(page);
    await field(page, key, next);
    await expect(panel.locator(`#${id}`)).toHaveJSProperty(
      'value',
      key === 'lineHeight' ? 20 : next,
    );
    await page.getByTestId('left-undo').click();
    await field(page, key, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await field(page, key, next);
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('font family and bold/italic controls make independent undoable edits', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await change(panel.locator('#ic-text-content-font-family'), 'serif');
  await field(page, 'fontFamily', 'serif');
  const styles = panel.locator('sp-action-group[selects="multiple"]');
  await styles.locator('[value="bold"]').click();
  await field(page, 'fontWeight', 'bold');
  await styles.locator('[value="italic"]').click();
  await field(page, 'fontStyle', 'italic');
  await page.getByTestId('left-undo').click();
  await field(page, 'fontStyle', 'normal');
  await field(page, 'fontWeight', 'bold');
  await page.getByTestId('left-undo').click();
  await field(page, 'fontWeight', undefined);
  await page.getByTestId('left-undo').click();
  await field(page, 'fontFamily', 'sans-serif');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued typography owns number, style selection and target when controls are reused', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: TextContent) => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => editor.selectNodes([editor.getNodeById('typography-1')!]),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const input = element.shadowRoot!.querySelector(
      '#font-size',
    ) as HTMLElement & { value: number };
    input.value = 30;
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.value = 99;
    const styles = element.shadowRoot!.querySelector(
      'sp-action-group[selects="multiple"]',
    ) as HTMLElement & { selected: string[] };
    styles.selected = ['bold'];
    styles.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
    styles.selected.push('italic');
    element.node = api.getNodeById('typography-1')!;
    element.api = window.apis.right;
  });
  await field(page, 'fontSize', 30);
  await field(page, 'fontWeight', 'bold');
  await field(page, 'fontStyle', 'normal');
  expect(
    await page.evaluate(
      () =>
        (window.apis.left.getNodeById('typography-1') as TextSerializedNode)
          .fontSize,
    ),
  ).toBe(20);
  await page.getByTestId('left-undo').click();
  await field(page, 'fontWeight', undefined);
  await page.getByTestId('left-undo').click();
  await field(page, 'fontSize', 20);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued alignment and baseline preserve the latest anchor and resolve typography variables for measurement', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: TextContent) => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          const node = editor.getNodeById('typography-0')!;
          editor.updateNode(node, {
            x: node.x + 40,
            y: node.y + 30,
            fontSize: '$other',
          });
          editor.setAppState({
            variables: {
              other: {
                type: 'number',
                value: [{ value: 24 }, { value: 36, theme: { Mode: 'Dark' } }],
              },
            },
            themeMode: 'dark' as ThemeMode,
          });
          editor.selectNodes([editor.getNodeById('typography-1')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const align = element.shadowRoot!.querySelector(
      'sp-action-group[selects="single"]',
    ) as HTMLElement & { selected: string[] };
    align.selected = ['center'];
    align.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    align.selected[0] = 'end';
    const baseline = element.shadowRoot!.querySelector(
      '#ic-text-content-text-baseline',
    ) as HTMLElement & { value: string };
    baseline.value = 'middle';
    baseline.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
    baseline.value = 'bottom';
    element.node = api.getNodeById('typography-1')!;
  });
  await field(page, 'textAlign', 'center');
  await field(page, 'textBaseline', 'middle');
  await field(page, 'fontSize', '$other');
  const geometry = await page.evaluate(() => {
    const node = window.apis.left.getNodeById(
      'typography-0',
    ) as TextSerializedNode;
    return {
      anchorX: node.x + node.anchorX,
      anchorY: node.y + node.anchorY,
      width: node.width,
      localAnchorX: node.anchorX,
      height: node.height,
    };
  });
  expect(geometry.anchorX).toBeCloseTo(140, 4);
  expect(geometry.anchorY).toBeCloseTo(210, 4);
  expect(geometry.localAnchorX).toBeCloseTo(geometry.width / 2, 4);
  expect(geometry.width).toBeGreaterThan(80);
  expect(geometry.height).toBeGreaterThan(0);
  await page.getByTestId('left-undo').click();
  await field(page, 'textBaseline', 'top');
  await field(page, 'textAlign', 'center');
  await page.getByTestId('left-undo').click();
  await field(page, 'textAlign', 'start');
  await field(page, 'fontSize', '$other');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('all baseline choices and alignment buttons are wired to one undo per choice', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  for (const baseline of [
    'hanging',
    'middle',
    'alphabetic',
    'ideographic',
    'bottom',
  ]) {
    await change(panel.locator('#ic-text-content-text-baseline'), baseline);
    await field(page, 'textBaseline', baseline);
    await page.getByTestId('left-undo').click();
    await field(page, 'textBaseline', 'top');
  }
  const align = panel.locator('sp-action-group[selects="single"]');
  for (const value of ['center', 'end']) {
    await align.locator(`[value="${value}"]`).click();
    await field(page, 'textAlign', value);
    await page.getByTestId('left-undo').click();
    await field(page, 'textAlign', 'start');
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid, empty and unchanged typography commands do not capture unrelated pending history', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('left')!, {
      width: 130,
    }),
  );
  await panel.evaluate((element: TextContent) => {
    const root = element.shadowRoot!;
    for (const control of Array.from(
      root.querySelectorAll('sp-number-field, sp-picker, sp-action-group'),
    )) {
      control.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
    for (const id of [
      'font-size',
      'ic-text-content-letter-spacing',
      'ic-text-content-line-height',
    ]) {
      const control = root.querySelector(`#${id}`)!;
      const own = Object.getOwnPropertyDescriptor(control, 'value');
      try {
        for (const value of [
          '',
          '12oops',
          NaN,
          Infinity,
          -Infinity,
          ...(id.includes('letter-spacing') ? [] : [-1]),
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
    for (const id of [
      'ic-text-content-font-family',
      'ic-text-content-text-baseline',
    ]) {
      const control = root.querySelector(`#${id}`) as HTMLElement & {
        value: string;
      };
      control.value = id.includes('family') ? '  ' : 'invalid';
      control.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
    for (const control of Array.from(
      root.querySelectorAll('sp-action-group'),
    )) {
      (control as HTMLElement & { selected: string[] }).selected = ['invalid'];
      control.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
  });
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await field(page, 'fontSize', 20);
  await field(page, 'letterSpacing', 2);
  await field(page, 'lineHeight', 28);
  await expect(panel.locator('#font-size')).toHaveJSProperty('value', 20);
  await expect(
    panel.locator('#ic-text-content-text-baseline'),
  ).toHaveJSProperty('value', 'top');
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(100);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const [id, key] of numbers) {
  const trigger = id === 'font-size' ? 'ic-text-content-font-size' : id;
  test(`${key} variable binding owns its key and detaches the latest binding and theme`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    const overlay = panel.locator(
      `sp-overlay[trigger^="${trigger}-dv-trigger"]`,
    );
    await overlay
      .locator('ic-spectrum-design-variable-picker')
      .evaluate((element) => {
        const detail = { key: 'size' };
        element.dispatchEvent(
          new CustomEvent('ic-variable-pick', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
        detail.key = 'other';
      });
    await field(page, key, '$size');
    await expect(overlay.locator('.dv-row sp-action-button')).toHaveCount(1);
    await page.evaluate(() => window.apis.left.clearHistory());
    await page.evaluate((key) => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            editor.updateNode(editor.getNodeById('typography-0')!, {
              [key]: '$other',
            });
            editor.setAppState({
              variables: {
                other: {
                  type: 'number',
                  value: [
                    { value: 24 },
                    {
                      value: key === 'letterSpacing' ? -3 : 36,
                      theme: { Mode: 'Dark' },
                    },
                  ],
                },
              },
              themeMode: 'dark' as ThemeMode,
            });
            editor.selectNodes([editor.getNodeById('typography-1')!]);
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    }, key);
    await overlay
      .locator('.dv-row sp-action-button')
      .evaluate((element: HTMLElement) => element.click());
    await field(page, key, key === 'letterSpacing' ? -3 : 36);
    await page.getByTestId('left-undo').click();
    await field(page, key, '$other');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('missing or mistyped variables are not bound and unresolved bindings remain intact', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  for (const [id, key, initial] of numbers) {
    const trigger = id === 'font-size' ? 'ic-text-content-font-size' : id;
    const overlay = panel.locator(
      `sp-overlay[trigger^="${trigger}-dv-trigger"]`,
    );
    const picker = overlay.locator('ic-spectrum-design-variable-picker');
    for (const name of ['missing', 'color', 'size']) {
      await picker.evaluate(
        (element, key) =>
          element.dispatchEvent(
            new CustomEvent('ic-variable-pick', {
              detail: { key },
              bubbles: true,
              composed: true,
            }),
          ),
        name,
      );
      await drain(page);
      await field(page, key, name === 'size' ? '$size' : initial);
    }
  }
  await page.evaluate(() =>
    window.apis.left.edit(
      (api) => {
        api.setAppState({ variables: {} }, { replaceVariables: true });
      },
      { capture: 'NEVER' },
    ),
  );
  await page.evaluate(() => window.apis.left.clearHistory());
  for (const detach of await panel.locator('.dv-row sp-action-button').all()) {
    await detach.evaluate((element: HTMLElement) => element.click());
  }
  await change(panel.locator('sp-action-group[selects="single"]'), ['center']);
  await drain(page);
  for (const [, key] of numbers) await field(page, key, '$size');
  await field(page, 'textAlign', 'start');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const action of ['delete', 'replace', 'unmount'] as const) {
  test(`queued typography edits are cancelled after target ${action}`, async ({
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
              editor.deleteNodesById(['typography-0']);
              if (action === 'replace')
                editor.updateNode({
                  id: 'typography-0',
                  type: 'rect',
                  x: 100,
                  y: 100,
                  width: 60,
                  height: 40,
                  zIndex: 1,
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
    await change(panel.locator('#font-size'), 40);
    if (action === 'unmount') {
      await expect(page.getByTestId('left-status')).toHaveCount(0);
      await page.evaluate(() => window.setShown(['left', 'right']));
      await expect(page.getByTestId('left-status')).toHaveText('ready', {
        timeout: 45000,
      });
      expect(
        await page.evaluate(() => window.apis.left.getNodeById('typography-0')),
      ).toBeUndefined();
    } else {
      await drain(page);
      const node = await page.evaluate(() =>
        window.apis.left.getNodeById('typography-0'),
      );
      if (action === 'delete') expect(!node || node.isDeleted).toBe(true);
      else expect(node).toMatchObject({ type: 'rect', width: 60 });
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('rejected typography edits are observed and restore the displayed value', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('typography edit rejected'));
  });
  await change(panel.locator('#font-size'), 40);
  await change(panel.locator('sp-action-group[selects="single"]'), ['center']);
  await expect
    .poll(() =>
      reported.some((message) => message.includes('typography edit rejected')),
    )
    .toBe(true);
  await field(page, 'fontSize', 20);
  await field(page, 'textAlign', 'start');
  await expect(panel.locator('#font-size')).toHaveJSProperty('value', 20);
  await expect(
    panel.locator('sp-action-group[selects="single"]'),
  ).toHaveJSProperty('selected', ['start']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
