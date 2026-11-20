import { createCanvas } from 'canvas';
import { BufferUsage } from '@antv/g-device-api';
import {
  DOMAdapter,
  Path,
  Polyline,
  Rect,
  Text,
} from '../../packages/core/src';
import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
import { Drawcall } from '../../packages/core/src/drawcalls/Drawcall';

beforeAll(() => {
  jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation(
      (width = 1, height = 1) => createCanvas(width, height) as any,
    );
});
afterAll(() => jest.restoreAllMocks());

function harness() {
  const buffers: { destroy: jest.Mock }[] = [];
  const created: Drawcall[] = [];
  const rendered: Drawcall[] = [];
  const device: any = {
    createBuffer: jest.fn(() => {
      const buffer = { destroy: jest.fn() };
      buffers.push(buffer);
      return buffer;
    }),
  };
  class Fill extends Drawcall {
    constructor(...args: ConstructorParameters<typeof Drawcall>) {
      super(...args);
      created.push(this);
    }
    createGeometry() {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: 4,
        usage: BufferUsage.INDEX,
      });
      this.vertexBuffers = [
        this.device.createBuffer({ viewOrSize: 8, usage: BufferUsage.VERTEX }),
      ];
    }
    createMaterial() {}
    render() {
      if (this.destroyed) throw new Error('Disposed drawcall reached render');
      rendered.push(this);
    }
  }
  class Stroke extends Fill {}
  const batch = new BatchManager(device);
  jest
    .spyOn(batch as any, 'collectDrawcallCtors')
    .mockReturnValue([Fill, Stroke]);
  const flush = () => batch.flush({} as any, {} as any, {});
  return { batch, flush, created, rendered, buffers };
}

it.each([
  ['text', () => new Text({ content: 'Owned text', fontSize: 18 })],
  [
    'polyline',
    () =>
      new Polyline({
        points: [
          [0, 0],
          [20, 20],
        ],
      }),
  ],
  ['non-batched rectangle', () => new Rect({ batchable: false })],
  ['full Path', () => new Path({ d: 'M0 0 H20 V20 Z', batchable: true })],
] as const)(
  'retires every owned drawcall once when removing %s',
  (_name, make) => {
    const { batch, flush, created, buffers } = harness();
    const shape = make();
    batch.add(shape);
    flush();
    expect(created).toHaveLength(2);
    expect(buffers).toHaveLength(4);
    batch.remove(shape);
    batch.remove(shape);
    expect(created.every((drawcall) => drawcall.destroyed)).toBe(true);
    for (const buffer of buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    batch.destroy();
    batch.destroy();
    for (const buffer of buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
  },
);

it('never allocates or renders a removed queued text, and reentry gets fresh drawcalls', () => {
  const { batch, flush, created, rendered, buffers } = harness();
  const text = new Text({ content: 'Reentry', fontSize: 18 });
  batch.add(text);
  const retired = created.slice();
  batch.remove(text);
  flush();
  expect(rendered.map((drawcall) => drawcall.uid)).toEqual([]);
  expect(buffers).toEqual([]);
  expect(retired.every((drawcall) => drawcall.destroyed)).toBe(true);
  batch.clear();
  batch.add(text);
  flush();
  expect(rendered).toHaveLength(2);
  expect(rendered.every((drawcall) => !retired.includes(drawcall))).toBe(true);
  batch.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it('does not retire shared batches when one rectangle leaves and its peer remains', () => {
  const { batch, flush, created, rendered, buffers } = harness();
  const a = new Rect(),
    b = new Rect();
  batch.add(a);
  batch.add(b);
  flush();
  const shared = created.slice();
  expect(shared).toHaveLength(2);
  batch.remove(a);
  expect(shared.every((drawcall) => !drawcall.destroyed)).toBe(true);
  expect(shared.map((drawcall) => drawcall.shapes)).toEqual([[b], [b]]);
  for (const buffer of buffers) expect(buffer.destroy).not.toHaveBeenCalled();
  rendered.length = 0;
  batch.clear();
  batch.add(b);
  flush();
  expect(rendered).toEqual(shared);
  batch.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it('removing a never-rendered non-batched shape creates no cached resources', () => {
  const { batch, created, buffers } = harness();
  batch.remove(new Text({ content: 'Not attached' }));
  expect(created).toEqual([]);
  expect(buffers).toEqual([]);
  batch.destroy();
});
