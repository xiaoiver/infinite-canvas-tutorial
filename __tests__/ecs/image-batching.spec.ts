import {
  API,
  type Entity,
  Rect,
  FillLayers,
  GlobalTransform,
  Mat3,
  Renderable,
  Filter,
  Children,
  Stroke,
  Opacity,
  MaterialDirty,
} from '../../packages/ecs/src';
import { BatchManager } from '../../packages/ecs/src/systems/BatchManager';
import { ImageBatch } from '../../packages/ecs/src/drawcalls/ImageBatch';
import * as packing from '../../packages/ecs/src/utils/image-batching';
import { setFillLayerDecodedBitmapForUrl } from '../../packages/ecs/src/utils/fill-layer-image-url-raster';
import { imageBatchContract } from '../contracts/image-batching';
imageBatchContract(packing);
const previous = globalThis.ImageBitmap;
class Bitmap {
  width = 64;
  height = 48;
}
beforeEach(() => {
  globalThis.ImageBitmap = Bitmap as unknown as typeof ImageBitmap;
});
afterEach(() => {
  globalThis.ImageBitmap = previous;
});
const api = { getNodeByEntity: () => undefined } as API;
let generation = 0;
function rect(source = 0) {
  const url = 'image-batch-' + generation + '-' + source + '.png';
  if (source < 9)
    setFillLayerDecodedBitmapForUrl(
      url,
      new Bitmap() as unknown as ImageBitmap,
    );
  const data = new Map<unknown, any>([
    [Rect, { x: 0, y: 0, width: 24, height: 22, cornerRadius: 0 }],
    [FillLayers, { layers: [{ type: 'image', value: url }] }],
    [GlobalTransform, { matrix: Mat3.copy(Mat3.IDENTITY) }],
    [Renderable, { batchable: true }],
    [Stroke, { width: 1, alignment: 'center', dasharray: [0, 0] }],
    [Opacity, { opacity: 1 }],
  ]);
  return {
    data,
    entity: {
      has: (c: unknown) => data.has(c),
      hasSomeOf: (...cs: unknown[]) => cs.some((c) => data.has(c)),
      read: (c: unknown) => {
        if (!data.has(c)) throw new Error('unexpected read');
        return data.get(c);
      },
    } as Entity,
  };
}
const managers: BatchManager[] = [];
function manager(intent: 'screen' | 'export' = 'screen') {
  const b = new BatchManager(null, null, null, null, api, intent);
  managers.push(b);
  return b;
}
const calls = (b: BatchManager) =>
  b.buildFlushSegments().flatMap((s) => s.drawcalls);
afterEach(() => {
  managers.splice(0).forEach((b) => b.destroy());
  generation++;
});
it('defaults off, respects ancestor barriers and keeps export full', () => {
  const a = rect(),
    b = manager();
  b.add(a.entity);
  expect(calls(b)[0]).not.toBeInstanceOf(ImageBatch);
  b.setImageBatchingEnabled(true);
  expect(calls(b)[0]).toBeInstanceOf(ImageBatch);
  const parent = rect();
  parent.data.set(Filter, {});
  a.data.set(Children, { parent: parent.entity });
  b.add(a.entity);
  expect(calls(b)[0]).not.toBeInstanceOf(ImageBatch);
  const exp = manager('export'),
    other = rect();
  exp.setImageBatchingEnabled(true);
  exp.add(other.entity);
  expect(calls(exp)[0]).not.toBeInstanceOf(ImageBatch);
});
it('rejects unresolved, closed, rounded, filtered and singular image shapes', () => {
  const r = rect(10);
  expect(packing.eligibleImageRect(r.entity)).toBe(false);
  const s = rect();
  expect(packing.eligibleImageRect(s.entity)).toBe(true);
  s.data.get(Rect).cornerRadius = 2;
  expect(packing.eligibleImageRect(s.entity)).toBe(false);
  s.data.get(Rect).cornerRadius = 0;
  s.data.get(GlobalTransform).matrix.m00 = 0;
  expect(packing.eligibleImageRect(s.entity)).toBe(false);
});
it('splits eight sampler slots, retires empty pages and never revives deleted groups', () => {
  // Reuse source generations rather than replacing/closing a decoded source per entity.
  const nodes = Array.from({ length: 9 }, (_, i) => rect(i));
  const b = manager();
  b.setImageBatchingEnabled(true);
  nodes.forEach((n) => b.add(n.entity));
  const old = calls(b);
  expect(old.map((d) => d.shapes.length)).toEqual([8, 1]);
  nodes.forEach((n) => b.remove(n.entity, false));
  expect(calls(b)).toEqual([]);
  expect(old.every((d) => d.destroyed)).toBe(true);
  b.add(nodes[0].entity);
  expect(calls(b)[0]).not.toBe(old[0]);
});

it('releases earlier texture leases when a later page upload fails', () => {
  const a = rect(0),
    b = rect(1),
    release = jest.fn();
  const mock = jest
    .spyOn(packing, 'imageRectTexture')
    .mockImplementation((shape) => ({
      source: {} as ImageBitmap,
      key: '',
      token: shape === a.entity ? 'a' : 'b',
      acquire: () => {
        if (shape === b.entity) throw new Error('upload failed');
        return { texture: {} as any, release };
      },
    }));
  const page = new ImageBatch(null, null, null, null, true, 0, api);
  page.shapes = [a.entity, b.entity];
  (page as any).prepareGeometry();
  expect(() => page.createMaterial('', null)).toThrow('upload failed');
  expect(release).toHaveBeenCalledTimes(1);
  const buffer = { destroy: jest.fn() };
  (page as any).vertexBuffers = [buffer];
  (page as any).vertexBufferDatas = [new Float32Array(20)];
  page.destroy();
  expect(buffer.destroy).toHaveBeenCalledTimes(1);
  expect((page as any).vertexBufferDatas).toEqual([]);
  expect(release).toHaveBeenCalledTimes(1);
  mock.mockRestore();
});

it('reuses raster descriptions on visibility plans and invalidates them on material edits', () => {
  const r = rect(),
    lookup = jest.fn(() => undefined),
    editor = { getNodeByEntity: lookup } as unknown as API;
  const first = packing.imageRectTexture(r.entity, editor);
  expect(packing.imageRectTexture(r.entity, editor)).toBe(first);
  expect(lookup).toHaveBeenCalledTimes(1);
  const b = manager();
  // Invalidation must also work while the runtime option is off.
  r.data.set(MaterialDirty, {});
  b.add(r.entity);
  expect(packing.imageRectTexture(r.entity, editor)).not.toBe(first);
  expect(lookup).toHaveBeenCalledTimes(2);
  r.data.get(Rect).width = 48;
  packing.imageRectTexture(r.entity, editor);
  expect(lookup).toHaveBeenCalledTimes(3);
});

it('resolves image tokens once per dirty plan and repartitions edited raster variants', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => rect(i % 6));
  const descriptions = jest.spyOn(packing, 'imageRectTexture');
  const b = manager();
  b.setImageBatchingEnabled(true);
  try {
    nodes.forEach((n) => b.add(n.entity));
    expect(calls(b).map((d) => d.shapes.length)).toEqual([256, 44]);
    expect(descriptions).toHaveBeenCalledTimes(300);
    descriptions.mockClear();
    calls(b);
    expect(descriptions).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) {
      nodes[i].data.set(FillLayers, rect(6 + i).data.get(FillLayers));
      nodes[i].data.set(MaterialDirty, {});
      b.add(nodes[i].entity);
    }
    expect(calls(b).map((d) => d.shapes.length)).toEqual([8, 256, 36]);
    expect(descriptions).toHaveBeenCalledTimes(300);
    for (const node of nodes)
      expect(
        descriptions.mock.calls.filter(([shape]) => shape === node.entity),
      ).toHaveLength(1);
  } finally {
    descriptions.mockRestore();
  }
});
