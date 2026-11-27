import assert from 'node:assert/strict';
import { replayStats } from './camera-replay-tools.mjs';
const finite = (v) => Number.isFinite(v) && v >= 0;
const close = (a, b) => Math.abs(a - b) <= 1e-4;
const match = (a, b) =>
  close(a.x, Math.fround(b.x)) &&
  close(a.y, Math.fround(b.y)) &&
  Math.abs(a.zoom - b.zoom) <= 1e-6 * Math.max(1, Math.abs(b.zoom));
const timing = (xs) => ({
  ...replayStats(xs),
  total: xs.reduce((a, b) => a + b, 0),
});
/** A stream qualifies actual receipt/prefix progress, not one frame per command. */
export function summarizeContinuousGesture(g) {
  const { events, frames, initial, final } = g.stream;
  assert(
    events.length > 0 && frames.length > 0,
    'Missing continuous input/frame observations',
  );
  assert.equal(g.commands.length, g.commandCount, 'Incomplete host commands');
  assert(events.length <= g.commands.length, 'Unexpected extra wheel receipts');
  for (const [i, c] of g.commands.entries()) {
    assert.equal(c.sequence, i + 1);
    assert.equal(c.scheduledAfterMs, i * g.cadenceMs);
    assert(
      finite(c.dispatchedAfterMs) &&
        finite(c.acknowledgedAfterMs) &&
        c.acknowledgedAfterMs >= c.dispatchedAfterMs,
      'Invalid host clocks',
    );
  }
  const deltaSum = events.reduce((sum, e) => sum + e.input.deltaY, 0);
  assert.equal(
    deltaSum,
    g.commandCount * g.deltaY,
    'Delivered deltas differ from host commands',
  );
  let requested = { ...initial };
  const direction = Math.sign(g.deltaY);
  assert.equal(
    direction,
    g.direction === 'in' ? -1 : 1,
    'Gesture direction differs',
  );
  assert.deepEqual(g.initial.view, initial, 'Initial view differs');
  for (const [i, e] of events.entries()) {
    assert.equal(e.sequence, i + 1);
    assert(finite(e.receivedAt));
    if (i)
      assert(e.receivedAt >= events[i - 1].receivedAt, 'Receipt order differs');
    assert.equal(e.input.isTrusted, true, 'Trusted input required');
    assert.equal(e.input.deltaMode, 0);
    assert.equal(e.input.deltaX, 0);
    assert.equal(
      Math.sign(e.input.deltaY),
      direction,
      'Monotonic gesture required',
    );
    assert.equal(e.input.clientX, g.anchor.clientX);
    assert.equal(e.input.clientY, g.anchor.clientY);
    const zoom = Math.min(
      2,
      Math.max(
        0.018,
        requested.zoom *
          Math.exp(-Math.max(-100, Math.min(100, e.input.deltaY)) * 0.0025),
      ),
    );
    requested = {
      x:
        requested.x +
        g.anchor.viewportX / requested.zoom -
        g.anchor.viewportX / zoom,
      y:
        requested.y +
        g.anchor.viewportY / requested.zoom -
        g.anchor.viewportY / zoom,
      zoom,
    };
    assert(
      Math.abs(e.requested.x - requested.x) < 1e-7 &&
        Math.abs(e.requested.y - requested.y) < 1e-7 &&
        Math.abs(e.requested.zoom - requested.zoom) < 1e-10,
      'Input target differs',
    );
    assert(
      i === 0 || e.requested.zoom !== events[i - 1].requested.zoom,
      'Clamped/nonunique stream targets cannot establish prefix completion',
    );
  }
  const nativeKeys = [
    'bufferCreates',
    'bufferDeletes',
    'bufferAllocations',
    'bufferUploads',
    'bufferBytes',
    'uniformUploads',
    'uniformBytes',
    'drawcalls',
    'indices',
    'arrayVertices',
  ];
  const matchedPrefixes = [];
  for (const [i, f] of frames.entries()) {
    for (const k of [
      'startedAt',
      'completedAt',
      'elapsed',
      'observedAt',
      'observationMs',
    ])
      assert(finite(f[k]), 'Missing frame clock');
    assert(
      f.startedAt <= f.completedAt &&
        f.completedAt <= f.observedAt &&
        Math.abs(f.completedAt - f.startedAt - f.elapsed) < 1e-3 &&
        Math.abs(f.observedAt - f.completedAt - f.observationMs) < 1e-3,
      'Inconsistent completed frame clocks',
    );
    if (i)
      assert(
        f.startedAt >= frames[i - 1].completedAt,
        'Overlapping engine executions',
      );
    assert(
      nativeKeys.every(
        (k) => Number.isSafeInteger(f.native[k]) && f.native[k] >= 0,
      ),
      'Incomplete native work',
    );
    let prefix = match(f.view, initial) ? 0 : -1;
    for (const e of events)
      if (e.receivedAt <= f.completedAt && match(f.view, e.requested))
        prefix = e.sequence;
    assert(prefix >= 0, 'Completed camera is not a received input prefix');
    if (i)
      assert(prefix >= matchedPrefixes[i - 1], 'Camera prefix moved backward');
    matchedPrefixes.push(prefix);
  }
  const last = events.at(-1),
    settled = frames.at(-1);
  assert(
    settled.startedAt >= last.receivedAt && match(settled.view, last.requested),
    'Final stream target did not complete after its receipt',
  );
  assert.equal(matchedPrefixes.at(-1), events.length);
  assert(
    Math.abs(final.uiView.x - requested.x) < 1e-7 &&
      Math.abs(final.uiView.y - requested.y) < 1e-7 &&
      Math.abs(final.uiView.zoom - requested.zoom) < 1e-10,
    'UI final target differs',
  );
  assert.deepEqual(
    g.initial.surface,
    final.surface,
    'Surface changed during input',
  );
  for (const gate of [g.validationBefore, g.validationAfter]) {
    assert(gate && finite(gate.elapsed));
    assert.deepEqual(gate.errors, [], 'GPU validation failed');
  }
  const completion = [];
  for (const e of events) {
    const i = frames.findIndex(
      (f, i) => f.startedAt >= e.receivedAt && matchedPrefixes[i] >= e.sequence,
    );
    assert(i >= 0, 'Input prefix not completed');
    completion.push(frames[i].completedAt - e.receivedAt);
  }
  const rendered = frames.filter((f) => f.native.drawcalls > 0);
  assert(rendered.length > 0, 'No native rendering');
  const gaps = frames
    .slice(1)
    .map((f, i) => f.completedAt - frames[i].completedAt);
  return {
    round: g.round,
    direction: g.direction,
    hostCommands: g.commands.length,
    receivedEvents: events.length,
    coalescedCommands: g.commands.length - events.length,
    deltaSum,
    deliveredDurationMs: last.receivedAt - events[0].receivedAt,
    engineExecutions: frames.length,
    renderedFrames: rendered.length,
    engineMs: timing(frames.map((f) => f.elapsed)),
    renderedEngineMs: timing(rendered.map((f) => f.elapsed)),
    completedFrameIntervalMs: gaps.length ? timing(gaps) : undefined,
    inputPrefixCompletionMs: timing(completion),
    lastInputToTargetFrameMs: settled.completedAt - last.receivedAt,
    engineFramesOver16_7ms: frames.filter((f) => f.elapsed > 1000 / 60).length,
    nativeTotals: Object.fromEntries(
      nativeKeys.map((k) => [
        k,
        frames.reduce((sum, f) => sum + f.native[k], 0),
      ]),
    ),
    visibleBefore: g.initial.state.visible,
    visibleAfter: final.state.visible,
    allocatedBufferBytesBefore: g.initial.state.allocatedBufferBytes,
    allocatedBufferBytesAfter: final.state.allocatedBufferBytes,
  };
}
export function summarizeWorkflowContinuous(c) {
  assert.equal(c.schema, 1);
  assert.equal(c.mode, 'continuous-input');
  assert.equal(c.workload, 'workflow-continuous-wheel');
  assert([24, 2400].includes(c.count));
  assert.equal(c.source.dirty, false, 'Clean source required');
  assert(
    /^[a-f0-9]{40}$/.test(c.source.head) &&
      /^[a-f0-9]{40}$/.test(c.source.tree),
  );
  assert.equal(
    c.commandCount,
    c.count === 24 ? 8 : 40,
    'Command protocol differs',
  );
  assert.equal(c.cadenceMs, 16, 'Host cadence protocol differs');
  assert(
    c.gestures.every(
      (g) => g.commandCount === c.commandCount && g.cadenceMs === c.cadenceMs,
    ),
    'Gesture command protocol differs',
  );
  assert.equal(c.documentSame, true, 'Document changed');
  assert.equal(c.teardown, 'passed', 'Teardown incomplete');
  assert.deepEqual(
    c.gestures.map((g) => [g.round, g.direction]),
    [
      [0, 'in'],
      [0, 'out'],
      [1, 'in'],
      [1, 'out'],
    ],
  );
  return {
    source: c.source,
    count: c.count,
    browser: c.browser,
    node: c.node,
    gestures: c.gestures.map(summarizeContinuousGesture),
  };
}
