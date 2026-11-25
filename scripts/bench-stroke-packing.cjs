// CPU-only packing diagnostic; includes fresh output allocation, excludes GPU work.
// node scripts/bench-stroke-packing.cjs [reference-checkout] [output.json]
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { strict: assert } = require('node:assert');
const ts = require('typescript');

function source(root) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  return {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
  };
}
function load(root, backend) {
  const text = readFileSync(
    resolve(root, `packages/${backend}/src/utils/stroke-batching.ts`),
    'utf8',
  );
  // Compile this dependency-free repository module in the benchmark's realm.
  // Separate VM contexts would add cross-realm Math and array access overhead.
  const exports = {};
  new Function(
    'exports',
    ts.transpileModule(text, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(exports);
  return exports.packStrokeInstances;
}
function percentile(values, q) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
}
const roots = { current: process.cwd() };
if (process.argv[2]) roots.reference = resolve(process.argv[2]);
const report = {
  node: process.version,
  protocol:
    '256 independent paths/page; 400 warmup calls; 16 alternating samples of 400 fresh page allocations; milliseconds/page including allocation and GC; no GPU or frame-rate claim',
  sources: Object.fromEntries(
    Object.entries(roots).map(([name, root]) => [name, source(root)]),
  ),
  results: [],
};
let checksum = 0;
for (const [backend, stride] of [
  ['core', 1],
  ['ecs', 3],
]) {
  const functions = Object.entries(roots).map(([name, root]) => [
    name,
    load(root, backend),
  ]);
  for (const rows of [2, 12, 48, 'mixed']) {
    const parts = Array.from({ length: 256 }, (_, p) => {
      const count = rows === 'mixed' ? 2 + ((p * 13) % 47) : rows;
      return {
        points: Array.from({ length: (count + 3) * 3 }, (_, i) => (p + i) / 7),
        travel: Array.from({ length: count * stride }, (_, i) => i / 3),
        translationAndOrder: [p, -p, p / 1000],
      };
    });
    const expected = functions[0][1](parts, stride);
    for (const [, fn] of functions) {
      const actual = fn(parts, stride);
      assert.deepEqual(
        new Uint8Array(actual.points.buffer),
        new Uint8Array(expected.points.buffer),
      );
      assert.deepEqual(
        new Uint8Array(actual.travel.buffer),
        new Uint8Array(expected.travel.buffer),
      );
      for (let i = 0; i < 400; i++) fn(parts, stride);
    }
    const samples = Object.fromEntries(functions.map(([name]) => [name, []]));
    for (let round = 0; round < 16; round++) {
      for (const [name, fn] of round % 2
        ? [...functions].reverse()
        : functions) {
        const start = performance.now();
        for (let i = 0; i < 400; i++) {
          const result = fn(parts, stride);
          checksum += result.points[15] + result.travel[stride];
        }
        samples[name].push((performance.now() - start) / 400);
      }
    }
    report.results.push({
      backend,
      stride,
      rows,
      points: expected.points.length,
      bytes: expected.points.byteLength + expected.travel.byteLength,
      samples,
      summary: Object.fromEntries(
        Object.entries(samples).map(([name, values]) => [
          name,
          {
            p50: percentile(values, 0.5),
            p95: percentile(values, 0.95),
          },
        ]),
      ),
    });
  }
}
assert(Number.isFinite(checksum));
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[3]) writeFileSync(process.argv[3], json);
console.log(json);
