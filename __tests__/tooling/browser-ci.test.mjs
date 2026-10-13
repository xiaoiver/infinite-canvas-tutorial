import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import BrowserTimingReporter, {
  summarizeTimings,
} from '../../scripts/browser-timing-reporter.mjs';
import { discover } from './helpers/playwright-discovery.mjs';

const require = createRequire(import.meta.url);
// Use ESLint's declared YAML dependency without adding another workspace package.
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const workflow = load(
  readFileSync('.github/workflows/browser-regression.yml', 'utf8'),
);
const matrix = workflow.jobs['browser-tests'].strategy.matrix.include;

for (const browser of ['chromium', 'webkit']) {
  test(`${browser} CI groups cover every discovered test exactly once`, () => {
    const groups = matrix.filter((group) => group.browser === browser);
    const all = discover(groups[0].config);
    const partitioned = groups.flatMap((group) => {
      const ids = discover(group.config, group.shard, group['webkit-group']);
      assert(ids.length > 0, `empty ${browser} group ${group.group}`);
      return ids;
    });
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

test('non-Lottie WebKit suites retain three isolated shards within the existing timeout', () => {
  const other = matrix.filter(
    (group) => group.browser === 'webkit' && group['webkit-group'] === 'other',
  );
  assert.deepEqual(other.map((group) => group.shard).sort(), [
    '1/3',
    '2/3',
    '3/3',
  ]);
  assert.equal(
    new Set(matrix.map((group) => `${group.browser}-${group.group}`)).size,
    matrix.length,
  );
  assert.equal(workflow.jobs['browser-tests']['timeout-minutes'], 25);
  assert.equal(workflow.jobs['browser-tests'].strategy['fail-fast'], false);
});

test('Chromium keeps four single-worker shards without extending the job timeout', () => {
  const chromium = matrix.filter((group) => group.browser === 'chromium');
  assert.deepEqual(chromium.map((group) => group.shard).sort(), [
    '1/4',
    '2/4',
    '3/4',
    '4/4',
  ]);
  const config = readFileSync('playwright.browser.config.ts', 'utf8');
  assert.match(config, /fullyParallel: false/);
  assert.match(config, /workers: 1/);
  assert.match(config, /retries: 0/);
});

test('Playwright times out with reporting headroom and uploads failed-run artifacts', () => {
  const job = workflow.jobs['browser-tests'];
  const step = job.steps.find((step) => step.name === 'Run browser tests');
  const milliseconds = Number(step.run.match(/--global-timeout=(\d+)/)?.[1]);
  assert(milliseconds > 0);
  // Keep three minutes for dependency/browser setup, teardown and upload.
  assert(milliseconds <= (job['timeout-minutes'] - 3) * 60000);
  const upload = job.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  );
  assert.equal(upload.if, '${{ !cancelled() }}');
});

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

test('late worker callbacks cannot overwrite a finalized timeout report', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'browser-ci-late-events-'));
  const cwd = process.cwd();
  const summary = process.env.GITHUB_STEP_SUMMARY;
  try {
    process.chdir(directory);
    process.env.GITHUB_STEP_SUMMARY = path.join(directory, 'summary.md');
    const reporter = new BrowserTimingReporter();
    reporter.onBegin({ projects: [] }, { allTests: () => [1, 2] });
    const sample = (id) => ({
      id,
      location: { file: path.join(directory, 'example.spec.ts') },
      titlePath: () => ['example.spec.ts', id],
    });
    const completed = sample('completed');
    const interrupted = sample('interrupted');
    reporter.onTestBegin(completed, { retry: 0 });
    reporter.onTestEnd(completed, {
      duration: 100,
      retry: 0,
      status: 'passed',
    });
    reporter.onTestBegin(interrupted, { retry: 0 });
    reporter.onEnd({ duration: 1000, status: 'timedout' });
    const files = [
      '.test-results/browser-timings.json',
      '.test-results/browser-timings.md',
      'summary.md',
    ];
    const before = files.map((file) => readFileSync(file, 'utf8'));
    // Simulate a worker completing shutdown after Playwright's run deadline.
    reporter.onTestEnd(interrupted, {
      duration: 1100,
      retry: 0,
      status: 'interrupted',
    });
    reporter.onTestBegin(sample('late'), { retry: 0 });
    reporter.onBegin({ projects: [] }, { allTests: () => [] });
    reporter.onEnd({ duration: 1200, status: 'failed' });
    assert.deepEqual(
      files.map((file) => readFileSync(file, 'utf8')),
      before,
    );
    const report = JSON.parse(before[0]);
    assert.equal(report.status, 'timedout');
    assert.equal(report.duration, 1000);
    assert.deepEqual(
      report.attempts.map(({ status }) => status),
      ['passed'],
    );
    assert.deepEqual(
      report.active.map(({ title }) => title),
      ['example.spec.ts › interrupted'],
    );
    assert.equal(before[1], before[2]);
  } finally {
    process.chdir(cwd);
    if (summary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = summary;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a real Playwright global timeout fails and preserves completed work and the last active test', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'browser-ci-timeout-'));
  try {
    const testModule = JSON.stringify(require.resolve('@playwright/test'));
    const reporter = path.resolve('scripts/browser-timing-reporter.mjs');
    const delayedReporter = path.join(directory, 'delayed-reporter.mjs');
    writeFileSync(
      delayedReporter,
      `import BrowserTimingReporter from ${JSON.stringify(
        pathToFileURL(reporter).href,
      )};
export default class extends BrowserTimingReporter {
  onTestBegin(test, result) {
    // Worker execution can outrun the parent's IPC/checkpoint processing.
    if (test.title === 'interrupted') {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    super.onTestBegin(test, result);
  }
}`,
    );
    writeFileSync(
      path.join(directory, 'playwright.config.cjs'),
      `module.exports = ${JSON.stringify({
        testDir: directory,
        testMatch: 'timeout.spec.js',
        timeout: 0,
        workers: 1,
        retries: 0,
        reporter: [['json', { outputFile: 'results.json' }], [delayedReporter]],
      })};`,
    );
    writeFileSync(
      path.join(directory, 'timeout.spec.js'),
      `const { test, expect } = require(${testModule});
const { readFileSync } = require('node:fs');
test('completed', async () => {});
test('interrupted', async () => {
  // onTestBegin is delivered to the reporter in a different process. Wait for
  // its checkpoint instead of assuming it was written before this body runs.
  await expect.poll(() => {
    const report = JSON.parse(readFileSync('.test-results/browser-timings.json', 'utf8'));
    return {
      status: report.status,
      totalTests: report.totalTests,
      attempts: report.attempts.map(test => test.status),
      active: report.active.map(test => test.title),
    };
  }).toEqual({
    status: 'running',
    totalTests: 3,
    attempts: ['passed'],
    active: ['timeout.spec.js › interrupted'],
  });
  await new Promise(() => {});
});
test('not reached', async () => {});`,
    );
    const result = spawnSync(
      process.execPath,
      [
        require.resolve('@playwright/test/cli'),
        'test',
        '-c',
        'playwright.config.cjs',
        '--global-timeout=10000',
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30000,
        env: {
          ...process.env,
          BROWSER_TEST_GROUP: 'timeout-regression',
          PLAYWRIGHT_JSON_OUTPUT_FILE: '',
          GITHUB_STEP_SUMMARY: path.join(directory, 'summary.md'),
        },
      },
    );
    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const report = JSON.parse(
      readFileSync(path.join(directory, '.test-results/browser-timings.json')),
    );
    const json = JSON.parse(readFileSync(path.join(directory, 'results.json')));
    assert.equal(
      report.status,
      'timedout',
      JSON.stringify({
        report,
        results: json,
        stdout: result.stdout,
        stderr: result.stderr,
      }),
    );
    assert.equal(report.group, 'timeout-regression');
    assert.equal(report.totalTests, 3);
    // Depending on worker shutdown timing, Playwright may emit onTestEnd for
    // the interrupted test, or leave it active. Neither may lose the test or
    // claim it passed; an unstarted test may only be reported as skipped.
    const interrupted = report.attempts.find(({ title }) =>
      title.endsWith(' › interrupted'),
    );
    if (interrupted) {
      assert.equal(interrupted.status, 'interrupted');
      assert.deepEqual(report.active, []);
    } else {
      assert.deepEqual(
        report.active.map(({ title }) => title),
        ['timeout.spec.js › interrupted'],
      );
    }
    assert.deepEqual(
      report.attempts
        .filter(({ status }) => status === 'passed')
        .map(({ title }) => title),
      ['timeout.spec.js › completed'],
    );
    const unstarted = report.attempts.find(({ title }) =>
      title.endsWith(' › not reached'),
    );
    if (unstarted) assert.equal(unstarted.status, 'skipped');
    assert.equal(json.stats.expected, 1);
    assert.equal(json.stats.unexpected, 0, JSON.stringify(json.stats));
    assert.equal(json.stats.skipped, 2, JSON.stringify(json.stats));
    const summary = readFileSync(path.join(directory, 'summary.md'), 'utf8');
    assert(summary.includes('Status: timedout'));
    assert(summary.includes('interrupted'));
    assert.equal(
      readFileSync(
        path.join(directory, '.test-results/browser-timings.md'),
        'utf8',
      ),
      summary,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
