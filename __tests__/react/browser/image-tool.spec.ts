import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type { Pen } from '@infinite-canvas-tutorial/ecs';
import type { Penbar } from '@infinite-canvas-tutorial/webcomponents/spectrum';

declare global {
  interface Window {
    imageToolProbe: {
      pickers: {
        resolve: (file?: File) => void;
        reject: (error: Error) => void;
      }[];
      uploads: {
        canvas: string;
        resolve: (value: string) => void;
        reject: (error: Error) => void;
      }[];
      file: File;
      source: string;
      bar?: Penbar;
      parent?: Node;
    };
  }
}

async function ready(page: Page, legacyPicker = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((legacyPicker) => {
    window.imageToolProbe = {
      pickers: [],
      uploads: [],
    } as unknown as Window['imageToolProbe'];
    if (legacyPicker) {
      Reflect.deleteProperty(window, 'showOpenFilePicker');
      return;
    }
    // Control the OS picker boundary while exercising the real file import.
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () =>
        new Promise((resolve, reject) => {
          window.imageToolProbe.pickers.push({
            resolve: (file) =>
              resolve(file ? [{ getFile: async () => file }] : []),
            reject,
          });
        }),
    });
  }, legacyPicker);
  await page.goto('/');
  for (const side of ['left', 'right']) {
    await expect(page.getByTestId(`${side}-status`)).toHaveText('ready', {
      timeout: 45000,
    });
  }
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 4;
    canvas.getContext('2d')!.fillRect(0, 0, 8, 4);
    const probe = window.imageToolProbe;
    probe.source = canvas.toDataURL();
    const bytes = Uint8Array.from(atob(probe.source.split(',')[1]), (c) =>
      c.charCodeAt(0),
    );
    probe.file = new File([bytes], 'image.png', { type: 'image/png' });
    for (const [side, api] of Object.entries(window.apis)) {
      api.capabilities.register(
        'upload',
        'image-tool-test',
        () =>
          new Promise<string>((resolve, reject) => {
            probe.uploads.push({ canvas: side, resolve, reject });
          }),
      );
    }
  });
  const bar = page.getByTestId('left-shortcuts').locator('ic-spectrum-penbar');
  await expect(bar.locator('sp-action-group.penbar')).toBeVisible();
  return { bar, errors };
}

async function choose(bar: Locator, pen: string) {
  await bar.locator('sp-action-group.penbar').evaluate((element, pen) => {
    (element as HTMLElement & { selected: string[] }).selected = [pen];
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, pen);
}

async function start(bar: Locator, page: Page, index = 0) {
  await choose(bar, 'image');
  await expect
    .poll(() => page.evaluate(() => window.imageToolProbe.pickers.length))
    .toBe(index + 1);
}

async function pick(page: Page, index = 0) {
  await page.evaluate((index) => {
    const probe = window.imageToolProbe;
    probe.pickers[index].resolve(probe.file);
  }, index);
}

async function uploading(page: Page, count = 1) {
  await expect
    .poll(() => page.evaluate(() => window.imageToolProbe.uploads.length))
    .toBe(count);
}

async function finishUpload(page: Page, index = 0) {
  await page.evaluate((index) => {
    const probe = window.imageToolProbe;
    probe.uploads[index].resolve(probe.source);
  }, index);
}

async function drain(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function tool(page: Page, pen: string, side = 'left') {
  await expect
    .poll(() =>
      page.evaluate(
        (side) => window.apis[side].getAppState().penbarSelected,
        side,
      ),
    )
    .toBe(pen);
}

async function count(page: Page, expected: number, side = 'left') {
  await expect
    .poll(() =>
      page.evaluate(
        (side) =>
          window.apis[side].getNodes().filter((n) => !n.isDeleted).length,
        side,
      ),
    )
    .toBe(expected);
}

test('the image button accepts a native file input and keeps the committed image selected', async ({
  page,
}) => {
  const { bar, errors } = await ready(page, true);
  const source = await page.evaluate(() => window.imageToolProbe.source);
  const chosen = page.waitForEvent('filechooser');
  await bar.locator('sp-action-button[value="image"]').click();
  const picker = await chosen;
  await picker.setFiles({
    name: 'image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(source.split(',')[1], 'base64'),
  });
  await uploading(page);
  await tool(page, 'select');
  await finishUpload(page);
  await count(page, 2);
  await drain(page);
  const selected = await page.evaluate(() => {
    const api = window.apis.left;
    const image = api.getNodes().find((n) => n.id !== 'left' && !n.isDeleted)!;
    return { actual: api.getAppState().layersSelected, expected: [image.id] };
  });
  expect(selected.actual).toEqual(selected.expected);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await count(page, 2);
  const cancelled = page.waitForEvent('filechooser');
  await bar.locator('sp-action-button[value="image"]').click();
  await (await cancelled).element().dispatchEvent('cancel');
  await tool(page, 'select');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.imageToolProbe.uploads.length)).toBe(
    1,
  );
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('image tool captures its position, commits once, and leaves later unrecorded edits alone', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const center = await page.evaluate(() => {
    const api = window.apis.left;
    let inserted = false;
    const off = api.subscribe(({ nodes }) => {
      if (!inserted && nodes.some((n) => n.id !== 'left' && !n.isDeleted)) {
        inserted = true;
        off();
        // A subsequent synchronous consumer update must not be captured by a
        // trailing toolbar record() after the image insertion has committed.
        api.updateNode(api.getNodeById('left')!, { width: 210 });
      }
    });
    return api.viewport2Canvas({
      x: api.element.clientWidth / 2,
      y: api.element.clientHeight / 2,
    });
  });
  await start(bar, page);
  await page.evaluate(() =>
    window.apis.left.setAppState({ cameraX: 500, cameraY: 300 }),
  );
  await drain(page);
  await pick(page);
  await uploading(page);
  await finishUpload(page);
  await tool(page, 'select');
  await count(page, 2);
  const result = await page.evaluate(() => {
    const api = window.apis.left;
    const image = api.getNodes().find((n) => n.id !== 'left' && !n.isDeleted)!;
    return {
      x: Number(image.x) + image.width! / 2,
      y: Number(image.y) + image.height! / 2,
      width: image.width,
      height: image.height,
      selected: api.getAppState().layersSelected,
      id: image.id,
      laterWidth: api.getNodeById('left')!.width,
    };
  });
  expect(result.x).toBeCloseTo(center.x);
  expect(result.y).toBeCloseTo(center.y);
  expect(result).toMatchObject({ width: 8, height: 4, laterWidth: 210 });
  expect(result.selected).toEqual([result.id]);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(210);
  await page.getByTestId('left-redo').click();
  await count(page, 2);
  await count(page, 1, 'right');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const outcome of ['cancel', 'empty'] as const) {
  test(`${outcome} picker restores selection tool without consuming pending edits or redo`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    await page.evaluate(async () => {
      const api = window.apis.left;
      await api.edit((editor) =>
        editor.updateNode(editor.getNodeById('left')!, { width: 300 }),
      );
      api.undo();
    });
    await expect(page.getByTestId('left-redo')).toBeEnabled();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const api = window.apis.left;
          api.runAtNextTick(() => {
            api.updateNode(api.getNodeById('left')!, { width: 210 });
            resolve();
          });
        }),
    );
    await start(bar, page);
    await page.evaluate((outcome) => {
      const picker = window.imageToolProbe.pickers[0];
      if (outcome === 'cancel')
        picker.reject(new DOMException('Cancelled', 'AbortError'));
      else picker.resolve();
    }, outcome);
    await tool(page, 'select');
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect(page.getByTestId('left-redo')).toBeEnabled();
    expect(
      await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
    ).toBe(210);
    await page.evaluate(() => window.apis.left.record());
    await page.getByTestId('left-undo').click();
    expect(
      await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
    ).toBe(100);
    await count(page, 1);
    expect(errors).toEqual([]);
  });
}

test('an older picker cannot insert or reset a newer image request', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await start(bar, page);
  await choose(bar, 'hand');
  await start(bar, page, 1);
  await pick(page, 0);
  await drain(page);
  await tool(page, 'image');
  expect(await page.evaluate(() => window.imageToolProbe.uploads.length)).toBe(
    0,
  );
  await pick(page, 1);
  await uploading(page);
  await finishUpload(page);
  await tool(page, 'select');
  await count(page, 2);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const source of ['toolbar', 'API', 'keyboard'] as const) {
  test(`${source} tool changes cancel an image waiting for upload`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    await start(bar, page);
    await pick(page);
    await uploading(page);
    if (source === 'toolbar') await choose(bar, 'hand');
    else if (source === 'API') {
      await page.evaluate(() =>
        window.apis.left.setAppState({ penbarSelected: 'hand' as Pen }),
      );
    } else {
      await page.evaluate(() => window.apis.left.getCanvasElement().focus());
      await page.keyboard.press('r');
    }
    const selected = source === 'keyboard' ? 'draw-rect' : 'hand';
    await tool(page, selected);
    await finishUpload(page);
    await drain(page);
    await tool(page, selected);
    await count(page, 1);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await count(page, 1, 'right');
    expect(errors).toEqual([]);
  });
}

test('replacing the toolbar API cancels its old request and preserves the other canvas tool', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await start(bar, page);
  await pick(page);
  await uploading(page);
  await bar.evaluate(async (element: Penbar) => {
    const right = window.apis.right;
    right.setAppState({ penbarSelected: 'hand' as Pen });
    element.api = right;
    element.appState = right.getAppState();
    element.requestUpdate();
    await element.updateComplete;
  });
  await finishUpload(page);
  await drain(page);
  await tool(page, 'select');
  await tool(page, 'hand', 'right');
  await count(page, 1);
  await count(page, 1, 'right');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  // Even before the next Lit update, a stale listener cannot target the new API.
  await page.evaluate(() => window.apis.left.getCanvasElement().focus());
  await page.keyboard.press('r');
  await tool(page, 'hand', 'right');
  expect(errors).toEqual([]);
});

test('disconnect cancels upload and shortcuts; reconnect restores one working toolbar', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await choose(bar, 'draw-ellipse');
  await expect(bar).toHaveJSProperty('lastDrawPen', 'draw-ellipse');
  await start(bar, page);
  await pick(page);
  await uploading(page);
  await bar.evaluate((element: Penbar) => {
    window.imageToolProbe.bar = element;
    window.imageToolProbe.parent = element.parentNode!;
    element.remove();
  });
  await finishUpload(page);
  await drain(page);
  await tool(page, 'select');
  await count(page, 1);
  await page.evaluate(() => window.apis.left.getCanvasElement().focus());
  await page.keyboard.press('r');
  await tool(page, 'select');
  await page.evaluate(async () => {
    const { parent, bar } = window.imageToolProbe;
    parent!.appendChild(bar!);
    await bar!.updateComplete;
  });
  await expect(bar).toHaveJSProperty('lastDrawPen', 'draw-ellipse');
  await page.keyboard.press('Shift+l');
  await tool(page, 'draw-arrow');
  await start(bar, page, 1);
  await pick(page, 1);
  await uploading(page, 2);
  await finishUpload(page, 1);
  await tool(page, 'select');
  await count(page, 2);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const phase of ['picker', 'upload'] as const) {
  test(`destroying a canvas during ${phase} discards the late result`, async ({
    page,
  }) => {
    const { bar, errors } = await ready(page);
    await start(bar, page);
    if (phase === 'upload') {
      await pick(page);
      await uploading(page);
    }
    await page.evaluate(() =>
      window.flushReact(() => window.setShown(['right'])),
    );
    if (phase === 'picker') await pick(page);
    else await finishUpload(page);
    await drain(page);
    await expect(page.getByTestId('left-status')).toHaveCount(0);
    await tool(page, 'select', 'right');
    await count(page, 1, 'right');
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('a rejected commit restores the tool and can be retried without an unhandled rejection', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text());
  });
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit;
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Rejected image edit'));
    };
  });
  await start(bar, page);
  await pick(page);
  await uploading(page);
  await finishUpload(page);
  await tool(page, 'select');
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect
    .poll(() =>
      messages.some((message) => message.includes('Rejected image edit')),
    )
    .toBe(true);
  await start(bar, page, 1);
  await pick(page, 1);
  await uploading(page, 2);
  // Upload failure continues to use the local data URL, as before.
  await page.evaluate(() =>
    window.imageToolProbe.uploads[1].reject(new Error('Upload unavailable')),
  );
  await tool(page, 'select');
  await count(page, 2);
  await page.getByTestId('left-undo').click();
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a preceding queued tool change cancels image insertion before the same frame commits it', async ({
  page,
}) => {
  const { bar, errors } = await ready(page);
  await start(bar, page);
  await pick(page);
  await uploading(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit;
    api.edit = (...args) => {
      api.edit = edit;
      void edit.call(
        api,
        (editor) => {
          editor.setAppState({ penbarSelected: 'hand' as Pen });
        },
        { capture: 'NEVER' },
      );
      return edit.apply(api, args);
    };
  });
  await finishUpload(page);
  await tool(page, 'hand');
  await drain(page);
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('image API accepts cancellation before preparation and while its commit is queued', async ({
  page,
}) => {
  const { errors } = await ready(page);
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const prepare = new AbortController();
    prepare.abort();
    const first = await api
      .createImageFromFile(window.imageToolProbe.source, {
        signal: prepare.signal,
      })
      .then(
        () => 'inserted',
        (error: Error) => error.name,
      );
    const queued = new AbortController();
    const edit = api.edit;
    api.edit = (...args) => {
      const pending = edit.apply(api, args);
      queued.abort();
      return pending;
    };
    try {
      const second = await api
        .createImageFromFile(window.imageToolProbe.source, {
          signal: queued.signal,
        })
        .then(
          () => 'inserted',
          (error: Error) => error.name,
        );
      return { first, second };
    } finally {
      api.edit = edit;
    }
  });
  expect(result).toEqual({ first: 'AbortError', second: 'AbortError' });
  await count(page, 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
