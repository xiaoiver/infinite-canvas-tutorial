import test from 'node:test';
import assert from 'node:assert/strict';
import {
  strokeUploadMode,
  summarizeStrokeUploads,
} from '../../scripts/stroke-upload-tools.mjs';
import { compareWorkflowInputs } from '../../scripts/workflow-input-tools.mjs';
import { compareReplays } from '../../scripts/camera-replay-tools.mjs';
test('upload mode is explicit and cannot overlap phase/timeline instrumentation', () => {
  assert.equal(strokeUploadMode({}), false);
  assert.equal(strokeUploadMode({ STROKE_UPLOAD_DIAGNOSTIC: '1' }), true);
  for (const v of ['0', 'true', ''])
    assert.throws(() => strokeUploadMode({ STROKE_UPLOAD_DIAGNOSTIC: v }));
  for (const extra of [{ CAMERA_PHASES: '1' }, { CAMERA_TIMELINE_DIR: 'out' }])
    assert.throws(() =>
      strokeUploadMode({ STROKE_UPLOAD_DIAGNOSTIC: '1', ...extra }),
    );
});
const capture = () => ({
  mode: 'stroke-upload-diagnostic',
  source: { dirty: false },
  documentSame: true,
  teardown: 'passed',
  uploadProbeRestored: true,
  rounds: [
    {
      index: 0,
      steps: [
        {
          strokeUploads: {
            loads: 1,
            packModules: 1,
            packedCalls: 1,
            nodeSamples: 1,
            firstNodes: 0,
            unchangedGeometryNodes: 1,
            changedGeometryNodes: 0,
            unchangedGeometryBytes: 52,
            unchangedPayloadBytes: 64,
            placementChanges: 0,
            packedBytes: 64,
            spanUploadBytes: 0,
            capacityUploadBytes: 0,
            capacityAllocations: 0,
          },
        },
      ],
    },
  ],
});
test('summaries require complete restoration and positive hooks; idle frames may have zero work', () => {
  const x = capture();
  assert.equal(summarizeStrokeUploads(x)[0].unchangedPayloadBytes, 64);
  for (const mutate of [
    (x) => (x.mode = undefined),
    (x) => (x.uploadProbeRestored = false),
    (x) => (x.source.dirty = true),
    (x) => (x.rounds[0].steps[0].strokeUploads.loads = 0),
    (x) => (x.rounds[0].steps[0].strokeUploads.packModules = 0),
    (x) => (x.rounds[0].steps[0].strokeUploads.nodeSamples = 2),
  ]) {
    const x = capture();
    mutate(x);
    assert.throws(() => summarizeStrokeUploads(x));
  }
});
test('ordinary comparison entry points reject the upload diagnostic marker', () => {
  const x = { ...capture(), schema: 1, workload: 'workflow-trusted-wheel' };
  assert.throws(() => compareWorkflowInputs(x, x), /Diagnostic/);
  const y = {
    ...capture(),
    schema: 1,
    workload: 'strokes',
    trace: [],
    viewport: {},
    results: [],
  };
  assert.throws(() => compareReplays(y, y), /Diagnostic/);
});
test('resident peak gauges use max while transfer counters sum', () => {
  const x = capture();
  Object.assign(x.rounds[0].steps[0].strokeUploads, {
    resident1m_peakBytes: 512,
    resident1m_hits: 1,
    resident1m_misses: 0,
    resident1m_fallbackNodes: 0,
    resident1m_emptyNodes: 0,
    resident1m_geometryBytes: 64,
  });
  x.rounds[0].steps.push(structuredClone(x.rounds[0].steps[0]));
  const result = summarizeStrokeUploads(x)[0];
  assert.equal(result.resident1m_peakBytes, 512);
  assert.equal(result.resident1m_geometryBytes, 128);
  x.rounds[0].steps[0].strokeUploads.resident1m_peakBytes = 2 * 1024 * 1024;
  assert.throws(() => summarizeStrokeUploads(x));
});
