import {
  FillLayers,
  MaterialDirty,
  type Entity,
  type FillLayerItem,
} from '../../packages/ecs/src';
import {
  isLikelySvgResourceUrl,
  rasterizeSvgUrlToImageBitmap,
  resetFillImageSvgRerasterSchedule,
  scheduleFillImageSvgRerasterIfNeeded,
} from '../../packages/ecs/src/utils/fillImageSvgReraster';
import {
  getFillLayerDecodedBitmap,
  getFillLayerDecodedBitmapIntrinsicSize,
} from '../../packages/ecs/src/utils/fill-layer-image-url-raster';

const original = {
  Image: globalThis.Image,
  document: globalThis.document,
  OffscreenCanvas: globalThis.OffscreenCanvas,
  createImageBitmap: globalThis.createImageBitmap,
};
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
let images: ControlledImage[];
let contexts: {
  drawImage: jest.Mock;
  clearRect: jest.Mock;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
}[];
let createBitmap: jest.Mock;
let serial = 0;
const url = () => `https://example.test/raster-${serial++}.svg`;
class ControlledImage {
  naturalWidth = 20;
  naturalHeight = 10;
  crossOrigin = '';
  src = '';
  onload?: () => void;
  onerror?: () => void;
  constructor() {
    images.push(this);
  }
}
const bitmap = (width = 40, height = 20) =>
  ({ width, height, close: jest.fn() } as unknown as ImageBitmap);
function canvas(width = 0, height = 0) {
  const context = {
    drawImage: jest.fn(),
    clearRect: jest.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  };
  contexts.push(context);
  return { width, height, getContext: () => context };
}
beforeEach(() => {
  images = [];
  contexts = [];
  globalThis.Image = ControlledImage as unknown as typeof Image;
  globalThis.document = {
    createElement: jest.fn(() => canvas()),
  } as unknown as Document;
  globalThis.OffscreenCanvas = class {
    constructor(w: number, h: number) {
      return canvas(w, h);
    }
  } as unknown as typeof OffscreenCanvas;
  createBitmap = jest.fn((c: { width: number; height: number }) =>
    Promise.resolve(bitmap(c.width, c.height)),
  );
  globalThis.createImageBitmap = createBitmap;
});
afterEach(async () => {
  await settle();
  Object.assign(globalThis, original);
  jest.restoreAllMocks();
});

function target(source: string) {
  let layers: FillLayerItem[] | undefined = [{ type: 'image', value: source }];
  const components = new Set<unknown>();
  const entity = {
    alive: true,
    has: (c: unknown) => (c === FillLayers ? !!layers : components.has(c)),
    read: () => ({ layers }),
    add: jest.fn((c: unknown) => {
      components.add(c);
    }),
  };
  return {
    entity: entity as unknown as Entity,
    raw: entity,
    setLayers: (value?: FillLayerItem[]) => {
      layers = value;
    },
  };
}
const schedule = (entity: Entity, source: string, patch = {}) =>
  scheduleFillImageSvgRerasterIfNeeded({
    entity,
    url: source,
    sourceW: 20,
    sourceH: 10,
    targetW: 40,
    targetH: 20,
    ...patch,
  });
async function complete(index: number, image?: ImageBitmap) {
  if (image) createBitmap.mockResolvedValueOnce(image);
  images[index].onload!();
  await settle();
}

it.each([
  ['/shape.SVG?v=1#icon', true],
  [' data:image/svg+xml;charset=utf-8,<svg/> ', true],
  ['https://example.test/a.svg', true],
  ['https://example.test/a.png?file=a.svg', false],
  ['data:image/png;base64,AA', false],
  ['', false],
  ['http://[invalid', false],
])('recognizes SVG resource %j', (source, expected) =>
  expect(isLikelySvgResourceUrl(source)).toBe(expected),
);

it.each([
  'https://example.test/a.svg',
  'http://example.test/a.svg',
  '//example.test/a.svg',
])('sets anonymous CORS before loading %s', async (source) => {
  const result = rasterizeSvgUrlToImageBitmap(source, 40, 20);
  expect(images[0].crossOrigin).toBe('anonymous');
  expect(images[0].src).toBe(source);
  await complete(0);
  await expect(result).resolves.toMatchObject({ width: 40, height: 20 });
});

it('rasterizes at the requested size with object-fit and position', async () => {
  const result = rasterizeSvgUrlToImageBitmap(
    'data:image/svg+xml,<svg/>',
    40,
    40,
    { objectFit: 'contain', objectPosition: 'left bottom' },
  );
  await complete(0);
  await expect(result).resolves.toMatchObject({ width: 40, height: 40 });
  expect(images[0].crossOrigin).toBe('');
  expect(contexts[0].drawImage).toHaveBeenCalledWith(
    images[0],
    0,
    0,
    20,
    10,
    0,
    20,
    40,
    20,
  );
  expect(contexts[0].imageSmoothingQuality).toBe('high');
});

it('uses OffscreenCanvas when document is unavailable', async () => {
  globalThis.document = undefined;
  const result = rasterizeSvgUrlToImageBitmap(url(), 40, 20);
  await complete(0);
  await expect(result).resolves.toMatchObject({ width: 40, height: 20 });
});

it.each([
  [0, 20],
  [20, 0],
  [NaN, 20],
  [20, Infinity],
])('rejects invalid raster dimensions %j', async (w, h) => {
  const pending = rasterizeSvgUrlToImageBitmap(url(), w, h);
  expect(images).toHaveLength(0);
  await expect(pending).resolves.toBeNull();
});

it('does not load when Image is unavailable', async () => {
  globalThis.Image = undefined;
  await expect(rasterizeSvgUrlToImageBitmap(url(), 40, 20)).resolves.toBeNull();
});

it.each([
  'load',
  'context',
  'canvas',
  'draw',
  'bitmap-reject',
  'bitmap-throw',
] as const)(
  'settles raster failure (%s) without throwing from image events',
  async (failure) => {
    if (failure === 'context')
      globalThis.document.createElement = jest.fn(() => ({
        getContext: () => null,
      })) as any;
    if (failure === 'canvas')
      globalThis.document.createElement = jest.fn(() => {
        throw new Error('allocation failed');
      });
    if (failure === 'bitmap-reject')
      createBitmap.mockRejectedValueOnce(new Error('decode'));
    if (failure === 'bitmap-throw')
      createBitmap.mockImplementationOnce(() => {
        throw new Error('decode');
      });
    if (failure === 'draw')
      globalThis.document.createElement = jest.fn(() => {
        const c = canvas();
        contexts[0].drawImage.mockImplementation(() => {
          throw new Error('draw');
        });
        return c;
      }) as any;
    const result = rasterizeSvgUrlToImageBitmap(url(), 40, 20);
    expect(() =>
      failure === 'load' ? images[0].onerror!() : images[0].onload!(),
    ).not.toThrow();
    await expect(result).resolves.toBeNull();
  },
);

it('coalesces an identical request and marks the material after completion', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  schedule(t.entity, source);
  expect(images).toHaveLength(1);
  const image = bitmap();
  await complete(0, image);
  expect(getFillLayerDecodedBitmap(source)).toBe(image);
  expect(t.raw.add).toHaveBeenCalledWith(MaterialDirty);
});

it.each(['png', 'sufficient'])(
  'skips %s sources without starting an image load',
  (reason) => {
    const source = reason === 'png' ? '/a.png' : url(),
      t = target(source);
    schedule(
      t.entity,
      source,
      reason === 'sufficient' ? { targetW: 20.5, targetH: 10.5 } : {},
    );
    expect(images).toHaveLength(0);
  },
);

it('retries after a failed raster', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  images[0].onerror!();
  await settle();
  schedule(t.entity, source);
  expect(images).toHaveLength(2);
  await complete(1);
  expect(getFillLayerDecodedBitmap(source)).toBeDefined();
});

it('closes an obsolete result after the requested dimensions change', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  schedule(t.entity, source, { targetW: 80, targetH: 40 });
  const old = bitmap();
  await complete(0, old);
  expect(old.close).toHaveBeenCalledTimes(1);
  expect(getFillLayerDecodedBitmap(source)).toBeUndefined();
  await complete(1);
  expect(getFillLayerDecodedBitmap(source)).toMatchObject({
    width: 80,
    height: 40,
  });
});

it('rejects an old task even when reset schedules the identical dimensions', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  resetFillImageSvgRerasterSchedule(t.entity);
  schedule(t.entity, source);
  const old = bitmap();
  await complete(0, old);
  expect(old.close).toHaveBeenCalledTimes(1);
  expect(getFillLayerDecodedBitmap(source)).toBeUndefined();
  const current = bitmap();
  await complete(1, current);
  expect(getFillLayerDecodedBitmap(source)).toBe(current);
});

it('does not let an old failure clear the current in-flight request after reset', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  resetFillImageSvgRerasterSchedule(t.entity);
  schedule(t.entity, source);
  images[0].onerror!();
  await settle();
  schedule(t.entity, source);
  expect(images).toHaveLength(2);
  await complete(1);
});

it.each(['removed', 'disabled', 'changed', 'deleted'] as const)(
  'releases a completed bitmap when the target is %s',
  async (reason) => {
    const source = url(),
      t = target(source);
    schedule(t.entity, source);
    if (reason === 'removed') t.setLayers();
    if (reason === 'disabled')
      t.setLayers([{ type: 'image', value: source, enabled: false }]);
    if (reason === 'changed')
      t.setLayers([{ type: 'image', value: '/other.svg' }]);
    if (reason === 'deleted') t.raw.alive = false;
    const image = bitmap();
    await complete(0, image);
    expect(image.close).toHaveBeenCalledTimes(1);
    expect(getFillLayerDecodedBitmap(source)).toBeUndefined();
    expect(t.raw.add).not.toHaveBeenCalled();
  },
);

it('preserves source aspect ratio in the shared cache instead of baking a layer crop', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source, {
    targetW: 40,
    targetH: 40,
    rasterOptions: { objectFit: 'cover', objectPosition: 'left top' },
  });
  await complete(0);
  expect(getFillLayerDecodedBitmap(source)).toMatchObject({
    width: 80,
    height: 40,
  });
  expect(contexts[0].drawImage).toHaveBeenCalledWith(
    images[0],
    0,
    0,
    20,
    10,
    0,
    0,
    80,
    40,
  );
});

it('does not downgrade a shared SVG cache when a smaller canvas finishes later', async () => {
  const source = url(),
    a = target(source),
    b = target(source);
  schedule(a.entity, source);
  schedule(b.entity, source, { targetW: 80, targetH: 40 });
  const larger = bitmap(80, 40);
  await complete(1, larger);
  const smaller = bitmap();
  await complete(0, smaller);
  expect(getFillLayerDecodedBitmap(source)).toBe(larger);
  expect(smaller.close).toHaveBeenCalledTimes(1);
  expect(larger.close).not.toHaveBeenCalled();
  expect(a.raw.add).toHaveBeenCalledWith(MaterialDirty);
});

it.each(['none', 'scale-down'] as const)(
  'does not supersample intrinsic-sized %s fills',
  (objectFit) => {
    const source = url(),
      t = target(source);
    schedule(t.entity, source, { rasterOptions: { objectFit } });
    expect(images).toHaveLength(0);
  },
);

it('caps oversized source rasters while preserving their ratio', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source, { targetW: 10000, targetH: 10000 });
  await complete(0);
  expect(getFillLayerDecodedBitmap(source)).toMatchObject({
    width: 4096,
    height: 2048,
  });
});

it('skips a source already at the raster limit', () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source, {
    sourceW: 4096,
    sourceH: 2048,
    targetW: 5000,
    targetH: 2500,
  });
  expect(images).toHaveLength(0);
});

it.each([{ sourceW: 0 }, { sourceH: NaN }, { targetW: Infinity }])(
  'ignores invalid scheduler dimensions %j',
  (patch) => {
    const source = url(),
      t = target(source);
    schedule(t.entity, source, patch);
    expect(images).toHaveLength(0);
  },
);

it('releases the raster if the ECS entity reference has been invalidated', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  Object.defineProperty(t.raw, 'alive', {
    get() {
      throw new Error('Entity no longer valid');
    },
  });
  const image = bitmap();
  await complete(0, image);
  expect(image.close).toHaveBeenCalledTimes(1);
  expect(getFillLayerDecodedBitmap(source)).toBeUndefined();
});

it('retains original intrinsic dimensions across successive resolution upgrades', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  await complete(0);
  schedule(t.entity, source, {
    sourceW: 40,
    sourceH: 20,
    targetW: 80,
    targetH: 40,
  });
  await complete(1);
  expect(getFillLayerDecodedBitmap(source)).toMatchObject({
    width: 80,
    height: 40,
  });
  expect(getFillLayerDecodedBitmapIntrinsicSize(source)).toEqual({
    width: 20,
    height: 10,
  });
});

it('continues after obsolete bitmap cleanup throws', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source);
  resetFillImageSvgRerasterSchedule(t.entity);
  schedule(t.entity, source);
  const old = bitmap();
  (old.close as jest.Mock).mockImplementation(() => {
    throw new Error('already closed');
  });
  await complete(0, old);
  await complete(1);
  expect(getFillLayerDecodedBitmap(source)).toBeDefined();
});

it('uses the loaded SVG aspect ratio when the renderer only knows a 1x1 placeholder', async () => {
  const source = url(),
    t = target(source);
  schedule(t.entity, source, {
    sourceW: 1,
    sourceH: 1,
    targetW: 160,
    targetH: 160,
  });
  await complete(0);
  expect(getFillLayerDecodedBitmap(source)).toMatchObject({
    width: 320,
    height: 160,
  });
  expect(getFillLayerDecodedBitmapIntrinsicSize(source)).toEqual({
    width: 20,
    height: 10,
  });
});
