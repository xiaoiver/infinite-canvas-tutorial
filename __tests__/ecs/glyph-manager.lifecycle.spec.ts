import { createCanvas } from 'canvas';
import { type Device, Format } from '../../packages/device-api/src';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import {
  GlyphManager,
  getDefaultCharacterSet,
} from '../../packages/ecs/src/utils/glyph/glyph-manager';
import { TinySDF } from '../../packages/ecs/src/utils/glyph/tiny-sdf';
import { GlyphAtlas } from '../../packages/ecs/src/utils/glyph/glyph-atlas';
import { RGBAImage } from '../../packages/ecs/src/utils/glyph/alpha-image';
import type { BitmapFont } from '../../packages/ecs/src/utils/bitmap-font/BitmapFont';

const adapter = DOMAdapter.get();
let draw: jest.SpyInstance;
beforeEach(() => {
  DOMAdapter.set({
    ...adapter,
    createCanvas: (w, h) =>
      createCanvas(w!, h!) as unknown as HTMLCanvasElement,
  });
  // Rasterization has independent pixel tests. Keep packing and GPU ownership real.
  draw = jest.spyOn(TinySDF.prototype, 'draw').mockImplementation((char) => ({
    data: new Uint8ClampedArray([char.codePointAt(0)! % 255, 20, 30, 255]),
    width: 1,
    height: 1,
    glyphWidth: 4,
    glyphHeight: 4,
    glyphLeft: 0,
    glyphTop: 4,
    glyphAdvance: 40,
  }));
});
afterEach(() => {
  draw.mockRestore();
  DOMAdapter.set(adapter);
});

function fixture() {
  const textures: { destroy: jest.Mock; setImageData: jest.Mock }[] = [];
  const createTexture = jest.fn((_descriptor: unknown) => {
    const texture = { destroy: jest.fn(), setImageData: jest.fn() };
    textures.push(texture);
    return texture;
  });
  const manager = new GlyphManager();
  const generate = (text = 'A', stack = 'sans') =>
    manager.generateAtlas(
      stack,
      'sans-serif',
      '400',
      '',
      text,
      { createTexture } as unknown as Device,
      false,
      'red',
    );
  return { manager, generate, createTexture, textures };
}

it('preloads ASCII once, deduplicates graphemes and reuses unchanged atlas data', () => {
  const { manager, generate, createTexture, textures } = fixture();
  generate('A👩‍🚀👩‍🚀');
  expect(draw).toHaveBeenCalledTimes(getDefaultCharacterSet().length + 1);
  expect(Object.keys(manager.getMap().sans)).toContain('👩‍🚀');
  const atlas = manager.getAtlas();
  const map = manager.getMap();
  generate('B👩‍🚀A');
  expect(manager.getAtlas()).toBe(atlas);
  expect(manager.getMap()).toBe(map);
  expect(createTexture).toHaveBeenCalledTimes(1);
  expect(createTexture.mock.calls[0][0]).toMatchObject({
    format: Format.U8_RGBA_NORM,
    width: atlas.image.width,
    height: atlas.image.height,
  });
  expect(textures[0].setImageData).toHaveBeenCalledWith([atlas.image.data]);
  manager.destroy();
});

it('publishes a complete replacement before releasing the old atlas', () => {
  const { manager, generate, textures } = fixture();
  generate();
  const first = manager.getAtlas();
  const a = manager.getMap().sans.A;
  textures[0].destroy.mockImplementation(() => {
    expect(manager.getAtlasTexture()).toBe(textures[1]);
    expect(manager.getAtlas()).not.toBe(first);
    expect(textures[1].setImageData).toHaveBeenCalledTimes(1);
  });
  draw.mockClear();
  generate('ΩΩA');
  expect(draw).toHaveBeenCalledTimes(1);
  expect(manager.getMap().sans.A).toBe(a);
  expect(manager.getAtlas().positions.sans.Ω).toBeDefined();
  expect(textures[0].destroy).toHaveBeenCalledTimes(1);
  manager.destroy();
});

it.each(['allocate', 'upload'] as const)(
  'keeps the previous atlas usable after a failed %s and retries missing glyphs',
  (failurePoint) => {
    const { manager, generate, createTexture, textures } = fixture();
    generate();
    const oldMap = manager.getMap();
    const oldAtlas = manager.getAtlas();
    const error = new Error('GPU failure');
    const failed = {
      destroy: jest.fn(),
      setImageData: jest.fn(() => {
        throw error;
      }),
    };
    if (failurePoint === 'allocate')
      createTexture.mockImplementationOnce(() => {
        throw error;
      });
    else createTexture.mockReturnValueOnce(failed);
    expect(() => generate('Ω')).toThrow(error);
    expect(manager.getMap()).toBe(oldMap);
    expect(manager.getMap().sans.Ω).toBeUndefined();
    expect(manager.getAtlas()).toBe(oldAtlas);
    expect(manager.getAtlasTexture()).toBe(textures[0]);
    expect(textures[0].destroy).not.toHaveBeenCalled();
    expect(failed.destroy).toHaveBeenCalledTimes(
      failurePoint === 'upload' ? 1 : 0,
    );
    generate('Ω');
    expect(manager.getAtlas().positions.sans.Ω).toBeDefined();
    expect(manager.getAtlasTexture()).toBe(textures[1]);
    expect(textures[0].destroy).toHaveBeenCalledTimes(1);
    manager.destroy();
  },
);

it('does not publish a partially initialized atlas when the first upload fails', () => {
  const { manager, generate, createTexture } = fixture();
  const failed = {
    destroy: jest.fn(),
    setImageData: jest.fn(() => {
      throw new Error('upload');
    }),
  };
  createTexture.mockReturnValueOnce(failed);
  expect(() => generate()).toThrow('upload');
  expect(manager.getAtlasTexture()).toBeUndefined();
  expect(manager.getAtlas()).toBeUndefined();
  expect(manager.getMap()).toEqual({});
  manager.destroy();
  expect(failed.destroy).toHaveBeenCalledTimes(1);
  generate();
  expect(manager.getAtlasTexture()).toBeDefined();
  manager.destroy();
});

it('keeps font stacks separate and releases CPU/GPU caches idempotently', () => {
  const { manager, generate, textures } = fixture();
  generate('A', 'regular');
  generate('A', 'bold');
  expect(Object.keys(manager.getAtlas().positions)).toEqual([
    'regular',
    'bold',
  ]);
  manager.destroy();
  manager.destroy();
  expect(manager.getMap()).toEqual({});
  expect(manager.getAtlas()).toBeUndefined();
  expect(manager.getAtlasTexture()).toBeUndefined();
  textures.forEach((texture) =>
    expect(texture.destroy).toHaveBeenCalledTimes(1),
  );
  generate('A', 'regular');
  expect(manager.getAtlasTexture()).toBe(textures[2]);
  manager.destroy();
  textures.forEach((texture) =>
    expect(texture.destroy).toHaveBeenCalledTimes(1),
  );
});

it('packs distinct glyph pixels with transparent sampling gutters and skips empty bitmaps', () => {
  const metrics = { advance: 10, left: 0, top: 1, width: 1, height: 1 };
  const glyph = (id: string, rgba: number[]) => ({
    id,
    metrics,
    bitmap: new RGBAImage({ width: 1, height: 1 }, new Uint8Array(rgba)),
  });
  const atlas = new GlyphAtlas({
    sans: {
      A: glyph('A', [255, 0, 0, 255]),
      B: glyph('B', [0, 0, 255, 255]),
      ' ': { id: ' ', metrics, bitmap: new RGBAImage({ width: 0, height: 0 }) },
    },
  });
  const at = (x: number, y: number) => [
    ...atlas.image.data.slice(
      (y * atlas.image.width + x) * 4,
      (y * atlas.image.width + x) * 4 + 4,
    ),
  ];
  for (const [id, rgba] of [
    ['A', [255, 0, 0, 255]],
    ['B', [0, 0, 255, 255]],
  ] as const) {
    const { rect } = atlas.positions.sans[id];
    const x = rect.x + (rect.w - 1) / 2;
    const y = rect.y + (rect.h - 1) / 2;
    expect(at(x, y)).toEqual(rgba);
    expect(at(x - 1, y)).toEqual([0, 0, 0, 0]);
    expect(at(x + 1, y)).toEqual([0, 0, 0, 0]);
  }
  expect(atlas.positions.sans[' ']).toBeUndefined();
  expect(new GlyphAtlas({}).image).toMatchObject({
    width: 1,
    height: 1,
    data: new Uint8Array(4),
  });
});

it.each(['left', 'start', 'center', 'right', 'end'] as CanvasTextAlign[])(
  'keeps a shared origin on every line with %s alignment',
  (align) => {
    const { manager, generate } = fixture();
    generate('AB');
    const glyphs = manager.layout(
      ['AB', '', 'A'],
      'sans',
      30,
      align,
      2,
      undefined,
      2,
      false,
      40,
      5,
    );
    const justify =
      align === 'center' ? 0.5 : ['right', 'end'].includes(align) ? 1 : 0;
    expect(glyphs.map(({ x, y }) => [x, y])).toEqual([
      [40 - 42 * justify, 5],
      [62 - 42 * justify, 5],
      [40 - 20 * justify, 65],
    ]);
    manager.destroy();
  },
);

it('defaults layout scale to one and keeps composed characters intact', () => {
  const { manager, generate } = fixture();
  generate('👩‍🚀A');
  expect(
    manager
      .layout(['👩‍🚀A'], 'sans', 20, 'left', 0)
      .map(({ glyph, x }) => [glyph, x]),
  ).toEqual([
    ['👩‍🚀', 0],
    ['A', 10],
  ]);
  manager.destroy();
});

it.each([true, false])(
  'applies bitmap kerning before positioning the second glyph (enabled=%s)',
  (kerning) => {
    const manager = new GlyphManager();
    const font = {
      chars: {
        A: { xAdvance: 10, kerning: {} },
        V: { xAdvance: 12, kerning: { A: -3 } },
      },
    } as unknown as BitmapFont;
    const glyphs = manager.layout(
      ['AV', 'V'],
      'bitmap',
      30,
      'left',
      1,
      font,
      2,
      kerning,
      5,
      10,
    );
    expect(glyphs.map(({ x, y }) => [x, y])).toEqual([
      [5, 10],
      [kerning ? 20 : 26, 10],
      [5, 40],
    ]);
    manager.destroy();
  },
);
