import { test, expect } from '@playwright/test';
import { installProbes } from './fixtures/probes';
import type { BatchingHarness } from './fixtures/batching';

declare global {
  interface Window {
    batching: BatchingHarness;
    batchUploads: {
      calls: number;
      bytes: number;
      allocations: number;
      reset(): void;
    };
  }
}
function installUploads() {
  const probe = {
    calls: 0,
    bytes: 0,
    allocations: 0,
    reset() {
      this.calls = this.bytes = this.allocations = 0;
    },
  };
  const get = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet<object>();
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const context = get.apply(this, args);
    if (context && 'bufferSubData' in context && !seen.has(context)) {
      seen.add(context);
      const gl = context as WebGL2RenderingContext;
      const sub = gl.bufferSubData.bind(gl),
        data = gl.bufferData.bind(gl);
      const bind = gl.bindBuffer.bind(gl);
      const vertices = new WeakSet<WebGLBuffer>();
      const bound = new Map<number, WebGLBuffer>();
      gl.bindBuffer = (target, buffer) => {
        if (buffer) {
          bound.set(target, buffer);
          if (target === gl.ARRAY_BUFFER) vertices.add(buffer);
        } else bound.delete(target);
        return bind(target, buffer);
      };
      gl.bufferSubData = ((...args: any[]) => {
        const [target, , src, srcOffset = 0, length] = args;
        if (vertices.has(bound.get(target))) {
          probe.calls++;
          probe.bytes += length ?? src.byteLength - srcOffset;
        }
        return sub(...(args as [number, number, ArrayBufferView]));
      }) as typeof gl.bufferSubData;
      gl.bufferData = ((
        target: number,
        src: number | ArrayBufferView,
        usage: number,
      ) => {
        if (target === gl.ARRAY_BUFFER) probe.allocations++;
        return data(target, src as ArrayBufferView, usage);
      }) as typeof gl.bufferData;
    }
    return context;
  } as typeof get;
  Object.assign(window, { batchUploads: probe });
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(installProbes);
  await page.addInitScript(installUploads);
  await page.goto('/batching.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.batching.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});

test('solid instancing preserves alpha, color, and affine transforms', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    const full = await h.sample('rect', false),
      batched = await h.sample('rect', true);
    const shapes = [
      {
        id: 'r0',
        type: 'rect',
        x: 60,
        y: 25,
        width: 50,
        height: 60,
        scaleX: -0.7,
        scaleY: 1.2,
        rotation: 0.4,
        zIndex: 0,
        fills: [{ type: 'solid', value: 'red' }],
        opacity: 0.7,
      },
      {
        id: 'r1',
        type: 'ellipse',
        x: 75,
        y: 50,
        width: 70,
        height: 50,
        rotation: -0.3,
        zIndex: 1,
        fills: [{ type: 'solid', value: 'blue', opacity: 0.6 }],
      },
    ];
    const transformFull = await h.scene(shapes, false),
      transformBatch = await h.scene(shapes, true);
    return { full, batched, transformFull, transformBatch };
  });
  expect(result.full.groups).toHaveLength(3);
  expect(result.batched.groups).toHaveLength(1);
  expect(result.batched.pixel).toEqual(result.full.pixel);
  expect(result.batched.png).toEqual(result.full.png);
  expect(result.transformBatch.png).toEqual(result.transformFull.png);
});

test('unsupported text stays full and creates an ordering barrier between SDF runs', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    const textFull = await h.sample('text', false),
      textBatch = await h.sample('text', true);
    const nodes = [
      {
        id: 'a',
        type: 'rect',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        zIndex: 0,
        opacity: 0.5,
        fills: [{ type: 'solid', value: 'red' }],
      },
      {
        id: 'text',
        type: 'text',
        x: 25,
        y: 35,
        width: 80,
        height: 40,
        zIndex: 1,
        content: 'abc',
        fontSize: 28,
        fills: [{ type: 'solid', value: 'blue' }],
      },
      {
        id: 'c',
        type: 'rect',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        zIndex: 2,
        opacity: 0.5,
        fills: [{ type: 'solid', value: 'red' }],
      },
    ];
    const orderedFull = await h.scene(nodes, false),
      orderedBatch = await h.scene(nodes, true);
    return { textFull, textBatch, orderedFull, orderedBatch };
  });
  expect(result.textBatch.png).toBe(result.textFull.png);
  expect(result.textBatch.groups.every((group) => !group.instanced)).toBe(true);
  expect(result.orderedBatch.groups.map((group) => group.nodes)).toEqual([
    ['a'],
    ['text'],
    ['c'],
  ]);
  expect(result.orderedBatch.png).toBe(result.orderedFull.png);
});

test('same-constructor material changes migrate between full and solid pages without stale members', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    const gradient = {
      fills: [{ type: 'gradient', value: 'linear-gradient(90deg, red, blue)' }],
    };
    await h.sample('rect', false);
    const full = await h.edit('r2', gradient);
    await h.sample('rect', true);
    const changed = await h.edit('r2', gradient);
    const restored = await h.edit('r2', {
      fills: [{ type: 'solid', value: 'green' }],
    });
    return { full, changed, restored };
  });
  expect(result.changed.png).toBe(result.full.png);
  expect(result.changed.groups.map((group) => group.nodes)).toEqual([
    ['r0', 'r1'],
    ['r2'],
  ]);
  expect(result.changed.groups[1].instanced).toBe(false);
  expect(result.restored.groups).toHaveLength(1);
});

test('camera-only frames upload no instance data; one material edit updates one row without allocations', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    await h.sample('rect', true);
    window.batchUploads.reset();
    await h.camera(0.9);
    const camera = {
      calls: window.batchUploads.calls,
      bytes: window.batchUploads.bytes,
      allocations: window.batchUploads.allocations,
    };
    window.batchUploads.reset();
    await h.edit('r1', { opacity: 0.3 });
    const edit = {
      calls: window.batchUploads.calls,
      bytes: window.batchUploads.bytes,
      allocations: window.batchUploads.allocations,
    };
    return { camera, edit };
  });
  expect(result.camera).toEqual({ calls: 0, bytes: 0, allocations: 0 });
  expect(result.edit.allocations).toBe(0);
  expect(result.edit.calls).toBe(2);
  expect(result.edit.bytes).toBe(152);
});

test('flag changes, visibility and culling reentry, and same-frame deletion retain no stale instances', async ({
  page,
}) => {
  const states = await page.evaluate(async () => {
    const h = window.batching;
    await h.sample('rect', false);
    const flagged = await h.flags(true);
    const hidden = await h.edit('r1', { visibility: 'hidden' });
    const shown = await h.edit('r1', { visibility: 'visible' });
    const culled = await h.pan(2000);
    const returned = await h.pan(0);
    const before = window.lifecycleProbes.resources().at(-1).live;
    for (let i = 0; i < 8; i++) {
      await h.edit('r2', {
        fills: [
          { type: 'gradient', value: 'linear-gradient(90deg, red, blue)' },
        ],
      });
      await h.edit('r2', { fills: [{ type: 'solid', value: 'green' }] });
    }
    const after = window.lifecycleProbes.resources().at(-1).live;
    const deleted = await h.deleteAll();
    return { flagged, hidden, shown, culled, returned, deleted, before, after };
  });
  expect(states.flagged.groups.map((g) => g.nodes)).toEqual([
    ['r0', 'r1', 'r2'],
  ]);
  expect(states.hidden.groups.flatMap((g) => g.nodes)).toEqual(['r0', 'r2']);
  expect(states.shown.groups.flatMap((g) => g.nodes)).toEqual([
    'r0',
    'r1',
    'r2',
  ]);
  expect(states.culled.groups).toEqual([]);
  expect(states.returned.png).toBe(states.flagged.png);
  expect(states.deleted.groups).toEqual([]);
  expect(states.before.Buffer).toBe(7);
  expect(states.after.Buffer).toBe(states.before.Buffer);
  expect(states.after.Texture).toBe(states.before.Texture);
});

test('full and partial raster exports match the existing path and restore the ordered screen plan', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    await h.sample('rect', false);
    const full = await h.export(false),
      partial = await h.export(true);
    await h.sample('rect', true);
    const batchedFull = await h.export(false),
      batchedPartial = await h.export(true);
    const screen = await h.camera(1);
    return { full, partial, batchedFull, batchedPartial, screen };
  });
  expect(result.batchedFull).toBe(result.full);
  expect(result.batchedPartial).toBe(result.partial);
  expect(result.screen.groups.map((g) => g.nodes)).toEqual([
    ['r0', 'r1', 'r2'],
  ]);
});

test('LOD transitions remain painter-order barriers between solid batches and exports stay full', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.batching;
    const nodes = [
      {
        id: 'r0',
        type: 'rect',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        zIndex: 0,
        opacity: 0.5,
        fills: [{ type: 'solid', value: 'red' }],
      },
      {
        id: 'r1',
        type: 'text',
        x: 20,
        y: 25,
        width: 100,
        height: 12,
        zIndex: 1,
        content: 'Small label',
        fontFamily: 'sans-serif',
        fontSize: 8,
        fills: [{ type: 'solid', value: 'black' }],
      },
      {
        id: 'r2',
        type: 'rect',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        zIndex: 2,
        opacity: 0.5,
        fills: [{ type: 'solid', value: 'blue' }],
      },
    ];
    await h.scene(nodes, true);
    await h.camera(0.5);
    const proxy = await h.enableLOD(true);
    const selected = await h.select('r1');
    const restored = await h.select();
    const proxyFullExport = await h.export(false);
    const proxyPartialExport = await h.export(true);
    const afterExport = await h.camera(0.5);
    await h.enableLOD(false);
    const fullExport = await h.export(false);
    const partialExport = await h.export(true);
    return {
      proxy,
      selected,
      restored,
      afterExport,
      proxyFullExport,
      proxyPartialExport,
      fullExport,
      partialExport,
    };
  });
  for (const state of [result.proxy, result.restored, result.afterExport]) {
    expect(state.groups.map((g) => g.ctor)).toEqual([
      'SDF',
      'TextProxy',
      'SDF',
    ]);
    expect(state.groups.map((g) => g.nodes)).toEqual([['r0'], ['r1'], ['r2']]);
    expect(state.groups.map((g) => g.instanced)).toEqual([true, false, true]);
  }
  expect(
    result.selected.groups
      .filter((g) => g.nodes.some((id) => ['r0', 'r1', 'r2'].includes(id)))
      .map((g) => g.ctor),
  ).toEqual(['SDF', 'SDFText', 'SDF']);
  expect(result.proxyFullExport).toBe(result.fullExport);
  expect(result.proxyPartialExport).toBe(result.partialExport);
});
