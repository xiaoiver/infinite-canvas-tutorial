import { expect, test, type Page } from '@playwright/test';
import type { ContextImageEditBar } from '@infinite-canvas-tutorial/webcomponents/spectrum';
import { ready, count } from './image-test-helpers';

async function finish(page: Page, index = 0, empty = false) {
  await page.evaluate(
    ({ index, empty }) => {
      const { jobs, results } = window.imageProbe;
      const job = jobs[index];
      if (job.kind === 'upscale') job.resolve(empty ? {} : { url: results[0] });
      else
        job.resolve({
          images: empty ? [] : results.map((url) => ({ url })),
          description: '',
        });
    },
    { index, empty },
  );
}

test('background removal inserts only its finished result and keeps unrelated edits in separate history entries', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const button = bar
    .locator('sp-action-button')
    .filter({ hasText: 'Remove background' });
  // Two events in the same turn also exercise the guard before Lit disables it.
  await button.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click'));
    element.dispatchEvent(new MouseEvent('click'));
  });
  await expect
    .poll(() => page.evaluate(() => window.imageProbe.jobs.length))
    .toBe(1);
  await expect(button).toHaveAttribute('disabled', '');
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.imageProbe.jobs[0].input)).toEqual({
    isEdit: true,
    prompt: 'Remove background from the image',
    urls: [await page.evaluate(() => window.imageProbe.source)],
  });
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 120 }),
    ),
  );
  await finish(page);
  await count(page, 2);
  await expect(button).not.toHaveAttribute('disabled', '');
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      const output = api
        .getNodes()
        .find((node) => node.id !== 'left' && !node.isDeleted)!;
      return {
        x: output.x,
        width: output.width,
        selected: api.getAppState().layersSelected,
        loading: api.getAppState().loading,
      };
    }),
  ).toEqual({ x: 200, width: 100, selected: ['left'], loading: false });
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(120);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(100);
  await page.getByTestId('left-redo').click();
  await page.getByTestId('left-redo').click();
  await count(page, 2);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('upscaling a canvas result retains the original source after the toolbar changes selection', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await bar.locator('sp-action-button').filter({ hasText: 'Upscale' }).click();
  await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit(
      (editor) => {
        editor.updateNode({
          id: 'other',
          type: 'rect',
          x: 270,
          y: 30,
          width: 20,
          height: 20,
          zIndex: 2,
          fills: [
            { type: 'image', value: window.imageProbe.results[1], opacity: 1 },
          ],
          isEditing: true,
        });
        editor.selectNodes([editor.getNodeById('other')!]);
      },
      { capture: 'NEVER' },
    );
  });
  await expect
    .poll(() => bar.evaluate((element: ContextImageEditBar) => element.node.id))
    .toBe('other');
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    window.imageProbe.jobs[0].resolve({ canvas });
  });
  await count(page, 3);
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      const output = api
        .getNodes()
        .find(
          (node) => !['left', 'other'].includes(node.id) && !node.isDeleted,
        )!;
      return {
        x: output.x,
        y: output.y,
        width: output.width,
        height: output.height,
        fill: output.type === 'rect' ? output.fills?.[0].value : undefined,
        selected: api.getAppState().layersSelected,
        input: window.imageProbe.jobs[0].input,
      };
    }),
  ).toEqual({
    x: 200,
    y: 50,
    width: 100,
    height: 80,
    fill: expect.stringContaining('data:image/png'),
    selected: ['other'],
    input: { image_url: await page.evaluate(() => window.imageProbe.source) },
  });
  await page.getByTestId('left-undo').click();
  await count(page, 2);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('decomposition uses its provider and inserts all layers as one undoable edit', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const button = bar
    .locator('sp-action-button')
    .filter({ hasText: 'Decompose' });
  await button.click();
  await expect
    .poll(() =>
      page.evaluate(() => window.imageProbe.jobs.map((job) => job.kind)),
    )
    .toEqual(['decompose']);
  await count(page, 1);
  await expect(button).toHaveAttribute('disabled', '');
  await finish(page);
  await count(page, 3);
  const result = await page.evaluate(() => ({
    expected: window.imageProbe.results,
    layers: window.apis.left
      .getNodes()
      .filter((node) => node.id !== 'left' && !node.isDeleted)
      .map((node) => ({
        fill: node.type === 'rect' ? node.fills?.[0].value : undefined,
        zIndex: node.zIndex,
      })),
  }));
  expect(result.layers).toEqual(
    result.expected.map((fill, zIndex) => ({ fill, zIndex })),
  );
  await expect(button).not.toHaveAttribute('disabled', '');
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await count(page, 3);
  expect(errors).toEqual([]);
});

for (const label of ['Remove background', 'Upscale', 'Decompose']) {
  test(`${label} recovers from provider failure and empty results without placeholders or history`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    const reported: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') reported.push(message.text());
    });
    const button = bar.locator('sp-action-button').filter({ hasText: label });
    await button.click();
    await page.evaluate(() =>
      window.imageProbe.jobs[0].reject(new Error('Image provider failed')),
    );
    await expect(button).not.toHaveAttribute('disabled', '');
    await expect
      .poll(() =>
        reported.some((message) => message.includes('Image provider failed')),
      )
      .toBe(true);
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await button.click();
    await finish(page, 1, true);
    await expect(button).not.toHaveAttribute('disabled', '');
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    expect(
      await page.evaluate(() => window.apis.left.getAppState().loading),
    ).toBe(false);
    // A successful retry verifies that the action is usable again.
    await button.click();
    await finish(page, 2);
    await count(page, label === 'Decompose' ? 3 : 2);
    expect(errors).toEqual([]);
  });
}

for (const change of ['delete', 'replace'] as const) {
  test(`a late image response is ignored after source ${change}`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    const handle = await bar.elementHandle();
    await bar
      .locator('sp-action-button')
      .filter({ hasText: 'Remove background' })
      .click();
    await page.evaluate(async (change) => {
      await window.apis.left.edit(
        (api) => {
          if (change === 'delete') api.deleteNodesById(['left']);
          else
            api.updateNode(api.getNodeById('left')!, {
              fills: [
                {
                  type: 'image',
                  value: window.imageProbe.results[1],
                  opacity: 1,
                },
              ],
            });
        },
        { capture: 'NEVER' },
      );
    }, change);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await finish(page);
    await expect
      .poll(() =>
        handle!.evaluate(
          (element: ContextImageEditBar) => element.removingBackground,
        ),
      )
      .toBe(false);
    await count(page, change === 'delete' ? 0 : 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

for (const phase of ['preparation', 'queued commit'] as const) {
  test(`unmount during ${phase} cannot edit a replacement canvas`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    const handle = await bar.elementHandle();
    await bar
      .locator('sp-action-button')
      .filter({ hasText: 'Upscale' })
      .click();
    if (phase === 'preparation') {
      await page.evaluate(() =>
        window.flushReact(() => window.setShown(['right'])),
      );
    } else {
      await page.evaluate(() => {
        const api = window.apis.left;
        const edit = api.edit.bind(api);
        api.edit = (update, options) => {
          const pending = edit(update, options);
          window.flushReact(() => window.setShown(['right']));
          return pending;
        };
      });
      await finish(page);
    }
    await expect(page.getByTestId('left-status')).toHaveCount(0);
    await page.evaluate(() => window.setShown(['right', 'left']));
    await expect(page.getByTestId('left-status')).toHaveText('ready', {
      timeout: 45000,
    });
    if (phase === 'preparation') await finish(page);
    await expect
      .poll(() =>
        handle!.evaluate(
          (element: ContextImageEditBar) => element.upscalingImage,
        ),
      )
      .toBe(false);
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('an edit rejection resets the image action and is observed by the toolbar', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  const button = bar.locator('sp-action-button').filter({ hasText: 'Upscale' });
  await button.click();
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('Image commit failed'));
  });
  await finish(page);
  await expect(button).not.toHaveAttribute('disabled', '');
  await expect
    .poll(() =>
      reported.some((message) => message.includes('Image commit failed')),
    )
    .toBe(true);
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
