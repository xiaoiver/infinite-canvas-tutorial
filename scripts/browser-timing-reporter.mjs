import { mkdirSync, writeFileSync, appendFileSync, renameSync } from 'node:fs';
import path from 'node:path';

const seconds = (ms) => (ms / 1000).toFixed(2);
const cell = (value) => String(value).replace(/[\n\r|<>`]/g, ' ');

export function summarizeTimings(report) {
  const files = new Map();
  for (const attempt of report.attempts) {
    const file = files.get(attempt.file) ?? { count: 0, duration: 0 };
    file.count++;
    file.duration += attempt.duration;
    files.set(attempt.file, file);
  }
  return [
    `## Browser timing: ${cell(report.browser)} / ${cell(report.group)}`,
    '',
    `Status: ${cell(report.status)}. Wall time: ${seconds(
      report.duration,
    )}s. Test attempts: ${report.attempts.length}.`,
    ...(report.active?.length
      ? [
          '',
          `Unfinished tests: ${report.active
            .map((test) => cell(test.title))
            .join(', ')}.`,
        ]
      : []),
    '',
    '### Slowest files',
    '',
    '| File | Attempts | Total seconds |',
    '| --- | ---: | ---: |',
    ...[...files]
      .sort((a, b) => b[1].duration - a[1].duration)
      .slice(0, 10)
      .map(
        ([file, timing]) =>
          `| ${cell(file)} | ${timing.count} | ${seconds(timing.duration)} |`,
      ),
    '',
    '### Slowest attempts',
    '',
    '| Test | Status | Total | Setup | Body | Teardown |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...[...report.attempts]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(
        (test) =>
          `| ${cell(test.title)} | ${cell(test.status)} | ${seconds(
            test.duration,
          )} | ${seconds(test.setup)} | ${seconds(test.body)} | ${seconds(
            test.teardown,
          )} |`,
      ),
    '',
    'Durations are seconds. Setup/teardown include hooks and fixtures; file totals sum test attempts, including retries.',
    '',
  ].join('\n');
}

export default class BrowserTimingReporter {
  phases = new WeakMap();
  attempts = [];
  active = new Map();
  finished = false;

  onBegin(config, suite) {
    if (this.finished) return;
    this.startedAt = Date.now();
    this.totalTests = suite.allTests().length;
    this.browser = config.projects[0]?.use.browserName ?? 'chromium';
    this.group =
      process.env.BROWSER_TEST_GROUP ??
      (config.shard ? `${config.shard.current}/${config.shard.total}` : 'all');
    this.checkpoint();
  }

  onTestBegin(test, result) {
    if (this.finished) return;
    this.active.set(test.id, {
      file: path.relative(process.cwd(), test.location.file),
      title: test.titlePath().filter(Boolean).join(' › '),
      retry: result.retry,
    });
    this.checkpoint();
  }

  onStepEnd(_test, result, step) {
    if (this.finished) return;
    // Root hooks already include their nested hooks/fixtures. Counting both
    // would inflate timings and conceal whether browser shutdown is slow.
    if (step.category !== 'hook' || step.parent) return;
    const phases = this.phases.get(result) ?? { setup: 0, teardown: 0 };
    if (step.title === 'Before Hooks') phases.setup += step.duration;
    if (step.title === 'After Hooks') phases.teardown += step.duration;
    this.phases.set(result, phases);
  }

  onTestEnd(test, result) {
    if (this.finished) return;
    this.active.delete(test.id);
    const { setup, teardown } = this.phases.get(result) ?? {
      setup: 0,
      teardown: 0,
    };
    this.attempts.push({
      file: path.relative(process.cwd(), test.location.file),
      title: test.titlePath().filter(Boolean).join(' › '),
      status: result.status,
      retry: result.retry,
      duration: result.duration,
      setup,
      body: Math.max(0, result.duration - setup - teardown),
      teardown,
    });
    this.checkpoint();
  }

  checkpoint(result) {
    // Persist completed attempts and the active test while the runner is alive.
    // A hard cancellation may never call onEnd; the last JSON remains useful.
    if (this.startedAt === undefined && !result) return;
    const report = {
      browser: this.browser ?? 'unknown',
      group: this.group ?? process.env.BROWSER_TEST_GROUP ?? 'all',
      status: result?.status ?? 'running',
      duration: result?.duration ?? Date.now() - this.startedAt,
      totalTests: this.totalTests ?? 0,
      active: [...this.active.values()],
      attempts: this.attempts,
    };
    const directory = '.test-results';
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      `${directory}/browser-timings.json.tmp`,
      JSON.stringify(report, null, 2),
    );
    renameSync(
      `${directory}/browser-timings.json.tmp`,
      `${directory}/browser-timings.json`,
    );
    return report;
  }

  onEnd(result) {
    // A global timeout can finish the run before worker shutdown callbacks.
    // Freeze this snapshot so late events cannot overwrite the final status or
    // make the JSON disagree with the summary. Unfinished tests stay visible.
    if (this.finished) return;
    this.finished = true;
    const report = this.checkpoint(result);
    const summary = summarizeTimings(report);
    writeFileSync('.test-results/browser-timings.md', summary);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    }
  }
}
