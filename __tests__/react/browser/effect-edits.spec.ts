import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type {
  EffectsPanel,
  LayerBlendModeRow,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';

const initial = 'blur(4px) brightness(0.2) brightness(0.2)';
declare global {
  interface Window {
    effectSetup: string;
  }
}
async function ready(page: Page, filter = initial) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate((filter) => {
    window.effectSetup = 'pending';
    const support = '/editing-test-support.ts';
    void import(support)
      .then(() =>
        window.apis.left.edit(
          (api) => {
            api.updateNode(api.getNodeById('left')!, { filter });
            api.updateNode({
              id: 'other-effect',
              type: 'rect',
              x: 260,
              y: 120,
              width: 40,
              height: 40,
              fills: [{ type: 'solid', value: '#ffffff' }],
              filter,
              zIndex: 2,
            });
            api.selectNodes([api.getNodeById('left')!]);
            window.editingProbe.properties();
            api.setAppState({
              propertiesPanelSectionsOpen: {
                ...api.getAppState().propertiesPanelSectionsOpen,
                transform: false,
                fillSection: false,
                strokeSection: false,
                effects: true,
              },
            });
          },
          { capture: 'NEVER' },
        ),
      )
      .then(
        () => {
          window.effectSetup = 'ready';
        },
        (e) => {
          window.effectSetup = String(e);
        },
      );
  }, filter);
  await expect
    .poll(() => page.evaluate(() => window.effectSetup))
    .toBe('ready');
  const section = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel-content ic-spectrum-effects-panel');
  const blend = page
    .getByTestId('left-shortcuts')
    .locator(
      'ic-spectrum-properties-panel-content ic-spectrum-layer-blend-mode-row',
    );
  await expect(section.locator('.add-layer-cta')).toBeVisible();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { section, blend, errors };
}
async function wire(page: Page, expected: string, id = 'left') {
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          (window.apis.left.getNodeById(id) as { filter?: string })?.filter ??
          '',
        id,
      ),
    )
    .toBe(expected);
}
async function drain(page: Page) {
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
}
async function change(control: Locator, value: unknown) {
  await control.evaluate((element: HTMLElement & { value: unknown }, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function undo(page: Page, expected: string) {
  await page.getByTestId('left-undo').click();
  await wire(page, expected);
}

test('rapid effect parameter edits preserve siblings and undo separately', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element) => {
    const row = element.shadowRoot!.querySelector('.effect-row')!;
    for (const [label, value] of [
      ['Radius', 8.5],
      ['Quality', 5],
      ['Radius', 0],
    ] as const) {
      const control = row.querySelector(
        `sp-slider[label="${label}"]`,
      ) as HTMLElement & { value: number };
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const control = row.querySelector('sp-switch') as HTMLElement & {
      checked: boolean;
    };
    control.checked = false;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wire(page, 'blur(0px, 5, 0) brightness(0.2) brightness(0.2)');
  for (const filter of [
    'blur(0px, 5) brightness(0.2) brightness(0.2)',
    'blur(8.5px, 5) brightness(0.2) brightness(0.2)',
    'blur(8.5px) brightness(0.2) brightness(0.2)',
    initial,
  ])
    await undo(page, filter);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('repeated adds append at commit and undo one at a time', async ({
  page,
}) => {
  const { section, errors } = await ready(page, '');
  await section.locator('.add-layer-cta').evaluate((e: HTMLElement) => {
    e.click();
    e.click();
    e.click();
  });
  await wire(page, 'brightness(0) brightness(0) brightness(0)');
  for (const filter of ['brightness(0) brightness(0)', 'brightness(0)', ''])
    await undo(page, filter);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('deleting a row twice cannot delete the next duplicate effect', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element) => {
    const rows = element.shadowRoot!.querySelectorAll('.effect-row');
    const remove = rows[1].querySelector(
      'sp-action-button[label="Remove"]',
    ) as HTMLElement;
    remove.click();
    remove.click();
    const slider = rows[2].querySelector('sp-slider') as HTMLElement & {
      value: number;
    };
    slider.value = 0.7;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wire(page, 'blur(4px) brightness(0.7)');
  await undo(page, 'blur(4px) brightness(0.2)');
  await undo(page, initial);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('reordering preserves the rendered row identity for later parameter edits', async ({
  page,
}) => {
  const { section, errors } = await ready(page);
  await section.evaluate((element) => {
    const row = element.shadowRoot!.querySelector('.effect-row')!;
    (
      row.querySelector('sp-action-button[label="Move down"]') as HTMLElement
    ).click();
    (
      row.querySelector('sp-action-button[label="Move down"]') as HTMLElement
    ).click();
    const slider = row.querySelector(
      'sp-slider[label="Radius"]',
    ) as HTMLElement & { value: number };
    slider.value = 12;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wire(page, 'brightness(0.2) brightness(0.2) blur(12px)');
  for (const filter of [
    'brightness(0.2) brightness(0.2) blur(4px)',
    'brightness(0.2) blur(4px) brightness(0.2)',
    initial,
  ])
    await undo(page, filter);
  expect(errors).toEqual([]);
});

test('kind changes reject stale parameter controls and retain the selected input', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await section.evaluate((element) => {
    const picker = element.shadowRoot!.querySelector(
      'sp-picker',
    ) as HTMLElement & { value: string };
    picker.value = 'contrast';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    picker.value = 'noise';
    const slider = element.shadowRoot!.querySelector(
      'sp-slider',
    ) as HTMLElement & { value: number };
    slider.value = 0.8;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wire(page, 'contrast(0)');
  await expect(section.locator('sp-picker')).toHaveJSProperty(
    'value',
    'contrast',
  );
  await undo(page, 'brightness(0.2)');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid and equivalent effect edits do not capture pending history', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await section.evaluate((element) => {
    const api = window.apis.left;
    api.updateNode(api.getNodeById('left')!, { name: 'Pending' });
    const slider = element.shadowRoot!.querySelector('sp-slider')!;
    for (const value of ['', NaN, Infinity, '0.7oops', 0.2]) {
      Object.defineProperty(slider, 'value', { value, configurable: true });
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      delete (slider as HTMLElement & { value?: unknown }).value;
    }
    const picker = element.shadowRoot!.querySelector(
      'sp-picker',
    ) as HTMLElement & { value: string };
    for (const value of ['unknown', 'brightness']) {
      picker.value = value;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await drain(page);
  await wire(page, 'brightness(0.2)');
  await expect(section.locator('sp-picker')).toHaveJSProperty(
    'value',
    'brightness',
  );
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.name),
  ).not.toBe('Pending');
  expect(errors).toEqual([]);
});

test('effect edits retain their canvas and target when the panel is reused', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await section.evaluate((element: EffectsPanel) => {
    const control = element.shadowRoot!.querySelector(
      'sp-slider',
    ) as HTMLElement & { value: number };
    control.value = 0.5;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    element.targetNodeIds = ['other-effect'];
    element.node = window.apis.right.getNodeById('right')!;
    element.api = window.apis.right;
  });
  await wire(page, 'brightness(0.5)');
  await wire(page, 'brightness(0.2)', 'other-effect');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await undo(page, 'brightness(0.2)');
  expect(errors).toEqual([]);
});

for (const stale of ['locked', 'deleted', 'retyped', 'replaced'] as const) {
  test(`effect edits cancel for ${stale} targets`, async ({ page }) => {
    const { section, errors } = await ready(page, 'brightness(0.2)');
    await page.evaluate((stale) => {
      const api = window.apis.left,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const node = editor.getNodeById('left')!;
            if (stale === 'deleted') editor.deleteNodesById(['left']);
            else if (stale === 'locked')
              editor.updateNode(node, { locked: true });
            else if (stale === 'retyped')
              editor.updateNode({ ...node, type: 'ellipse' });
            else editor.updateNode(node, { filter: 'contrast(0.3)' });
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    }, stale);
    await change(section.locator('sp-slider'), 0.7);
    await drain(page);
    if (stale !== 'deleted')
      await wire(
        page,
        stale === 'replaced' ? 'contrast(0.3)' : 'brightness(0.2)',
      );
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a shared effect command edits both targets in one undo and owns the target list', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await section.evaluate((element: EffectsPanel) => {
    const ids = ['left', 'other-effect'];
    element.targetNodeIds = ids;
    const slider = element.shadowRoot!.querySelector(
      'sp-slider',
    ) as HTMLElement & { value: number };
    slider.value = 0.6;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    ids.splice(0, 2, 'missing');
  });
  await wire(page, 'brightness(0.6)');
  await wire(page, 'brightness(0.6)', 'other-effect');
  await undo(page, 'brightness(0.2)');
  await wire(page, 'brightness(0.2)', 'other-effect');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a locked member cancels the entire multi-target effect edit', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) =>
        api.updateNode(api.getNodeById('other-effect')!, { locked: true }),
      { capture: 'NEVER' },
    );
  });
  await section.evaluate((element: EffectsPanel) => {
    element.targetNodeIds = ['left', 'other-effect'];
  });
  await change(section.locator('sp-slider'), 0.7);
  await drain(page);
  await wire(page, 'brightness(0.2)');
  await wire(page, 'brightness(0.2)', 'other-effect');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('mixed selection additions reset once then append with independent undo', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0)');
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) =>
        api.updateNode(api.getNodeById('other-effect')!, {
          filter: 'contrast(0.3)',
        }),
      { capture: 'NEVER' },
    );
  });
  await section.evaluate(async (element: EffectsPanel) => {
    element.targetNodeIds = ['left', 'other-effect'];
    element.filtersMixed = true;
    await element.updateComplete;
    const add = element.shadowRoot!.querySelector(
      '.add-layer-cta',
    ) as HTMLElement;
    add.click();
    add.click();
  });
  await wire(page, 'brightness(0) brightness(0)');
  await wire(page, 'brightness(0) brightness(0)', 'other-effect');
  await undo(page, 'brightness(0)');
  await wire(page, 'brightness(0)', 'other-effect');
  await undo(page, 'brightness(0)');
  await wire(page, 'contrast(0.3)', 'other-effect');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('failed effect edits restore controls and allow retry', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'brightness(0.2)');
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Expected effect rejection'));
    };
  });
  await change(section.locator('sp-slider'), 0.6);
  await expect(section.locator('sp-slider')).toHaveJSProperty('value', 0.2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await change(section.locator('sp-slider'), 0.6);
  await wire(page, 'brightness(0.6)');
  await undo(page, 'brightness(0.2)');
  expect(errors).toEqual([]);
});

test('blend choices queue separately and normal restores the implicit default', async ({
  page,
}) => {
  const { blend, errors } = await ready(page);
  await blend
    .locator('sp-picker')
    .evaluate((control: HTMLElement & { value: string }) => {
      for (const value of ['multiply', 'screen', 'normal']) {
        control.value = value;
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  await drain(page);
  await expect(blend.locator('sp-picker')).toHaveJSProperty('value', 'normal');
  for (const expected of ['screen', 'multiply', 'normal']) {
    await page.getByTestId('left-undo').click();
    await drain(page);
    await expect(blend.locator('sp-picker')).toHaveJSProperty(
      'value',
      expected,
    );
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid and unchanged blend choices leave pending history untouched', async ({
  page,
}) => {
  const { blend, errors } = await ready(page);
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('left')!, {
      name: 'Pending',
    }),
  );
  for (const value of ['normal', 'unknown', ''])
    await change(blend.locator('sp-picker'), value);
  await drain(page);
  await expect(blend.locator('sp-picker')).toHaveJSProperty('value', 'normal');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('blend edits keep the original target when the component is reused', async ({
  page,
}) => {
  const { blend, errors } = await ready(page);
  await blend.evaluate((element: LayerBlendModeRow) => {
    const control = element.shadowRoot!.querySelector(
      'sp-picker',
    ) as HTMLElement & { value: string };
    control.value = 'multiply';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.value = 'screen';
    element.api = window.apis.right;
    element.node = window.apis.right.getNodeById('right')!;
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.blendMode),
    )
    .toBe('multiply');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.blendMode),
    )
    .toBeUndefined();
  expect(errors).toEqual([]);
});

test('nested rain parameters and tuple endpoints compose without stale siblings', async ({
  page,
}) => {
  const { section, errors } = await ready(page, 'rain()');
  const changes = [
    ['Background blur steps', 4],
    ['Droplets per second', 600],
    ['Light X', 1.2],
    ['Light Y', -1.1],
    ['Droplet size min', 12],
    ['Droplet size max', 35],
  ] as const;
  await expect(section.locator('sp-slider[label="Light X"]')).toBeAttached();
  await section.evaluate((element, changes) => {
    for (const [label, value] of changes) {
      const slider = element.shadowRoot!.querySelector(
        `sp-slider[label="${label}"]`,
      ) as HTMLElement & { value: number };
      slider.value = value;
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, changes);
  await drain(page);
  for (const [label, value] of changes)
    await expect(
      section.locator(`sp-slider[label="${label}"]`),
    ).toHaveJSProperty('value', value);
  for (let i = 0; i < changes.length; i++) {
    await page.getByTestId('left-undo').click();
    await drain(page);
  }
  await wire(page, 'rain()');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const mode of ['effects', 'blend'] as const) {
  test(`${mode} commands cancel when their canvas unmounts`, async ({
    page,
  }) => {
    const { section, blend, errors } = await ready(page, 'brightness(0.2)');
    const control =
      mode === 'effects'
        ? section.locator('sp-slider')
        : blend.locator('sp-picker');
    await control.evaluate(
      (element: HTMLElement & { value: string | number }, mode) => {
        element.value = mode === 'effects' ? 0.8 : 'multiply';
        element.dispatchEvent(new Event('change', { bubbles: true }));
        window.flushReact(() => window.setShown(['right']));
      },
      mode,
    );
    await expect(page.getByTestId('left-shortcuts')).toHaveCount(0);
    await expect(page.getByTestId('right-status')).toHaveText('ready');
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('blend rejection restores the picker and permits retry', async ({
  page,
}) => {
  const { blend, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Expected blend rejection'));
    };
  });
  await change(blend.locator('sp-picker'), 'multiply');
  await expect(blend.locator('sp-picker')).toHaveJSProperty('value', 'normal');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await change(blend.locator('sp-picker'), 'multiply');
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.blendMode),
    )
    .toBe('multiply');
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.blendMode),
    )
    .toBeUndefined();
  expect(errors).toEqual([]);
});

test('a newly locked blend target cancels before writing or recording', async ({
  page,
}) => {
  const { blend, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) =>
          editor.updateNode(editor.getNodeById('left')!, { locked: true }),
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
  });
  await change(blend.locator('sp-picker'), 'multiply');
  await drain(page);
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.blendMode),
  ).toBeUndefined();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const [kind, prefix] of [
  ['heatmap', 'hm-g'],
  ['gem-smoke', 'gs-s'],
] as const) {
  test(`${kind} palette edits retain color identity across removal and consecutive adds`, async ({
    page,
  }) => {
    const { section, errors } = await ready(page, `${kind}()`);
    // Color inputs are rendered inside their overlays even when the popover is closed.
    const stops = section.locator(`[id^="ic-ef-${prefix}-0-"]`);
    // Smoke starts at its six-color limit, so first make room through the UI.
    if (kind === 'gem-smoke') {
      await section.locator(`[id="ic-ef-${prefix}-0-0"]`).evaluate((button) => {
        (
          button
            .closest('.color-ctrl-row')!
            .querySelector('sp-action-button[label="Remove"]') as HTMLElement
        ).click();
      });
      await expect(stops).toHaveCount(5);
      await page.evaluate(() => window.apis.left.clearHistory());
    }
    const original = await page.evaluate(
      () => (window.apis.left.getNodeById('left') as { filter: string }).filter,
    );
    const count = await stops.count();
    expect(count).toBeGreaterThan(1);
    await section.evaluate((element, prefix) => {
      const root = element.shadowRoot!;
      const first = root.getElementById(`ic-ef-${prefix}-0-0`)!;
      const second = root.getElementById(`ic-ef-${prefix}-0-1`)!;
      const remove = first
        .closest('.color-ctrl-row')!
        .querySelector('sp-action-button[label="Remove"]') as HTMLElement;
      remove.click();
      remove.click();
      const detail = { type: 'solid', value: '#123456' };
      second
        .parentElement!.querySelector('ic-spectrum-input-solid')!
        .dispatchEvent(
          new CustomEvent('color-change', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      detail.value = '#abcdef';
      const add = root.querySelector(
        prefix === 'hm-g'
          ? 'sp-action-button[label="Add gradient stop"]'
          : 'sp-action-button[label="Add smoke color"]',
      ) as HTMLElement;
      add.click();
      add.click();
    }, prefix);
    await drain(page);
    const added = Math.min(2, (kind === 'heatmap' ? 10 : 6) - (count - 1));
    await expect(stops).toHaveCount(count - 1 + added);
    await expect(
      section
        .locator(`[id="ic-ef-${prefix}-0-0"]`)
        .locator('..')
        .locator('ic-spectrum-input-solid'),
    ).toHaveJSProperty('value', '#123456');
    for (let i = 0; i < 2 + added; i++) {
      await page.getByTestId('left-undo').click();
      await drain(page);
    }
    await wire(page, original);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
