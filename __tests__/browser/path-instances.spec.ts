import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { installVertexUploadProbe } from './fixtures/vertex-uploads';
import type {} from './fixtures/polyline-lod';
import { PNG } from 'pngjs';

function compare(a: Buffer, b: Buffer) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  expect([x.width, x.height]).toEqual([y.width, y.height]);
  let significant = 0,
    ink = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] < 240 || x.data[i + 1] < 240 || x.data[i + 2] < 240) ink++;
    if ([0, 1, 2, 3].some((c) => Math.abs(x.data[i + c] - y.data[i + c]) > 3))
      significant++;
  }
  expect(ink).toBeGreaterThan(100);
  expect(significant).toBeLessThan(20);
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(installVertexUploadProbe);
  await page.goto('/polyline-lod.html');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 30000 });
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.polylineLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});
test('repeated solid Paths share one fill draw and preserve screen pixels and export', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.zoom(0.75);
    await window.polylineLOD.seedPaths(600);
    window.polylineLOD.resetWork();
    await window.polylineLOD.camera(0.2);
  });
  const full = await page.locator('canvas').screenshot();
  const off = await page.evaluate(() => window.polylineLOD.state());
  await page.evaluate(async () => {
    await window.polylineLOD.pathInstancing(true);
    await window.polylineLOD.camera(0.1);
    window.polylineLOD.resetWork();
    await window.polylineLOD.camera(0.2);
  });
  const on = await page.evaluate(() => window.polylineLOD.state());
  expect(on.document).toEqual(off.document);
  expect(on.visible).toBe(600);
  expect(on.drawcalls).toBe(1);
  expect(off.native.drawcalls).toBe(601);
  expect(on.native.drawcalls).toBe(2);
  expect(on.native.bufferUploads).toBe(1);
  compare(await page.locator('canvas').screenshot(), full);
  for (const partial of [false, true]) {
    const on = await page.evaluate(
      (p) => window.polylineLOD.export(p),
      partial,
    );
    await page.evaluate(() => window.polylineLOD.pathInstancing(false));
    const off = await page.evaluate(
      (p) => window.polylineLOD.export(p),
      partial,
    );
    expect(on).toBe(off);
    await page.evaluate(() => window.polylineLOD.pathInstancing(true));
  }
});

test('overlapping affine Paths preserve alpha and painter barriers; complex styles fall back', async ({
  page,
}) => {
  for (const barrier of [false, true]) {
    await page.evaluate(async (barrier) => {
      const paths: any[] = [0, 1, 2].map((i) => ({
        id: i === 0 ? 'line' : `n${i}`,
        type: 'path',
        batchable: true,
        x: 150 + i * 15,
        y: 110 + i * 9,
        width: 100,
        height: 100,
        rotation: 0.25,
        scaleX: -1.3,
        scaleY: 0.8,
        zIndex: i,
        d: 'M0 0 H100 V100 H0 Z M25 25 H75 V75 H25 Z',
        fillRule: 'evenodd',
        opacity: 0.65,
        fills: [
          { type: 'solid', value: ['red', 'blue', 'green'][i], opacity: 0.7 },
        ],
      }));
      if (barrier)
        paths.splice(1, 0, {
          id: 'barrier',
          type: 'rect',
          x: 70,
          y: 120,
          width: 100,
          height: 50,
          zIndex: 0.5,
          fills: [{ type: 'solid', value: 'yellow', opacity: 0.5 }],
        });
      await window.polylineLOD.document(paths);
      await window.polylineLOD.pathInstancing(false);
    }, barrier);
    const full = await page.locator('canvas').screenshot();
    await page.evaluate(() => window.polylineLOD.pathInstancing(true));
    compare(await page.locator('canvas').screenshot(), full);
    expect(
      await page.evaluate(() => window.polylineLOD.constructors()),
    ).toEqual(
      barrier ? ['PathInstances', 'SDF', 'PathInstances'] : ['PathInstances'],
    );
  }
  for (const patch of [
    {
      fills: [
        {
          type: 'gradient',
          value: 'linear-gradient(90deg, red, blue)',
          opacity: 1,
        },
      ],
    },
    {
      fills: [
        { type: 'solid', value: 'red' },
        { type: 'solid', value: 'blue', opacity: 0.5 },
      ],
    },
    {
      fills: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokes: [{ type: 'solid', value: 'blue', opacity: 0.7 }],
    },
  ]) {
    await page.evaluate((p) => window.polylineLOD.patch(p, 'line'), patch);
    expect(
      await page.evaluate(() => window.polylineLOD.constructors()),
    ).toContain('Mesh');
    const on = await page.locator('canvas').screenshot();
    await page.evaluate(() => window.polylineLOD.pathInstancing(false));
    compare(await page.locator('canvas').screenshot(), on);
    await page.evaluate(() => window.polylineLOD.pathInstancing(true));
  }
});
test('edits, history, in-place Path changes and visibility reentry retain current geometry without leaking pages', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.seedPaths(12);
    await window.polylineLOD.pathInstancing(true);
  });
  const initial = await page.locator('canvas').screenshot();
  const document = await page.evaluate(
    () => window.polylineLOD.state().document,
  );
  await page.evaluate(() =>
    window.polylineLOD.patch({
      fills: [{ type: 'solid', value: 'green', opacity: 0.6 }],
    }),
  );
  const edited = await page.locator('canvas').screenshot();
  expect(edited).not.toEqual(initial);
  await page.evaluate(() => window.polylineLOD.history('undo'));
  compare(await page.locator('canvas').screenshot(), initial);
  await page.evaluate(() => window.polylineLOD.history('redo'));
  compare(await page.locator('canvas').screenshot(), edited);
  await page.evaluate(() => window.polylineLOD.patch({ visibility: 'hidden' }));
  expect((await page.evaluate(() => window.polylineLOD.state())).visible).toBe(
    11,
  );
  await page.evaluate(() =>
    window.polylineLOD.patch({ visibility: 'visible' }),
  );
  expect((await page.evaluate(() => window.polylineLOD.state())).visible).toBe(
    12,
  );
  await page.evaluate(() => window.polylineLOD.mutatePath('M0 0 H35 V35 H0 Z'));
  expect(await page.evaluate(() => window.polylineLOD.constructors())).toEqual([
    'PathInstances',
    'PathInstances',
  ]);
  const mutated = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.polylineLOD.pathInstancing(false));
  compare(await page.locator('canvas').screenshot(), mutated);
  await page.evaluate(() => window.polylineLOD.pathInstancing(true));
  for (let i = 0; i < 5; i++)
    await page.evaluate(async (i) => {
      await window.polylineLOD.mutatePath(`M0 0 H${20 + i} V20 H0 Z`);
      await window.polylineLOD.camera(100000);
      await window.polylineLOD.camera(0);
    }, i);
  const resource = await page.evaluate(
    () => window.polylineLOD.state().resources,
  );
  for (let i = 0; i < 5; i++)
    await page.evaluate(async (i) => {
      await window.polylineLOD.mutatePath(`M0 0 H${25 + i} V20 H0 Z`);
      await window.polylineLOD.camera(100000);
      await window.polylineLOD.camera(0);
    }, i);
  expect(
    await page.evaluate(() => window.polylineLOD.state().resources),
  ).toEqual(resource);
  expect(document[0]).not.toHaveProperty('pathInstancing');
  await page.evaluate(() => window.polylineLOD.removeDuringZoom());
  expect(
    (await page.evaluate(() => window.polylineLOD.state())).document.some(
      (n) => n.id === 'line' && !n.isDeleted,
    ),
  ).toBe(false);
});
test('picking, hover and marquee keep the original Path; camera migration has no duplicate membership', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.seedPaths(2);
    await window.polylineLOD.pathInstancing(true);
  });
  await page.mouse.move(28, 27);
  await expect
    .poll(() =>
      page.evaluate(() => window.polylineLOD.interaction().highlighted),
    )
    .toBe(true);
  await page.mouse.click(28, 27);
  await expect
    .poll(() => page.evaluate(() => window.polylineLOD.interaction().selected))
    .toBe(true);
  await page.evaluate(() => window.polylineLOD.interact('select', false));
  await page.mouse.move(1, 1);
  await page.mouse.down();
  await page.mouse.move(70, 60, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.polylineLOD.interaction().selected))
    .toBe(true);
  await page.evaluate(() => window.polylineLOD.interact('select', false));
  for (const back of [false, true]) {
    const membership = await page.evaluate(
      (back) => window.polylineLOD.movePathCamera(back),
      back,
    );
    expect(membership.flat().filter((id) => id === 'line')).toHaveLength(1);
    expect(membership.flat().filter((id) => id === 'n1')).toHaveLength(1);
    const spatial = await page.evaluate(() =>
      window.polylineLOD.spatialMembership(),
    );
    expect(spatial.flat().filter((id) => id === 'line')).toHaveLength(1);
  }
});
test('WebGL1 uses shared fill geometry with independent instance colors', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl2') return null;
      return (get as any).call(this, type, ...args);
    } as typeof get;
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 30000 });
  await page.evaluate(() => window.polylineLOD.seedPaths(120));
  const full = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.polylineLOD.pathInstancing(true));
  compare(await page.locator('canvas').screenshot(), full);
  expect(await page.evaluate(() => window.polylineLOD.constructors())).toEqual([
    'PathInstances',
  ]);
});

test('native instance pages split above capacity and retire after bounded clearing', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.pathInstancing(true);
    await window.polylineLOD.zoom(0.2);
    await window.polylineLOD.seedPaths(4097);
  });
  expect((await page.evaluate(() => window.polylineLOD.state())).visible).toBe(
    4097,
  );
  expect(await page.evaluate(() => window.polylineLOD.constructors())).toEqual([
    'PathInstances',
    'PathInstances',
  ]);
  await page.evaluate(async () => {
    window.polylineLOD.resetWork();
    await window.polylineLOD.camera(0.1);
  });
  expect(
    (await page.evaluate(() => window.polylineLOD.state())).native.drawcalls,
  ).toBe(3);
  await page.evaluate(() => window.polylineLOD.clearPaths());
  expect(
    (await page.evaluate(() => window.polylineLOD.state())).drawcalls,
  ).toBe(0);
});

test('camera movement uploads no instance rows; one paint or translation edit updates one row', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.polylineLOD.seedPaths(100);
    await window.polylineLOD.pathInstancing(true);
    window.vertexUploads.reset();
    await window.polylineLOD.camera(0.1);
  });
  expect(
    await page.evaluate(() => ({
      calls: window.vertexUploads.calls,
      bytes: window.vertexUploads.bytes,
    })),
  ).toEqual({ calls: 0, bytes: 0 });
  for (const patch of [
    { fills: [{ type: 'solid', value: 'green', opacity: 0.65 }] },
    { x: 77 },
    { opacity: 0.6 },
  ]) {
    await page.evaluate(async (patch) => {
      window.vertexUploads.reset();
      await window.polylineLOD.patch(patch, 'n50');
    }, patch);
    expect(
      await page.evaluate(() => ({
        calls: window.vertexUploads.calls,
        bytes: window.vertexUploads.bytes,
      })),
    ).toEqual({ calls: 1, bytes: 48 });
  }
  const on = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.polylineLOD.pathInstancing(false));
  compare(await page.locator('canvas').screenshot(), on);
});
