import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import BrowserTimingReporter, {
  summarizeTimings,
} from '../../scripts/browser-timing-reporter.mjs';

const require = createRequire(import.meta.url);
// Use ESLint's declared YAML dependency without adding another workspace package.
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const workflow = load(
  readFileSync('.github/workflows/browser-regression.yml', 'utf8'),
);
const matrix = workflow.jobs['browser-tests'].strategy.matrix.include;

function discover(config, shard = '1/1', group = 'all') {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        require.resolve('@playwright/test/cli'),
        'test',
        '-c',
        config,
        `--shard=${shard}`,
        '--list',
        '--reporter=json',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PLAYWRIGHT_WEBKIT_GROUP: group,
          PLAYWRIGHT_JSON_OUTPUT_FILE: '',
        },
        maxBuffer: 8 * 1024 * 1024,
      },
    ),
  );
  const ids = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) ids.push(spec.id);
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  return ids;
}

for (const browser of ['chromium', 'webkit']) {
  test(`${browser} CI groups cover every discovered test exactly once`, () => {
    const groups = matrix.filter((group) => group.browser === browser);
    const all = discover(groups[0].config);
    const partitioned = groups.flatMap((group) =>
      discover(group.config, group.shard, group['webkit-group']),
    );
    assert(all.length > 100);
    assert.equal(
      new Set(partitioned).size,
      partitioned.length,
      'duplicated tests',
    );
    assert.deepEqual(
      partitioned.sort(),
      all.sort(),
      'missing or unexpected tests',
    );
  });
}

test('the required browser check rejects failures, cancellations and skipped jobs', () => {
  const gate = workflow.jobs['browser-regression'];
  assert.equal(gate.if, '${{ always() }}');
  assert.deepEqual(gate.needs.sort(), ['browser-tests', 'static-checks']);
  const step = gate.steps[0];
  assert.equal(
    step.env.STATIC_CHECKS_RESULT,
    '${{ needs.static-checks.result }}',
  );
  assert.equal(
    step.env.BROWSER_TESTS_RESULT,
    '${{ needs.browser-tests.result }}',
  );
  for (const checks of ['success', 'failure', 'cancelled', 'skipped', '']) {
    for (const browsers of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const result = spawnSync('bash', ['-e', '-c', step.run], {
        env: {
          ...process.env,
          STATIC_CHECKS_RESULT: checks,
          BROWSER_TESTS_RESULT: browsers,
        },
      });
      assert.equal(
        result.status === 0,
        checks === 'success' && browsers === 'success',
      );
    }
  }
});

test('timings separate setup, body and teardown without double-counting nested hooks', () => {
  const reporter = new BrowserTimingReporter();
  const result = { duration: 1000, retry: 0, status: 'passed' };
  reporter.onStepEnd(null, result, {
    title: 'Before Hooks',
    category: 'hook',
    duration: 200,
  });
  reporter.onStepEnd(null, result, {
    title: 'Before Hooks',
    category: 'hook',
    duration: 150,
    parent: {},
  });
  reporter.onStepEnd(null, result, {
    title: 'After Hooks',
    category: 'hook',
    duration: 300,
  });
  const sample = {
    location: { file: `${process.cwd()}/example.spec.ts` },
    titlePath: () => ['', 'test | <slow>'],
  };
  reporter.onTestEnd(sample, result);
  reporter.onTestEnd(sample, { duration: 500, retry: 1, status: 'failed' });
  assert.deepEqual(
    reporter.attempts.map(({ setup, body, teardown }) => ({
      setup,
      body,
      teardown,
    })),
    [
      { setup: 200, body: 500, teardown: 300 },
      { setup: 0, body: 500, teardown: 0 },
    ],
  );
  const summary = summarizeTimings({
    browser: 'webkit',
    group: 'lottie',
    status: 'failed',
    duration: 1600,
    attempts: reporter.attempts,
  });
  assert(summary.includes('| example.spec.ts | 2 | 1.50 |'));
  assert(summary.includes('| passed | 1.00 | 0.20 | 0.50 | 0.30 |'));
  assert(summary.includes('Wall time: 1.60s'));
  assert(!summary.includes('<slow>'));
});
