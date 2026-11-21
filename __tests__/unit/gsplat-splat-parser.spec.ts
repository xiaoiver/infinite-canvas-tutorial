import { parseSplat } from '../../packages/plugin-gsplat/src/parsers/splat';
import { GsplatData } from '../../packages/plugin-gsplat/src/GsplatData';

/** Build a single-gaussian `.splat` record (32 bytes). */
function makeSplat(
  pos: [number, number, number],
  scale: [number, number, number],
  rgba: [number, number, number, number],
  quatWXYZBytes: [number, number, number, number],
): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const f = new Float32Array(buf);
  const u8 = new Uint8Array(buf);
  f[0] = pos[0];
  f[1] = pos[1];
  f[2] = pos[2];
  f[3] = scale[0];
  f[4] = scale[1];
  f[5] = scale[2];
  u8[24] = rgba[0];
  u8[25] = rgba[1];
  u8[26] = rgba[2];
  u8[27] = rgba[3];
  u8[28] = quatWXYZBytes[0];
  u8[29] = quatWXYZBytes[1];
  u8[30] = quatWXYZBytes[2];
  u8[31] = quatWXYZBytes[3];
  return buf;
}

describe('parseSplat', () => {
  it('parses a single gaussian into GsplatData', () => {
    // Identity quaternion (w=1) packs as bytes (255, 128, 128, 128).
    const buf = makeSplat([1, 2, 3], [0.1, 0.2, 0.3], [255, 128, 0, 200], [
      255, 128, 128, 128,
    ]);
    const data = parseSplat(buf);

    expect(data).toBeInstanceOf(GsplatData);
    expect(data.count).toBe(1);
    expect(Array.from(data.centers)).toEqual([1, 2, 3]);
    expect(data.scales[0]).toBeCloseTo(0.1, 5);
    expect(data.scales[2]).toBeCloseTo(0.3, 5);

    // Colors normalized to [0, 1].
    expect(data.colors[0]).toBeCloseTo(1, 5);
    expect(data.colors[1]).toBeCloseTo(128 / 255, 5);
    expect(data.colors[2]).toBeCloseTo(0, 5);
    expect(data.colors[3]).toBeCloseTo(200 / 255, 5);

    // Identity quaternion re-emitted as (x, y, z, w) = (0, 0, 0, 1).
    expect(data.rotations[0]).toBeCloseTo(0, 5);
    expect(data.rotations[1]).toBeCloseTo(0, 5);
    expect(data.rotations[2]).toBeCloseTo(0, 5);
    expect(data.rotations[3]).toBeCloseTo(1, 5);
  });

  it('parses multiple gaussians', () => {
    const a = makeSplat([0, 0, 0], [1, 1, 1], [10, 20, 30, 40], [255, 128, 128, 128]);
    const b = makeSplat([5, 6, 7], [2, 2, 2], [50, 60, 70, 80], [255, 128, 128, 128]);
    const merged = new Uint8Array(64);
    merged.set(new Uint8Array(a), 0);
    merged.set(new Uint8Array(b), 32);

    const data = parseSplat(merged.buffer);
    expect(data.count).toBe(2);
    expect(Array.from(data.centers.subarray(3, 6))).toEqual([5, 6, 7]);
  });

  it('rejects buffers that are not a multiple of 32 bytes', () => {
    expect(() => parseSplat(new ArrayBuffer(31))).toThrow();
  });
});
