import { expect, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from './isolated-webkit-test';
import type { ThemeMode } from '@infinite-canvas-tutorial/ecs';
import type { TopNavbar } from '@infinite-canvas-tutorial/webcomponents/spectrum';

type Menu = HTMLElement & { selected: unknown[] };
const accent = {
  type: 'color' as const,
  value: [
    { value: '#123456', theme: { Mode: 'Light' } },
    { value: '#abcdef', theme: { Mode: 'Dark' } },
  ],
};

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  for (const id of ['left', 'right']) {
    await expect(page.getByTestId(`${id}-status`)).toHaveText('ready', {
      timeout: 45000,
    });
  }
  await page.evaluate(async (accent) => {
    for (const [id, api] of Object.entries(window.apis)) {
      await api.edit(
        (editor) => {
          editor.setAppState({
            themePreference: 'light',
            variables: { accent },
            topbarVisible: true,
            snapToObjectsEnabled: true,
            snapToPixelGridEnabled: true,
          });
          editor.updateNode(editor.getNodeById(id)!, {
            fills: [{ type: 'solid', value: '$accent' }],
          });
        },
        { capture: 'NEVER' },
      );
    }
  }, accent);
  const navbar = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-top-navbar');
  const menu = navbar.locator('sp-menu:has(> sp-menu-item[value="system"])');
  await expect(menu).toHaveJSProperty('selected', ['light']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  return { navbar, menu, errors };
}

async function choose(menu: Locator, selected: unknown[]) {
  await menu.evaluate((element: Menu, selected) => {
    element.selected = selected;
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, selected);
}

async function bound(page: Page, value: string, id = 'left') {
  await expect
    .poll(() => page.evaluate((id) => window.boundFill(id), id))
    .toBe(value);
}

async function drain(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => window.apis.left.runAtNextTick(resolve)),
  );
}

test('theme menus refresh rendered bindings without consuming pending edits or redo', async ({
  page,
}) => {
  const { menu, errors } = await ready(page);
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
  await choose(menu, ['dark']);
  await bound(page, '#abcdef');
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() => {
      const api = window.apis.left;
      const node = api.getNodeById('left')!;
      if (node.type !== 'rect')
        throw new Error('expected the fixture rectangle');
      const { snapToObjectsEnabled, snapToPixelGridEnabled, themeMode } =
        api.getAppState();
      return {
        snapToObjectsEnabled,
        snapToPixelGridEnabled,
        themeMode,
        fills: node.fills,
      };
    }),
  ).toEqual({
    snapToObjectsEnabled: true,
    snapToPixelGridEnabled: true,
    themeMode: 'dark',
    fills: [{ type: 'solid', value: '$accent' }],
  });
  // Check the rendered pixel as well as the resolved ECS component.
  const pixel = await page.evaluate(() => {
    const api = window.apis.left;
    const canvas = api.getCanvasElement() as HTMLCanvasElement;
    const p = api.canvas2Viewport({ x: 80, y: 80 });
    return {
      url: canvas.toDataURL(),
      x: (p.x * canvas.width) / canvas.clientWidth,
      y: (p.y * canvas.height) / canvas.clientHeight,
    };
  });
  const png = PNG.sync.read(Buffer.from(pixel.url.split(',')[1], 'base64'));
  const offset = (Math.round(pixel.y) * png.width + Math.round(pixel.x)) * 4;
  expect([...png.data.subarray(offset, offset + 4)]).toEqual([
    171, 205, 239, 255,
  ]);
  await bound(page, '#123456', 'right');
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 300 }),
    ),
  );
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('100');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await choose(menu, ['light']);
  await bound(page, '#123456');
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await page.getByTestId('left-redo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('300');
  expect(errors).toEqual([]);
});

test('system appearance follows media changes without recording or changing explicit canvases', async ({
  page,
}) => {
  const { menu, errors } = await ready(page);
  await choose(menu, ['system']);
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
  await page.emulateMedia({ colorScheme: 'dark' });
  await bound(page, '#abcdef');
  await bound(page, '#123456', 'right');
  await expect(menu).toHaveJSProperty('selected', ['system']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ic-theme-preference')!),
    ),
  ).toEqual({ themePreference: 'system' });
  await page.emulateMedia({ colorScheme: 'light' });
  await bound(page, '#123456');
  await page.evaluate(() =>
    window.apis.left.edit((api) =>
      api.updateNode(api.getNodeById('left')!, { width: 300 }),
    ),
  );
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-object-width')).toHaveText('100');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('rapid theme events and queued variable edits resolve live values and undo only the variable change', async ({
  page,
}) => {
  const { menu, errors } = await ready(page);
  await menu.evaluate(async (element: Menu) => {
    const api = window.apis.left;
    const pending = api.edit((editor) =>
      editor.setAppState({
        variables: {
          accent: {
            type: 'color',
            value: [
              { value: '#112233', theme: { Mode: 'Light' } },
              { value: '#445566', theme: { Mode: 'Dark' } },
            ],
          },
        },
      }),
    );
    for (const value of ['dark', 'light', 'dark']) {
      const selected = [value];
      element.selected = selected;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      selected[0] = 'invalid-after-dispatch';
    }
    await pending;
  });
  await bound(page, '#445566');
  await expect(menu).toHaveJSProperty('selected', ['dark']);
  await page.getByTestId('left-undo').click();
  await bound(page, '#abcdef');
  expect(
    await page.evaluate(() => window.apis.left.getAppState().variables),
  ).toEqual({ accent });
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await bound(page, '#445566');
  expect(errors).toEqual([]);
});

test('invalid and unchanged choices restore the menu without writes; failures can be retried', async ({
  page,
}) => {
  const { navbar, menu, errors } = await ready(page);
  await navbar.evaluate((element: TopNavbar) => {
    const api = element.api;
    const set = api.setAppState.bind(api);
    element.dataset.writes = '0';
    api.setAppState = (state, options) => {
      if ('themePreference' in state) {
        element.dataset.writes = String(Number(element.dataset.writes) + 1);
        if (element.dataset.fail === 'true')
          throw new Error('theme write failed');
      }
      set(state, options);
    };
  });
  for (const selected of [[], ['invalid'], ['dark', 'light'], ['light']]) {
    await choose(menu, selected);
    await expect(menu).toHaveJSProperty('selected', ['light']);
  }
  await expect(navbar).toHaveAttribute('data-writes', '0');
  await navbar.evaluate((el: HTMLElement) => {
    el.dataset.fail = 'true';
  });
  await choose(menu, ['dark']);
  await expect(menu).toHaveJSProperty('selected', ['light']);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await navbar.evaluate((el: HTMLElement) => {
    el.dataset.fail = 'false';
  });
  await choose(menu, ['dark']);
  await bound(page, '#abcdef');
  await expect(navbar).toHaveAttribute('data-writes', '2');
  expect(errors).toEqual([]);
});

test('detached controls and destroyed canvases reject theme events and discard pending refreshes', async ({
  page,
}) => {
  const { navbar, menu, errors } = await ready(page);
  await navbar.evaluate(async (element: TopNavbar) => {
    const parent = element.parentElement!;
    const api = element.api;
    element.remove();
    const menu = element.shadowRoot!.querySelector(
      'sp-menu:has(> sp-menu-item[value="system"])',
    ) as Menu;
    menu.selected = ['dark'];
    menu.dispatchEvent(new Event('change', { bubbles: true }));
    if (api.getAppState().themeMode !== 'light')
      throw new Error('detached control wrote theme');
    parent.append(element);
    await element.updateComplete;
  });
  await choose(menu, ['system']);
  await page.evaluate(async () => {
    const api = window.apis.left;
    const stale = api.element.shadowRoot!.querySelector(
      'ic-spectrum-top-navbar',
    ) as TopNavbar;
    api.setAppState({ themeMode: 'dark' as ThemeMode });
    window.flushReact(() => window.setShown(['right']));
    // Keep a connected control pointing at an already destroyed canvas.
    // It must reject events even though isConnected is true.
    await Promise.resolve();
    api.destroy();
    const set = api.setAppState.bind(api);
    stale.dataset.testid = 'stale-theme-navbar';
    stale.dataset.writes = '0';
    api.setAppState = (state, options) => {
      stale.dataset.writes = String(Number(stale.dataset.writes) + 1);
      set(state, options);
    };
    document.body.append(stale);
    await stale.updateComplete;
  });
  const stale = page.getByTestId('stale-theme-navbar');
  await choose(stale.locator('sp-menu:has(> sp-menu-item[value="system"])'), [
    'light',
  ]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await bound(page, '#123456', 'right');
  await expect(stale).toHaveAttribute('data-writes', '0');
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});

test('saved preferences restore the mode and binding values after remounting', async ({
  page,
}) => {
  const { menu, errors } = await ready(page);
  await choose(menu, ['dark']);
  await bound(page, '#abcdef');
  await page.evaluate(() =>
    window.flushReact(() => window.setShown(['right'])),
  );
  await page.evaluate(() =>
    window.flushReact(() => window.setShown(['left', 'right'])),
  );
  await expect(page.getByTestId('left-status')).toHaveText('ready');
  expect(
    await page.evaluate(() => window.apis.left.getAppState().themeMode),
  ).toBe('dark');
  await page.evaluate(
    (accent) =>
      window.apis.left.edit(
        (api) => {
          api.setAppState({ variables: { accent } });
          api.updateNode(api.getNodeById('left')!, {
            fills: [{ type: 'solid', value: '$accent' }],
          });
        },
        { capture: 'NEVER' },
      ),
    accent,
  );
  await bound(page, '#abcdef');
  await bound(page, '#123456', 'right');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});
