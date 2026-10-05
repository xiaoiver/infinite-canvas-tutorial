import { expect, test, type Page } from '@playwright/test';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
}

async function count(page: Page, expected: number) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodes().filter((node) => !node.isDeleted).length,
      ),
    )
    .toBe(expected);
}

test('queued insertion clears live highlights and selects in its single commit without a delayed selection', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const stale = api.getAppState();
    await api.edit(
      (editor) => {
        editor.highlightNodes([editor.getNodeById('left')!]);
      },
      { capture: 'NEVER' },
    );
    const selectedAtCommit: string[][] = [];
    const off = api.subscribe((snapshot) =>
      selectedAtCommit.push([...snapshot.appState.layersSelected]),
    );
    const node: SerializedNode = {
      id: 'inserted',
      type: 'rect',
      x: 60,
      y: 60,
      width: 40,
      height: 30,
      zIndex: 2,
    };
    const pending = window.insertNodes(api, stale, [node]);
    api.setAppState({
      layersHighlighted: [
        ...api.getAppState().layersHighlighted,
        'removed-node',
      ],
    });
    node.x = 999;
    const applied = await pending;
    off();
    return {
      applied,
      selectedAtCommit,
      selected: api.getAppState().layersSelected,
      highlighted: api.getAppState().layersHighlighted,
      x: api.getNodeById('inserted')!.x,
    };
  });
  expect(result).toEqual({
    applied: true,
    selectedAtCommit: [['inserted']],
    selected: ['inserted'],
    highlighted: [],
    x: 60,
  });
  await count(page, 2);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await count(page, 2);
  await page.evaluate(() =>
    window.apis.left.selectNodes([window.apis.left.getNodeById('left')!]),
  );
  // A trailing 100ms selection used to overwrite a subsequent user action.
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => window.apis.left.getAppState().layersSelected),
  ).toEqual(['left']);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const kind of ['text', 'svg', 'nodes'] as const) {
  test(`awaiting ${kind} paste includes insertion and selection`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await ready(page);
    await page.bringToFront();
    const inserted = await page.evaluate(async (kind) => {
      const api = window.apis.left;
      const data = new DataTransfer();
      const source =
        kind === 'text'
          ? 'Pasted text'
          : kind === 'svg'
          ? '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="40" height="30" fill="red"/></svg>'
          : JSON.stringify([
              {
                id: 'original',
                type: 'rect',
                x: 10,
                y: 20,
                width: 40,
                height: 30,
                zIndex: 2,
              },
            ]);
      data.setData('text/plain', source);
      await window.paste(
        api,
        api.getAppState(),
        new ClipboardEvent('paste', { clipboardData: data }),
      );
      const nodes = api
        .getNodes()
        .filter((node) => !node.isDeleted && node.id !== 'left');
      return {
        count: nodes.length,
        selected: api.getAppState().layersSelected,
        ids: nodes.map((node) => node.id),
      };
    }, kind);
    expect(inserted.count).toBe(kind === 'svg' ? 2 : 1);
    expect(inserted.selected).toHaveLength(1);
    expect(inserted.ids).toContain(inserted.selected[0]);
    await page.getByTestId('left-undo').click();
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await page.getByTestId('left-redo').click();
    await count(page, inserted.count + 1);
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('empty, aborted, and unmounted insertions settle without touching another canvas', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const node: SerializedNode = {
      id: 'cancelled',
      type: 'rect',
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      zIndex: 2,
    };
    const empty = await window.insertNodes(api, api.getAppState(), []);
    const controller = new AbortController();
    const aborted = window.insertNodes(api, api.getAppState(), [node], {
      signal: controller.signal,
    });
    controller.abort();
    const abortResult = await aborted;
    const destroyed = window.insertNodes(api, api.getAppState(), [node]);
    window.flushReact(() => window.setShown(['right']));
    return { empty, abortResult, destroyed: await destroyed };
  });
  expect(result).toEqual({
    empty: false,
    abortResult: false,
    destroyed: false,
  });
  await expect(page.getByTestId('left-status')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.apis.right
        .getNodes()
        .filter((node) => !node.isDeleted)
        .map((node) => node.id),
    ),
  ).toEqual(['right']);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('image insertion resolves after selecting the committed image', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const image = document.createElement('canvas');
    image.width = image.height = 2;
    image.getContext('2d')!.fillRect(0, 0, 2, 2);
    const api = window.apis.left;
    const node = await api.createImageFromFile(image.toDataURL(), {
      position: { x: 80, y: 90 },
    });
    return {
      id: node.id,
      present: !!api.getNodeById(node.id),
      selected: api.getAppState().layersSelected,
    };
  });
  expect(result.present).toBe(true);
  expect(result.selected).toEqual([result.id]);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
});

test('Mermaid edit failures propagate without a text fallback insertion', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const original = api.edit;
    let attempts = 0;
    api.edit = () => {
      attempts++;
      return Promise.reject(new Error('Rejected insertion'));
    };
    const data = new DataTransfer();
    data.setData('text/plain', 'flowchart LR\nA --> B');
    let message = '';
    try {
      await window.paste(
        api,
        api.getAppState(),
        new ClipboardEvent('paste', { clipboardData: data }),
      );
    } catch (error) {
      message = (error as Error).message;
    } finally {
      api.edit = original;
    }
    return { attempts, message };
  });
  expect(result).toEqual({ attempts: 1, message: 'Rejected insertion' });
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
});

test('native SVG file drop inserts and selects one undoable group', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const canvas = page.getByTestId('left-shortcuts').locator('canvas');
  const box = (await canvas.boundingBox())!;
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        [
          '<svg xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="blue"/></svg>',
        ],
        'shape.svg',
        { type: 'image/svg+xml' },
      ),
    );
    return transfer;
  });
  await canvas.dispatchEvent('drop', {
    dataTransfer: data,
    clientX: box.x + 100,
    clientY: box.y + 100,
  });
  await count(page, 3);
  const selected = await page.evaluate(() => {
    const api = window.apis.left;
    return api
      .getAppState()
      .layersSelected.map((id) => api.getNodeById(id)!.type);
  });
  expect(selected).toEqual(['g']);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await data.dispose();
  expect(errors).toEqual([]);
});
