import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
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

  onBegin(config) {
    this.browser = config.projects[0]?.use.browserName ?? 'chromium';
    this.group =
      process.env.BROWSER_TEST_GROUP ??
      (config.shard ? `${config.shard.current}/${config.shard.total}` : 'all');
  }

  onStepEnd(_test, result, step) {
    // Root hooks already include their nested hooks/fixtures. Counting both
    // would inflate timings and conceal whether browser shutdown is slow.
    if (step.category !== 'hook' || step.parent) return;
    const phases = this.phases.get(result) ?? { setup: 0, teardown: 0 };
    if (step.title === 'Before Hooks') phases.setup += step.duration;
    if (step.title === 'After Hooks') phases.teardown += step.duration;
    this.phases.set(result, phases);
  }

  onTestEnd(test, result) {
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
  }

  onEnd(result) {
    const report = {
      browser: this.browser,
      group: this.group,
      status: result.status,
      duration: result.duration,
      attempts: this.attempts,
    };
    const directory = '.test-results';
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      `${directory}/browser-timings.json`,
      JSON.stringify(report, null, 2),
    );
    const summary = summarizeTimings(report);
    writeFileSync(`${directory}/browser-timings.md`, summary);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    }
  }
}
