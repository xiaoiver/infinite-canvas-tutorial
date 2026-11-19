import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import * as core from '../packages/core/src/utils/path-rendering';
import * as ecs from '../packages/ecs/src/utils/path-rendering';

it('measures settled precision cache hits and alternating levels', () => {
  const results = [];
  for (const [engine, implementation] of [
    ['core', core],
    ['ecs', ecs],
  ] as const) {
    for (const mode of ['stable', 'alternating'] as const) {
      const cache = new implementation.PathGeometryCache();
      const d = 'M0 0 C0 300 300 -300 300 0';
      const iterations = 100000;
      const run = () => {
        let points = 0;
        const start = performance.now();
        for (let i = 0; i < iterations; i++)
          points += cache.get(d, mode === 'stable' ? 2 : i % 2 ? 2 : 16, 1)[0]
            .length;
        return { ms: performance.now() - start, points };
      };
      for (let i = 0; i < 3; i++) run();
      const measured = Array.from({ length: 10 }, run);
      const times = measured.map((x) => x.ms).sort((a, b) => a - b);
      results.push({
        engine,
        mode,
        iterations,
        samples: 10,
        p50Ms: times[5],
        p95Ms: times[9],
        measured,
      });
    }
  }
  mkdirSync('.test-results', { recursive: true });
  writeFileSync(
    '.test-results/path-cache-benchmark.json',
    JSON.stringify(
      { node: process.version, platform: process.platform, results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results.map(({ measured: _raw, ...row }) => row)));
});
