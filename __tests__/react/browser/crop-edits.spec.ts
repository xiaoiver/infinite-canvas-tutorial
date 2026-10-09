import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './isolated-webkit-test';
import type { Pen } from '@infinite-canvas-tutorial/ecs';
import type { PenbarCrop } from '@infinite-canvas-tutorial/webcomponents/spectrum';

async function drain(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (const side of ['left', 'right']) {
    await expect(page.getByTestId(`${side}-status`)).toHaveText('ready', {
      timeout: 45000,
    });
  }
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => {
        api.updateNodes([
          {
            id: 'crop-a',
            type: 'rect',
            clipMode: 'soft',
            locked: true,
            x: 70,
            y: 60,
            width: 100,
            height: 80,
            zIndex: 0,
          },
          {
            ...api.getNodeById('left')!,
            parentId: 'crop-a',
            x: -30,
            y: -10,
            width: 200,
            height: 100,
          },
          {
            id: 'crop-b',
            type: 'rect',
            clipMode: 'clip',
            x: 240,
            y: 50,
            width: 40,
            height: 90,
            zIndex: 1,
          },
          {
            id: 'child-b',
            type: 'rect',
            parentId: 'crop-b',
            x: 5,
            y: 10,
            width: 60,
            height: 120,
            zIndex: 0,
          },
        ]);
        api.reparentNode(api.getNodeById('left')!, api.getNodeById('crop-a')!);
        api.updateNode(api.getNodeById('left')!, { x: -30, y: -10 });
        api.selectNodes([api.getNodeById('left')!]);
        api.setAppState({ layersCropping: ['crop-a'] });
      },
      { capture: 'NEVER' },
    );
  });
  const panel = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-penbar-crop');
  await expect(panel.locator('sp-slider')).toBeVisible();
  await expect(panel.locator('sp-slider')).toHaveJSProperty('value', 1);
  await drain(page);
  return { panel, errors };
}

async function scale(panel: Locator, value: number) {
  await panel.locator('sp-slider').evaluate((element, value) => {
    (element as HTMLElement & { value: number }).value = value;
    element.dispatchEvent(
      new Event('input', { bubbles: true, composed: true }),
    );
  }, value);
}

async function aspect(panel: Locator, value: string, nested = false) {
  const control = nested
    ? panel.locator('sp-menu[slot="submenu"]').first()
    : panel.locator('sp-action-menu');
  await control.evaluate((element, value) => {
    (element as HTMLElement & { value: string }).value = value;
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, value);
}

async function geometry(page: Page, id: string, expected: number[]) {
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const node = window.apis.left.getNodeById(id)!;
        return [node.x, node.y, node.width, node.height];
      }, id),
    )
    .toEqual(expected);
}

test('aspect and scale preserve image proportions and center with one undo each', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.locator('sp-action-menu').click();
  await panel.locator('sp-menu-item[value="square"]').click();
  await geometry(page, 'crop-a', [90, 50, 100, 100]);
  await geometry(page, 'left', [-50, 0, 200, 100]);
  await scale(panel, 2);
  await geometry(page, 'left', [-150, -50, 400, 200]);
  await page.getByTestId('left-undo').click();
  await geometry(page, 'left', [-50, 0, 200, 100]);
  await page.getByTestId('left-undo').click();
  await geometry(page, 'crop-a', [70, 60, 100, 80]);
  await geometry(page, 'left', [-30, -10, 200, 100]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.getByTestId('left-redo').click();
  await geometry(page, 'crop-a', [90, 50, 100, 100]);
  await page.getByTestId('left-redo').click();
  await geometry(page, 'left', [-150, -50, 400, 200]);
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('nested aspect menus submit once and queued aspects use live geometry', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element) => {
    const menu = element.shadowRoot!.querySelector(
      'sp-menu[slot="submenu"]',
    ) as HTMLElement & { value: string };
    for (const value of ['16:9', '9:16']) {
      menu.value = value;
      menu.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
  });
  await geometry(page, 'crop-a', [111.875, 50, 56.25, 100]);
  await geometry(page, 'left', [-71.875, 0, 200, 100]);
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('crop-a')!.width),
    )
    .toBeCloseTo(1600 / 9);
  await page.getByTestId('left-undo').click();
  await geometry(page, 'crop-a', [70, 60, 100, 80]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('invalid and unchanged inputs preserve pending changes and redo', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(async () => {
    const api = window.apis.left;
    await api.edit((api) =>
      api.updateNode(api.getNodeById('child-b')!, { width: 80 }),
    );
    api.undo();
  });
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await page.evaluate(() =>
    window.apis.left.updateNode(window.apis.left.getNodeById('child-b')!, {
      height: 131,
    }),
  );
  await panel.evaluate((element) => {
    const slider = element.shadowRoot!.querySelector('sp-slider')!;
    const own = Object.getOwnPropertyDescriptor(slider, 'value');
    try {
      for (const value of ['', ' ', '2oops', NaN, Infinity, 0, -1, 4.1, 1]) {
        Object.defineProperty(slider, 'value', { configurable: true, value });
        slider.dispatchEvent(
          new Event('input', { bubbles: true, composed: true }),
        );
      }
    } finally {
      if (own) Object.defineProperty(slider, 'value', own);
      else Reflect.deleteProperty(slider, 'value');
    }
    const menu = element.shadowRoot!.querySelector(
      'sp-action-menu',
    ) as HTMLElement & { value: string };
    for (const value of ['', '0:1', '1:0', 'NaN:1', '2:3oops']) {
      menu.value = value;
      menu.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
  });
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('left-redo')).toBeEnabled();
  await geometry(page, 'left', [-30, -10, 200, 100]);
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('child-b')!.height),
    )
    .toBe(120);
  expect(errors).toEqual([]);
});

test('switching crop targets cancels queued scale and resets the baseline at the same selection length', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element) => {
    const slider = element.shadowRoot!.querySelector(
      'sp-slider',
    ) as HTMLElement & { value: number };
    slider.value = 2;
    slider.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    window.apis.left.setAppState({ layersCropping: ['crop-b'] });
  });
  await drain(page);
  await geometry(page, 'left', [-30, -10, 200, 100]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(panel.locator('sp-slider')).toHaveJSProperty('value', 1);
  await scale(panel, 2);
  await geometry(page, 'child-b', [-25, -50, 120, 240]);
  await geometry(page, 'left', [-30, -10, 200, 100]);
  expect(errors).toEqual([]);
});

test('a queued exit and re-entry invalidates an earlier session before its command runs', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await panel.evaluate((element) => {
    void window.apis.left.edit(
      (api) => {
        api.setAppState({ layersCropping: [] });
        api.setAppState({ layersCropping: ['crop-a'] });
      },
      { capture: 'NEVER' },
    );
    const slider = element.shadowRoot!.querySelector(
      'sp-slider',
    ) as HTMLElement & { value: number };
    slider.value = 2;
    slider.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  await drain(page);
  await geometry(page, 'left', [-30, -10, 200, 100]);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await scale(panel, 2);
  await geometry(page, 'left', [-130, -60, 400, 200]);
  expect(errors).toEqual([]);
});

for (const action of ['disconnect', 'replace', 'destroy', 'tool'] as const) {
  test(`${action} cancels pending crop edits and leaves the other canvas alone`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.evaluate(async (element: PenbarCrop, action) => {
      const api = element.api;
      const parent = element.parentNode!;
      const slider = element.shadowRoot!.querySelector(
        'sp-slider',
      ) as HTMLElement & { value: number };
      slider.value = 2;
      slider.dispatchEvent(
        new Event('input', { bubbles: true, composed: true }),
      );
      if (action === 'destroy') {
        window.setShown(['right']);
        return;
      }
      if (action === 'disconnect') element.remove();
      else if (action === 'tool')
        api.setAppState({ penbarSelected: 'hand' as Pen });
      else element.api = window.apis.right;
      // A detached or rebound old control must not start another crop command.
      slider.dispatchEvent(
        new Event('input', { bubbles: true, composed: true }),
      );
      const controller = new AbortController();
      await api.edit(() => controller.abort(), { signal: controller.signal });
      if (action === 'disconnect') parent.appendChild(element);
      else if (action === 'tool')
        api.setAppState({ penbarSelected: 'select' as Pen });
      else element.api = api;
      await element.updateComplete;
    }, action);
    await drain(page);
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    if (action === 'destroy')
      await expect(page.getByTestId('left-status')).toHaveCount(0);
    else {
      await geometry(page, 'left', [-30, -10, 200, 100]);
      if (action === 'tool') {
        // Select finishes the crop when switching tools. That legitimate exit
        // is one undo step; the cancelled scale must not add another one.
        await expect(panel.locator('sp-slider')).toHaveCount(0);
        await expect
          .poll(() =>
            page.evaluate(() => window.apis.left.getAppState().layersCropping),
          )
          .toEqual([]);
        await expect
          .poll(() =>
            page.evaluate(
              () => window.apis.left.getNodeById('crop-a')!.clipMode,
            ),
          )
          .toBe('clip');
        await page.getByTestId('left-undo').click();
        await geometry(page, 'left', [-30, -10, 200, 100]);
      }
      await expect(page.getByTestId('left-undo')).toBeDisabled();
      if (action === 'tool') {
        await page.evaluate(() =>
          window.apis.left.edit(
            (api) => {
              api.selectNodes([api.getNodeById('left')!]);
              api.setAppState({ layersCropping: ['crop-a'] });
            },
            { capture: 'NEVER' },
          ),
        );
        await expect(panel.locator('sp-slider')).toBeVisible();
      }
      await scale(panel, 2);
      await geometry(page, 'left', [-130, -60, 400, 200]);
    }
    expect(errors).toEqual([]);
  });
}

for (const action of ['delete', 'reparent'] as const) {
  test(`queued crop command skips a child changed by ${action}`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.evaluate((element, action) => {
      void window.apis.left.edit(
        (api) => {
          if (action === 'delete') api.deleteNodesById(['left']);
          else
            api.reparentNode(
              api.getNodeById('left')!,
              api.getNodeById('crop-b')!,
            );
        },
        { capture: 'NEVER' },
      );
      const slider = element.shadowRoot!.querySelector(
        'sp-slider',
      ) as HTMLElement & { value: number };
      slider.value = 2;
      slider.dispatchEvent(
        new Event('input', { bubbles: true, composed: true }),
      );
    }, action);
    await drain(page);
    // Removing the last child ends crop mode and restores the mask. Undo that
    // cleanup once without reverting the remote deletion/reparent or scaling.
    await expect
      .poll(() =>
        page.evaluate(() => window.apis.left.getAppState().layersCropping),
      )
      .toEqual([]);
    await expect(panel.locator('sp-slider')).toHaveCount(0);
    await geometry(page, 'crop-a', [70, 60, 100, 80]);
    const childState = () =>
      page.evaluate(() => {
        const node = window.apis.left.getNodeById('left');
        if (!node) return null;
        const { parentId, x, y, width, height } = node;
        return { parentId, x, y, width, height };
      });
    const child = await childState();
    if (action === 'delete') expect(child).toBeNull();
    else
      expect(child).toMatchObject({
        parentId: 'crop-b',
        width: 200,
        height: 100,
      });
    for (const [history, clipMode] of [
      ['undo', 'soft'],
      ['redo', 'clip'],
    ] as const) {
      await page.getByTestId(`left-${history}`).click();
      await expect
        .poll(() =>
          page.evaluate(() => window.apis.left.getNodeById('crop-a')!.clipMode),
        )
        .toBe(clipMode);
      expect(await childState()).toEqual(child);
      await expect(page.getByTestId(`left-${history}`)).toBeDisabled();
    }
    await expect(page.getByTestId('right-undo')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

for (const label of ['Apply crop', 'Exit crop']) {
  test(`${label} ends the session once and cancels following input`, async ({
    page,
  }) => {
    const { panel, errors } = await ready(page);
    await panel.evaluate((element, label) => {
      const button = element.shadowRoot!.querySelector(
        `[aria-label="${label}"]`,
      )!;
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      const slider = element.shadowRoot!.querySelector(
        'sp-slider',
      ) as HTMLElement & { value: number };
      slider.value = 2;
      slider.dispatchEvent(
        new Event('input', { bubbles: true, composed: true }),
      );
    }, label);
    await expect(panel.locator('sp-slider')).toHaveCount(0);
    await geometry(page, 'left', [-30, -10, 200, 100]);
    expect(
      await page.evaluate(() => {
        const api = window.apis.left;
        return {
          selected: api.getAppState().layersSelected,
          clip: api.getNodeById('crop-a')!.clipMode,
          parentLocked: api.getNodeById('crop-a')!.locked,
          childLocked: api.getNodeById('left')!.locked,
        };
      }),
    ).toEqual({
      selected: ['crop-a'],
      clip: 'clip',
      parentLocked: false,
      childLocked: true,
    });
    await page.getByTestId('left-undo').click();
    await expect(page.getByTestId('left-undo')).toBeDisabled();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.apis.left.getNodeById('left')!.locked ?? false,
        ),
      )
      .toBe(false);
    await page.getByTestId('left-redo').click();
    await expect
      .poll(() =>
        page.evaluate(() => window.apis.left.getNodeById('left')!.locked),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test('failed crop edits restore the control and allow retry', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text());
  });
  await page.evaluate(() => {
    const api = window.apis.left;
    const edit = api.edit;
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('Rejected crop edit'));
    };
  });
  await scale(panel, 2);
  await expect
    .poll(() => messages.some((m) => m.includes('Rejected crop edit')))
    .toBe(true);
  await expect(panel.locator('sp-slider')).toHaveJSProperty('value', 1);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await scale(panel, 2);
  await geometry(page, 'left', [-130, -60, 400, 200]);
  expect(errors).toEqual([]);
});

test('rotated and flipped frames keep the image in place when changing the crop aspect', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => {
        api.updateNode(api.getNodeById('crop-a')!, {
          rotation: Math.PI / 2,
          scaleX: -1,
          scaleY: 2,
        });
        api.updateNode(api.getNodeById('left')!, {
          rotation: Math.PI / 4,
          scaleX: -1,
          scaleY: 1.5,
        });
      },
      { capture: 'NEVER' },
    );
  });
  await drain(page);
  const bounds = () =>
    page.evaluate(() => {
      const api = window.apis.left;
      const { minX, minY, maxX, maxY } = api.getBounds([
        api.getNodeById('left')!,
      ]);
      return [minX, minY, maxX, maxY];
    });
  const before = await bounds();
  await aspect(panel, 'original');
  await expect(page.getByTestId('left-undo')).toBeEnabled();
  await drain(page);
  const after = await bounds();
  after.forEach((n, i) => expect(n).toBeCloseTo(before[i], 3));
  await scale(panel, 2);
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('left')!.width),
    )
    .toBe(400);
  await drain(page);
  const scaled = await bounds();
  expect((scaled[0] + scaled[2]) / 2).toBeCloseTo(
    (before[0] + before[2]) / 2,
    3,
  );
  expect((scaled[1] + scaled[3]) / 2).toBeCloseTo(
    (before[1] + before[3]) / 2,
    3,
  );
  expect(errors).toEqual([]);
});

test('multiple children disable single-image geometry controls but can finish together', async ({
  page,
}) => {
  const { panel, errors } = await ready(page);
  await page.evaluate(async () => {
    await window.apis.left.edit(
      (api) => {
        api.updateNode({
          id: 'extra',
          type: 'rect',
          parentId: 'crop-a',
          x: 20,
          y: 20,
          width: 20,
          height: 20,
          zIndex: 1,
        });
      },
      { capture: 'NEVER' },
    );
  });
  await expect(panel.locator('sp-slider')).toHaveJSProperty('disabled', true);
  await expect(panel.locator('sp-action-menu')).toHaveJSProperty(
    'disabled',
    true,
  );
  await scale(panel, 2);
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await panel.locator('[aria-label="Apply crop"]').click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        ['left', 'extra'].map((id) => window.apis.left.getNodeById(id)!.locked),
      ),
    )
    .toEqual([true, true]);
  await page.getByTestId('left-undo').click();
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('core crop exit with no live target is a history-preserving no-op', async ({
  page,
}) => {
  const { errors } = await ready(page);
  await page.evaluate(() => {
    const api = window.apis.left;
    api.setAppState({ layersCropping: [] });
    api.updateNode(api.getNodeById('child-b')!, { width: 77 });
    api.applyCrop();
    api.cancelCrop();
    api.setAppState({ layersCropping: ['missing'] });
    api.applyCrop();
    api.cancelCrop();
    api.setAppState({ layersCropping: [] });
  });
  await drain(page);
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await page.evaluate(() => window.apis.left.record());
  await page.getByTestId('left-undo').click();
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getNodeById('child-b')!.width),
    )
    .toBe(60);
  expect(errors).toEqual([]);
});
