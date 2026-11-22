import { DOMAdapter, Text, Rect, Path } from '../../packages/core/src';
import { Drawcall } from '../../packages/core/src/drawcalls/Drawcall';
import { PathInstances } from '../../packages/core/src/drawcalls/PathInstances';
import * as layoutSnapshots from '../../packages/core/src/utils/text-layout-snapshot';
import { textLayoutSnapshotContract } from '../contracts/text-layout-snapshot';
import { createCanvas } from 'canvas';
import { TextBatch } from '../../packages/core/src/drawcalls/TextBatch';
import { SDFText } from '../../packages/core/src/drawcalls/SDFText';
import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
import * as helpers from '../../packages/core/src/utils/text-batching';
import { textBatchingContract } from '../contracts/text-batching';
textBatchingContract(helpers);
beforeEach(() => {
  jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation((w = 1, h = 1) => createCanvas(w, h) as any);
});
afterEach(() => jest.restoreAllMocks());
function label(content = 'AB') {
  const t = new Text({
    content,
    fontSize: 12,
    fontFamily: 'sans-serif',
    fill: 'red',
    stroke: 'none',
    strokeWidth: 0,
  });
  t.batchable = true;
  return t;
}
it('rejects unsupported styles and separates paint and linear transforms', () => {
  const a = label(),
    b = label('CD');
  expect(TextBatch.batchKey(a)).not.toBeNull();
  expect(TextBatch.batchKey(a)).toBe(TextBatch.batchKey(b));
  b.fill = 'blue';
  expect(TextBatch.batchKey(b)).not.toBe(TextBatch.batchKey(a));
  for (const change of [
    { batchable: false },
    { content: '中文' },
    { fontFamily: 'custom' },
    { fontVariant: 'small-caps' },
    { decorationLine: 'underline' },
    { wireframe: true },
    { sizeAttenuation: true },
    { stroke: 'red', strokeWidth: 2 },
    { fill: 'linear-gradient(red,blue)' },
  ]) {
    const t = label();
    Object.assign(t, change);
    expect(TextBatch.batchKey(t)).toBeNull();
  }
  expect(TextBatch.batchKey(new Rect())).toBeNull();
});
it('pages by glyph count, preserves barriers, excludes export and retires same-frame removals', () => {
  const batch = new BatchManager(null);
  let submitted: SDFText[] = [];
  jest.spyOn(SDFText.prototype, 'submit').mockImplementation(function () {
    submitted.push(this);
  });
  const a = label('l'.repeat(2048)),
    b = label('i'.repeat(2048)),
    c = label('C');
  const flush = () => {
    submitted = [];
    batch.flush(null, null, {});
    return submitted;
  };
  batch.clear(true, false, true);
  [a, b, c].forEach((t) => batch.add(t));
  const pages = flush();
  expect(pages.map((d) => d.shapes)).toEqual([[a, b], [c]]);
  expect(pages.every((d) => d instanceof TextBatch)).toBe(true);
  batch.clear(true, false, true);
  batch.add(a);
  batch.remove(a);
  expect(flush()).toEqual([]);
  expect(pages.every((d) => d.destroyed)).toBe(true);
  batch.clear(true, false, false);
  batch.add(a);
  batch.add(b);
  expect(flush().map((d) => d.shapes)).toEqual([[a], [b]]);
  batch.destroy();
});

it('refreshes baked depth when preceding non-text siblings disappear', () => {
  const text = label();
  text.globalRenderOrder = 10;
  const draw = new TextBatch(null, null, null, true, 0);
  draw.shapes = [text];
  jest.spyOn(SDFText.prototype, 'createGeometry').mockImplementation(() => {});
  draw.createGeometry();
  text.renderDirtyFlag =
    text.geometryDirtyFlag =
    text.materialDirtyFlag =
      false;
  draw.geometryDirty = false;
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(false);
  text.globalRenderOrder = 9;
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(true);
  draw.destroy();
});

it('keeps unsupported text as a painter barrier and retires its page on reunion', () => {
  const batch = new BatchManager(null);
  let submitted: SDFText[] = [];
  jest.spyOn(SDFText.prototype, 'submit').mockImplementation(function () {
    submitted.push(this);
  });
  const a = label('A'),
    barrier = label('中文'),
    b = label('B');
  const frame = (texts: Text[]) => {
    submitted = [];
    batch.clear(true, false, true);
    texts.forEach((text) => batch.add(text));
    batch.flush(null, null, {});
    return submitted;
  };
  const old = frame([a, barrier, b]);
  expect(old.map((d) => d.constructor)).toEqual([
    TextBatch,
    SDFText,
    TextBatch,
  ]);
  expect(old.map((d) => d.shapes)).toEqual([[a], [barrier], [b]]);
  expect(frame([a, b]).map((d) => d.shapes)).toEqual([[a, b]]);
  expect(old.slice(1).every((d) => d.destroyed)).toBe(true);
  batch.destroy();
});

it('reuses a text page across arbitrary paint keys and rebuilds only changed layout', () => {
  const a = label('A'),
    b = label('B');
  a.globalRenderOrder = 1;
  b.globalRenderOrder = 2;
  const batch = new BatchManager(null);
  let submitted: SDFText[] = [];
  jest.spyOn(SDFText.prototype, 'submit').mockImplementation(function () {
    submitted.push(this);
  });
  const frame = () => {
    submitted = [];
    batch.clear(true, false, true);
    batch.add(a);
    batch.add(b);
    batch.flush(null, null, {});
    return submitted;
  };
  const first = frame()[0];
  a.fill = b.fill = 'green';
  expect(frame()[0]).toBe(first);
  expect(first.destroyed).toBe(false);
  jest.spyOn(SDFText.prototype, 'createGeometry').mockImplementation(() => {});
  const draw = first as TextBatch;
  draw.createGeometry();
  a.renderDirtyFlag = b.renderDirtyFlag = false;
  draw.geometryDirty = false;
  a.fill = b.fill = 'cyan';
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(false);
  b.content = 'Changed';
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(true);
  jest.spyOn(SDFText.prototype, 'createGeometry').mockImplementation(() => {
    throw new Error('GPU failure');
  });
  expect(() => draw.createGeometry()).toThrow('GPU failure');
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(true);
  batch.destroy();
});

it('does not lend the same text page twice while paint keys rotate', () => {
  const batch = new BatchManager(null),
    a = label('A'),
    b = label('B');
  b.fill = 'blue';
  let calls: SDFText[] = [];
  jest.spyOn(SDFText.prototype, 'submit').mockImplementation(function () {
    calls.push(this);
  });
  const frame = () => {
    calls = [];
    batch.clear(true, false, true);
    batch.add(a);
    batch.add(b);
    batch.flush(null, null, {});
    return calls;
  };
  const first = frame();
  a.fill = 'orange';
  b.fill = 'red';
  const next = frame();
  expect(next).toEqual(first);
  expect(next.map((d) => d.shapes)).toEqual([[a], [b]]);
  expect(new Set(next).size).toBe(2);
  batch.destroy();
});

textLayoutSnapshotContract(layoutSnapshots);
it('dispatches text and Path eligibility only to the matching primitive kind', () => {
  const batch = new BatchManager(null),
    text = label('AB'),
    path = new Path({
      d: 'M0 0 H20 V20 Z',
      fill: 'red',
      stroke: 'none',
      strokeWidth: 0,
    });
  path.batchable = true;
  const textKey = jest.spyOn(TextBatch, 'batchKey'),
    pathKey = jest.spyOn(PathInstances, 'batchKey');
  jest.spyOn(Drawcall.prototype, 'submit').mockImplementation(() => {});
  batch.clear(true, true, true);
  [new Rect(), text, path].forEach((s) => batch.add(s));
  batch.flush(null, null, {});
  expect(textKey.mock.calls.map((c) => c[0])).toEqual([text]);
  expect(pathKey.mock.calls.map((c) => c[0])).toEqual([path]);
  batch.destroy();
});
it('invalidates copied Core metrics even when a derived object is mutated in place', () => {
  const text = label('AB'),
    draw = new TextBatch(null, null, null, true, 0);
  draw.shapes = [text];
  jest.spyOn(SDFText.prototype, 'createGeometry').mockImplementation(() => {});
  draw.createGeometry();
  text.renderDirtyFlag = false;
  draw.geometryDirty = true;
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(false);
  text.metrics.fontMetrics.fontBoundingBoxAscent = 123;
  draw.geometryDirty = true;
  (draw as any).prepareGeometry();
  expect(draw.geometryDirty).toBe(true);
  draw.destroy();
});

it('uses current traversal order across paint edits, reordered frames and removals', () => {
  const batch = new BatchManager(null);
  const a = label('A'), barrier = label('中文'), b = label('B');
  let submitted: SDFText[] = [];
  jest.spyOn(SDFText.prototype, 'submit').mockImplementation(function () {
    submitted.push(this);
  });
  const frame = (texts: Text[], removed?: Text) => {
    submitted = [];
    batch.clear(true, false, true);
    texts.forEach((text) => batch.add(text));
    if (removed) batch.remove(removed);
    batch.flush(null, null, {});
    return submitted.flatMap((drawcall) => drawcall.shapes);
  };
  try {
    expect(frame([a, barrier, b])).toEqual([a, barrier, b]);
    a.fill = 'green';
    expect(frame([a, barrier, b])).toEqual([a, barrier, b]);
    expect(frame([b, barrier, a])).toEqual([b, barrier, a]);
    expect(frame([b, barrier, a], barrier)).toEqual([b, a]);
    expect(frame([a])).toEqual([a]);
  } finally {
    batch.destroy();
  }
});
