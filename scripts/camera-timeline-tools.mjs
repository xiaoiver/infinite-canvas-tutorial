import assert from 'node:assert/strict';

// All times below are milliseconds. Trace and CPU-profile timestamps are µs.
export function overlap(a, b) {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}
export function covered(intervals, window) {
  const clipped = intervals
    .map(([a, b]) => [Math.max(a, window[0]), Math.min(b, window[1])])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0,
    end = -Infinity;
  for (const [a, b] of clipped) {
    total += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return total;
}

export function analyzeCameraTimeline(capture) {
  assert.equal(capture.mode, 'camera-timeline-diagnostic');
  assert.equal(capture.schema, 1);
  assert.equal(capture.dataLossOccurred, false, 'Timeline trace lost events');
  const { traceEvents, profile, anchors, clockBracket, windows } = capture;
  assert.equal(anchors.length, 2, 'Two clock anchors required');
  const matches = anchors.map((a) => {
    const events = traceEvents.filter((e) => e.name === a.name);
    assert.equal(events.length, 1, 'Clock anchor must occur exactly once');
    const event = events[0];
    assert(Number.isFinite(event.ts) && Number.isFinite(a.pageMs));
    return { event, offset: event.ts / 1000 - a.pageMs };
  });
  const clockToleranceMs = 0.2; // Includes page timestamp quantization.
  const [first, last] = matches;
  assert.equal(first.event.pid, last.event.pid, 'Renderer changed');
  assert.equal(first.event.tid, last.event.tid, 'Main thread changed');
  assert(
    Math.abs(first.offset - last.offset) <= clockToleranceMs,
    'Trace/page clock drift',
  );
  const offset = (first.offset + last.offset) / 2;
  assert(
    clockBracket.beforeMs <= clockBracket.afterMs,
    'Invalid clock bracket',
  );
  assert(
    clockBracket.afterMs - clockBracket.beforeMs <= 10,
    'Clock bracket too wide',
  );
  assert(
    clockBracket.timestampMs >= profile.startTime / 1000 &&
      clockBracket.timestampMs <= profile.endTime / 1000,
    'Profile clock does not bracket calibration',
  );
  assert(
    offset >=
      clockBracket.timestampMs - clockBracket.afterMs - clockToleranceMs &&
      offset <=
        clockBracket.timestampMs - clockBracket.beforeMs + clockToleranceMs,
    'Trace/profile clocks do not agree',
  );
  assert(
    profile.startTime <= first.event.ts && profile.endTime >= last.event.ts,
    'Profile does not cover anchors',
  );
  const main = traceEvents.filter(
    (e) =>
      e.pid === first.event.pid &&
      e.tid === first.event.tid &&
      e.ph === 'X' &&
      Number.isFinite(e.ts) &&
      Number.isFinite(e.dur) &&
      e.dur >= 0,
  );
  const tasks = main.filter(
    (e) => e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask',
  );
  assert(tasks.length > 0, 'No renderer main-thread tasks recorded');
  const gc = main.filter((e) => /^(MinorGC|MajorGC|V8\.GC_)/.test(e.name));
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  assert.equal(
    profile.samples.length,
    profile.timeDeltas.length,
    'CPU sample/delta mismatch',
  );
  let time = profile.startTime / 1000;
  const samples = profile.samples.map((id, i) => {
    assert(nodes.has(id), 'Unknown CPU sample node');
    const delta = profile.timeDeltas[i] / 1000;
    assert(Number.isFinite(delta) && delta >= 0, 'Invalid CPU sample delta');
    const start = time;
    time += delta;
    return { interval: [start, time], node: nodes.get(id) };
  });
  assert(time <= profile.endTime / 1000 + 1, 'Samples extend beyond profile');
  const interval = (e) => [e.ts / 1000, (e.ts + e.dur) / 1000];
  return {
    mode: capture.mode,
    clock: {
      offsetMs: offset,
      toleranceMs: clockToleranceMs,
      driftMs: last.offset - first.offset,
      bracketWidthMs: clockBracket.afterMs - clockBracket.beforeMs,
      pid: first.event.pid,
      tid: first.event.tid,
    },
    sampleIntervalMaxMs: Math.max(
      0,
      ...profile.timeDeltas.map((d) => d / 1000),
    ),
    windows: windows.map((w) => {
      assert(
        Number.isFinite(w.startedAt) &&
          Number.isFinite(w.completedAt) &&
          w.completedAt >= w.startedAt,
        'Invalid engine window',
      );
      const range = [w.startedAt + offset, w.completedAt + offset];
      assert(
        range[0] >= first.event.ts / 1000 - clockToleranceMs &&
          range[1] <= last.event.ts / 1000 + clockToleranceMs,
        'Engine window outside anchors',
      );
      const bySample = new Map(),
        byEvent = new Map();
      let sparseSampleOverlapMs = 0,
        sampleIntervalMaxMs = 0;
      for (const { interval: sample, node } of samples) {
        const ms = overlap(sample, range);
        if (!ms) continue;
        const gapMs = sample[1] - sample[0];
        sampleIntervalMaxMs = Math.max(sampleIntervalMaxMs, gapMs);
        // A stalled sampler cannot attribute the whole gap to its next stack.
        if (gapMs > 3) {
          sparseSampleOverlapMs += ms;
          continue;
        }
        const f = node.callFrame;
        const key = `${f.functionName || '(anonymous)'} ${f.url || ''}:${
          f.lineNumber + 1
        }`;
        bySample.set(key, (bySample.get(key) ?? 0) + ms);
      }
      for (const e of main) {
        const ms = overlap(interval(e), range);
        if (ms) byEvent.set(e.name, (byEvent.get(e.name) ?? 0) + ms);
      }
      const rank = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 15);
      const elapsedMs = w.completedAt - w.startedAt;
      const taskCoveredMs = covered(tasks.map(interval), range);
      return {
        ...w,
        elapsedMs,
        taskCoveredMs,
        outsideRecordedTasksMs: Math.max(0, elapsedMs - taskCoveredMs),
        gcCoveredMs: covered(gc.map(interval), range),
        sampleIntervalMaxMs,
        sparseSampleOverlapMs,
        sampledResidenceMs: [...bySample.values()].reduce((a, b) => a + b, 0),
        sampleSelfTop: rank(bySample),
        traceInclusiveTop: rank(byEvent),
      };
    }),
  };
}
