import assert from 'node:assert/strict';
import { compareWorkflowInputs } from './workflow-input-tools.mjs';
import { compareReplays, replayStats } from './camera-replay-tools.mjs';
import { qualifyStrokeTexture } from './stroke-texture-bench-tools.mjs';

const omit = (o, keys) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const groups = (c) => ('rounds' in c ? [{ backend: 'ecs', ...c }] : c.results);
const rows = (c) =>
  groups(c).flatMap((g) =>
    g.rounds.map((r) => ({
      backend: g.backend,
      round: r.index,
      steps: r.steps,
      initial: r.initial,
      frames: r.steps.flatMap((s) => s.frames),
    })),
  );
function qualify(c) {
  assert.equal(
    typeof c.strokeTexture,
    'boolean',
    'Explicit texture scope required',
  );
  assert(['strokes', 'workflow-trusted-wheel'].includes(c.workload));
  // Preserve canonical clock, document, GPU gate, source and teardown checks.
  (c.workload === 'strokes' ? compareReplays : compareWorkflowInputs)(c, c);
  qualifyStrokeTexture(c);
  for (const { frames } of rows(c))
    for (const { data } of frames) {
      assert(
        data.native &&
          Object.values(data.native).every(
            (v) => Number.isSafeInteger(v) && v >= 0,
          ),
      );
      assert(
        [
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
        ].every((k) => Number.isSafeInteger(data.native[k])),
        'Missing native transfer/submission counters',
      );
    }
}
function semanticData(f) {
  const d = omit(f.data, [
    'native',
    'textureNative',
    'strokeTexturePages',
    'resources',
  ]);
  // Timings are outcomes; precision/geometry and phase call counts are work.
  if (d.cpu) d.cpu = omit(d.cpu, ['precisionMs', 'geometryMs']);
  if (d.phases)
    d.phases = Object.fromEntries(
      Object.entries(d.phases).map(([k, v]) => [k, { calls: v.calls }]),
    );
  if (d.state)
    d.state = omit(d.state, [
      'strokeTexture',
      'resources',
      'allocatedBufferBytes',
    ]);
  return { view: f.view, data: d };
}
function otherResources(f) {
  return (f.data.resources ?? f.data.state?.resources)?.map((r) => ({
    side: r.side,
    live: omit(r.live, ['Buffer', 'Texture']),
  }));
}
/** Exact same-source experiment; allows representation work to change explicitly. */
export function compareStrokeTextures(a, b, { repeat = false } = {}) {
  qualify(a);
  qualify(b);
  if (repeat)
    assert.equal(a.strokeTexture, b.strokeTexture, 'Repeat mode differs');
  for (const k of [
    'schema',
    'workload',
    'viewport',
    'browser',
    'node',
    'source',
    'count',
    'dpr',
    'trace',
    'traceHash',
    'deltas',
  ])
    assert.deepEqual(a[k], b[k], `Capture ${k} differs`);
  const x = rows(a),
    y = rows(b);
  assert.equal(x.length, y.length, 'Backend/round count differs');
  let matchedFrames = 0;
  for (let i = 0; i < x.length; i++) {
    assert.equal(x[i].backend, y[i].backend);
    assert.equal(x[i].round, y[i].round);
    assert.equal(x[i].steps.length, y[i].steps.length);
    assert.deepEqual(
      x[i].initial?.demo.view,
      y[i].initial?.demo.view,
      'Initial camera differs',
    );
    if (x[i].initial?.state || y[i].initial?.state)
      assert.deepEqual(
        omit(x[i].initial.state, [
          'strokeTexture',
          'resources',
          'allocatedBufferBytes',
        ]),
        omit(y[i].initial.state, [
          'strokeTexture',
          'resources',
          'allocatedBufferBytes',
        ]),
        'Initial semantic state differs',
      );
    for (let j = 0; j < x[i].steps.length; j++) {
      const s = x[i].steps[j],
        t = y[i].steps[j];
      for (const k of ['id', 'input', 'requested'])
        assert.deepEqual(s[k], t[k], k);
      assert.equal(
        s.frames.length,
        t.frames.length,
        'Preparation frames differ',
      );
      for (let n = 0; n < s.frames.length; n++) {
        const f = s.frames[n],
          g = t.frames[n],
          key = `${x[i].backend}/${i}/${j}/${n}`;
        assert.deepEqual(
          semanticData(f),
          semanticData(g),
          `Semantics/work differ: ${key}`,
        );
        assert.deepEqual(
          otherResources(f),
          otherResources(g),
          `Non-buffer/texture resources differ: ${key}`,
        );
        for (const k of [
          'drawcalls',
          'indices',
          'arrayVertices',
          'uniformUploads',
          'uniformBytes',
        ])
          assert.equal(
            f.data.native[k],
            g.data.native[k],
            `Native ${k} differs: ${key}`,
          );
        if (repeat) {
          assert.equal(
            f.data.strokeTexturePages,
            g.data.strokeTexturePages,
            `Repeat active texture draws differ: ${key}`,
          );
          assert.deepEqual(
            f.data.native,
            g.data.native,
            `Repeat native work differs: ${key}`,
          );
          assert.deepEqual(
            f.data.textureNative,
            g.data.textureNative,
            `Repeat texture work differs: ${key}`,
          );
          assert.deepEqual(
            f.data.resources,
            g.data.resources,
            `Repeat resources differ: ${key}`,
          );
          assert.deepEqual(
            f.data.state?.resources,
            g.data.state?.resources,
            `Repeat state resources differ: ${key}`,
          );
          assert.equal(
            f.data.state?.allocatedBufferBytes,
            g.data.state?.allocatedBufferBytes,
            `Repeat storage differs: ${key}`,
          );
        }
        matchedFrames++;
      }
    }
  }
  return {
    matchedFrames,
    parity: repeat
      ? 'all recorded work/storage'
      : 'semantics, call counts, draws, uniforms, other resources',
  };
}
function resourceRanges(frames) {
  const samples = frames.map(
    (f) => f.data.resources ?? f.data.state?.resources,
  );
  return samples[0]?.map((r, i) => ({
    side: r.side,
    live: Object.fromEntries(
      Object.keys(r.live).map((k) => [
        k,
        [
          Math.min(...samples.map((s) => s[i].live[k])),
          Math.max(...samples.map((s) => s[i].live[k])),
        ],
      ]),
    ),
  }));
}
export function summarizeStrokeTextures(c) {
  qualify(c);
  return rows(c).map((r) => {
    const totals = (key) =>
      Object.fromEntries(
        Object.keys(r.frames[0].data[key]).map((k) => [
          k,
          r.frames.reduce((sum, f) => sum + f.data[key][k], 0),
        ]),
      );
    const range = (fn) => [
      Math.min(...r.frames.map(fn)),
      Math.max(...r.frames.map(fn)),
    ];
    const timing = (values) => ({
      ...replayStats(values),
      total: values.reduce((a, b) => a + b, 0),
    });
    const textureTransfers = omit(totals('textureNative'), [
      'rgba32fBytesPeak',
      'rgba32fBytesLive',
    ]);
    const native = totals('native');
    const knownTransferBytes = native.bufferBytes + textureTransfers.typedBytes;
    return {
      backend: r.backend,
      round: r.round,
      frames: r.frames.length,
      engine: timing(r.frames.map((f) => f.elapsed)),
      inputOrOperation: timing(
        r.steps.map((s) => s.inputToFrameMs ?? s.operationToFrameMs),
      ),
      readiness: timing(
        r.steps.map((s) => s.inputToResultMs ?? s.operationToResultMs),
      ),
      observation: timing(r.frames.map((f) => f.observationMs)),
      native,
      textureTransfers,
      knownTransferBytes,
      // DOM/PBO/source-offset calls have unknown transfer extent in this probe.
      totalTransferBytes:
        textureTransfers.domUploads || textureTransfers.offsetUploads
          ? undefined
          : knownTransferBytes,
      floatPeak: Math.max(
        ...r.frames.map((f) => f.data.textureNative.rgba32fBytesPeak),
      ),
      floatLive: range((f) => f.data.textureNative.rgba32fBytesLive),
      bufferLive: r.frames[0].data.state
        ? range((f) => f.data.state.allocatedBufferBytes)
        : undefined,
      combinedPostFrameLogical: r.frames[0].data.state
        ? range(
            (f) =>
              f.data.state.allocatedBufferBytes +
              f.data.textureNative.rgba32fBytesLive,
          )
        : undefined,
      // Neither this sum at a frame boundary nor floatPeak is physical GPU memory.
      resources: resourceRanges(r.frames),
      textureDraws: range((f) => f.data.strokeTexturePages),
      visible: range((f) => f.data.visible ?? f.data.state.visible.cards),
      drawcalls: range((f) => f.data.native.drawcalls),
      indices: range((f) => f.data.native.indices),
      arrayVertices: range((f) => f.data.native.arrayVertices),
    };
  });
}
