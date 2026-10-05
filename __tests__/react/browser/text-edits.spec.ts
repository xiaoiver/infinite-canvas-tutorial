import { expect, test, type Page } from '@playwright/test';
import type { TextEditor } from '@infinite-canvas-tutorial/webcomponents/spectrum';

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
          ['Alpha', 'Beta'].map((content, index) => ({
            id: `text-${index}`,
            type: 'text',
            content,
            anchorX: 110 + index * 140,
            anchorY: 180,
            fontFamily: 'Arial',
            fontSize: 20,
            textBaseline: 'top',
            fills: [{ type: 'solid', value: '#000' }],
            zIndex: index + 1,
          })),
        );
      },
      { capture: 'NEVER' },
    );
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getBounds([window.apis.left.getNodeById('text-0')!])
            .maxX,
      ),
    )
    .toBeGreaterThan(110);
  const editor = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-text-editor');
  return { editor, input: editor.locator('textarea'), errors };
}

async function open(page: Page, id = 'text-0') {
  const point = await page.evaluate((id) => window.editingProbe.point(id), id);
  await page
    .getByTestId('left-shortcuts')
    .locator('canvas')
    .dispatchEvent('dblclick', { clientX: point.x, clientY: point.y });
  await expect(
    page
      .getByTestId('left-shortcuts')
      .locator('ic-spectrum-text-editor textarea'),
  ).toBeVisible();
}

async function content(page: Page, value: string, id = 'text-0') {
  await expect
    .poll(() =>
      page.evaluate((id) => window.editingProbe.textState(id)?.content, id),
    )
    .toBe(value);
}

test('text editing hides only the renderer, commits current text once, and preserves newer attributes', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  await open(page);
  await expect(input).toHaveValue('Alpha');
  expect(
    await page.evaluate(() => window.editingProbe.textState('text-0')),
  ).toMatchObject({
    content: 'Alpha',
    visibility: 'inherited',
    rendered: 'hidden',
  });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() =>
    window.apis.left.edit(
      (api) => api.updateNode(api.getNodeById('text-0')!, { fontSize: 24 }),
      { capture: 'NEVER' },
    ),
  );
  await input.fill('  Updated text  ');
  await input.press('Escape');
  await content(page, '  Updated text  ');
  expect(
    await page.evaluate(() => window.editingProbe.textState('text-0')),
  ).toMatchObject({
    visibility: 'inherited',
    rendered: 'inherited',
    fontSize: 24,
  });
  await page.getByTestId('left-undo').click();
  await content(page, 'Alpha');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(
      () => window.editingProbe.textState('text-0')?.fontSize,
    ),
  ).toBe(24);
  await page.getByTestId('left-redo').click();
  await content(page, '  Updated text  ');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a real double click edits text and one undo restores its contents', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  const point = await page.evaluate(() => window.editingProbe.point('text-0'));
  await page.mouse.dblclick(point.x, point.y);
  await expect(input).toHaveValue('Alpha');
  await input.fill('Pointer edit');
  await input.press('Escape');
  await content(page, 'Pointer edit');
  await page.getByTestId('left-undo').click();
  await content(page, 'Alpha');
  // Pointer selection can have its own earlier history entry. The text edit
  // must be reverted by this single undo, regardless of that selection entry.
  await page.getByTestId('left-redo').click();
  await content(page, 'Pointer edit');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('temporary hiding never enters the history of an unrelated edit and unchanged blur creates no commit', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  await open(page);
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 120 }),
    ),
  );
  await input.evaluate((element) => element.blur());
  expect(
    await page.evaluate(() => window.editingProbe.textState('text-0')),
  ).toMatchObject({
    content: 'Alpha',
    visibility: 'inherited',
    rendered: 'inherited',
  });
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => ({
      width: window.apis.left.getNodeById('left')!.width,
      text: window.editingProbe.textState('text-0'),
    })),
  ).toMatchObject({
    width: 100,
    text: { rendered: 'inherited', visibility: 'inherited' },
  });
  await open(page);
  // This update is deliberately uncommitted. A no-op blur must not absorb it.
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('left')!, {
      width: 130,
    }),
  );
  await input.evaluate((element) => element.blur());
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(100);
  expect(errors).toEqual([]);
});

test('blank existing text restores its contents and a blank new draft leaves no node or history', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  await open(page);
  await input.fill('   ');
  await input.press('Escape');
  await content(page, 'Alpha');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => {
    window.editingProbe.textPen();
    const api = window.apis.left;
    const p = api.viewport2Client({ x: 200, y: 250 });
    api
      .getCanvasElement()
      .dispatchEvent(
        new MouseEvent('dblclick', { clientX: p.x, clientY: p.y }),
      );
  });
  await expect(input).toBeVisible();
  await input.fill('\n  ');
  await input.press('Escape');
  await expect(input).toBeHidden();
  expect(
    await page.evaluate(() => ({
      count: window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      pen: window.apis.left.getAppState().penbarSelected,
    })),
  ).toEqual({ count: 3, pen: 'select' });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a nonempty new text draft is one undoable insertion', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  await page.evaluate(() => {
    window.editingProbe.textPen();
    const api = window.apis.left;
    const p = api.viewport2Client({ x: 200, y: 250 });
    api
      .getCanvasElement()
      .dispatchEvent(
        new MouseEvent('dblclick', { clientX: p.x, clientY: p.y }),
      );
  });
  await expect(input).toBeVisible();
  await input.fill('New draft');
  await input.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      ),
    )
    .toBe(4);
  const node = await page.evaluate(() =>
    window.apis.left
      .getNodes()
      .find((n) => n.type === 'text' && n.content === 'New draft'),
  );
  expect(node).toMatchObject({
    type: 'text',
    content: 'New draft',
  });
  if (node?.type !== 'text') throw new Error('Expected inserted text');
  expect(Number(node.x) + Number(node.anchorX)).toBeCloseTo(200);
  expect(Number(node.y) + Number(node.anchorY)).toBeCloseTo(250);
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      ),
    )
    .toBe(3);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      ),
    )
    .toBe(4);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('switching text fields before the next frame retains each captured target and ignores duplicate blur', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  await open(page);
  await input.fill('First edit');
  await page.evaluate(() => {
    const api = window.apis.left;
    const p = window.editingProbe.point('text-1');
    // A second double click can arrive while the same textarea is still focused.
    api
      .getCanvasElement()
      .dispatchEvent(
        new MouseEvent('dblclick', { clientX: p.x, clientY: p.y }),
      );
  });
  await expect(input).toHaveValue('Beta');
  await content(page, 'First edit');
  await input.fill('Second edit');
  await input.evaluate((element) => {
    element.dispatchEvent(new FocusEvent('blur'));
    element.dispatchEvent(new FocusEvent('blur'));
  });
  await content(page, 'Second edit', 'text-1');
  await page.getByTestId('left-undo').click();
  await content(page, 'Beta', 'text-1');
  await content(page, 'First edit');
  await page.getByTestId('left-undo').click();
  await content(page, 'Alpha');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const change of ['delete', 'replace'] as const) {
  test(`a ${change} before a text commit cannot resurrect or overwrite its former target`, async ({
    page,
  }) => {
    const { input, errors } = await ready(page);
    await open(page);
    await input.fill('Stale edit');
    await page.evaluate((change) => {
      const api = window.apis.left;
      const edit = api.edit.bind(api);
      api.edit = (update, options) => {
        void edit(
          (editor) => {
            editor.deleteNodesById(['text-0']);
            if (change === 'replace')
              editor.updateNode({
                id: 'text-0',
                type: 'rect',
                x: 110,
                y: 180,
                width: 50,
                height: 30,
                zIndex: 1,
              });
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    }, change);
    await input.press('Escape');
    await expect
      .poll(() => page.evaluate(() => window.editingProbe.textState('text-0')))
      .toBe(null);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    if (change === 'replace')
      expect(
        await page.evaluate(() => window.apis.left.getNodeById('text-0')!.type),
      ).toBe('rect');
    expect(errors).toEqual([]);
  });
}

test('disconnecting the editor restores the original text and reconnecting rebinds double click', async ({
  page,
}) => {
  const { editor, input, errors } = await ready(page);
  await open(page);
  await input.fill('Discarded draft');
  const handle = await editor.elementHandle();
  await handle!.evaluate((element) => {
    const parent = element.parentNode!;
    element.remove();
    const p = window.editingProbe.point('text-1');
    window.apis.left
      .getCanvasElement()
      .dispatchEvent(
        new MouseEvent('dblclick', { clientX: p.x, clientY: p.y }),
      );
    parent.appendChild(element);
  });
  expect(
    await page.evaluate(() => window.editingProbe.textState('text-0')),
  ).toMatchObject({ content: 'Alpha', rendered: 'inherited' });
  await expect(input).toBeHidden();
  await open(page, 'text-1');
  await expect(input).toHaveValue('Beta');
  await input.fill('Reconnected');
  await input.press('Escape');
  await content(page, 'Reconnected', 'text-1');
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('rebinding the editor removes the previous canvas listener', async ({
  page,
}) => {
  const { editor, input, errors } = await ready(page);
  await page
    .getByTestId('right-shortcuts')
    .locator('ic-spectrum-text-editor')
    .evaluate((element) => element.remove());
  await editor.evaluate(async (element: TextEditor) => {
    element.api = window.apis.right;
    element.requestUpdate();
    await element.updateComplete;
    const support = '/editing-test-support.ts';
    const { textPen } = await import(support);
    textPen('right');
  });
  const point = await page.evaluate(() =>
    window.apis.right.viewport2Client({ x: 200, y: 150 }),
  );
  await page
    .getByTestId('left-shortcuts')
    .locator('canvas')
    .dispatchEvent('dblclick', { clientX: point.x, clientY: point.y });
  await expect(input).toBeHidden();
  await page
    .getByTestId('right-shortcuts')
    .locator('canvas')
    .dispatchEvent('dblclick', { clientX: point.x, clientY: point.y });
  await expect(input).toBeVisible();
  await input.fill('Right canvas');
  await input.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.apis.right
          .getNodes()
          .flatMap((node) =>
            !node.isDeleted && node.type === 'text' ? [node.content] : [],
          ),
      ),
    )
    .toEqual(['Right canvas']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('right-undo').click();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const phase of ['draft', 'queued commit'] as const) {
  test(`unmounting a ${phase} cannot write to a replacement canvas`, async ({
    page,
  }) => {
    const { input, errors } = await ready(page);
    await open(page);
    await input.fill('Unmounted');
    if (phase === 'queued commit') {
      await page.evaluate(() => {
        const api = window.apis.left;
        const edit = api.edit.bind(api);
        api.edit = (update, options) => {
          const pending = edit(update, options);
          window.flushReact(() => window.setShown(['right']));
          return pending;
        };
      });
      await input.dispatchEvent('blur');
    } else {
      await page.evaluate(() =>
        window.flushReact(() => window.setShown(['right'])),
      );
    }
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
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a rejected text edit is reported and the original text remains visible', async ({
  page,
}) => {
  const { input, errors } = await ready(page);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await open(page);
  await input.fill('Cannot commit');
  await page.evaluate(() => {
    window.apis.left.edit = () =>
      Promise.reject(new Error('Text commit failed'));
  });
  await input.press('Escape');
  await expect
    .poll(() =>
      reported.some((message) => message.includes('Text commit failed')),
    )
    .toBe(true);
  expect(
    await page.evaluate(() => window.editingProbe.textState('text-0')),
  ).toMatchObject({ content: 'Alpha', rendered: 'inherited' });
  await expect(input).toBeHidden();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
