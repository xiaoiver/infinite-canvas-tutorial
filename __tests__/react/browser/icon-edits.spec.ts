import { expect, test, type Page } from '@playwright/test';
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
        api.updateNodes(
          ['icon-a', 'icon-b'].map((id, index) => ({
            id,
            type: 'iconfont',
            iconFontFamily: 'regression',
            iconFontName: 'square',
            x: 110 + index * 100,
            y: 180,
            width: 40,
            height: 40,
            zIndex: index + 1,
          })),
        );
        api.selectNodes([api.getNodeById('icon-a')!]);
        window.editingProbe.properties();
      },
      { capture: 'NEVER' },
    );
  });
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel-content');
  const controls = panel.locator('ic-spectrum-icon-font-controls');
  await expect(controls).toBeVisible();
  return { panel, controls, errors };
}

async function icon(page: Page, id: string, name: string) {
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.apis.left.getNodeById(id);
        return node?.type === 'iconfont' ? node.iconFontName : undefined;
      }, id),
    )
    .toBe(name);
}

test('the icon picker commits one patch and supports undo and redo', async ({
  page,
}) => {
  const { controls, errors } = await ready(page);
  await controls.locator('.icon-name-picker-trigger').click();
  await controls.getByRole('option', { name: 'triangle', exact: true }).click();
  await icon(page, 'icon-a', 'triangle');
  await icon(page, 'icon-b', 'square');
  // The grid intentionally stays open for repeated picks. Close its overlay
  // before using controls outside the canvas.
  await page.keyboard.press('Escape');
  await expect(controls).toHaveCount(0);
  await page.getByTestId('left-undo').click();
  await icon(page, 'icon-a', 'square');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await icon(page, 'icon-a', 'triangle');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a queued icon patch owns its detail and target while the panel changes selection', async ({
  page,
}) => {
  const { panel, controls, errors } = await ready(page);
  await controls.evaluate((element) => {
    const api = window.apis.left;
    const edit = api.edit.bind(api);
    api.edit = (update, options) => {
      void edit(
        (editor) => {
          editor.updateNode(editor.getNodeById('icon-a')!, { x: 140 });
          editor.selectNodes([editor.getNodeById('icon-b')!]);
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const detail = { iconFontName: 'triangle' };
    element.dispatchEvent(
      new CustomEvent('ic-iconfont-controls-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
    detail.iconFontName = 'invalid-after-dispatch';
    // Force the same panel to display B before the queued callback runs.
    const panel = element.getRootNode() as ShadowRoot;
    (panel.host as PropertiesPanelContent).node = api.getNodeById('icon-b')!;
  });
  await icon(page, 'icon-a', 'triangle');
  await icon(page, 'icon-b', 'square');
  await expect
    .poll(() =>
      panel.evaluate((element: PropertiesPanelContent) => element.node.id),
    )
    .toBe('icon-b');
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('icon-a')!.x),
  ).toBe(140);
  await page.getByTestId('left-undo').click();
  await icon(page, 'icon-a', 'square');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('icon-a')!.x),
  ).toBe(140);
  expect(errors).toEqual([]);
});

for (const change of ['delete', 'replace', 'unmount'] as const) {
  test(`a queued icon patch is harmless after ${change}`, async ({ page }) => {
    const { controls, errors } = await ready(page);
    await controls.evaluate((element, change) => {
      const api = window.apis.left;
      const edit = api.edit.bind(api);
      if (change !== 'unmount')
        api.edit = (update, options) => {
          void edit(
            (editor) => {
              editor.deleteNodesById(['icon-a']);
              if (change === 'replace')
                editor.updateNode({
                  id: 'icon-a',
                  type: 'rect',
                  x: 110,
                  y: 180,
                  width: 40,
                  height: 40,
                  zIndex: 1,
                });
            },
            { capture: 'NEVER' },
          );
          return edit(update, options);
        };
      element.dispatchEvent(
        new CustomEvent('ic-iconfont-controls-change', {
          detail: { iconFontName: 'triangle' },
          bubbles: true,
          composed: true,
        }),
      );
      if (change === 'unmount')
        window.flushReact(() => window.setShown(['right']));
    }, change);
    if (change === 'unmount') {
      await expect(page.getByTestId('left-status')).toHaveCount(0);
      await page.evaluate(() => window.setShown(['left', 'right']));
      await expect(page.getByTestId('left-status')).toHaveText('ready', {
        timeout: 45000,
      });
      expect(
        await page.evaluate(() =>
          window.apis.left
            .getNodes()
            .filter((n) => !n.isDeleted)
            .map((n) => n.id),
        ),
      ).toEqual(['left']);
    } else
      await expect
        .poll(() =>
          page.evaluate(() => {
            const node = window.apis.left.getNodeById('icon-a');
            return !node || node.isDeleted ? 'deleted' : node.type;
          }),
        )
        .toBe(change === 'delete' ? 'deleted' : 'rect');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('icon commit errors are observed without an unhandled event rejection', async ({
  page,
}) => {
  const { controls, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('Icon commit failed'));
  });
  await controls.dispatchEvent('ic-iconfont-controls-change', {
    detail: { iconFontName: 'triangle' },
    bubbles: true,
    composed: true,
  });
  await expect
    .poll(() =>
      reported.some((message) => message.includes('Icon commit failed')),
    )
    .toBe(true);
  await icon(page, 'icon-a', 'square');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('empty and unchanged icon patches do not consume unrelated pending edits', async ({
  page,
}) => {
  const { controls, errors } = await ready(page);
  await controls.evaluate((element) => {
    const api = window.apis.left;
    api.updateNode(api.getNodeById('left')!, { width: 130 });
    for (const detail of [{}, { iconFontName: 'square' }]) {
      element.dispatchEvent(
        new CustomEvent('ic-iconfont-controls-change', {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    }
  });
  // Queue a barrier after both patches without capturing the pending width.
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(100);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
