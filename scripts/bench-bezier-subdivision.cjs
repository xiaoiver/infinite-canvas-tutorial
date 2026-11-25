// CPU-only render sampling: node scripts/bench-bezier-subdivision.cjs [reference-root] [output.json]
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve, dirname, extname } = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { strict: assert } = require('node:assert');
const ts = require('typescript');

// Compile the pure curve graph in this realm; compilation/parsing is untimed.
function loader(root) {
  const external = createRequire(resolve(root, 'package.json'));
  const cache = new Map();
  return function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const requireLocal = (id) => {
      if (!id.startsWith('.')) return external(id);
      const target = resolve(dirname(file), id);
      return load(extname(target) ? target : target + '.ts');
    };
    new Function(
      'require',
      'module',
      'exports',
      ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    )(requireLocal, module, module.exports);
    return module.exports;
  };
}
function provenance(root) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  return {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
  };
}
function bytes(lines) {
  const hash = createHash('sha256');
  let count = 0;
  for (const line of lines) {
    const buffer = Buffer.alloc(4 + line.length * 16);
    buffer.writeUInt32LE(line.length);
    for (let i = 0; i < line.length; i++) {
      buffer.writeDoubleLE(line[i][0], 4 + i * 16);
      buffer.writeDoubleLE(line[i][1], 12 + i * 16);
    }
    hash.update(buffer);
    count += line.length;
  }
  return { count, sha256: hash.digest('hex') };
}
function percentile(values, fraction) {
  return [...values].sort((a, b) => a - b)[
    Math.ceil(values.length * fraction) - 1
  ];
}
const roots = { current: process.cwd() };
if (process.argv[2]) roots.reference = resolve(process.argv[2]);
const loadFixture = loader(process.cwd());
const { bezierControls } = loadFixture(
  resolve('__tests__/fixtures/bezier-subdivision.ts'),
);
const golden = JSON.parse(
  readFileSync('__tests__/fixtures/bezier-subdivision.json', 'utf8'),
);
const report = {
  node: process.version,
  protocol:
    '64 frozen authored/seeded quadratic/cubic paths; parsed/constructed before timing; 40 warmup batches; 12 alternating samples of 20 fresh flattenPath batches; milliseconds per 64 paths including allocation/GC; no cache, GPU or application-frame claim',
  sources: Object.fromEntries(
    Object.entries(roots).map(([name, root]) => [name, provenance(root)]),
  ),
  baseline: golden,
  results: [],
};
let checksum = 0;
for (const backend of ['core', 'ecs']) {
  const variants = Object.entries(roots).map(([name, root]) => {
    const load = loader(root),
      base = resolve(root, `packages/${backend}/src/utils/curve`);
    const { flattenPath } = load(base + '/adaptive.ts');
    const { CurvePath } = load(base + '/curve-path.ts');
    const { CubicBezierCurve } = load(base + '/cubic-bezier-curve.ts');
    const { QuadraticBezierCurve } = load(base + '/quadratic-bezier-curve.ts');
    const paths = bezierControls().map((controls) => {
      controls.forEach((point) => Object.freeze(point));
      const path = new CurvePath();
      path.add(
        new (controls.length === 4 ? CubicBezierCurve : QuadraticBezierCurve)(
          ...controls,
        ),
      );
      Object.freeze(path.curves);
      return Object.freeze(path);
    });
    // Exact baseline values, not a tolerance or reduced point count.
    for (const { scale, radius, count, sha256 } of golden.cases) {
      assert.deepEqual(bytes(flattenPath(paths, scale, radius)), {
        count,
        sha256,
      });
    }
    return { name, flattenPath, paths };
  });
  for (const [scale, radius] of [
    [0.0625, 0.125],
    [0.5, 1],
    [4, 8],
  ]) {
    const samples = Object.fromEntries(variants.map((v) => [v.name, []]));
    let expected;
    for (const variant of variants) {
      const actual = bytes(variant.flattenPath(variant.paths, scale, radius));
      if (expected) assert.deepEqual(actual, expected);
      expected = actual;
      for (let i = 0; i < 40; i++)
        variant.flattenPath(variant.paths, scale, radius);
    }
    for (let round = 0; round < 12; round++) {
      for (const variant of round % 2 ? [...variants].reverse() : variants) {
        const start = performance.now();
        for (let i = 0; i < 20; i++)
          checksum += variant.flattenPath(variant.paths, scale, radius)[0]
            .length;
        samples[variant.name].push((performance.now() - start) / 20);
      }
    }
    report.results.push({
      backend,
      scale,
      radius,
      paths: 64,
      ...expected,
      samples,
      summary: Object.fromEntries(
        Object.entries(samples).map(([name, values]) => [
          name,
          { p50: percentile(values, 0.5), p95: percentile(values, 0.95) },
        ]),
      ),
    });
  }
}
assert(Number.isFinite(checksum));
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[3]) writeFileSync(process.argv[3], json);
console.log(json);
