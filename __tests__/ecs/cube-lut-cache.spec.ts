import {
  Format,
  TextureDimension,
  TextureUsage,
  type Device,
} from '../../packages/device-api/src';
import {
  getCubeLutGpu,
  listRegisteredCubeLutKeys,
  registerCubeLutFromText,
  unregisterAllCubeLuts,
  unregisterCubeLut,
  warnMissingCubeLutOnce,
  type LutAtlasFormat,
} from '../../packages/ecs/src/utils/cube-lut-cache';

const cube = `LUT_3D_SIZE 2
DOMAIN_MIN 0.1 0.2 0.3
DOMAIN_MAX 1 2 3
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1`;

function fixture() {
  const textures: { setImageData: jest.Mock; destroy: jest.Mock }[] = [];
  const createTexture = jest.fn((_descriptor: unknown) => {
    const texture = { setImageData: jest.fn(), destroy: jest.fn() };
    textures.push(texture);
    return texture;
  });
  return {
    device: { createTexture } as unknown as Device,
    createTexture,
    textures,
  };
}

it.each<[LutAtlasFormat, Format, number]>([
  ['u8', Format.U8_RGBA_NORM, 255],
  ['f16', Format.F16_RGBA, 0x3c00],
  ['f32', Format.F32_RGBA, 1],
])(
  'uploads %s voxels in red-fastest order and preserves the input domain',
  (atlasFormat, format, one) => {
    const { device, createTexture, textures } = fixture();
    registerCubeLutFromText(device, 'identity', cube, { atlasFormat });
    expect(createTexture).toHaveBeenCalledWith({
      dimension: TextureDimension.TEXTURE_3D,
      format,
      width: 2,
      height: 2,
      depthOrArrayLayers: 2,
      mipLevelCount: 1,
      usage: TextureUsage.SAMPLED,
    });
    const [pixels] = textures[0].setImageData.mock.calls[0][0];
    expect(pixels).toBeInstanceOf(
      atlasFormat === 'u8'
        ? Uint8Array
        : atlasFormat === 'f16'
        ? Uint16Array
        : Float32Array,
    );
    expect([...pixels]).toEqual([
      0,
      0,
      0,
      one,
      one,
      0,
      0,
      one,
      0,
      one,
      0,
      one,
      one,
      one,
      0,
      one,
      0,
      0,
      one,
      one,
      one,
      0,
      one,
      one,
      0,
      one,
      one,
      one,
      one,
      one,
      one,
      one,
    ]);
    expect(getCubeLutGpu(device, 'identity')).toEqual({
      texture: textures[0],
      size: 2,
      domainMin: [0.1, 0.2, 0.3],
      domainMax: [1, 2, 3],
    });
    unregisterAllCubeLuts(device);
  },
);

it.each<[LutAtlasFormat, number[]]>([
  ['u8', [0, 128, 255, 255]],
  ['f16', [0xbc00, 0x3800, 0x4000, 0x3c00]],
  ['f32', [-1, 0.5, 2, 1]],
])(
  'preserves HDR values in float formats and clamps normalized bytes (%s)',
  (atlasFormat, expected) => {
    const { device, textures } = fixture();
    registerCubeLutFromText(device, 'hdr', 'LUT_3D_SIZE 1\n-1 0.5 2', {
      atlasFormat,
    });
    expect([...textures[0].setImageData.mock.calls[0][0][0]]).toEqual(expected);
    unregisterAllCubeLuts(device);
  },
);

it('isolates devices and keeps repeated registration idempotent until explicit removal', () => {
  const a = fixture();
  const b = fixture();
  expect(getCubeLutGpu(a.device, 'same')).toBeUndefined();
  expect(listRegisteredCubeLutKeys(a.device)).toEqual([]);
  unregisterCubeLut(a.device, 'missing');
  unregisterAllCubeLuts(a.device);
  registerCubeLutFromText(a.device, 'same', cube);
  const first = getCubeLutGpu(a.device, 'same');
  registerCubeLutFromText(a.device, 'same', 'ignored invalid replacement', {
    atlasFormat: 'f32',
  });
  expect(getCubeLutGpu(a.device, 'same')).toBe(first);
  expect(a.createTexture).toHaveBeenCalledTimes(1);
  registerCubeLutFromText(b.device, 'same', cube);
  expect(getCubeLutGpu(b.device, 'same')!.texture).not.toBe(first!.texture);
  unregisterCubeLut(a.device, 'same');
  unregisterCubeLut(a.device, 'same');
  expect(a.textures[0].destroy).toHaveBeenCalledTimes(1);
  expect(getCubeLutGpu(a.device, 'same')).toBeUndefined();
  expect(b.textures[0].destroy).not.toHaveBeenCalled();
  registerCubeLutFromText(a.device, 'same', cube);
  registerCubeLutFromText(a.device, 'second', cube);
  const keys = listRegisteredCubeLutKeys(a.device);
  expect(keys).toEqual(['same', 'second']);
  keys.pop();
  expect(listRegisteredCubeLutKeys(a.device)).toEqual(['same', 'second']);
  unregisterAllCubeLuts(a.device);
  unregisterAllCubeLuts(a.device);
  unregisterAllCubeLuts(b.device);
  expect(listRegisteredCubeLutKeys(a.device)).toEqual([]);
  [...a.textures, ...b.textures].forEach((texture) =>
    expect(texture.destroy).toHaveBeenCalledTimes(1),
  );
});

it('does not allocate GPU resources or reserve a key for malformed input', () => {
  const { device, createTexture } = fixture();
  expect(() =>
    registerCubeLutFromText(device, 'retry', 'invalid cube'),
  ).toThrow('Missing LUT_3D_SIZE');
  expect(createTexture).not.toHaveBeenCalled();
  expect(listRegisteredCubeLutKeys(device)).toEqual([]);
  registerCubeLutFromText(device, 'retry', cube);
  expect(listRegisteredCubeLutKeys(device)).toEqual(['retry']);
  unregisterAllCubeLuts(device);
});

it('destroys a texture after failed upload and allows registration to retry', () => {
  const { device, createTexture, textures } = fixture();
  const failure = new Error('upload failed');
  const failed = {
    destroy: jest.fn(),
    setImageData: jest.fn(() => {
      throw failure;
    }),
  };
  createTexture.mockReturnValueOnce(failed);
  expect(() => registerCubeLutFromText(device, 'retry', cube)).toThrow(failure);
  expect(failed.destroy).toHaveBeenCalledTimes(1);
  expect(getCubeLutGpu(device, 'retry')).toBeUndefined();
  expect(listRegisteredCubeLutKeys(device)).toEqual([]);
  registerCubeLutFromText(device, 'retry', cube);
  expect(getCubeLutGpu(device, 'retry')!.texture).toBe(textures[0]);
  unregisterAllCubeLuts(device);
  expect(failed.destroy).toHaveBeenCalledTimes(1);
  expect(textures[0].destroy).toHaveBeenCalledTimes(1);
});

it('warns only once per missing logical key', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    warnMissingCubeLutOnce('cube-cache-test-a');
    warnMissingCubeLutOnce('cube-cache-test-a');
    warnMissingCubeLutOnce('cube-cache-test-b');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('cube-cache-test-a');
    expect(warn.mock.calls[1][0]).toContain('cube-cache-test-b');
  } finally {
    warn.mockRestore();
  }
});
