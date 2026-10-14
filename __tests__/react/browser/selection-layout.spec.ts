import { expect, test, type Page } from '@playwright/test';
import type { RectSerializedNode } from '@infinite-canvas-tutorial/ecs';
import type { PropertiesPanel } from '@infinite-canvas-tutorial/webcomponents/spectrum';

declare global {
  interface Window {
    selectionLayoutReady: string;
  }
}
async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(() => {
    window.selectionLayoutReady = 'pending';
    const support = '/editing-test-support.ts';
    void import(support)
      .then(() =>
        window.apis.left.edit(
          (api) => {
            api.updateNode(api.getNodeById('left')!, {
              x: 70,
              y: 20,
              width: 20,
              height: 10,
              scaleX: 2,
              scaleY: 0.5,
            });
            api.updateNodes([
              {
                id: 'b',
                type: 'rect',
                x: 100,
                y: 50,
                width: 30,
                height: 20,
                zIndex: 1,
              },
              {
                id: 'c',
                type: 'rect',
                x: 180,
                y: 100,
                width: 20,
                height: 20,
                zIndex: 2,
              },
            ]);
            api.selectNodes(
              ['left', 'b', 'c'].map((id) => api.getNodeById(id)!),
            );
            window.editingProbe.properties();
          },
          { capture: 'NEVER' },
        ),
      )
      .then(
        () => {
          window.selectionLayoutReady = 'ready';
        },
        (error) => {
          window.selectionLayoutReady = String(error);
        },
      );
  });
  await expect
    .poll(() => page.evaluate(() => window.selectionLayoutReady))
    .toBe('ready');
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-properties-panel');
  await expect(
    panel.locator('sp-action-button[label="Align left"]'),
  ).toBeVisible();
  return { panel, errors };
}
const positions = (page: Page) =>
  page.evaluate(() =>
    ['left', 'b', 'c'].map((id) => {
      const n = window.apis.left.getNodeById(id)!;
      return [n.x, n.y];
    }),
  );

for (const [label, xs, ys] of [
  ['Align left', [70, 70, 70], [20, 50, 100]],
  ['Align right', [160, 170, 180], [20, 50, 100]],
  ['Align center horizontally', [115, 120, 125], [20, 50, 100]],
  ['Align top', [70, 100, 180], [20, 20, 20]],
  ['Align bottom', [70, 100, 180], [115, 100, 100]],
  ['Align middle vertically', [70, 100, 180], [67.5, 60, 60]],
  ['Distribute horizontal spacing', [70, 130, 180], [20, 50, 100]],
  ['Distribute vertical spacing', [70, 100, 180], [20, 52.5, 100]],
] as [string, number[], number[]][]) {
  test(`${label} preserves scaled geometry and commits once`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.locator(`sp-action-button[label="${label}"]`).click();
    await expect
      .poll(() => positions(page))
      .toEqual(xs.map((x, i) => [x, ys[i]]));
    expect(
      await page.evaluate(() => {
        const n = window.apis.left.getNodeById('left')!;
        return {
          width: n.width,
          height: n.height,
          scaleX: n.scaleX,
          scaleY: n.scaleY,
        };
      }),
    ).toEqual({ width: 20, height: 10, scaleX: 2, scaleY: 0.5 });
    await page.getByTestId('left-undo').click();
    await expect
      .poll(() => positions(page))
      .toEqual([
        [70, 20],
        [100, 50],
        [180, 100],
      ]);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await expect
      .poll(() => positions(page))
      .toEqual(xs.map((x, i) => [x, ys[i]]));
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('queued alignment retains its canvas and selected IDs when the panel is reused', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const accepted = await panel.evaluate((element: PropertiesPanel) => {
    element
      .shadowRoot!.querySelector('sp-action-button[label="Align left"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    window.apis.left.setAppState({ layersSelected: ['c'] });
    element.api = window.apis.right;
    element.remove();
    element
      .shadowRoot!.querySelector('sp-action-button[label="Align left"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return window.apis.left.getNodeById('b')!.x;
  });
  expect(accepted).toBe(100);
  await expect
    .poll(() => positions(page))
    .toEqual([
      [70, 20],
      [70, 50],
      [70, 100],
    ]);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('deleting selected nodes before the queued alignment creates no extra undo step', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element: PropertiesPanel) => {
    void window.apis.left.edit((api) => api.deleteNodesById(['b', 'c']));
    element
      .shadowRoot!.querySelector('sp-action-button[label="Align right"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodes().map((n) => n.id)),
    )
    .toEqual(['left']);
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.x),
  ).toBe(70);
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() => positions(page))
    .toEqual([
      [70, 20],
      [100, 50],
      [180, 100],
    ]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('an unchanged alignment does not capture an unrelated pending paint edit', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const button = panel.locator('sp-action-button[label="Align left"]');
  await button.click();
  await expect
    .poll(() => positions(page))
    .toEqual([
      [70, 20],
      [70, 50],
      [70, 100],
    ]);
  await page.evaluate(() => {
    const api = window.apis.left;
    api.clearHistory();
    api.updateNode(api.getNodeById('b')!, {
      fills: [{ type: 'solid', value: 'green' }],
    });
  });
  await button.click();
  await page.evaluate(() => {
    window.selectionLayoutReady = 'pending';
    const controller = new AbortController();
    void window.apis.left
      .edit(() => controller.abort(), { signal: controller.signal })
      .then(
        () => {
          window.selectionLayoutReady = 'ready';
        },
        (error) => {
          window.selectionLayoutReady = String(error);
        },
      );
  });
  await expect
    .poll(() => page.evaluate(() => window.selectionLayoutReady))
    .toBe('ready');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(
      () => (window.apis.left.getNodeById('b')! as RectSerializedNode).fills,
    ),
  ).toEqual([{ type: 'solid', value: 'green' }]);
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window.apis.left.getNodeById('b')! as RectSerializedNode).fills,
      ),
    )
    .toBeUndefined();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
