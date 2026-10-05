import { expect, test, type Page, type Locator } from '@playwright/test';
import type { ContextImageEditBar } from '@infinite-canvas-tutorial/webcomponents/spectrum';
import { ready, count } from './image-test-helpers';

const action = (bar: Locator, label: string) =>
  bar
    .locator('sp-action-button')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });

async function jobs(page: Page, kinds: string[]) {
  await expect
    .poll(() =>
      page.evaluate(() => window.imageProbe.jobs.map((job) => job.kind)),
    )
    .toEqual(kinds);
}

async function select(page: Page, bar: Locator) {
  await action(bar, 'Smart select').click();
  await page.evaluate(() => window.imageProbe.jobs.at(-1)!.resolve(undefined));
  await expect(action(bar, 'Remove')).toBeVisible();
}

async function point(page: Page, x = 70, y = 80) {
  await page.evaluate(
    ({ x, y }) => {
      const api = window.apis.left;
      const p = api.canvas2Viewport({ x, y });
      api.setAppState({ editingPoints: [[p.x, p.y]] });
    },
    { x, y },
  );
}

async function mask(page: Page, index: number, color = 'blue', url = false) {
  await page.evaluate(
    ({ index, color, url }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 2, 2);
      window.imageProbe.masks.push(canvas);
      window.imageProbe.jobs[index].resolve({
        image: url ? { url: canvas.toDataURL() } : { canvas },
      });
    },
    { index, color, url },
  );
}

async function preview(bar: Locator, rgba: number[] | null) {
  await expect
    .poll(() =>
      bar.evaluate((element: ContextImageEditBar) => {
        const canvas = element.maskCanvas;
        return canvas?.isConnected
          ? Array.from(canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data)
          : null;
      }),
    )
    .toEqual(rgba);
}

async function replace(page: Page) {
  await page.evaluate(() =>
    window.apis.left.edit(
      (api) =>
        api.updateNode(api.getNodeById('left')!, {
          fills: [
            { type: 'image', value: window.imageProbe.results[1], opacity: 1 },
          ],
        }),
      { capture: 'NEVER' },
    ),
  );
}

test('encoding failures recover and a response for a replaced image cannot enter smart selection', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const smart = action(bar, 'Smart select');
  await smart.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click'));
    element.dispatchEvent(new MouseEvent('click'));
  });
  await jobs(page, ['encode']);
  await page.evaluate(() =>
    window.imageProbe.jobs[0].reject(new Error('Encoding failed')),
  );
  await expect(smart).not.toHaveAttribute('disabled', '');
  await smart.click();
  await jobs(page, ['encode', 'encode']);
  await replace(page);
  await expect(smart).not.toHaveAttribute('disabled', '');
  // The old provider still owns the canvas loading overlay. Dispatch directly
  // to exercise a new session before that unrelated provider settles.
  await smart.dispatchEvent('click');
  await jobs(page, ['encode', 'encode', 'encode']);
  await page.evaluate(() => window.imageProbe.jobs[1].resolve(undefined));
  await expect(smart).toHaveAttribute('disabled', '');
  await page.evaluate(() => window.imageProbe.jobs[2].resolve(undefined));
  await expect(action(bar, 'Remove')).toHaveAttribute('disabled', '');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('only the newest point response is shown, with the source URL and an owned preview', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await select(page, bar);
  await point(page);
  await jobs(page, ['encode', 'segment']);
  await point(page, 90, 100);
  await jobs(page, ['encode', 'segment', 'segment']);
  const input = (await page.evaluate(
    () => window.imageProbe.jobs[2].input,
  )) as {
    image_url: string;
    point_prompts: { x: number; y: number; label: number }[];
  };
  expect(input.image_url).toBe(
    await page.evaluate(() => window.imageProbe.source),
  );
  expect(input.point_prompts[0].x).toBeCloseTo(40);
  expect(input.point_prompts[0].y).toBeCloseTo(50);
  expect(input.point_prompts[0].label).toBe(1);
  await mask(page, 2, 'green');
  await preview(bar, [0, 128, 0, 255]);
  await mask(page, 1, 'blue');
  await expect
    .poll(() => page.evaluate(() => window.apis.left.getAppState().loading))
    .toBe(false);
  await preview(bar, [0, 128, 0, 255]);
  expect(
    await bar.evaluate((element: ContextImageEditBar) => ({
      providerAttached: window.imageProbe.masks.some(
        (mask) => mask.isConnected,
      ),
      own: !window.imageProbe.masks.includes(element.maskCanvas),
      children: window.apis.left.getHtmlLayer().querySelectorAll('canvas')
        .length,
    })),
  ).toEqual({ providerAttached: false, own: true, children: 1 });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('cleared points invalidate pending masks; failures and empty masks allow another point', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await select(page, bar);
  await point(page);
  await jobs(page, ['encode', 'segment']);
  await mask(page, 1);
  await preview(bar, [0, 0, 255, 255]);
  await point(page, 80);
  await jobs(page, ['encode', 'segment', 'segment']);
  await preview(bar, null);
  await page.evaluate(() =>
    window.apis.left.setAppState({ editingPoints: [] }),
  );
  await mask(page, 2);
  await expect
    .poll(() => page.evaluate(() => window.apis.left.getAppState().loading))
    .toBe(false);
  await preview(bar, null);
  await point(page);
  await jobs(page, ['encode', 'segment', 'segment', 'segment']);
  await page.evaluate(() =>
    window.imageProbe.jobs[3].reject(new Error('Segmentation failed')),
  );
  await expect
    .poll(() => page.evaluate(() => window.apis.left.getAppState().loading))
    .toBe(false);
  await preview(bar, null);
  await point(page);
  await jobs(page, ['encode', 'segment', 'segment', 'segment', 'segment']);
  await page.evaluate(() => window.imageProbe.jobs[4].resolve({ image: {} }));
  await expect
    .poll(() => page.evaluate(() => window.apis.left.getAppState().loading))
    .toBe(false);
  await preview(bar, null);
  await point(page);
  await jobs(page, [
    'encode',
    'segment',
    'segment',
    'segment',
    'segment',
    'segment',
  ]);
  await mask(page, 5, 'blue', true);
  await preview(bar, [0, 0, 255, 255]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const phase of ['preview', 'pending response'] as const) {
  for (const change of ['selection', 'replace', 'exit'] as const) {
    test(`${change} invalidates the ${phase}`, async ({ page }) => {
      const { bar, errors } = await ready(page);
      const handle = await bar.elementHandle();
      await select(page, bar);
      await point(page);
      await jobs(page, ['encode', 'segment']);
      await mask(page, 1);
      await preview(bar, [0, 0, 255, 255]);
      // Retain a reference so we can check cleanup after toolbar removal.
      const canvas = await bar.evaluateHandle(
        (element: ContextImageEditBar) => element.maskCanvas,
      );
      if (phase === 'pending response') {
        await point(page, 80);
        await jobs(page, ['encode', 'segment', 'segment']);
      }
      if (change === 'replace') await replace(page);
      else
        await page.evaluate(
          (change) =>
            window.apis.left.edit(
              (api) => {
                if (change === 'exit')
                  api.updateNode(api.getNodeById('left')!, {
                    isEditing: false,
                  });
                else {
                  api.updateNode({
                    id: 'other',
                    type: 'rect',
                    x: 260,
                    y: 30,
                    width: 20,
                    height: 20,
                    zIndex: 2,
                    fills: [
                      {
                        type: 'image',
                        value: window.imageProbe.results[1],
                        opacity: 1,
                      },
                    ],
                    isEditing: true,
                  });
                  api.selectNodes([api.getNodeById('other')!]);
                }
              },
              { capture: 'NEVER' },
            ),
          change,
        );
      if (phase === 'pending response') await mask(page, 2);
      await expect
        .poll(() => page.evaluate(() => window.apis.left.getAppState().loading))
        .toBe(false);
      expect(await canvas.evaluate((canvas) => canvas.isConnected)).toBe(false);
      expect(
        await handle!.evaluate(
          (element: ContextImageEditBar) => !!element.maskCanvas,
        ),
      ).toBe(false);
      expect(
        await page.evaluate(
          () =>
            window.apis.left.getHtmlLayer().querySelectorAll('canvas').length,
        ),
      ).toBe(0);
      if (change !== 'exit')
        await expect(action(bar, 'Smart select')).not.toHaveAttribute(
          'disabled',
          '',
        );
      await expect(page.getByTestId('left-undo')).toBeDisabled();
      expect(errors).toEqual([]);
    });
  }
}

test('mask removal owns its input, commits one result, and preserves a newer preview', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await select(page, bar);
  await point(page);
  await jobs(page, ['encode', 'segment']);
  await mask(page, 1);
  await preview(bar, [0, 0, 255, 255]);
  const remove = action(bar, 'Remove');
  await remove.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click'));
    element.dispatchEvent(new MouseEvent('click'));
  });
  await jobs(page, ['encode', 'segment', 'remove']);
  await bar.evaluate((element: ContextImageEditBar) =>
    element.maskCanvas.getContext('2d')!.clearRect(0, 0, 2, 2),
  );
  expect(
    await page.evaluate(() => {
      const input = window.imageProbe.jobs[2].input as {
        image_url: string;
        mask: HTMLCanvasElement;
      };
      return {
        image: input.image_url,
        pixel: Array.from(
          input.mask.getContext('2d')!.getImageData(0, 0, 1, 1).data,
        ),
        connected: input.mask.isConnected,
      };
    }),
  ).toEqual({
    image: await page.evaluate(() => window.imageProbe.source),
    pixel: [0, 0, 255, 255],
    connected: false,
  });
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await point(page, 90);
  await jobs(page, ['encode', 'segment', 'remove', 'segment']);
  await mask(page, 3, 'green');
  await preview(bar, [0, 128, 0, 255]);
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 120 }),
    ),
  );
  await page.evaluate(() =>
    window.imageProbe.jobs[2].resolve({ url: window.imageProbe.results[0] }),
  );
  await count(page, 2);
  await expect(remove).not.toHaveAttribute('disabled', '');
  await preview(bar, [0, 128, 0, 255]);
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      const node = api
        .getNodes()
        .find((node) => node.id !== 'left' && !node.isDeleted)!;
      return {
        x: node.x,
        width: node.width,
        selected: api.getAppState().layersSelected,
      };
    }),
  ).toEqual({ x: 200, width: 100, selected: ['left'] });
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(120);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await page.getByTestId('left-redo').click();
  await count(page, 2);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('failed and empty removals keep the mask for retry; success clears it', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await select(page, bar);
  await point(page);
  await jobs(page, ['encode', 'segment']);
  await mask(page, 1);
  await preview(bar, [0, 0, 255, 255]);
  const remove = action(bar, 'Remove');
  await remove.click();
  await page.evaluate(() =>
    window.imageProbe.jobs[2].reject(new Error('Removal failed')),
  );
  await expect(remove).not.toHaveAttribute('disabled', '');
  await preview(bar, [0, 0, 255, 255]);
  await remove.click();
  await page.evaluate(() => window.imageProbe.jobs[3].resolve({}));
  await expect(remove).not.toHaveAttribute('disabled', '');
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await remove.click();
  await page.evaluate(() =>
    window.imageProbe.jobs[4].resolve({ canvas: window.imageProbe.masks[0] }),
  );
  await count(page, 2);
  await preview(bar, null);
  await expect(remove).toHaveAttribute('disabled', '');
  expect(
    await bar.evaluate(
      (element: ContextImageEditBar) => element.removingByMask,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

for (const phase of [
  'encoding',
  'segmentation',
  'removal',
  'queued commit',
] as const) {
  test(`unmount during ${phase} clears masks and cannot affect a replacement canvas`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    const handle = await bar.elementHandle();
    await action(bar, 'Smart select').click();
    if (phase !== 'encoding') {
      await page.evaluate(() => window.imageProbe.jobs[0].resolve(undefined));
      await expect(action(bar, 'Remove')).toBeVisible();
      await point(page);
      await jobs(page, ['encode', 'segment']);
      if (phase !== 'segmentation') {
        await mask(page, 1);
        await preview(bar, [0, 0, 255, 255]);
        await action(bar, 'Remove').click();
        await jobs(page, ['encode', 'segment', 'remove']);
      }
    }
    const htmlLayer = await page.evaluateHandle(() =>
      window.apis.left.getHtmlLayer(),
    );
    if (phase === 'queued commit') {
      await page.evaluate(() => {
        const api = window.apis.left;
        const edit = api.edit.bind(api);
        api.edit = (update, options) => {
          const pending = edit(update, options);
          window.flushReact(() => window.setShown(['right']));
          return pending;
        };
        window.imageProbe.jobs[2].resolve({
          url: window.imageProbe.results[0],
        });
      });
    } else
      await page.evaluate(() =>
        window.flushReact(() => window.setShown(['right'])),
      );
    await expect(page.getByTestId('left-status')).toHaveCount(0);
    expect(
      await htmlLayer.evaluate(
        (layer) => layer.querySelectorAll('canvas').length,
      ),
    ).toBe(0);
    await page.evaluate(() => window.setShown(['right', 'left']));
    await expect(page.getByTestId('left-status')).toHaveText('ready', {
      timeout: 45000,
    });
    if (phase === 'encoding')
      await page.evaluate(() => window.imageProbe.jobs[0].resolve(undefined));
    if (phase === 'segmentation') await mask(page, 1);
    if (phase === 'removal')
      await page.evaluate(() =>
        window.imageProbe.jobs[2].resolve({
          url: window.imageProbe.results[0],
        }),
      );
    await expect
      .poll(() =>
        handle!.evaluate(
          (element: ContextImageEditBar) =>
            !!element.encodingImage ||
            !!element.removingByMask ||
            !!element.maskCanvas,
        ),
      )
      .toBe(false);
    expect(
      await htmlLayer.evaluate(
        (layer) => layer.querySelectorAll('canvas').length,
      ),
    ).toBe(0);
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

for (const phase of ['preparation', 'queued commit'] as const) {
  test(`source replacement during removal ${phase} leaves no result or history`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    await select(page, bar);
    await point(page);
    await jobs(page, ['encode', 'segment']);
    await mask(page, 1);
    await preview(bar, [0, 0, 255, 255]);
    await action(bar, 'Remove').click();
    if (phase === 'preparation') await replace(page);
    else
      await page.evaluate(() => {
        const api = window.apis.left;
        const edit = api.edit.bind(api);
        api.edit = (update, options) => {
          // Change the source in the same write phase, immediately before the
          // mask edit callback executes. Its guard must cancel the empty commit.
          void edit(
            (editor) =>
              editor.updateNode(editor.getNodeById('left')!, {
                fills: [
                  {
                    type: 'image',
                    value: window.imageProbe.results[1],
                    opacity: 1,
                  },
                ],
              }),
            { capture: 'NEVER' },
          );
          return edit(update, options);
        };
      });
    await page.evaluate(() =>
      window.imageProbe.jobs[2].resolve({ url: window.imageProbe.results[0] }),
    );
    await expect
      .poll(() =>
        bar.evaluate((element: ContextImageEditBar) => element.removingByMask),
      )
      .toBe(false);
    await expect(action(bar, 'Smart select')).not.toHaveAttribute(
      'disabled',
      '',
    );
    await preview(bar, null);
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a new smart selection waits for a fresh point instead of reusing existing points', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await point(page, 75, 85);
  await select(page, bar);
  await jobs(page, ['encode']);
  await preview(bar, null);
  await point(page, 90, 100);
  await jobs(page, ['encode', 'segment']);
  await mask(page, 1);
  await preview(bar, [0, 0, 255, 255]);
  expect(errors).toEqual([]);
});
