import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/glyph-atlas';

test('Core/ECS batch CPU and allocation sampling', async ({ browser }) => {
  test.setTimeout(240000);
  const results = [];
  const destination =
    process.env.BATCH_ALLOCATIONS_BENCH_OUTPUT ??
    '.test-results/batch-allocations/summary.json';
  const directory = dirname(destination);
  mkdirSync(directory, { recursive: true });
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  writeFileSync(destination, '[]\n');
  const normalize = (url: string) =>
    url.includes('/packages/')
      ? 'packages/' + url.split('/packages/')[1].split('?')[0]
      : url.includes('/node_modules/')
      ? 'node_modules/' + url.split('/node_modules/').at(-1)!.split('?')[0]
      : url.replace('http://127.0.0.1:4175/', '');
  const scope = (stack: any[]) => {
    for (const f of stack)
      if (f.url.includes('BatchManager')) {
        if (['plan', 'planOrdered'].includes(f.functionName)) return 'planning';
        if (['flush', 'flushDrawcalls'].includes(f.functionName))
          return 'submission';
      }
    return null;
  };

  for (const backend of ['core', 'ecs']) {
    const page = await browser.newPage();
    try {
      await page.addInitScript(installProbes);
      await page.goto(`/glyph-atlas.html?backend=${backend}`);
      await expect(page.locator('output')).toHaveText('Ready');
      await page.evaluate(() => window.mixedRenderer.textBatching(true));
      await page.evaluate(() =>
        window.mixedRenderer.configure(1000, 'grouped', false),
      );
      await page.evaluate(() => window.mixedRenderer.measure('edit', 2, 1));
      const before = await page.evaluate(() => window.mixedRenderer.state());
      const session = await page.context().newCDPSession(page);
      await session.send('Profiler.enable');
      await session.send('Profiler.setSamplingInterval', { interval: 1000 });
      await session.send('Profiler.start');
      const cpuFrame = await page.evaluate(() =>
        window.mixedRenderer.measure('edit', 30, 15),
      );
      const cpu = await session.send('Profiler.stop');
      await session.send('Profiler.disable');
      writeFileSync(
        join(directory, `${backend}.cpuprofile`),
        JSON.stringify(cpu.profile),
      );
      await session.send('HeapProfiler.enable');
      await session.send('HeapProfiler.startSampling', {
        samplingInterval: 16384,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      const heapFrame = await page.evaluate(() =>
        window.mixedRenderer.measure('edit', 30, 15),
      );
      const heap = await session.send('HeapProfiler.stopSampling');
      await session.send('HeapProfiler.disable');
      writeFileSync(
        join(directory, `${backend}.heapprofile`),
        JSON.stringify(heap.profile),
      );
      const nodes = new Map(cpu.profile.nodes.map((n) => [n.id, n]));
      const parents = new Map<number, number>();
      for (const n of cpu.profile.nodes)
        for (const child of n.children ?? []) parents.set(child, n.id);
      const frames = (id: number) => {
        const stack = [];
        while (nodes.has(id)) {
          stack.push(nodes.get(id)!.callFrame);
          id = parents.get(id)!;
        }
        return stack;
      };
      const label = (f: any) =>
        `${f.functionName || '(anonymous)'} ${normalize(f.url)}:${
          f.lineNumber + 1
        }`;
      const cpuRows = new Map<string, number>();
      for (let i = 0; i < (cpu.profile.samples?.length ?? 0); i++) {
        const fs = frames(cpu.profile.samples![i]);
        const category = scope(fs);
        if (!category) continue;
        const key = category + ' | ' + label(fs[0]);
        cpuRows.set(
          key,
          (cpuRows.get(key) ?? 0) + (cpu.profile.timeDeltas?.[i] ?? 0),
        );
      }
      const allocations = new Map<string, number>();
      const walk = (n: any, stack: any[]) => {
        const next = [n.callFrame, ...stack];
        const category = scope(next);
        if (category) {
          const key = category + ' | ' + label(n.callFrame);
          allocations.set(key, (allocations.get(key) ?? 0) + n.selfSize);
        }
        for (const c of n.children ?? []) walk(c, next);
      };
      walk(heap.profile.head, []);
      const summary = {
        ...provenance,
        backend,
        cpuFrame,
        heapFrame,
        before,
        cpuP50P95: [cpuFrame.cpuP50, cpuFrame.cpuP95],
        heapP50P95: [heapFrame.cpuP50, heapFrame.cpuP95],
        native: heapFrame.native,
        cpuTop: [...cpuRows].sort((a, b) => b[1] - a[1]).slice(0, 20),
        sdfSampledBytes: [...allocations]
          .filter(
            ([key]) =>
              key.includes('generateBuffer') &&
              key.includes('/drawcalls/SDF.ts'),
          )
          .reduce((sum, [, bytes]) => sum + bytes, 0),
        heapTop: [...allocations].sort((a, b) => b[1] - a[1]).slice(0, 20),
      };
      expect(heapFrame.visible).toBe(1000);
      expect(heapFrame.webglError).toBe(0);
      expect(heapFrame.native).toEqual(cpuFrame.native);
      expect(heapFrame.allocatedBufferBytes).toBe(before.allocatedBufferBytes);
      expect(heapFrame.resources).toEqual(before.resources);
      const baseline = await page.evaluate(() =>
        window.mixedRenderer.destroy(),
      );
      const end = await page.evaluate(() => window.lifecycleProbes.resources());
      if (backend === 'core') expect(end).toEqual(baseline);
      else
        expect(
          end.every((c) => Object.values(c.live).every((n) => n === 0)),
        ).toBe(true);
      results.push({ ...summary, teardownPassed: true });
      writeFileSync(destination, JSON.stringify(results, null, 2) + '\n');
      console.log({
        backend,
        cpuTop: summary.cpuTop.slice(0, 5),
        heapTop: summary.heapTop.slice(0, 5),
      });
      await session.detach();
    } finally {
      await page.close();
    }
  }
});
