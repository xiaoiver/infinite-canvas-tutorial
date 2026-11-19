import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { installVertexUploadProbe } from './fixtures/vertex-uploads';
import type {} from './fixtures/core-path-instances';
import { PNG } from 'pngjs';

function compare(a: Buffer, b: Buffer) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  expect([x.width, x.height]).toEqual([y.width, y.height]);
  let ink = 0,
    difference = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] < 240 || x.data[i + 1] < 240 || x.data[i + 2] < 240) ink++;
    if ([0, 1, 2, 3].some((c) => Math.abs(x.data[i + c] - y.data[i + c]) > 3))
      difference++;
  }
  expect(ink).toBeGreaterThan(100);
  expect(difference).toBeLessThan(20);
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(installVertexUploadProbe);
  await page.goto('/core-path-instances.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  const baseline = await page.evaluate(() =>
    window.corePathInstances.destroy(),
  );
  // The external device retains its startup fallback resources on destroy.
  // All resources allocated after that baseline must be released.
  expect(await page.evaluate(() => window.lifecycleProbes.resources())).toEqual(
    baseline,
  );
  expect(errors).toEqual([]);
});
test('default off, ordered repeated fills, camera uploads and complete raster exports', async ({
  page,
}) => {
  await page.evaluate(() => window.corePathInstances.seed(600));
  const off = await page.evaluate(() => window.corePathInstances.state());
  expect(off.enabled).toBe(false);
  expect(off.visible).toBe(600);
  expect(off.native.drawcalls).toBe(601);
  const full = await page.locator('canvas').screenshot();
  await page.evaluate(() => {
    window.corePathInstances.enable(true);
    window.corePathInstances.camera(0.2);
  });
  const on = await page.evaluate(() => window.corePathInstances.state());
  expect(on.document).toEqual(off.document);
  expect(on.native.drawcalls).toBe(2);
  expect(on.instances).toBe(1);
  expect(on.native.indices).toBe(5400);
  expect(on.vertex.calls).toBe(0);
  await page.evaluate(() => window.corePathInstances.camera(0));
  compare(await page.locator('canvas').screenshot(), full);
  for (const grid of [false, true]) {
    const enabled = await page.evaluate(
      (g) => window.corePathInstances.export(g),
      grid,
    );
    expect(
      (await page.evaluate(() => window.corePathInstances.state())).instances,
    ).toBe(1);
    await page.evaluate(() => window.corePathInstances.enable(false));
    const disabled = await page.evaluate(
      (g) => window.corePathInstances.export(g),
      grid,
    );
    expect(enabled).toBe(disabled);
    await page.evaluate(() => window.corePathInstances.enable(true));
  }
});
test('affine overlap, holes, painter barriers, and unsupported strokes retain pixels', async ({
  page,
}) => {
  for (const barrier of [false, true]) {
    await page.evaluate(
      (b) => window.corePathInstances.scene(b, true),
      barrier,
    );
    const full = await page.locator('canvas').screenshot();
    await page.evaluate(() => window.corePathInstances.enable(true));
    compare(await page.locator('canvas').screenshot(), full);
    expect(
      (await page.evaluate(() => window.corePathInstances.state())).instances,
    ).toBe(1);
    await page.evaluate(() =>
      window.corePathInstances.mutate(1, { stroke: '#7c3aed', strokeWidth: 4 }),
    );
    const on = await page.locator('canvas').screenshot();
    await page.evaluate(() => window.corePathInstances.enable(false));
    compare(await page.locator('canvas').screenshot(), on);
  }
});
test('row edits, geometry keys, visibility, culling reentry and same-frame removal', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.corePathInstances.seed(20);
    window.corePathInstances.enable(true);
  });
  for (const change of [
    { fill: '#16a34a' },
    { translateX: 33 },
    { opacity: 0.33 },
    { fillOpacity: 0.42 },
  ]) {
    await page.evaluate((c) => window.corePathInstances.mutate(2, c), change);
    const s = await page.evaluate(() => window.corePathInstances.state());
    expect(s.vertex.calls).toBe(1);
    expect(s.vertex.bytes).toBe(48);
  }
  for (let i = 0; i < 6; i++) {
    await page.evaluate(
      (i) =>
        window.corePathInstances.mutate(2, { d: `M0 0 H${16 + i} V20 H0 Z` }),
      i,
    );
    expect(
      (await page.evaluate(() => window.corePathInstances.state())).instances,
    ).toBe(2);
  }
  await page.evaluate(() =>
    window.corePathInstances.mutate(2, { visible: false }),
  );
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).visible,
  ).toBe(19);
  await page.evaluate(() =>
    window.corePathInstances.mutate(2, { visible: true }),
  );
  const resources = (
    await page.evaluate(() => window.corePathInstances.state())
  ).resources;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.corePathInstances.camera(3000));
    expect(
      (await page.evaluate(() => window.corePathInstances.state())).visible,
    ).toBe(0);
    await page.evaluate(() => window.corePathInstances.camera(0));
    expect(
      (await page.evaluate(() => window.corePathInstances.state())).resources,
    ).toEqual(resources);
  }
  await page.evaluate(() => window.corePathInstances.remove(2));
  const on = await page.locator('canvas').screenshot();
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).visible,
  ).toBe(19);
  await page.evaluate(() => window.corePathInstances.enable(false));
  compare(await page.locator('canvas').screenshot(), on);
});
test('original geometry remains pickable; alternating geometry never crosses painter order', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.corePathInstances.seed(600, 2);
    window.corePathInstances.enable(true);
  });
  const s = await page.evaluate(() => window.corePathInstances.state());
  expect(s.native.drawcalls).toBe(601);
  expect(s.instances).toBe(0);
  expect(await page.evaluate(() => window.corePathInstances.pick(5, 5))).toBe(
    0,
  );
  expect(await page.evaluate(() => window.corePathInstances.pick(10, 18))).toBe(
    -1,
  );
  await page.evaluate(() => window.corePathInstances.enable(false));
  expect(await page.evaluate(() => window.corePathInstances.pick(5, 5))).toBe(
    0,
  );
});
test('4097 native instances form two pages and retire after deletion', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.corePathInstances.seed(4097);
    window.corePathInstances.camera(0, 0.2);
    window.corePathInstances.enable(true);
  });
  const s = await page.evaluate(() => window.corePathInstances.state());
  expect(s.visible).toBe(4097);
  expect(s.instances).toBe(1);
  expect(s.planned).toBe(2);
  expect(s.native.drawcalls).toBe(3);
  await page.evaluate(() => window.corePathInstances.clear());
  const empty = await page.evaluate(() => window.corePathInstances.state());
  expect(empty.instances).toBe(0);
  expect(empty.native.drawcalls).toBe(1);
  expect(empty.resources[0].live.Buffer).toBe(3);
});
test('WebGL1 supports independent per-instance paint', async ({ page }) => {
  await page.evaluate(() => window.corePathInstances.destroy());
  await page.goto('/core-path-instances.html?webgl1=1&dpr=2');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.corePathInstances.scene(false, true));
  const full = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.corePathInstances.enable(true));
  compare(await page.locator('canvas').screenshot(), full);
});

test('parent transforms keep pixels, culling and picking synchronized; capture failure restores screen plan', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.corePathInstances.seed(20);
    window.corePathInstances.enable(true);
    window.corePathInstances.parent(60, 1.4);
  });
  const screen = await page.locator('canvas').screenshot();
  expect(await page.evaluate(() => window.corePathInstances.pick(65, 5))).toBe(
    0,
  );
  await page.evaluate(() => window.corePathInstances.enable(false));
  compare(await page.locator('canvas').screenshot(), screen);
  await page.evaluate(() => window.corePathInstances.enable(true));
  expect(await page.evaluate(() => window.corePathInstances.failExport())).toBe(
    'injected capture failure',
  );
  await page.evaluate(() => window.corePathInstances.camera(0.2));
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).native
      .drawcalls,
  ).toBe(2);
  await page.evaluate(() => window.corePathInstances.parent(3000, 1.4));
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).visible,
  ).toBe(0);
  await page.evaluate(() => window.corePathInstances.parent(60, 1.4));
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).visible,
  ).toBe(20);
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).spatial,
  ).toEqual(Array(20).fill(1));
  await page.evaluate(() => window.corePathInstances.camera(0));
  compare(await page.locator('canvas').screenshot(), screen);
  await page.evaluate(() => window.corePathInstances.export(true));
});

test('rectangles batch within each run, preserve Path barriers and retire a shared binding safely', async ({
  page,
}) => {
  await page.evaluate(() => window.corePathInstances.sdfScene());
  const full = await page.locator('canvas').screenshot();
  await page.evaluate(() => {
    window.corePathInstances.enable(true);
    window.corePathInstances.batchable(true);
  });
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).native
      .drawcalls,
  ).toBe(4);
  compare(await page.locator('canvas').screenshot(), full);
  await page.evaluate(() => window.corePathInstances.remove(2));
  expect(
    (await page.evaluate(() => window.corePathInstances.state())).native
      .drawcalls,
  ).toBe(2);
  const batched = await page.locator('canvas').screenshot();
  await page.evaluate(() => {
    window.corePathInstances.batchable(false);
    window.corePathInstances.enable(false);
  });
  compare(await page.locator('canvas').screenshot(), batched);
});

test('unsupported wireframe fallback and empty paths release geometry without reviving old draws', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.corePathInstances.seed(20);
    window.corePathInstances.enable(true);
    window.corePathInstances.mutate(2, { wireframe: true });
  });
  const wire = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.corePathInstances.enable(false));
  compare(await page.locator('canvas').screenshot(), wire);
  await page.evaluate(() => {
    window.corePathInstances.enable(true);
    window.corePathInstances.mutate(2, { d: '' });
  });
  const empty = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.corePathInstances.enable(false));
  compare(await page.locator('canvas').screenshot(), empty);
  await page.evaluate(() =>
    window.corePathInstances.mutate(2, { d: 'M0 0 H20 V20 Z' }),
  );
  const restored = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.corePathInstances.enable(true));
  compare(await page.locator('canvas').screenshot(), restored);
});
