import { Rect, Path } from '../../packages/core/src';
import { ImageBatch } from '../../packages/core/src/drawcalls/ImageBatch';
import * as packing from '../../packages/core/src/utils/image-batching';
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
const rect = () =>
  new Rect({
    width: 24,
    height: 22,
    fill: new Bitmap() as unknown as ImageBitmap,
    batchable: true,
    stroke: 'none',
  });
it('accepts immutable image rectangles under affine transforms with no visible stroke', () => {
  const r = rect();
  r.worldTransform.c = 0.2;
  r.worldTransform.tx = 30;
  expect(packing.eligibleImageRect(r)).toBe(true);
  expect(packing.eligibleImageRect(new Path())).toBe(false);
});
it.each([
  { wireframe: true },
  { sizeAttenuation: true },
  { strokeAttenuation: true },
  { cornerRadius: 4 },
  { stroke: 'red' },
  { batchable: false },
  { width: 0 },
  { fill: 'red' },
  { dropShadowBlurRadius: 2 },
])('falls back for %p', (patch) => {
  const r = rect();
  Object.assign(r, patch);
  expect(packing.eligibleImageRect(r)).toBe(false);
});
it('rejects closed sources and singular transforms', () => {
  const r = rect();
  (r.fill as ImageBitmap as unknown as Bitmap).width = 0;
  expect(packing.eligibleImageRect(r)).toBe(false);
  r.fill = new Bitmap() as unknown as ImageBitmap;
  r.worldTransform.a = 0;
  expect(packing.eligibleImageRect(r)).toBe(false);
});

it('rolls back all page texture uploads before publishing a binding', () => {
  const textures: { destroy: jest.Mock }[] = [];
  const device = {
    createTexture: () => {
      const i = textures.length,
        t = {
          destroy: jest.fn(),
          setImageData: () => {
            if (i % 2 === 1) throw new Error('upload failed');
          },
        };
      textures.push(t);
      return t;
    },
  };
  const page = new ImageBatch(device as any, null, null, true, 0);
  page.shapes = [rect(), rect()];
  (page as any).prepareGeometry();
  for (let attempt = 0; attempt < 2; attempt++)
    expect(() => page.createMaterial('', null)).toThrow('upload failed');
  expect(textures).toHaveLength(4);
  textures.forEach((t) => expect(t.destroy).toHaveBeenCalledTimes(1));
  page.destroy();
  textures.forEach((t) => expect(t.destroy).toHaveBeenCalledTimes(1));
});
