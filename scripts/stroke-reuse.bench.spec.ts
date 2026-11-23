import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/core-path-instances';
import type { PolylineLODHarness } from '../__tests__/browser/fixtures/polyline-lod';
declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}

test('paired Core/ECS 2400 curved strokes: edits, precision and culling reentry', async ({
  browser,
}) => {
  const output =
    process.env.STROKE_REUSE_OUTPUT ?? '.test-results/stroke-reuse.json';
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const results: unknown[] = [];
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  mkdirSync(dirname(output), { recursive: true });
  for (const backend of ['core', 'ecs'] as const) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 760 },
      deviceScaleFactor: 1,
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addInitScript(installProbes, { resourceStacks: false });
      await page.goto(
        backend === 'core' ? '/core-path-instances.html' : '/polyline-lod.html',
      );
      await expect(page.locator('#status')).toHaveText('Ready');
      await page.evaluate(async (backend) => {
        if (backend === 'core') {
          window.corePathInstances.strokes(2400);
          window.corePathInstances.enable(true);
          window.corePathInstances.camera(0, 0.13);
        } else {
          await window.polylineLOD.zoom(0.13);
          await window.polylineLOD.document(
            Array.from({ length: 2400 }, (_, i) => ({
              id: i === 0 ? 'line' : `n${i}`,
              type: 'path',
              x: 20 + (i % 20) * 40,
              y: 20 + Math.floor(i / 20) * 35,
              width: 30,
              height: 30,
              batchable: true,
              zIndex: i * 2,
              d: `M0 15 C${5 + (i % 4)} -10 22 40 30 15`,
              fills: [],
              strokes: [{ type: 'solid', value: '#2563eb' }],
              strokeWidth: 3,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              opacity: 0.65,
            })),
          );
          await window.polylineLOD.pathInstancing(true);
        }
      }, backend);
      const start = await page.evaluate(
        (b) =>
          b === 'core'
            ? window.corePathInstances.state()
            : window.polylineLOD.state(),
        backend,
      );
      expect(start.visible).toBe(2400);
      expect(start.strokePages).toBe(10);
      const steps = [];
      for (const action of [
        ...Array.from({ length: 10 }, (_, i) => ({
          kind: 'edit',
          value: 21 + (i % 2),
        })),
        ...[0.26, 0.52, 0.13, 0.26, 0.52, 0.13].map((value) => ({
          kind: 'zoom',
          value,
        })),
        ...[100000, 0, 100000, 0].map((value) => ({ kind: 'pan', value })),
      ]) {
        const row = await page.evaluate(
          async ({ backend, action }) => {
            if (backend === 'ecs') window.polylineLOD.resetWork();
            const start = performance.now();
            if (backend === 'core') {
              if (action.kind === 'edit')
                window.corePathInstances.translate(0, action.value);
              else
                window.corePathInstances.camera(
                  action.kind === 'pan' ? action.value : 0,
                  action.kind === 'zoom' ? action.value : undefined,
                );
            } else {
              if (action.kind === 'edit')
                await window.polylineLOD.patch({ x: action.value });
              else if (action.kind === 'zoom')
                await window.polylineLOD.zoom(action.value);
              else await window.polylineLOD.camera(action.value);
            }
            const operationWallMs = performance.now() - start;
            const s =
              backend === 'core'
                ? window.corePathInstances.state()
                : window.polylineLOD.state();
            return {
              operationWallMs,
              actualX:
                backend === 'core'
                  ? (s.document[0] as any).attributes.transform.position.x
                  : (s.document.find((n: any) => n.id === 'line') as any).x,
              visible: s.visible,
              strokePages: s.strokePages,
              native: s.native,
              cpu: s.strokeCPU,
              resources: s.resources,
            };
          },
          { backend, action },
        );
        if (action.kind === 'edit') expect(row.actualX).toBe(action.value);
        steps.push({ ...action, ...row });
      }
      const finish = await page.evaluate(
        (b) =>
          b === 'core'
            ? window.corePathInstances.state()
            : window.polylineLOD.state(),
        backend,
      );
      expect(finish.visible).toBe(2400);
      expect(
        finish.document.map((n: any) =>
          backend === 'core' ? n.attributes.d : n.d,
        ),
      ).toEqual(
        start.document.map((n: any) =>
          backend === 'core' ? n.attributes.d : n.d,
        ),
      );
      const baseline = await page.evaluate(
        async (b) =>
          b === 'core'
            ? window.corePathInstances.destroy()
            : window.polylineLOD.destroy(),
        backend,
      );
      if (backend === 'core')
        expect(
          await page.evaluate(() => window.lifecycleProbes.resources()),
        ).toEqual(baseline);
      else
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
      expect(errors).toEqual([]);
      results.push({
        backend,
        initialVisible: start.visible,
        steps,
        teardown: 'passed',
      });
      writeFileSync(
        output,
        JSON.stringify({ ...provenance, results }, null, 2) + '\n',
      );
      console.log(
        JSON.stringify({
          backend,
          steps: steps.map((s) => ({
            kind: s.kind,
            value: s.value,
            visible: s.visible,
            creates: s.native.bufferCreates,
            deletes: s.native.bufferDeletes,
            cpu: s.cpu,
          })),
        }),
      );
    } finally {
      await page.close();
    }
  }
});
