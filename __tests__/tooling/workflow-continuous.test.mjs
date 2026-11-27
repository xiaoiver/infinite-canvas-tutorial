import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeContinuousGesture,
  summarizeWorkflowContinuous,
} from '../../scripts/workflow-continuous-tools.mjs';
import { compareWorkflowInputs } from '../../scripts/workflow-input-tools.mjs';
import { makeContinuousGesture as gesture } from './helpers/continuous-fixture.mjs';

test('reports native work and causal prefix completion without physical-FPS claims', () => {
  const r = summarizeContinuousGesture(gesture());
  assert.equal(r.engineExecutions, 2);
  assert.equal(r.renderedFrames, 2);
  assert.equal(r.inputPrefixCompletionMs.p50, 4);
  assert.equal(r.inputPrefixCompletionMs.p95, 5);
  assert.equal(r.nativeTotals.bufferBytes, 128);
  assert.equal(r.engineFramesOver16_7ms, 0);
  assert.equal(r.coalescedCommands, 0);
});
test('accounts for renderer skipping an intermediate input prefix', () => {
  const g = gesture();
  g.stream.frames.shift();
  const r = summarizeContinuousGesture(g);
  assert.equal(r.engineExecutions, 1);
  assert.equal(r.inputPrefixCompletionMs.p50, 5);
  assert.equal(r.inputPrefixCompletionMs.p95, 15);
});
test('rejects dropped/synthetic input, incomplete prefixes, corrupt clocks, native work and GPU gates', () => {
  for (const mutate of [
    (g) => g.commands.pop(),
    (g) => (g.stream.events[0].input.isTrusted = false),
    (g) => (g.stream.events[0].input.deltaY = -10),
    (g) => (g.stream.events[0].requested.zoom *= 2),
    (g) => (g.stream.events[1].receivedAt = 30),
    (g) => (g.stream.frames[0].elapsed = 10),
    (g) => (g.stream.frames[1].startedAt = 1),
    (g) => (g.stream.frames[1].view.x += 1),
    (g) => (g.stream.final.uiView.zoom *= 2),
    (g) => delete g.stream.frames[0].native.drawcalls,
    (g) => g.validationAfter.errors.push(1280),
    (g) => g.stream.final.surface.width++,
  ]) {
    const g = gesture();
    mutate(g);
    assert.throws(() => summarizeContinuousGesture(g));
  }
});
test('continuous captures remain separate from one-input timing and require completed source/document/teardown proof', () => {
  const make = () => ({
    schema: 1,
    mode: 'continuous-input',
    workload: 'workflow-continuous-wheel',
    count: 24,
    commandCount: 8,
    cadenceMs: 16,
    browser: 'test',
    node: 'test',
    source: { head: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false },
    documentSame: true,
    teardown: 'passed',
    gestures: [
      [0, 'in'],
      [0, 'out'],
      [1, 'in'],
      [1, 'out'],
    ].map(([round, direction]) => ({
      ...gesture(direction === 'in' ? -20 : 20, 8),
      round,
      direction,
    })),
  });
  const c = make();
  assert.equal(summarizeWorkflowContinuous(c).gestures.length, 4);
  assert.throws(() => compareWorkflowInputs(c, c));
  for (const mutate of [
    (c) => (c.source.dirty = true),
    (c) => (c.documentSame = false),
    (c) => (c.teardown = 'pending'),
    (c) => c.gestures.pop(),
  ]) {
    const x = make();
    mutate(x);
    assert.throws(() => summarizeWorkflowContinuous(x));
  }
});
