import { createCanvas } from 'canvas';
import { DOMAdapter, Text, Rect } from '../../packages/core/src';
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
