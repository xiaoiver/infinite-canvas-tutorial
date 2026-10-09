import { loadImageBitmapUniversal } from '../../packages/ecs/src/utils/load-image-bitmap';
import {
  getRainDropTextureBitmapIfReady,
  loadRainDropTextureCached,
  preloadRainDropTextures,
} from '../../packages/ecs/src/utils/rain-drop-texture-cache';

jest.mock('../../packages/ecs/src/utils/load-image-bitmap', () => ({
  loadImageBitmapUniversal: jest.fn(),
}));
const load = loadImageBitmapUniversal as jest.MockedFunction<
  typeof loadImageBitmapUniversal
>;
let serial = 0;
const url = () => `memory://rain-${serial++}.png`;
const bitmap = () =>
  ({ width: 8, height: 8, close: jest.fn() } as unknown as ImageBitmap);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
beforeEach(() => load.mockReset());

it('shares in-flight work and exposes the resolved sprite for synchronous export', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  load.mockReturnValue(request.promise);
  const a = loadRainDropTextureCached(` ${source} `);
  const b = loadRainDropTextureCached(source);
  expect(a).toBe(b);
  expect(getRainDropTextureBitmapIfReady(source)).toBeUndefined();
  const image = bitmap();
  request.resolve(image);
  await expect(a).resolves.toBe(image);
  expect(getRainDropTextureBitmapIfReady(` ${source} `)).toBe(image);
  await expect(loadRainDropTextureCached(source)).resolves.toBe(image);
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(source);
  expect(image.close).not.toHaveBeenCalled();
});

it('keeps unrelated URLs independent when requests complete out of order', async () => {
  const a = deferred<ImageBitmap>();
  const b = deferred<ImageBitmap>();
  load.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const first = url(),
    second = url();
  const pa = loadRainDropTextureCached(first),
    pb = loadRainDropTextureCached(second);
  const ia = bitmap(),
    ib = bitmap();
  b.resolve(ib);
  await pb;
  expect(getRainDropTextureBitmapIfReady(first)).toBeUndefined();
  a.resolve(ia);
  await pa;
  expect(getRainDropTextureBitmapIfReady(first)).toBe(ia);
  expect(getRainDropTextureBitmapIfReady(second)).toBe(ib);
});

it('notifies all callers of failure and permits a fresh retry', async () => {
  const source = url();
  const request = deferred<ImageBitmap>();
  load.mockReturnValueOnce(request.promise);
  const a = loadRainDropTextureCached(source),
    b = loadRainDropTextureCached(source);
  const settled = Promise.allSettled([a, b]);
  const error = new Error('decode failed');
  request.reject(error);
  expect(await settled).toEqual([
    { status: 'rejected', reason: error },
    { status: 'rejected', reason: error },
  ]);
  expect(getRainDropTextureBitmapIfReady(source)).toBeUndefined();
  const image = bitmap();
  load.mockResolvedValueOnce(image);
  await expect(loadRainDropTextureCached(source)).resolves.toBe(image);
  expect(load).toHaveBeenCalledTimes(2);
});

it.each(['', '   '])(
  'rejects an empty URL %j without invoking the decoder',
  async (source) => {
    await expect(loadRainDropTextureCached(source)).rejects.toThrow('empty');
    expect(load).not.toHaveBeenCalled();
  },
);

it('preloads unique nonempty URLs and waits for every sprite', async () => {
  const first = url(),
    second = url();
  const a = deferred<ImageBitmap>(),
    b = deferred<ImageBitmap>();
  load.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const done = jest.fn();
  const pending = preloadRainDropTextures([
    first,
    ` ${first} `,
    '',
    second,
  ]).then(done);
  expect(load).toHaveBeenCalledTimes(2);
  a.resolve(bitmap());
  await a.promise;
  expect(done).not.toHaveBeenCalled();
  b.resolve(bitmap());
  await pending;
  expect(done).toHaveBeenCalledTimes(1);
});

it('preloading an empty list does not decode anything', async () => {
  await preloadRainDropTextures(['', '  ']);
  expect(load).not.toHaveBeenCalled();
});

it('retries only the failed sprite after a partially successful preload', async () => {
  const first = url(),
    second = url();
  const image = bitmap();
  load.mockResolvedValueOnce(image).mockRejectedValueOnce(new Error('offline'));
  await expect(preloadRainDropTextures([first, second])).rejects.toThrow(
    'offline',
  );
  load.mockResolvedValueOnce(bitmap());
  await preloadRainDropTextures([first, second]);
  expect(load.mock.calls.map(([source]) => source)).toEqual([
    first,
    second,
    second,
  ]);
  expect(getRainDropTextureBitmapIfReady(first)).toBe(image);
});
