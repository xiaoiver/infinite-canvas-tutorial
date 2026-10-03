import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { ThemeMode } from '@infinite-canvas-tutorial/ecs';

test('native imports commit nodes, variables, and selection together and copy queued input', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  const imported = await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit(
      (editor) => editor.selectNodes([editor.getNodeById('left')!]),
      { capture: 'NEVER' },
    );
    api.clearHistory();
    const doc = api.exportIcDocument();
    doc.variables = { accent: { type: 'color', value: '#00ff00' } };
    doc.themes.mode = 'dark' as ThemeMode;
    doc.appState.cameraZoom = 2;
    doc.appState.layersSelected = ['left', 'missing'];
    doc.elements = [
      { id: 'parent', type: 'g', zIndex: 0, x: 30, y: 0 },
      {
        id: 'left',
        parentId: 'parent',
        type: 'rect',
        zIndex: 0,
        x: 50,
        y: 50,
        width: 60,
        height: 80,
        fills: [{ type: 'solid', value: '$accent' }],
      },
    ];
    window.snapshots.left = [];
    window.nodeChanges.left = [];
    const pending = api.importIcDocument(doc);
    doc.elements[1].width = 999;
    doc.variables.accent.value = '#ff0000';
    return pending;
  });
  expect(imported).toBe(true);
  await expect(page.getByTestId('left-count')).toHaveText('2');
  await expect(page.getByTestId('left-node-width')).toHaveText('60');
  await expect(page.getByTestId('left-selected-ids')).toHaveText('left');
  await expect(page.getByTestId('left-zoom')).toHaveText('2');
  await expect
    .poll(() => page.evaluate(() => window.sceneGeometry('left')))
    .toEqual({ x: 80, minX: 80, maxX: 140 });
  expect(await page.evaluate(() => window.boundFill('left'))).toBe('#00ff00');
  expect(await page.evaluate(() => window.snapshots.left)).toEqual([
    { ids: ['parent', 'left'], selected: ['left'] },
  ]);
  expect(await page.evaluate(() => window.nodeChanges.left.length)).toBe(1);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('left-node-width')).toHaveText('100');
  expect(
    await page.evaluate(() => window.apis.left.getAppState().variables),
  ).toEqual({});
  // Camera/theme retain the existing non-undoable app-state semantics.
  await expect(page.getByTestId('left-zoom')).toHaveText('2');
  expect(
    await page.evaluate(() => window.apis.left.getAppState().themeMode),
  ).toBe('dark');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await expect(page.getByTestId('left-count')).toHaveText('2');
  await expect(page.getByTestId('left-node-width')).toHaveText('60');
  await expect(page.getByTestId('right-count')).toHaveText('1');
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('non-history imports notify once; aborted and invalid imports preserve the document', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('left-count')).toHaveText('1', {
    timeout: 45000,
  });
  const result = await page.evaluate(async () => {
    const api = window.apis.left;
    const doc = api.exportIcDocument();
    doc.elements[0].width = 70;
    window.snapshots.left = [];
    const imported = await api.importIcDocument(doc, { recordHistory: false });
    const controller = new AbortController();
    doc.elements = [];
    const cancelled = api.importIcDocument(doc, { signal: controller.signal });
    controller.abort();
    const errors: string[] = [];
    for (const invalid of [
      { ...doc, elements: [{ id: 'x', type: 'unknown' }] },
      { ...doc, elements: [{ id: 'x', type: 'g', parentId: 'missing' }] },
      { ...doc, appState: { layersSelected: 'x' } },
      { ...doc, themes: { mode: 'invalid' } },
    ]) {
      try {
        await api.importIcDocument(invalid);
      } catch (error) {
        errors.push(String(error));
      }
    }
    return {
      imported,
      cancelled: await cancelled,
      errors,
      history: api.getHistoryState(),
      snapshots: window.snapshots.left.length,
    };
  });
  expect(result).toMatchObject({
    imported: true,
    cancelled: false,
    history: { canUndo: false, canRedo: false },
    snapshots: 1,
  });
  expect(result.errors).toHaveLength(4);
  expect(
    await page.evaluate(() => window.apis.left.getNodeById('left')!.width),
  ).toBe(70);
});

for (const locale of ['en', 'zh']) {
  test(`playground saves per canvas, reloads, and imports/exports native files (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?playground=${locale}`);
    const left = page.locator('[data-canvas="A"]');
    const right = page.locator('[data-canvas="B"]');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2', {
      timeout: 45000,
    });
    await left.locator('[data-document-action="save"]').click();
    await expect(
      left.locator('.document-controls [role="status"]'),
    ).toBeVisible();
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await right.locator('[data-document-action="load"]').click();
    await expect(
      right.locator('.document-controls [role="status"]'),
    ).toHaveText(
      locale === 'zh'
        ? '此画布尚无本地存档。'
        : 'No saved document for this canvas.',
    );
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    await left.locator('[data-action="add"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-document-action="save"]').click();
    await expect(
      left.locator('.document-controls [role="status"]'),
    ).toBeVisible();
    await left.locator('[data-action="enlarge"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('100');
    await left.locator('[data-document-action="load"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('100');
    await left.locator('[data-action="redo"]').click();
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    const downloadPromise = page.waitForEvent('download');
    await left.locator('[data-document-action="export"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('canvas-A.ic');
    const raw = await readFile((await download.path())!, 'utf8');
    const doc = JSON.parse(raw);
    expect(doc).toMatchObject({
      type: 'infinite-canvas',
      version: 1,
      variables: {},
      themes: { mode: 'light' },
    });
    expect(doc.elements).toHaveLength(3);
    expect(doc.appState.layersSelected).toHaveLength(1);
    await page.locator('[data-action="reset"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await left
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'saved.ic',
        mimeType: 'application/json',
        buffer: Buffer.from(raw),
      });
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    // The input is cleared so selecting the same file again works.
    await left
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'saved.ic',
        mimeType: 'application/json',
        buffer: Buffer.from(raw),
      });
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await page.reload();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await left.locator('[data-document-action="load"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="width"]')).toHaveText('80');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('invalid files and unavailable storage report errors without changing the playground', async ({
  page,
}) => {
  await page.goto('/?playground=en');
  const left = page.locator('[data-canvas="A"]');
  await expect(left.locator('[data-state="nodes"]')).toHaveText('2', {
    timeout: 45000,
  });
  const bad = [
    '{',
    JSON.stringify({ type: 'infinite-canvas', version: 999 }),
    JSON.stringify({
      type: 'infinite-canvas',
      version: 1,
      variables: {},
      themes: {},
      elements: [{ id: 'x', type: 'g', parentId: 'x' }],
      appState: {},
    }),
  ];
  for (const raw of bad) {
    await left
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'bad.ic',
        mimeType: 'application/json',
        buffer: Buffer.from(raw),
      });
    await expect(left.locator('[role="alert"]')).toBeVisible();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
  }
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage quota exceeded');
    };
    Storage.prototype.getItem = () => {
      throw new Error('Storage is unavailable');
    };
  });
  await left.locator('[data-document-action="save"]').click();
  await expect(left.locator('[role="alert"]')).toHaveText(
    'Storage quota exceeded',
  );
  await left.locator('[data-document-action="load"]').click();
  await expect(left.locator('[role="alert"]')).toHaveText(
    'Storage is unavailable',
  );
  await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
  await expect(left.locator('[data-action="undo"]')).toBeDisabled();
});

test('reset cancels a slow file read owned by the previous canvas', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?playground=en');
  const left = page.locator('[data-canvas="A"]');
  await expect(left.locator('[data-state="nodes"]')).toHaveText('2', {
    timeout: 45000,
  });
  await page.evaluate(() => {
    File.prototype.text = async () => {
      await new Promise<void>((resolve) => {
        (window as unknown as { finishRead: () => void }).finishRead = resolve;
      });
      return JSON.stringify({
        type: 'infinite-canvas',
        version: 1,
        variables: {},
        themes: {},
        elements: [],
        appState: {},
      });
    };
  });
  await left
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'slow.ic',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
  await expect(left.locator('.document-controls')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await page.locator('[data-action="reset"]').click();
  await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
  await page.evaluate(() =>
    (window as unknown as { finishRead: () => void }).finishRead(),
  );
  // Drain a frame so an incorrectly retained import would already have committed.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
  await expect(left.locator('[data-action="undo"]')).toBeDisabled();
  await expect(left.locator('.document-controls [role="status"]')).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

for (const starter of ['vite', 'nextjs']) {
  test(`the ${starter} starter saves and restores a document in the browser`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?starter=${starter}`);
    await expect(page.getByTestId('shape-count')).toHaveText('1', {
      timeout: 45000,
    });
    await page.getByRole('button', { name: 'Save locally' }).click();
    await expect(page.getByText('Saved in this browser.')).toBeVisible();
    await page.getByRole('button', { name: 'Enlarge rectangle' }).click();
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Load saved' }).click();
    await expect(page.getByText('Loaded from this browser.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export .ic' }).click();
    const download = await downloadPromise;
    const doc = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(doc.elements[0].width).toBe(120);
    expect(doc.type).toBe('infinite-canvas');
    expect(errors).toEqual([]);
  });
}
