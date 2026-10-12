import { File as NodeFile } from 'node:buffer';

const mockLoad = jest.fn();
const mockConvert = jest.fn();
const mockImport = jest.fn();
jest.mock('@loaders.gl/core', () => ({ load: mockLoad }));
jest.mock('@loaders.gl/images', () => ({ ImageLoader: { id: 'image' } }));
jest.mock('heic-to', () => {
  mockImport();
  return { __esModule: true, heicTo: mockConvert };
});

let decode: typeof import('../../packages/ecs/src/utils/load-image-bitmap').loadImageBitmapUniversal;
const mockBitmap = jest.fn();
const mockFetch = jest.fn();
const bitmap = { width: 2, height: 1, close: jest.fn() };
const globals = ['File', 'createImageBitmap', 'fetch'] as const;
const descriptors = globals.map((key) =>
  Object.getOwnPropertyDescriptor(globalThis, key),
);
beforeEach(async () => {
  jest.resetModules();
  mockLoad.mockReset().mockResolvedValue(bitmap);
  mockConvert
    .mockReset()
    .mockResolvedValue(new Blob(['converted'], { type: 'image/png' }));
  mockImport.mockReset();
  mockBitmap.mockReset().mockResolvedValue(bitmap);
  mockFetch.mockReset();
  bitmap.close.mockClear();
  Object.assign(globalThis, {
    File: NodeFile,
    createImageBitmap: mockBitmap,
    fetch: mockFetch,
  });
  ({ loadImageBitmapUniversal: decode } = await import(
    '../../packages/ecs/src/utils/load-image-bitmap'
  ));
});
afterEach(() => {
  globals.forEach((key, i) => {
    const descriptor = descriptors[i];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  });
});

it('loads an ordinary Blob without requiring a global File constructor', async () => {
  Reflect.deleteProperty(globalThis, 'File');
  const blob = new Blob(['png'], { type: 'image/png' });
  await expect(decode(blob)).resolves.toBe(bitmap);
  expect(mockLoad).toHaveBeenCalledWith(blob, { id: 'image' });
  expect(mockImport).not.toHaveBeenCalled();
});

it('tries JPEG when HEIC-to-PNG conversion fails and returns ownership of the bitmap', async () => {
  const blob = new Blob(['heic'], { type: 'image/heic' });
  const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
  mockConvert
    .mockRejectedValueOnce(new Error('PNG encoding unavailable'))
    .mockResolvedValueOnce(jpeg);
  await expect(decode(blob)).resolves.toBe(bitmap);
  expect(mockConvert.mock.calls.map(([options]) => options.type)).toEqual([
    'image/png',
    'image/jpeg',
  ]);
  expect(mockBitmap).toHaveBeenCalledWith(jpeg);
  expect(bitmap.close).not.toHaveBeenCalled();
});

it('preserves the original decode error when the diagnostic fetch also fails', async () => {
  const error = new Error('image decode failed');
  mockLoad.mockRejectedValueOnce(error);
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await expect(decode('picture.bin')).rejects.toBe(error);
  expect(mockConvert).not.toHaveBeenCalled();
});

it('rejects unsuccessful HEIC HTTP responses before conversion', async () => {
  mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }));
  await expect(decode('missing.heic')).rejects.toThrow('404');
  expect(mockConvert).not.toHaveBeenCalled();
});

function signature(brand: string, ftyp = 'ftyp') {
  const bytes = new Uint8Array(16);
  bytes.set([0, 0, 0, 16]);
  bytes.set(
    [...ftyp].map((c) => c.charCodeAt(0)),
    4,
  );
  bytes.set(
    [...brand].map((c) => c.charCodeAt(0)),
    8,
  );
  return bytes;
}
const dataUrl = (bytes: Uint8Array, mime = 'application/octet-stream') =>
  `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

it('imports without a DOM and lazily shares the HEIC module across concurrent decodes', async () => {
  expect(typeof window).toBe('undefined');
  expect(mockImport).not.toHaveBeenCalled();
  await decode('normal.png');
  expect(mockImport).not.toHaveBeenCalled();
  const blob = new Blob(['heic'], { type: 'image/heic' });
  await Promise.all([decode(blob), decode(blob)]);
  await decode(blob);
  expect(mockImport).toHaveBeenCalledTimes(1);
  expect(mockConvert).toHaveBeenCalledTimes(3);
});

it('retries a failed lazy import without poisoning later conversions', async () => {
  const error = new Error('chunk unavailable');
  mockImport.mockImplementationOnce(() => {
    throw error;
  });
  const blob = new Blob(['heic'], { type: 'image/heic' });
  await expect(decode(blob)).rejects.toBe(error);
  expect(mockConvert).not.toHaveBeenCalled();
  await expect(decode(blob)).resolves.toBe(bitmap);
  expect(mockImport).toHaveBeenCalledTimes(2);
});

it.each([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  ' IMAGE/HEIF-SEQUENCE ',
])('recognizes %s MIME without reading the source signature', async (type) => {
  const blob = new Blob(['heic'], { type });
  const slice = jest.spyOn(blob, 'slice');
  await expect(decode(blob)).resolves.toBe(bitmap);
  expect(slice).not.toHaveBeenCalled();
  expect(mockConvert).toHaveBeenCalledWith({
    blob,
    type: 'image/png',
    quality: 1,
  });
  expect(mockLoad).not.toHaveBeenCalled();
});

it.each(['photo.heic', 'PHOTO.HEIF'])(
  'recognizes a File named %s without a useful MIME type',
  async (name) => {
    const file = new File(['heic'], name, { type: 'application/octet-stream' });
    await expect(decode(file)).resolves.toBe(bitmap);
    expect(mockConvert.mock.calls[0][0].blob).toBe(file);
  },
);

it.each(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'hevm', 'hevs'])(
  'recognizes the %s signature in an unlabelled Blob',
  async (brand) => {
    const blob = new Blob([signature(brand)]);
    await expect(decode(blob)).resolves.toBe(bitmap);
    expect(mockConvert.mock.calls[0][0].blob).toBe(blob);
    expect(mockLoad).not.toHaveBeenCalled();
  },
);

it.each(['avif', 'avis', 'mp42'])(
  'keeps %s on the ordinary decoder path',
  async (brand) => {
    const blob = new Blob([signature(brand)], {
      type: 'application/octet-stream',
    });
    await expect(decode(blob)).resolves.toBe(bitmap);
    expect(mockLoad).toHaveBeenCalledWith(blob, { id: 'image' });
    expect(mockImport).not.toHaveBeenCalled();
  },
);

it.each([new Uint8Array([1, 2]), signature('heic', 'xxxx')])(
  'does not confuse incomplete or non-ftyp bytes with HEIC',
  async (bytes) => {
    const blob = new Blob([bytes]);
    await expect(decode(blob)).resolves.toBe(bitmap);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockImport).not.toHaveBeenCalled();
  },
);

it('recovers a mislabeled Blob only after the ordinary decoder rejects it', async () => {
  const blob = new Blob([signature('heic')], { type: 'image/png' });
  mockLoad.mockRejectedValueOnce(new Error('not PNG'));
  await expect(decode(blob)).resolves.toBe(bitmap);
  const convertedBlob = mockConvert.mock.calls[0][0].blob as Blob;
  expect(convertedBlob.type).toBe('image/heic');
  expect(await convertedBlob.arrayBuffer()).toEqual(await blob.arrayBuffer());
  expect(mockLoad).toHaveBeenCalledTimes(1);
});

it.each(['signature absent', 'probe rejects'])(
  'preserves a Blob decode failure when %s',
  async (failure) => {
    const blob = new Blob(['not an image'], { type: 'image/png' });
    const error = new Error('decode');
    mockLoad.mockRejectedValueOnce(error);
    if (failure === 'probe rejects')
      jest.spyOn(blob, 'slice').mockImplementation(() => {
        throw new Error('read');
      });
    await expect(decode(blob)).rejects.toBe(error);
    expect(mockConvert).not.toHaveBeenCalled();
  },
);

it.each(['image/heic', 'application/octet-stream', ''])(
  'decodes base64 HEIC data URLs with MIME %j and whitespace',
  async (mime) => {
    const url = dataUrl(signature('heic'), mime).replace(',', ',\n ');
    await expect(decode(url)).resolves.toBe(bitmap);
    expect(await mockConvert.mock.calls[0][0].blob.arrayBuffer()).toEqual(
      signature('heic').buffer,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  },
);

it.each([
  'data:image/png;base64',
  'data:image/svg+xml,%3Csvg%3E',
  'data:image/heic;base64,???',
  dataUrl(signature('avif'), 'image/avif'),
  'data:image/png;base64,AQID',
])(
  'delegates non-HEIC or invalid data URLs to the ordinary decoder: %s',
  async (url) => {
    await expect(decode(url)).resolves.toBe(bitmap);
    expect(mockLoad).toHaveBeenCalledWith(url, { id: 'image' });
    expect(mockConvert).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  },
);

it.each([
  'photo.HEIC?token=1#still',
  '/path/photo.heif',
  'https://[invalid/photo.heic',
])('fetches HEIC path %s with CORS and converts its Blob', async (url) => {
  mockFetch.mockResolvedValueOnce(new Response(signature('heic')));
  await expect(decode(url)).resolves.toBe(bitmap);
  expect(mockFetch).toHaveBeenCalledWith(url, { mode: 'cors' });
  expect(mockLoad).not.toHaveBeenCalled();
});

it.each([
  'https://[invalid/photo.png',
  'photo.png?name=photo.heic',
  '/a.heic/photo.png',
])('does not infer HEIC from unrelated URL text: %s', async (url) => {
  await expect(decode(url)).resolves.toBe(bitmap);
  expect(mockLoad).toHaveBeenCalledWith(url, { id: 'image' });
  expect(mockFetch).not.toHaveBeenCalled();
});

it.each(['image/heic', 'application/octet-stream', 'image/png'])(
  'sniffs blob URLs with MIME %s before choosing their decoder',
  async (type) => {
    const bytes =
      type === 'image/png' ? new Uint8Array([1, 2]) : signature('heic');
    mockFetch.mockResolvedValueOnce(
      new Response(bytes, { headers: { 'content-type': type } }),
    );
    await expect(
      decode('blob:https://canvas.test/owned-by-caller'),
    ).resolves.toBe(bitmap);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockConvert).toHaveBeenCalledTimes(type === 'image/png' ? 0 : 1);
    expect(mockLoad).toHaveBeenCalledTimes(type === 'image/png' ? 1 : 0);
  },
);

it.each(['', 'image/heic', 'application/octet-stream; charset=binary'])(
  'recovers an extensionless URL from its response bytes/MIME %j',
  async (type) => {
    mockLoad.mockRejectedValueOnce(new Error('native decoder'));
    mockFetch.mockResolvedValueOnce(
      new Response(signature('heic'), { headers: { 'content-type': type } }),
    );
    await expect(decode('/asset/123')).resolves.toBe(bitmap);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockConvert).toHaveBeenCalledTimes(1);
  },
);

it.each(['wrong format', 'HTTP error', 'body rejects'])(
  'keeps the initial URL error when its fallback has %s',
  async (reason) => {
    const error = new Error('original decode');
    mockLoad.mockRejectedValueOnce(error);
    const response = new Response('not HEIC', {
      status: reason === 'HTTP error' ? 500 : 200,
    });
    if (reason === 'body rejects')
      jest.spyOn(response, 'blob').mockRejectedValue(new Error('body failed'));
    mockFetch.mockResolvedValueOnce(response);
    await expect(decode('/unknown')).rejects.toBe(error);
    expect(mockConvert).not.toHaveBeenCalled();
  },
);

it('surfaces a conversion failure after an extensionless response is confirmed as HEIC', async () => {
  mockLoad.mockRejectedValueOnce(new Error('native decode'));
  mockFetch.mockResolvedValueOnce(new Response(signature('heic')));
  const error = new Error('invalid HEIC');
  mockConvert.mockRejectedValue(error);
  await expect(decode('/heic-asset')).rejects.toBe(error);
  expect(mockConvert).toHaveBeenCalledTimes(2);
});

it('decodes the converted PNG once and returns its bitmap', async () => {
  const png = new Blob(['first still frame'], { type: 'image/png' });
  mockConvert.mockResolvedValueOnce(png);
  await expect(
    decode(new Blob(['heic'], { type: 'image/heic' })),
  ).resolves.toBe(bitmap);
  expect(mockBitmap).toHaveBeenCalledTimes(1);
  expect(mockBitmap).toHaveBeenCalledWith(png);
  expect(mockConvert).toHaveBeenCalledTimes(1);
});

it.each(['empty PNG', 'missing PNG', 'PNG decoder rejects'])(
  'falls back once to JPEG when %s',
  async (reason) => {
    mockConvert.mockResolvedValueOnce(
      reason === 'missing PNG'
        ? undefined
        : new Blob(reason === 'empty PNG' ? [] : ['png']),
    );
    const jpeg = new Blob(['jpeg']);
    mockConvert.mockResolvedValueOnce(jpeg);
    if (reason === 'PNG decoder rejects')
      mockBitmap.mockRejectedValueOnce(new Error('PNG decoder'));
    await expect(
      decode(new Blob(['heic'], { type: 'image/heic' })),
    ).resolves.toBe(bitmap);
    expect(mockConvert.mock.calls[1][0]).toMatchObject({
      type: 'image/jpeg',
      quality: 0.92,
    });
    expect(mockBitmap).toHaveBeenLastCalledWith(jpeg);
  },
);

it.each([
  'empty JPEG',
  'missing JPEG',
  'JPEG converter rejects',
  'JPEG decoder rejects',
])('rejects %s and permits a later independent retry', async (reason) => {
  mockConvert.mockResolvedValueOnce(undefined);
  if (reason === 'JPEG converter rejects')
    mockConvert.mockRejectedValueOnce(new Error('conversion'));
  else
    mockConvert.mockResolvedValueOnce(
      reason === 'missing JPEG'
        ? undefined
        : new Blob(reason === 'empty JPEG' ? [] : ['jpeg']),
    );
  if (reason === 'JPEG decoder rejects')
    mockBitmap.mockRejectedValueOnce(new Error('bitmap'));
  const blob = new Blob(['heic'], { type: 'image/heic' });
  await expect(decode(blob)).rejects.toThrow(
    reason.includes('empty') || reason.includes('missing')
      ? 'empty output'
      : reason.includes('converter')
      ? 'conversion'
      : 'bitmap',
  );
  expect(mockConvert).toHaveBeenCalledTimes(2);
  await expect(decode(blob)).resolves.toBe(bitmap);
  expect(bitmap.close).not.toHaveBeenCalled();
});
