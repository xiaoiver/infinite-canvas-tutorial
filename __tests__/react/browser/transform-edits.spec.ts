import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PropertiesPanelContent } from '@infinite-canvas-tutorial/webcomponents/spectrum';

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(async () => {
    const support = '/editing-test-support.ts';
    await import(support);
    await window.apis.left.edit(
      (api) => {
        api.updateNode({
          id: 'transform-b',
          type: 'rect',
          x: 220,
          y: 180,
          width: 40,
          height: 30,
          zIndex: 1,
        });
        api.selectNodes([api.getNodeById('left')!]);
        window.editingProbe.properties();
        api.setAppState({
          propertiesPanelSectionsOpen: {
            ...api.getAppState().propertiesPanelSectionsOpen,
            fillSection: false,
            strokeSection: false,
            shape: false,
            transform: true,
          },
        });
      },
      { capture: 'NEVER' },
    );
  });
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel-content');
  await expect(panel.locator('#w')).toBeVisible();
  return { panel, errors };
}

async function change(panel: Locator, field: string, value: number | string) {
  await panel.locator(`#${field}`).evaluate((element, value) => {
    (element as HTMLElement & { value: number | string }).value = value;
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, value);
}

async function value(page: Page, field: string, expected: number) {
  await expect
    .poll(() =>
      page.evaluate(
        (field) =>
          (
            window.apis.left.getNodeById('left')! as unknown as Record<
              string,
              number
            >
          )[field] ?? 0,
        field,
      ),
    )
    .toBeCloseTo(expected, 7);
}

for (const [field, key, initial, next] of [
  ['w', 'width', 100, 150.5],
  ['h', 'height', 80, 120.5],
  ['x', 'x', 50, 73.25],
  ['y', 'y', 50, -92.75],
  ['angle', 'rotation', 0, 45.5],
] as const) {
  test(`the ${key} field preserves decimals and makes one undoable edit`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    const input = panel.locator(`#${field} input`);
    await input.fill(String(next));
    await input.press('Enter');
    const expected = key === 'rotation' ? (next * Math.PI) / 180 : next;
    await value(page, key, expected);
    await page.getByTestId('left-undo').click();
    await value(page, key, initial);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await value(page, key, expected);
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('queued size changes retain their input and target while using the latest aspect ratio', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: PropertiesPanelContent) => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          editor.updateNode(editor.getNodeById('left')!, {
            x: 75,
            height: 40,
            lockAspectRatio: true,
          });
          editor.selectNodes([editor.getNodeById('transform-b')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const field = element.shadowRoot!.querySelector('#w') as HTMLElement & {
      value: number;
    };
    field.value = 180;
    field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    field.value = 999;
    element.node = api.getNodeById('transform-b')!;
  });
  await value(page, 'width', 180);
  await value(page, 'height', 72);
  await value(page, 'x', 75);
  expect(
    await page.evaluate(
      () => window.apis.left.getNodeById('transform-b')!.width,
    ),
  ).toBe(40);
  await page.getByTestId('left-undo').click();
  await value(page, 'width', 100);
  await value(page, 'height', 40);
  await value(page, 'x', 75);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('queued lock toggles compose and later size changes see the committed lock state', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: PropertiesPanelContent) => {
    const lock = element.shadowRoot!.querySelector(
      '.lock-button',
    ) as HTMLElement;
    lock.click();
    const width = element.shadowRoot!.querySelector('#w') as HTMLElement & {
      value: number;
    };
    width.value = 200;
    width.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    lock.click();
    lock.click();
  });
  await value(page, 'width', 200);
  await value(page, 'height', 160);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodeById('left')!.lockAspectRatio,
      ),
    )
    .toBe(true);
  // Three toggles and one resize are four commands, including the intermediate
  // false state even when the last two clicks occur within the same frame.
  for (const locked of [false, true]) {
    await page.getByTestId('left-undo').click();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.apis.left.getNodeById('left')!.lockAspectRatio,
        ),
      )
      .toBe(locked);
  }
  await page.getByTestId('left-undo').click();
  await value(page, 'width', 100);
  await value(page, 'height', 80);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(
      () => window.apis.left.getNodeById('left')!.lockAspectRatio === true,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('locked height edits use the current width and preserve fractional dimensions', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.edit(
      (api) =>
        api.updateNode(api.getNodeById('left')!, { lockAspectRatio: true }),
      { capture: 'NEVER' },
    ),
  );
  await change(panel, 'h', 100.5);
  await value(page, 'height', 100.5);
  await value(page, 'width', 125.625);
  await page.getByTestId('left-undo').click();
  await value(page, 'width', 100);
  await value(page, 'height', 80);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid and unchanged transform inputs do not capture unrelated pending changes', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('transform-b')!, {
      x: 300,
    }),
  );
  await panel.evaluate((element: PropertiesPanelContent) => {
    for (const id of ['w', 'h', 'x', 'y', 'angle']) {
      const field = element.shadowRoot!.querySelector(`#${id}`) as HTMLElement;
      field.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
      const own = Object.getOwnPropertyDescriptor(field, 'value');
      try {
        // Exercise invalid event values before Spectrum can normalize them.
        for (const value of [
          '',
          '  ',
          '12oops',
          NaN,
          Infinity,
          -Infinity,
          ...(id === 'w' || id === 'h' ? [-1] : []),
        ]) {
          Object.defineProperty(field, 'value', { configurable: true, value });
          field.dispatchEvent(
            new Event('change', { bubbles: true, composed: true }),
          );
        }
      } finally {
        if (own) Object.defineProperty(field, 'value', own);
        else delete (field as HTMLElement & { value?: unknown }).value;
      }
    }
  });
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await value(page, 'width', 100);
  await value(page, 'height', 80);
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('transform-b')!.x),
  ).toBe(220);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const action of ['delete', 'replace', 'unmount'] as const) {
  test(`a queued transform cannot overwrite a target after ${action}`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await page.evaluate((action) => {
      const api = window.apis.left;
      const edit = api.edit.bind(api);
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
                  x: 50,
                  y: 50,
                  width: 100,
                  height: 80,
                  zIndex: 0,
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
    await change(panel, 'w', 200);
    if (action === 'unmount') {
      await expect(page.getByTestId('left-status')).toHaveCount(0);
      await page.evaluate(() => window.setShown(['left', 'right']));
      await expect(page.getByTestId('left-status')).toHaveText('ready', {
        timeout: 45000,
      });
      await value(page, 'width', 100);
    } else {
      await expect
        .poll(() =>
          page.evaluate(() => {
            const node = window.apis.left.getNodeById('left');
            return !node || node.isDeleted ? 'deleted' : node.type;
          }),
        )
        .toBe(action === 'delete' ? 'deleted' : 'ellipse');
      if (action === 'replace') await value(page, 'width', 100);
    }
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a zero aspect ratio is not resized into NaN, and unlocking permits a valid width', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.edit(
      (api) =>
        api.updateNode(api.getNodeById('left')!, {
          width: 0,
          lockAspectRatio: true,
        }),
      { capture: 'NEVER' },
    ),
  );
  await change(panel, 'w', 100);
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
  await value(page, 'width', 0);
  await expect(panel.locator('#w')).toHaveJSProperty('value', 0);
  await value(page, 'height', 80);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await panel.locator('.lock-button').click();
  await change(panel, 'w', 100);
  await value(page, 'width', 100);
  await value(page, 'height', 80);
  await page.getByTestId('left-undo').click();
  await value(page, 'width', 0);
  expect(errors).toEqual([]);
});

test('entering a flex container dimension disables hugging even if its number is unchanged', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const width = await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit(
      (editor) =>
        editor.updateNode(editor.getNodeById('left')!, {
          display: 'flex',
          flexHugWidth: true,
          flexHugHeight: false,
        }),
      { capture: 'NEVER' },
    );
    for (let i = 0; i < 2; i++)
      await new Promise<void>((resolve) => api.runAtNextTick(resolve));
    await api.edit(() => {}, { capture: 'NEVER' });
    return api.getNodeById('left')!.width;
  });
  await change(panel, 'w', width);
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.flexHugWidth),
    )
    .toBe(false);
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.flexHugWidth),
    )
    .toBe(true);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a rejected transform edit is observed and leaves the original geometry visible', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('transform edit rejected'));
  });
  await change(panel, 'w', 200);
  await expect
    .poll(() =>
      reported.some((message) => message.includes('transform edit rejected')),
    )
    .toBe(true);
  await value(page, 'width', 100);
  await expect(panel.locator('#w')).toHaveJSProperty('value', 100);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
