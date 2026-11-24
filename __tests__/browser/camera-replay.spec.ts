import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { sameReplayView, replayStrokeNodes } from './fixtures/camera-replay';
import type {} from './fixtures/core-path-instances';
import type { PolylineLODHarness } from './fixtures/polyline-lod';
declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
for (const backend of ['core', 'ecs'] as const)
  test(`${backend} fixed replay labels completed camera frames and preserves document/ownership`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes, { resourceStacks: false });
    await page.goto(
      backend === 'core' ? '/core-path-instances.html' : '/polyline-lod.html',
    );
    await expect(page.locator('#status')).toHaveText('Ready');
    await page.evaluate(
      async ({ backend, nodes }) => {
        if (backend === 'core') {
          window.corePathInstances.strokes(nodes.length);
          window.corePathInstances.enable(true);
        } else {
          await window.polylineLOD.document(nodes);
          await window.polylineLOD.pathInstancing(true);
        }
      },
      { backend, nodes: replayStrokeNodes(24) },
    );
    const document = await page.evaluate(
      (b) =>
        b === 'core'
          ? window.corePathInstances.replayDocument()
          : window.polylineLOD.replayDocument(),
      backend,
    );
    const steps = [
      { x: 0, y: 0, zoom: 0.13 },
      { x: 0, y: 0, zoom: 0.13 },
      { x: 100000, y: 100000, zoom: 0.26 },
      { x: 0, y: 0, zoom: 0.52 },
      { x: 0, y: 0, zoom: 0.13 },
    ];
    for (const [i, view] of steps.entries()) {
      const row = await page.evaluate(
        async ({ backend, view }) =>
          backend === 'core'
            ? window.corePathInstances.replayCamera(view)
            : await window.polylineLOD.replayCamera(view),
        { backend, view },
      );
      expect(sameReplayView(row.frames.at(-1)!.view, view)).toBe(true);
      expect(
        row.frames.every((f) => f.elapsed >= 0 && Number.isFinite(f.elapsed)),
      ).toBe(true);
      expect(row.frames.at(-1)!.data.visible).toBe(i === 2 ? 0 : 24);
      expect(row.frames.at(-1)!.data.visibleIndices).toEqual(
        i === 2 ? [] : Array.from({ length: 24 }, (_, i) => i),
      );
      if (i === 1) expect(row.frames.at(-1)!.data.native.drawcalls).toBe(0);
    }
    expect(
      await page.evaluate(
        (b) =>
          b === 'core'
            ? window.corePathInstances.replayDocument()
            : window.polylineLOD.replayDocument(),
        backend,
      ),
    ).toEqual(document);
    const baseline = await page.evaluate(
      async (b) =>
        b === 'core'
          ? window.corePathInstances.destroy()
          : await window.polylineLOD.destroy(),
      backend,
    );
    if (backend === 'core')
      expect(
        await page.evaluate(() => window.lifecycleProbes.resources()),
      ).toEqual(baseline);
    else
      expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
        [],
      );
    expect(errors).toEqual([]);
  });
