import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  VectorNetworkSerializedNode,
  VectorEndpoint,
  VectorEdgeUse,
  VectorNetworkEditMode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '../../packages/webcomponents/src/API';
import type { ContextVectorNetworkEditBar } from '../../packages/webcomponents/src/spectrum/context-vector-network-edit-bar';
import type { VectorTopologyControls } from '../../packages/webcomponents/src/spectrum/vector-topology-controls';

declare global {
  interface Window {
    vectorEditAPI: ExtendedAPI;
  }
}

function network(
  kind: 'face' | 'edge' | 'handles',
): VectorNetworkSerializedNode {
  return {
    id: 'vector-edit',
    type: 'vector-network',
    x: 40,
    y: 30,
    width: 180,
    height: 180,
    zIndex: 1,
    isEditing: true,
    vertices: [
      { x: 0, y: 0 },
      { x: 180, y: 0 },
      { x: 180, y: 180 },
      { x: 0, y: 180 },
    ],
    segments: [
      {
        start: 0,
        end: 1,
        ...(kind === 'handles' ? { tangentStart: { x: 50, y: 0 } } : {}),
      },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      {
        start: 3,
        end: 0,
        ...(kind === 'handles' ? { tangentEnd: { x: 0, y: 30 } } : {}),
      },
      ...(kind === 'edge' ? [{ start: 0, end: 2 }] : []),
    ],
    regions:
      kind === 'edge'
        ? [
            { fillRule: 'evenodd', loops: [[0, 1, 4]] },
            { fillRule: 'evenodd', loops: [[4, 2, 3]] },
          ]
        : [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }],
    strokes: [{ type: 'solid', value: '#147af3' }],
    fills: [{ type: 'solid', value: '#b7d6ff' }],
    strokeWidth: 2,
  };
}

async function ready(page: Page, kind: 'face' | 'edge' | 'handles' = 'face') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(
    (node) => window.canvasRegression.setScene('left', [node], node.id),
    network(kind),
  );
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'vector-edit'),
  );
  const toolbar = page.locator(
    '#left ic-spectrum-context-vector-network-edit-bar',
  );
  await toolbar.evaluate(async (element: ContextVectorNetworkEditBar, kind) => {
    const api = (window.vectorEditAPI = element.api);
    await api.edit(
      (editor) => {
        // isEditing is transient ECS state; installing a document alone does
        // not initialize Editable as a real edit-mode transition does.
        editor.updateNode(editor.getNodeById('vector-edit')!, {
          isEditing: true,
        });
        editor.setAppState({
          vectorNetworkSelectedVertex: { nodeId: 'vector-edit', index: 0 },
          vectorNetworkEditMode: (kind === 'handles'
            ? 'bend'
            : 'move') as typeof element.appState.vectorNetworkEditMode,
        });
      },
      { capture: 'NEVER' },
    );
    api.clearHistory();
  }, kind);
  await page.evaluate(() => window.canvasRegression.settleFrames());
  await page.evaluate(() =>
    window.canvasRegression.selectVectorVertex('left', 'vector-edit', 0),
  );
  return { toolbar, errors };
}

const node = (page: Page) =>
  page.evaluate(
    () =>
      window.vectorEditAPI.getNodeById(
        'vector-edit',
      ) as VectorNetworkSerializedNode,
  );
const noHistory = async (page: Page) =>
  expect(
    await page.evaluate(() => window.vectorEditAPI.getHistoryState().canUndo),
  ).toBe(false);
async function drain(page: Page) {
  await page.evaluate(() => window.canvasRegression.settleFrames());
}
async function change(control: Locator, value: string) {
  await control.evaluate((element, value) => {
    (element as HTMLElement & { value: string }).value = value;
    element.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  }, value);
}
async function open(toolbar: Locator, faces = true) {
  const controls = toolbar.locator(
    `ic-spectrum-vector-topology-controls${
      faces ? '[faces]' : ':not([faces])'
    }`,
  );
  await controls.locator('#topology').click();
  await expect(controls.locator('sp-popover')).toBeVisible();
  return controls;
}
async function cutPanel(toolbar: Locator) {
  const controls = await open(toolbar);
  await change(controls.locator('sp-picker[label="Target vertex"]'), '2');
  return controls;
}
async function edgePanel(toolbar: Locator) {
  const controls = await open(toolbar, false);
  await change(controls.locator('sp-picker[label="Topology target"]'), 'edges');
  await change(controls.locator('sp-picker[label="Source edge"]'), '4');
  return controls;
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
});

test('queued cut captures its target, ignores duplicate submits and commits before closing', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page);
  const controls = await cutPanel(toolbar);
  await controls.evaluate((element) => {
    const root = element.shadowRoot!;
    const button = root.querySelector(
      '.actions sp-action-button',
    ) as HTMLElement;
    button.click();
    button.click();
    const picker = root.querySelector(
      'sp-picker[label="Target vertex"]',
    ) as HTMLElement & { value: string };
    picker.value = '1';
    picker.dispatchEvent(
      new Event('change', { bubbles: true, composed: true }),
    );
  });
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(4);
  await noHistory(page);
  await page.evaluate(() => window.vectorEditAPI.redo());
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('right')!.nodes[0].width,
    ),
  ).toBe(120);
  expect(errors).toEqual([]);
});

for (const kind of ['vertex', 'edge'] as const) {
  test(`queued ${kind} unglue owns nested selections until commit`, async ({
    page,
  }) => {
    const { toolbar, errors } = await ready(
      page,
      kind === 'edge' ? 'edge' : 'face',
    );
    const controls =
      kind === 'edge' ? await edgePanel(toolbar) : await open(toolbar, false);
    await controls
      .getByRole('checkbox', {
        name: kind === 'edge' ? 'R2 · L1 · 1' : 'E1 · Start',
        exact: true,
      })
      .check();
    await controls.evaluate((element, kind) => {
      const root = element.shadowRoot!;
      const button = Array.from(root.querySelectorAll('sp-action-button')).find(
        (button) =>
          button.textContent!.trim() ===
          (kind === 'edge' ? 'Unglue edge' : 'Unglue'),
      ) as HTMLElement;
      button.click();
      const state = element as unknown as {
        detached: VectorEndpoint[];
        uses: VectorEdgeUse[];
      };
      if (kind === 'edge') state.uses[0].regionIndex = 0;
      else state.detached[0].segmentIndex = 3;
    }, kind);
    await expect
      .poll(() =>
        node(page).then((n) =>
          kind === 'edge' ? n.segments.length : n.vertices.length,
        ),
      )
      .toBe(kind === 'edge' ? 6 : 5);
    const result = await node(page);
    if (kind === 'edge')
      expect(result.regions!.map((r) => r.loops)).toEqual([
        [[0, 1, 4]],
        [[5, 2, 3]],
      ]);
    else expect(result.segments[0].start).toBe(4);
    await page.evaluate(() => window.vectorEditAPI.undo());
    await expect
      .poll(() =>
        node(page).then((n) =>
          kind === 'edge' ? n.segments.length : n.vertices.length,
        ),
      )
      .toBe(kind === 'edge' ? 5 : 4);
    await noHistory(page);
    expect(errors).toEqual([]);
  });
}

test('rejected geometry leaves pending history intact and corrected choices can retry', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page);
  const controls = await cutPanel(toolbar);
  await change(controls.locator('sp-picker[label="Target vertex"]'), '1');
  await toolbar.evaluate((element: ContextVectorNetworkEditBar) =>
    element.api.updateNode(element.node, { strokeWidth: 7 }),
  );
  await controls.getByRole('button', { name: 'Cut face', exact: true }).click();
  await expect(controls.getByRole('alert')).toContainText('same face');
  await noHistory(page);
  await page.evaluate(() => window.vectorEditAPI.record());
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect.poll(() => node(page).then((n) => n.strokeWidth)).toBe(2);
  await noHistory(page);
  await expect(
    controls.locator('sp-overlay[trigger="topology@click"]'),
  ).toHaveJSProperty('state', 'closed');
  const reopened = await cutPanel(toolbar);
  await reopened.getByRole('button', { name: 'Cut face', exact: true }).click();
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  expect(errors).toEqual([]);
});

for (const action of ['cancel', 'disconnect', 'destroy', 'rebind'] as const) {
  test(`queued topology is cancelled on ${action}`, async ({ page }) => {
    const { toolbar, errors } = await ready(page);
    const controls = await cutPanel(toolbar);
    await controls.evaluate((element: VectorTopologyControls, action) => {
      const api = window.vectorEditAPI,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        if (action === 'destroy') {
          return window.canvasRegression
            .destroy('left')
            .then(() => edit(update, options));
        }
        const pending = edit(update, options);
        if (action === 'cancel')
          (
            element.shadowRoot!.querySelector(
              '.actions sp-action-button:last-child',
            ) as HTMLElement
          ).click();
        if (action === 'disconnect') element.remove();
        if (action === 'rebind') element.api = {} as typeof element.api;
        return pending;
      };
      (
        element.shadowRoot!.querySelector(
          '.actions sp-action-button',
        ) as HTMLElement
      ).click();
    }, action);
    if (action === 'destroy')
      await expect(page.locator('#left canvas')).toHaveCount(0);
    await drain(page);
    await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
    if (action !== 'destroy') {
      expect((await node(page)).segments).toHaveLength(4);
      await noHistory(page);
    }
    expect(
      await page.evaluate(
        () => window.canvasRegression.state('right')!.nodes[0].width,
      ),
    ).toBe(120);
    expect(errors).toEqual([]);
  });
}

for (const action of [
  'delete',
  'lock',
  'hide',
  'geometry',
  'mutate',
  'transform',
  'selection',
  'tool',
] as const) {
  test(`queued topology skips a target changed by ${action}`, async ({
    page,
  }) => {
    const { toolbar, errors } = await ready(page);
    const controls = await cutPanel(toolbar);
    await page.evaluate((action) => {
      const api = window.vectorEditAPI,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        void edit(
          (editor) => {
            const node = editor.getNodeById(
              'vector-edit',
            ) as VectorNetworkSerializedNode;
            if (action === 'delete') editor.deleteNodesById([node.id]);
            if (action === 'lock') editor.updateNode(node, { locked: true });
            if (action === 'hide')
              editor.updateNode(node, { visibility: 'hidden' });
            if (action === 'geometry')
              editor.updateNode(node, {
                vertices: node.vertices.map((v, i) =>
                  i === 0 ? { ...v, x: 5 } : v,
                ),
              });
            if (action === 'mutate') node.vertices[0].x = 5;
            if (action === 'transform') editor.updateNode(node, { x: 70 });
            if (action === 'selection')
              editor.setAppState({
                vectorNetworkSelectedVertex: { nodeId: node.id, index: 1 },
              });
            if (action === 'tool')
              editor.setAppState({
                vectorNetworkEditMode: 'bend' as VectorNetworkEditMode,
              });
          },
          { capture: 'NEVER' },
        );
        return edit(update, options);
      };
    }, action);
    await controls
      .getByRole('button', { name: 'Cut face', exact: true })
      .click();
    await drain(page);
    await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
    const result = await node(page);
    if (action === 'delete') expect(!result || result.isDeleted).toBe(true);
    else expect(result.segments).toHaveLength(4);
    await noHistory(page);
    expect(errors).toEqual([]);
  });
}

test('a rejected edit reports an error, unlocks its action and can retry', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page);
  const controls = await cutPanel(toolbar);
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    const api = window.vectorEditAPI,
      edit = api.edit.bind(api);
    api.edit = () => {
      api.edit = edit;
      return Promise.reject(new Error('topology edit rejected'));
    };
  });
  await controls.getByRole('button', { name: 'Cut face', exact: true }).click();
  await expect(controls.getByRole('alert')).toContainText('Try again');
  await expect(
    controls.getByRole('button', { name: 'Cut face', exact: true }),
  ).toBeEnabled();
  await noHistory(page);
  expect(
    reported.some((message) => message.includes('topology edit rejected')),
  ).toBe(true);
  await controls.getByRole('button', { name: 'Cut face', exact: true }).click();
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Bend selected edge keeps unrelated pending document history intact', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page, 'edge');
  const controls = await edgePanel(toolbar);
  await toolbar.evaluate((element: ContextVectorNetworkEditBar) =>
    element.api.updateNode(element.node, { strokeWidth: 7 }),
  );
  await controls
    .getByRole('button', { name: 'Bend selected edge', exact: true })
    .click();
  await expect(
    toolbar.getByRole('radio', { name: 'Bend', exact: true }),
  ).toBeChecked();
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  await noHistory(page);
  await page.evaluate(() => window.vectorEditAPI.record());
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect.poll(() => node(page).then((n) => n.strokeWidth)).toBe(2);
  await noHistory(page);
  expect(errors).toEqual([]);
});

test('queued handle coupling captures modes and uses the latest tangent lengths', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page, 'handles');
  await toolbar.evaluate((element: ContextVectorNetworkEditBar) => {
    const api = element.api,
      edit = api.edit.bind(api);
    api.edit = (update, options) => {
      api.edit = edit;
      void edit(
        (editor) => {
          const node = editor.getNodeById(
            'vector-edit',
          ) as VectorNetworkSerializedNode;
          editor.updateNode(node, {
            segments: node.segments.map((s, i) =>
              i === 0 ? { ...s, tangentStart: { x: 60, y: 20 } } : s,
            ),
          });
        },
        { capture: 'NEVER' },
      );
      return edit(update, options);
    };
    const select = element.shadowRoot!.querySelector('select')!;
    for (const mode of ['ANGLE', 'ANGLE_AND_LENGTH']) {
      select.value = mode;
      select.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }
    select.value = 'NONE';
  });
  await expect
    .poll(() => node(page).then((n) => n.vertices[0].handleMirroring))
    .toBe('ANGLE_AND_LENGTH');
  expect((await node(page)).segments[3].tangentEnd).toEqual({ x: -60, y: -20 });
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect
    .poll(() => node(page).then((n) => n.vertices[0].handleMirroring))
    .toBe('ANGLE');
  const tangent = (await node(page)).segments[3].tangentEnd!;
  expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(30);
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect
    .poll(() => node(page).then((n) => n.vertices[0].handleMirroring))
    .toBeUndefined();
  expect((await node(page)).segments[0].tangentStart).toEqual({ x: 60, y: 20 });
  await noHistory(page);
  expect(errors).toEqual([]);
});

test('invalid and unchanged coupling leave unrelated pending history alone', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page, 'handles');
  await toolbar.evaluate((element: ContextVectorNetworkEditBar) =>
    element.api.updateNode(element.node, { strokeWidth: 7 }),
  );
  for (const value of ['NONE', 'invalid'])
    await change(toolbar.locator('select'), value);
  await drain(page);
  await noHistory(page);
  await expect(toolbar.locator('select')).toHaveValue('NONE');
  await page.evaluate(() => window.vectorEditAPI.record());
  await page.evaluate(() => window.vectorEditAPI.undo());
  await expect.poll(() => node(page).then((n) => n.strokeWidth)).toBe(2);
  await noHistory(page);
  expect(errors).toEqual([]);
});

for (const action of ['connectivity', 'selection', 'disconnect'] as const) {
  test(`queued coupling skips stale ${action}`, async ({ page }) => {
    const { toolbar, errors } = await ready(page, 'handles');
    await toolbar.evaluate((element: ContextVectorNetworkEditBar, action) => {
      const api = element.api,
        edit = api.edit.bind(api);
      api.edit = (update, options) => {
        api.edit = edit;
        if (action !== 'disconnect')
          void edit(
            (editor) => {
              const node = editor.getNodeById(
                'vector-edit',
              ) as VectorNetworkSerializedNode;
              if (action === 'connectivity')
                editor.updateNode(node, {
                  segments: [...node.segments, { start: 0, end: 2 }],
                });
              if (action === 'selection')
                editor.setAppState({
                  vectorNetworkSelectedVertex: { nodeId: node.id, index: 1 },
                });
            },
            { capture: 'NEVER' },
          );
        const pending = edit(update, options);
        if (action === 'disconnect') element.remove();
        return pending;
      };
      const select = element.shadowRoot!.querySelector('select')!;
      select.value = 'ANGLE';
      select.dispatchEvent(
        new Event('change', { bubbles: true, composed: true }),
      );
    }, action);
    await drain(page);
    expect((await node(page)).vertices.every((v) => !v.handleMirroring)).toBe(
      true,
    );
    await noHistory(page);
    expect(errors).toEqual([]);
  });
}

test('rejected coupling restores the select value without an unhandled rejection', async ({
  page,
}) => {
  const { toolbar, errors } = await ready(page, 'handles');
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') reported.push(message.text());
  });
  await page.evaluate(() => {
    window.vectorEditAPI.edit = () =>
      Promise.reject(new Error('coupling edit rejected'));
  });
  await change(toolbar.locator('select'), 'ANGLE');
  await expect
    .poll(() =>
      reported.some((message) => message.includes('coupling edit rejected')),
    )
    .toBe(true);
  await expect(toolbar.locator('select')).toHaveValue('NONE');
  await noHistory(page);
  expect(errors).toEqual([]);
});
