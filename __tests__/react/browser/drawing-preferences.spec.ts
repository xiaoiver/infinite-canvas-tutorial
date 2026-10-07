import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import { PNG } from 'pngjs';
import type { AppState, Pen } from '@infinite-canvas-tutorial/ecs';
import type {
  PenbarDrawSettings,
  PenbarPencilSettings,
  PenbarBrushSettings,
  PenbarTextSettings,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';

type Panel =
  | PenbarDrawSettings
  | PenbarPencilSettings
  | PenbarBrushSettings
  | PenbarTextSettings;

async function ready(
  page: Page,
  kind: 'draw' | 'pencil' | 'brush' | 'text' = 'draw',
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(async (kind) => {
    const panel = document.createElement(
      `ic-spectrum-penbar-${kind}-settings`,
    ) as Panel;
    panel.api = window.apis.left;
    panel.appState = panel.api.getAppState();
    if (kind === 'draw')
      (panel as PenbarDrawSettings).pen = 'draw-rect' as Pen.DRAW_RECT;
    panel.dataset.testid = 'drawing-settings';
    document.body.append(panel);
    await panel.updateComplete;
  }, kind);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { panel: page.getByTestId('drawing-settings'), errors };
}

async function change(control: Locator, value: unknown) {
  await control.evaluate(
    (
      element: HTMLElement & {
        value: unknown;
        selected: unknown[];
        checked: boolean;
      },
      value,
    ) => {
      if (element.localName === 'sp-swatch-group')
        element.selected = value as unknown[];
      else if (element.localName === 'sp-switch')
        element.checked = value as boolean;
      else element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

function slider(panel: Locator, label: string) {
  return panel.locator(`sp-slider[label="${label}"]`);
}

async function preferences(page: Page, key: keyof AppState) {
  return page.evaluate((key) => window.apis.left.getAppState()[key], key);
}

async function drain(page: Page) {
  await page.evaluate(async () => {
    const controller = new AbortController();
    await window.apis.left.edit(() => controller.abort(), {
      signal: controller.signal,
    });
  });
}

test('legacy paint reads without mutation and opacity changes retain its color', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate(async (element: PenbarDrawSettings) => {
    const old = { stroke: 'red', strokeOpacity: 0.3, strokeWidth: 1 };
    element.api.setAppState({ penbarDrawRect: old });
    element.appState = element.api.getAppState();
    element.requestUpdate();
    await element.updateComplete;
  });
  expect(await preferences(page, 'penbarDrawRect')).toEqual({
    stroke: 'red',
    strokeOpacity: 0.3,
    strokeWidth: 1,
  });
  await expect(panel.locator('#stroke')).toHaveJSProperty('selected', ['red']);
  await expect(slider(panel, 'Stroke opacity')).toHaveJSProperty('value', 0.3);
  await change(slider(panel, 'Stroke opacity'), 0.7);
  expect(await preferences(page, 'penbarDrawRect')).toEqual({
    strokes: [{ type: 'solid', value: 'red', opacity: 0.7 }],
    strokeWidth: 1,
  });
  expect(errors).toEqual([]);
});

test('drawing defaults preserve paint layers, decimals and pending document history', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    api.setAppState({
      penbarDrawRect: {
        ...api.getAppState().penbarDrawRect,
        fills: [
          { type: 'solid', value: '#111111', opacity: 0.4 },
          { type: 'solid', value: '#222222' },
        ],
        strokes: [
          { type: 'solid', value: '#333333', opacity: 0.6 },
          { type: 'solid', value: '#444444' },
        ],
      },
    });
    api.runAtNextTick(() =>
      api.updateNode(api.getNodeById('left')!, { width: 210 }),
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.width),
    )
    .toBe(210);
  await change(slider(panel, 'Stroke width'), 2.5);
  await change(panel.locator('#stroke'), ['#ff0000']);
  await change(slider(panel, 'Stroke opacity'), 0);
  await change(panel.locator('#fill'), ['#00ff00']);
  await change(slider(panel, 'Fill opacity'), 0.25);
  await drain(page);
  expect(await preferences(page, 'penbarDrawRect')).toMatchObject({
    strokeWidth: 2.5,
    fills: [
      { type: 'solid', value: '#00ff00', opacity: 0.25 },
      { type: 'solid', value: '#222222' },
    ],
    strokes: [
      { type: 'solid', value: '#ff0000', opacity: 0 },
      { type: 'solid', value: '#444444' },
    ],
  });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  // Preferences must neither capture 210 nor silently advance the 100 baseline.
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 300 }),
    ),
  );
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('100');
  await change(slider(panel, 'Stroke width'), 0);
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await page.getByTestId('left-redo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('300');
  expect(await preferences(page, 'penbarDrawRect')).toMatchObject({
    strokeWidth: 0,
  });
  expect(
    await page.evaluate(
      () => window.apis.right.getAppState().penbarDrawRect.strokeWidth,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});

test('blank, non-finite, partial numeric and invalid paint input restores controls without writing', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await change(slider(panel, 'Stroke width'), 3.5);
  const before = await preferences(page, 'penbarDrawRect');
  for (const value of [NaN, Infinity, -1, '', '2px']) {
    // Spectrum normalizes input itself; a raw target also exercises the event boundary.
    await panel.evaluate((element: PenbarDrawSettings, value) => {
      const event = { stopPropagation() {}, target: { value } };
      (
        element as unknown as { handleStrokeWidthChanged(e: unknown): void }
      ).handleStrokeWidthChanged(event);
    }, value);
    await expect(slider(panel, 'Stroke width')).toHaveJSProperty('value', 3.5);
  }
  await change(slider(panel, 'Fill opacity'), NaN);
  await expect(slider(panel, 'Fill opacity')).toHaveJSProperty('value', 0.5);
  await change(panel.locator('#stroke'), []);
  await change(panel.locator('#fill'), ['not-a-color']);
  expect(await preferences(page, 'penbarDrawRect')).toEqual(before);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('rough, arrow and icon settings follow the current tool and canvas', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate(async (element: PenbarDrawSettings) => {
    element.pen = 'draw-rough-rect' as Pen.DRAW_ROUGH_RECT;
    await element.updateComplete;
  });
  await change(slider(panel, 'Bowing'), 0);
  await change(slider(panel, 'Roughness'), 2.5);
  await change(panel.locator('#rough-fill-style'), 'solid');
  await change(panel.locator('#rough-fill-style'), 'invalid');
  expect(await preferences(page, 'penbarDrawRoughRect')).toMatchObject({
    roughBowing: 0,
    roughRoughness: 2.5,
    roughFillStyle: 'solid',
  });
  await expect(panel.locator('#rough-fill-style')).toHaveJSProperty(
    'value',
    'solid',
  );
  await panel.evaluate(async (element: PenbarDrawSettings) => {
    element.pen = 'draw-arrow' as Pen.DRAW_ARROW;
    await element.updateComplete;
  });
  await change(panel.locator('#marker-start'), 'diamond');
  await change(panel.locator('#marker-end'), 'triangle');
  expect(await preferences(page, 'penbarDrawArrow')).toMatchObject({
    markerStart: 'diamond',
    markerEnd: 'triangle',
  });
  await panel.evaluate(async (element: PenbarDrawSettings) => {
    element.pen = 'draw-iconfont' as Pen.DRAW_ICONFONT;
    element.api = window.apis.right;
    element.appState = element.api.getAppState();
    await element.updateComplete;
    element
      .shadowRoot!.querySelector('ic-spectrum-icon-font-controls')!
      .dispatchEvent(
        new CustomEvent('ic-iconfont-controls-change', {
          detail: {
            iconFontFamily: 'local',
            iconFontName: 'test',
            strokeWidth: 99,
          },
          bubbles: true,
        }),
      );
  });
  expect(
    await page.evaluate(
      () => window.apis.right.getAppState().penbarDrawIconfont,
    ),
  ).toMatchObject({
    iconFontFamily: 'local',
    iconFontName: 'test',
    strokeWidth: 1,
  });
  expect(await preferences(page, 'penbarDrawIconfont')).toMatchObject({
    iconFontFamily: 'lucide',
    iconFontName: 'search',
  });
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('brush settings preserve stamps and reject missing choices without creating history', async ({
  page,
}) => {
  const { panel, errors } = await ready(page, 'brush');
  await change(slider(panel, 'Stroke width'), 22.5);
  await change(panel.locator('#stroke'), ['#0000ff']);
  await change(slider(panel, 'Stamp interval'), 0.2);
  await change(slider(panel, 'Stamp noise factor'), 0);
  await change(slider(panel, 'Stamp rotation factor'), 0.5);
  await change(panel.locator('sp-picker'), '/stamp2.png');
  const before = await preferences(page, 'penbarBrush');
  expect(before).toMatchObject({
    strokeWidth: 22.5,
    stampInterval: 0.2,
    stampNoiseFactor: 0,
    stampRotationFactor: 0.5,
    strokes: [{ value: '#0000ff' }],
    stamps: [
      { src: '/stamp1.png', active: false },
      { src: '/stamp2.png', active: true },
    ],
  });
  await change(panel.locator('sp-picker'), '/missing.png');
  await expect(panel.locator('sp-picker')).toHaveJSProperty(
    'value',
    '/stamp2.png',
  );
  expect(await preferences(page, 'penbarBrush')).toEqual(before);
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('text defaults update together and keep font size numeric', async ({
  page,
}) => {
  const { panel, errors } = await ready(page, 'text');
  await change(panel.locator('#font-family'), 'serif');
  await change(panel.locator('#font-style'), 'italic');
  await change(panel.locator('sp-number-field'), '20.5');
  await change(panel.locator('#fill'), ['#ff0000']);
  expect(await preferences(page, 'penbarText')).toMatchObject({
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 20.5,
    fills: [{ value: '#ff0000' }],
  });
  await change(panel.locator('sp-number-field'), NaN);
  await expect(panel.locator('sp-number-field')).toHaveJSProperty(
    'value',
    20.5,
  );
  await change(panel.locator('#font-family'), 'missing');
  await expect(panel.locator('#font-family')).toHaveJSProperty(
    'value',
    'serif',
  );
  await change(panel.locator('sp-number-field'), 0);
  expect(await preferences(page, 'penbarText')).toMatchObject({ fontSize: 0 });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('unchanged defaults do not notify and failed writes recover for retry', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const result = await panel.evaluate(async (element: PenbarDrawSettings) => {
    const api = element.api;
    const original = api.setAppState.bind(api);
    let writes = 0;
    api.setAppState = (...args) => {
      writes++;
      original(...args);
    };
    const control = element.shadowRoot!.querySelector(
      'sp-slider[label="Stroke width"]',
    ) as HTMLElement & { value: number };
    control.value = 1;
    control.dispatchEvent(new Event('change'));
    const unchangedWrites = writes;
    api.setAppState = () => {
      throw new Error('preference failure');
    };
    control.value = 9;
    control.dispatchEvent(new Event('change'));
    await element.updateComplete;
    const restored = control.value;
    api.setAppState = original;
    control.value = 9;
    control.dispatchEvent(new Event('change'));
    return {
      unchangedWrites,
      restored,
      width: api.getAppState().penbarDrawRect.strokeWidth,
    };
  });
  expect(result).toEqual({ unchangedWrites: 0, restored: 1, width: 9 });
  expect(errors).toEqual([]);
});

for (const lifecycle of ['disconnect', 'destroy'] as const) {
  test(`stale controls cannot change preferences after ${lifecycle}`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    expect(
      await panel.evaluate(async (element: PenbarDrawSettings, lifecycle) => {
        const api = element.api;
        const before = api.getAppState().penbarDrawRect;
        if (lifecycle === 'disconnect') element.remove();
        else api.destroy();
        const control = element.shadowRoot!.querySelector(
          'sp-slider[label="Stroke width"]',
        ) as HTMLElement & { value: number };
        control.value = 8;
        control.dispatchEvent(new Event('change'));
        return api.getAppState().penbarDrawRect === before;
      }, lifecycle),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

async function draw(page: Page, pen: string, preview?: () => Promise<void>) {
  const points = await page.evaluate((pen) => {
    const api = window.apis.left;
    api.setAppState({ penbarSelected: pen as Pen });
    return [
      api.viewport2Client({ x: 180, y: 60 }),
      api.viewport2Client({ x: 300, y: 160 }),
    ];
  }, pen);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 12 });
  // Ensure a non-collinear pencil outline with enough samples to preview.
  if (pen === 'pencil')
    await page.mouse.move(points[0].x, points[1].y + 30, { steps: 12 });
  await preview?.();
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      ),
    )
    .toBe(2);
  return page.evaluate(
    () =>
      window.apis.left.getNodes().find((n) => n.id !== 'left' && !n.isDeleted)!,
  );
}

async function expectPaintPixels(page: Page, color: 'red' | 'blue') {
  const bounds = await page.evaluate(() => {
    const api = window.apis.left;
    return [
      api.viewport2Client({ x: 175, y: 40 }),
      api.viewport2Client({ x: 320, y: 210 }),
    ];
  });
  await expect
    .poll(async () => {
      const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
      let count = 0;
      for (let y = Math.ceil(bounds[0].y); y < bounds[1].y; y++) {
        for (let x = Math.ceil(bounds[0].x); x < bounds[1].x; x++) {
          const i = (y * png.width + x) * 4;
          const [r, g, b] = png.data.subarray(i, i + 3);
          if (
            color === 'red'
              ? r > 160 && g < 80 && b < 80
              : b > 160 && r < 80 && g < 80
          )
            count++;
        }
      }
      return count;
    })
    .toBeGreaterThan(10);
}

test('new rectangles use the configured paint and drawing remains one undo step', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await change(panel.locator('#stroke'), ['#ff0000']);
  await change(slider(panel, 'Stroke opacity'), 0.25);
  await change(slider(panel, 'Stroke width'), 4);
  await change(panel.locator('#fill'), ['#0000ff']);
  await change(slider(panel, 'Fill opacity'), 1);
  const node = await draw(page, 'draw-rect');
  await expectPaintPixels(page, 'blue');
  expect(node).toMatchObject({
    type: 'rect',
    strokeWidth: 4,
    strokes: [{ value: '#ff0000', opacity: 0.25 }],
    fills: [{ value: '#0000ff' }],
  });
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.apis.left.getNodes().filter((n) => !n.isDeleted).length,
      ),
    )
    .toBe(1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(await preferences(page, 'penbarDrawRect')).toMatchObject({
    strokeWidth: 4,
    strokes: [{ value: '#ff0000' }],
  });
  expect(errors).toEqual([]);
});

for (const freehand of [false, true]) {
  test(`pencil paint reaches the drawn ${
    freehand ? 'freehand outline' : 'polyline'
  }`, async ({ page }) => {
    const { panel, errors } = await ready(page, 'pencil');
    await change(panel.locator('#stroke'), ['#ff0000']);
    await change(slider(panel, 'Stroke width'), 2.5);
    await change(panel.locator('sp-switch'), freehand);
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    const node = await draw(page, 'pencil', () =>
      expectPaintPixels(page, 'red'),
    );
    await expectPaintPixels(page, 'red');
    expect(node).toMatchObject(
      freehand
        ? {
            type: 'path',
            strokeWidth: 0,
            fills: [{ value: '#ff0000', opacity: 1 }],
          }
        : {
            type: 'polyline',
            strokeWidth: 2.5,
            strokes: [{ value: '#ff0000', opacity: 1 }],
          },
    );
    expect(errors).toEqual([]);
  });
}
