import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startCameraTimeline } from '../../scripts/camera-timeline.ts';

async function capture(
  kind,
  action,
  { fail, negativeProfile = false, lost = false } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'camera-trace-'));
  const previous = Object.fromEntries(
    ['CAMERA_TIMELINE_DIR', 'CAMERA_TIMELINE_MODE'].map((k) => [
      k,
      process.env[k],
    ]),
  );
  process.env.CAMERA_TIMELINE_DIR = directory;
  if (kind === undefined) delete process.env.CAMERA_TIMELINE_MODE;
  else process.env.CAMERA_TIMELINE_MODE = kind;
  const commands = [];
  let detachCount = 0;
  class Session extends EventEmitter {
    async detach() {
      detachCount++;
    }
    async send(method) {
      commands.push(method);
      if (method === fail) throw new Error('injected failure');
      if (method === 'Performance.getMetrics')
        return { metrics: [{ name: 'Timestamp', value: 1.005 }] };
      if (method === 'Profiler.stop')
        return {
          profile: {
            startTime: 990000,
            endTime: 1030000,
            nodes: [
              {
                id: 1,
                callFrame: { functionName: 'f', url: '', lineNumber: 0 },
              },
            ],
            samples: Array(40).fill(1),
            timeDeltas: [negativeProfile ? -1 : 1000, ...Array(39).fill(1000)],
          },
        };
      if (method === 'Tracing.end') {
        this.emit('Tracing.dataCollected', {
          value: [
            {
              name: 'camera-timeline-test-start',
              ts: 1000000,
              ph: 'I',
              pid: 1,
              tid: 2,
            },
            {
              name: 'camera-timeline-test-end',
              ts: 1020000,
              ph: 'I',
              pid: 1,
              tid: 2,
            },
            {
              name: 'RunTask',
              ts: 1000000,
              dur: 20000,
              ph: 'X',
              pid: 1,
              tid: 2,
            },
          ],
        });
        this.emit('Tracing.tracingComplete', { dataLossOccurred: lost });
      }
      return {};
    }
  }
  const session = new Session();
  let clockRead = 0;
  const page = {
    context: () => ({
      newCDPSession: async () => session,
      browser: () => ({ version: () => 'mock' }),
    }),
    evaluate: async (_fn, name) =>
      typeof name === 'string'
        ? { name, pageMs: name.endsWith('start') ? 0 : 20 }
        : [4, 6][clockRead++],
  };
  const read = (suffix) =>
    JSON.parse(readFileSync(join(directory, `test.${suffix}.json`), 'utf8'));
  try {
    await action({
      page,
      commands,
      read,
      exists: (suffix) => existsSync(join(directory, `test.${suffix}.json`)),
      detached: () => detachCount,
    });
  } finally {
    for (const [k, v] of Object.entries(previous))
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    rmSync(directory, { recursive: true, force: true });
  }
}
const windows = [{ id: 'ecs/0/test', startedAt: 2, completedAt: 12 }];
test('trace capture never starts a profiler, saves an explicit capability, and cleans up once', () =>
  capture('trace', async ({ page, commands, read, detached }) => {
    const timeline = await startCameraTimeline(page, 'test');
    const summary = await timeline.stop(windows);
    await timeline.abort();
    assert.equal(detached(), 1);
    assert(!commands.some((c) => c.startsWith('Profiler.')));
    assert.equal(commands.filter((c) => c === 'Tracing.end').length, 1);
    assert.equal(read('raw').captureKind, 'trace-only');
    assert(!('profile' in read('raw')));
    assert.deepEqual(read('summary'), summary);
    assert.equal(summary.windows[0].taskCoveredMs, 10);
  }));
test('default capture retains profiler validation and output', () =>
  capture(undefined, async ({ page, commands, read, detached }) => {
    const timeline = await startCameraTimeline(page, 'test');
    const summary = await timeline.stop(windows);
    assert(commands.includes('Profiler.start'));
    assert.equal(read('raw').captureKind, 'profile');
    assert.equal(summary.windows[0].sampledResidenceMs, 10);
    assert.equal(detached(), 1);
  }));
test('a rejected CPU capture stays rejected; it never falls back to trace-only', () =>
  capture(
    'profile',
    async ({ page, commands, read, exists, detached }) => {
      const timeline = await startCameraTimeline(page, 'test');
      await assert.rejects(timeline.stop(windows), /Invalid CPU sample delta/);
      assert.equal(read('raw').profile.timeDeltas[0], -1);
      assert.equal(read('raw').captureKind, 'profile');
      assert.equal(exists('summary'), false);
      assert.equal(detached(), 1);
      assert.equal(commands.filter((c) => c === 'Profiler.stop').length, 1);
    },
    { negativeProfile: true },
  ));
test('trace loss retains raw data but rejects a summary and detaches', () =>
  capture(
    'trace',
    async ({ page, read, exists, detached }) => {
      const timeline = await startCameraTimeline(page, 'test');
      await assert.rejects(timeline.stop(windows), /lost events/);
      assert.equal(read('raw').dataLossOccurred, true);
      assert.equal(exists('summary'), false);
      assert.equal(detached(), 1);
    },
    { lost: true },
  ));
test('startup failure ends an active trace and detaches without touching a profiler', () =>
  capture(
    'trace',
    async ({ page, commands, detached }) => {
      await assert.rejects(
        startCameraTimeline(page, 'test'),
        /injected failure/,
      );
      assert.equal(detached(), 1);
      assert(commands.includes('Tracing.end'));
      assert(!commands.some((c) => c.startsWith('Profiler.')));
    },
    { fail: 'Performance.getMetrics' },
  ));
test('invalid diagnostic mode rejects before opening a CDP session', () =>
  capture('typo', async ({ page, commands, detached }) => {
    await assert.rejects(
      startCameraTimeline(page, 'test'),
      /CAMERA_TIMELINE_MODE/,
    );
    assert.deepEqual(commands, []);
    assert.equal(detached(), 0);
  }));
test('ordinary mode never opens a CDP session even with a diagnostic mode variable', () =>
  capture('trace', async ({ page, commands, detached }) => {
    delete process.env.CAMERA_TIMELINE_DIR;
    assert.equal(await startCameraTimeline(page, 'test'), undefined);
    assert.deepEqual(commands, []);
    assert.equal(detached(), 0);
  }));
test('aborting an unfinished trace is idempotent and creates no report', () =>
  capture('trace', async ({ page, commands, exists, detached }) => {
    const timeline = await startCameraTimeline(page, 'test');
    await timeline.abort();
    await timeline.abort();
    assert.equal(detached(), 1);
    assert.equal(commands.filter((c) => c === 'Tracing.end').length, 1);
    assert.equal(exists('raw'), false);
    assert.equal(exists('summary'), false);
  }));
