import { createCanvas, Image as NativeImage } from 'canvas';
import {
  DOMAdapter,
  type API,
  type Entity,
  type FillLayerItem,
} from '../../packages/ecs/src';
import {
  getFillLayerDecodedBitmap,
  setFillLayerDecodedBitmapForUrl,
  rasterizeFillLayerImageUrlForTexture,
  resolveFillLayerImageRasterPixelSize,
  resolveFillLayerOpacityFromWire,
  resolveImageFillRasterOptions,
  transparentFillLayerCanvas,
  trySyncRasterizeImageUrlToCanvas,
} from '../../packages/ecs/src/utils/fill-layer-image-url-raster';

const adapter = DOMAdapter.get();
const originalImage = globalThis.Image;
const originalDpr = globalThis.devicePixelRatio;
let serial = 0;
const url = () => `memory://image-cache-${serial++}`;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
// An event-loop barrier drains decode promise continuations without a timer delay.
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function bitmap(color: string, width = 8, height = 4) {
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').fillStyle = color;
  canvas.getContext('2d').fillRect(0, 0, width, height);
  return Object.assign(canvas, {
    close: jest.fn(),
  }) as unknown as ImageBitmap & { close: jest.Mock };
}
const pixel = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  x: number,
  y: number,
) => [
  ...(canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(
    x,
    y,
    1,
    1,
  ).data,
];
let createImage: jest.Mock;
beforeEach(() => {
  globalThis.Image = undefined;
  globalThis.devicePixelRatio = 1;
  createImage = jest.fn(() => Promise.reject(new Error('Unexpected decode')));
  DOMAdapter.set({
    ...adapter,
    createCanvas: (w, h) =>
      createCanvas(w!, h!) as unknown as HTMLCanvasElement,
    createImage,
  });
});
afterEach(async () => {
  await settle();
  DOMAdapter.set(adapter);
  globalThis.Image = originalImage;
  globalThis.devicePixelRatio = originalDpr;
  jest.restoreAllMocks();
});

it('coalesces concurrent decodes, deduplicates callbacks and reuses decoded pixels', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  createImage.mockReturnValue(request.promise);
  const callback = jest.fn();
  const other = jest.fn();
  expect(
    rasterizeFillLayerImageUrlForTexture(source, 16, 8, callback),
  ).toBeNull();
  rasterizeFillLayerImageUrlForTexture(source, 16, 8, callback);
  rasterizeFillLayerImageUrlForTexture(source, 32, 16, other);
  await settle();
  expect(createImage).toHaveBeenCalledTimes(1);
  expect(createImage).toHaveBeenCalledWith(source);
  const image = bitmap('red');
  request.resolve(image);
  await settle();
  expect(getFillLayerDecodedBitmap(source)).toBe(image);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(other).toHaveBeenCalledTimes(1);
  const canvas = rasterizeFillLayerImageUrlForTexture(
    source,
    15.1,
    7.1,
    callback,
  )!;
  expect([canvas.width, canvas.height]).toEqual([16, 8]);
  expect(pixel(canvas, 8, 4)).toEqual([255, 0, 0, 255]);
  expect(createImage).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
});

it('does not let a late decode overwrite an explicitly replaced bitmap', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  createImage.mockReturnValue(request.promise);
  const observed: ImageBitmap[] = [];
  rasterizeFillLayerImageUrlForTexture(source, 8, 4, () =>
    observed.push(getFillLayerDecodedBitmap(source)!),
  );
  await settle();
  const latest = bitmap('red', 16, 8);
  setFillLayerDecodedBitmapForUrl(source, latest);
  const stale = bitmap('blue');
  request.resolve(stale);
  await settle();
  expect(getFillLayerDecodedBitmap(source)).toBe(latest);
  expect(observed).toEqual([latest]);
  expect(stale.close).toHaveBeenCalledTimes(1);
  expect(latest.close).not.toHaveBeenCalled();
  expect(
    pixel(rasterizeFillLayerImageUrlForTexture(source, 8, 4)!, 4, 2),
  ).toEqual([255, 0, 0, 255]);
});

it('does not close the current bitmap when a concurrent decode returns the same object', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  createImage.mockReturnValue(request.promise);
  rasterizeFillLayerImageUrlForTexture(source, 8, 4);
  await settle();
  const image = bitmap('red');
  setFillLayerDecodedBitmapForUrl(source, image);
  request.resolve(image);
  await settle();
  expect(getFillLayerDecodedBitmap(source)).toBe(image);
  expect(image.close).not.toHaveBeenCalled();
});

it.each(['reject', 'throw'] as const)(
  'allows a new decode after adapter failure (%s) without retaining old callbacks',
  async (kind) => {
    const source = url();
    if (kind === 'throw')
      createImage.mockImplementationOnce(() => {
        throw new Error('sync failure');
      });
    else createImage.mockRejectedValueOnce(new Error('async failure'));
    const old = jest.fn();
    rasterizeFillLayerImageUrlForTexture(source, 8, 4, old);
    await settle();
    expect(getFillLayerDecodedBitmap(source)).toBeUndefined();
    const next = jest.fn();
    const image = bitmap('red');
    createImage.mockResolvedValueOnce(image);
    rasterizeFillLayerImageUrlForTexture(source, 8, 4, next);
    await settle();
    expect(createImage).toHaveBeenCalledTimes(2);
    expect(getFillLayerDecodedBitmap(source)).toBe(image);
    expect(next).toHaveBeenCalledTimes(1);
    expect(old).not.toHaveBeenCalled();
  },
);

it('continues notifying subscribers after one throws and makes the cache available inside callbacks', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  createImage.mockReturnValue(request.promise);
  const next = jest.fn(() =>
    pixel(rasterizeFillLayerImageUrlForTexture(source, 8, 4)!, 4, 2),
  );
  rasterizeFillLayerImageUrlForTexture(source, 8, 4, () => {
    throw new Error('subscriber');
  });
  rasterizeFillLayerImageUrlForTexture(source, 8, 4, next);
  request.resolve(bitmap('blue'));
  await settle();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.results[0].value).toEqual([0, 0, 255, 255]);
});

it('closes replaced images once, tolerates close errors and leaves other URLs intact', () => {
  const source = url();
  const other = url();
  const first = bitmap('red');
  const second = bitmap('blue');
  const isolated = bitmap('green');
  setFillLayerDecodedBitmapForUrl(source, first);
  setFillLayerDecodedBitmapForUrl(source, first);
  setFillLayerDecodedBitmapForUrl(other, isolated);
  expect(first.close).not.toHaveBeenCalled();
  first.close.mockImplementation(() => {
    throw new Error('already closed');
  });
  setFillLayerDecodedBitmapForUrl(source, second);
  setFillLayerDecodedBitmapForUrl(source, second);
  expect(first.close).toHaveBeenCalledTimes(1);
  expect(getFillLayerDecodedBitmap(source)).toBe(second);
  expect(getFillLayerDecodedBitmap(other)).toBe(isolated);
  expect(isolated.close).not.toHaveBeenCalled();
});

it('letterboxes cached image pixels according to object-fit and object-position', () => {
  const source = url();
  setFillLayerDecodedBitmapForUrl(source, bitmap('red'));
  const canvas = rasterizeFillLayerImageUrlForTexture(source, 8, 8, undefined, {
    objectFit: 'contain',
    objectPosition: 'left bottom',
  })!;
  expect(pixel(canvas, 4, 0)[3]).toBe(0);
  expect(pixel(canvas, 4, 7)).toEqual([255, 0, 0, 255]);
  expect(createImage).not.toHaveBeenCalled();
});

it('uses source resolution for stretch fills and geometry times DPR for contain', () => {
  const source = url();
  globalThis.devicePixelRatio = 2;
  expect(resolveFillLayerImageRasterPixelSize(source, 10, 20)).toEqual({
    width: 20,
    height: 40,
  });
  setFillLayerDecodedBitmapForUrl(source, bitmap('red', 80, 40));
  expect(resolveFillLayerImageRasterPixelSize(source, 10, 20)).toEqual({
    width: 80,
    height: 40,
  });
  expect(
    resolveFillLayerImageRasterPixelSize(source, 10, 20, 'contain'),
  ).toEqual({ width: 20, height: 40 });
});

it('uses native synchronous data-image decoding without scheduling an async fetch', () => {
  globalThis.Image = NativeImage as unknown as typeof Image;
  const source = createCanvas(2, 2);
  source.getContext('2d').fillStyle = 'red';
  source.getContext('2d').fillRect(0, 0, 2, 2);
  const canvas = rasterizeFillLayerImageUrlForTexture(
    source.toDataURL(),
    4,
    4,
  )!;
  expect(pixel(canvas, 2, 2)).toEqual([255, 0, 0, 255]);
  expect(createImage).not.toHaveBeenCalled();
});

it('returns null for missing/unready images and uses a transparent minimum-size placeholder', () => {
  expect(trySyncRasterizeImageUrlToCanvas('image.png', 4, 4)).toBeNull();
  globalThis.Image = class {
    complete = false;
    naturalWidth = 0;
  } as unknown as typeof Image;
  expect(trySyncRasterizeImageUrlToCanvas('image.png', 4, 4)).toBeNull();
  expect(rasterizeFillLayerImageUrlForTexture('', 4, 4)).toBeNull();
  const canvas = transparentFillLayerCanvas(0, -1);
  expect([canvas.width, canvas.height]).toEqual([1, 1]);
  expect(pixel(canvas, 0, 0)).toEqual([0, 0, 0, 0]);
  expect(createImage).not.toHaveBeenCalled();
});

it('returns null for a cached image when its canvas cannot provide a 2D context', () => {
  const source = url();
  setFillLayerDecodedBitmapForUrl(source, bitmap('red'));
  jest.spyOn(DOMAdapter.get(), 'createCanvas').mockReturnValue({
    getContext: () => null,
  } as unknown as HTMLCanvasElement);
  expect(rasterizeFillLayerImageUrlForTexture(source, 8, 4)).toBeNull();
  expect(createImage).not.toHaveBeenCalled();
});

it('returns null when drawing a decoded image fails', () => {
  const source = url();
  setFillLayerDecodedBitmapForUrl(source, bitmap('red'));
  const canvas = createCanvas(8, 4);
  jest.spyOn(canvas.getContext('2d'), 'drawImage').mockImplementation(() => {
    throw new Error('invalid bitmap');
  });
  jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockReturnValue(canvas as unknown as HTMLCanvasElement);
  expect(rasterizeFillLayerImageUrlForTexture(source, 8, 4)).toBeNull();
});

const layer: FillLayerItem = {
  type: 'image',
  value: 'picture.png',
  opacity: 0.4,
  objectFit: 'contain',
  objectPosition: 'left',
};
const entity = {} as Entity;
const api = (fills?: unknown) =>
  ({ getNodeByEntity: () => ({ fills }) } as unknown as API);

it('prefers an enabled exact image match and merges only supplied wire options', () => {
  const wire = api([
    {
      type: 'image',
      value: 'picture.png',
      enabled: false,
      objectFit: 'cover',
      opacity: 0.1,
    },
    {
      type: 'image',
      value: 'picture.png',
      objectPosition: 'right',
      opacity: 0,
    },
  ]);
  expect(resolveImageFillRasterOptions(wire, entity, layer)).toEqual({
    objectFit: 'contain',
    objectPosition: 'right',
  });
  expect(resolveFillLayerOpacityFromWire(wire, entity, layer)).toBe(0);
});

it('uses the first enabled image as a fallback when the wire URL has changed', () => {
  const wire = api([
    {
      type: 'image',
      value: 'disabled.png',
      enabled: false,
      objectFit: 'cover',
      opacity: 0.1,
    },
    { type: 'image', value: 'new.png', objectFit: 'fill', opacity: '0.7' },
  ]);
  expect(resolveImageFillRasterOptions(wire, entity, layer)).toEqual({
    objectFit: 'fill',
    objectPosition: 'left',
  });
  expect(resolveFillLayerOpacityFromWire(wire, entity, layer)).toBe(0.7);
});

it.each([
  undefined,
  [],
  [{ type: 'solid', value: 'red' }],
  [{ type: 'image', value: 'x', enabled: false }],
])('retains ECS paint settings when no enabled image exists in %p', (fills) => {
  expect(resolveImageFillRasterOptions(api(fills), entity, layer)).toEqual({
    objectFit: 'contain',
    objectPosition: 'left',
  });
  expect(resolveFillLayerOpacityFromWire(api(fills), entity, layer)).toBe(0.4);
});

it.each([undefined, null, ''])(
  'retains ECS opacity when the wire opacity is %p',
  (opacity) => {
    expect(
      resolveFillLayerOpacityFromWire(
        api([{ ...layer, opacity }]),
        entity,
        layer,
      ),
    ).toBe(0.4);
  },
);

it('resolves standalone and non-image layers without reading scene data', () => {
  expect(resolveImageFillRasterOptions(undefined, entity, layer)).toEqual({
    objectFit: 'contain',
    objectPosition: 'left',
  });
  expect(resolveImageFillRasterOptions(api(), undefined, layer)).toEqual({
    objectFit: 'contain',
    objectPosition: 'left',
  });
  expect(
    resolveImageFillRasterOptions(api(), entity, {
      type: 'solid',
      value: 'red',
    }),
  ).toEqual({});
  expect(resolveFillLayerOpacityFromWire(undefined, entity, layer)).toBe(0.4);
  expect(resolveFillLayerOpacityFromWire(api(), undefined, layer)).toBe(0.4);
});
