import {
  decodeRadianceHDR,
  ENV_ATLAS_HEIGHT,
  ENV_ATLAS_WIDTH,
  prefilterEnvironment,
} from '../../packages/ecs/src/utils/environment-map';

it('decodes Radiance scanline RLE into linear HDR pixels', () => {
  const header = new TextEncoder().encode(
    '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 8\n',
  );
  const body = new Uint8Array([
    2, 2, 0, 8, 136, 128, 136, 64, 136, 32, 136, 129,
  ]);
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header);
  bytes.set(body, header.length);
  const environment = decodeRadianceHDR(bytes);
  expect([environment.width, environment.height]).toEqual([8, 1]);
  expect(environment.pixels.slice(0, 4)).toEqual(
    new Float32Array([128.5 / 128, 64.5 / 128, 32.5 / 128, 1]),
  );
  expect(environment.pixels.slice(-4)).toEqual(environment.pixels.slice(0, 4));
  expect(() => decodeRadianceHDR(bytes.subarray(0, bytes.length - 1))).toThrow(
    'Truncated',
  );
});

it('prefilters constant HDR radiance into all roughness levels without dimming it', () => {
  const width = 16;
  const height = 8;
  const pixels = new Float32Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([2, 1, 0.5, 1], i);
  const atlas = prefilterEnvironment({ width, height, pixels });
  expect(atlas.pixels).toHaveLength(ENV_ATLAS_WIDTH * ENV_ATLAS_HEIGHT * 4);
  let top = 0;
  for (let level = 0; level < 5; level++) {
    const offset = (top * ENV_ATLAS_WIDTH + 1) * 4;
    const multiplier = (atlas.pixels[offset + 3] / 255) * 16;
    expect((atlas.pixels[offset] / 255) * multiplier).toBeCloseTo(2, 1);
    expect((atlas.pixels[offset + 1] / 255) * multiplier).toBeCloseTo(1, 1);
    top += 64 >> level;
  }
  expect(atlas.irradiance[0]).toBeGreaterThan(0);
});
