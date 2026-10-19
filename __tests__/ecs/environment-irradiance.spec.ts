import { computeEnvironmentIrradiance } from '../../packages/ecs/src/utils/environment-irradiance';

function panorama(width: number, height: number, color: (y: number) => number) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      pixels.fill(color(y), offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  return pixels;
}

describe('environment diffuse irradiance', () => {
  it('preserves a uniform white environment independently of direction', () => {
    const sh = computeEnvironmentIrradiance(
      panorama(64, 32, () => 255),
      64,
      32,
    );
    expect(sh).toHaveLength(36);
    expect(sh[0]).toBeCloseTo(4 * Math.PI * 0.282095, 3);
    expect(sh[1]).toBeCloseTo(sh[0], 5);
    expect(sh[2]).toBeCloseTo(sh[0], 5);
    for (let i = 1; i < 9; i++) expect(Math.abs(sh[i * 4])).toBeLessThan(0.02);
  });

  it('makes a bright sky contribute positive upward irradiance', () => {
    const width = 64;
    const height = 32;
    const sh = computeEnvironmentIrradiance(
      panorama(width, height, (y) => (y < height / 2 ? 255 : 0)),
      width,
      height,
    );
    expect(sh[0]).toBeCloseTo(2 * Math.PI * 0.282095, 3);
    expect(sh[4]).toBeGreaterThan(0.9); // Y1,y after cosine convolution
    expect(Math.abs(sh[8])).toBeLessThan(0.02); // no longitudinal bias
    expect(sh[7]).toBe(0); // std140 padding
  });

  it('converts authored sRGB channels to linear radiance', () => {
    const sh = computeEnvironmentIrradiance(
      panorama(64, 32, () => 128),
      64,
      32,
    );
    const white = 4 * Math.PI * 0.282095;
    expect(sh[0] / white).toBeCloseTo(0.21586, 3);
  });
});
