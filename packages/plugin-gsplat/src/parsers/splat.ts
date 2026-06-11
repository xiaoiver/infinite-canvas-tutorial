import { GsplatData } from '../GsplatData';

/**
 * Parse the compact antimatter15 `.splat` binary format into {@link GsplatData}.
 *
 * Layout is 32 bytes per gaussian:
 * - `0..12`  position `xyz` as 3 × float32
 * - `12..24` scale `xyz` as 3 × float32 (already linear)
 * - `24..28` color `rgba` as 4 × uint8 (alpha = opacity)
 * - `28..32` rotation as 4 × uint8, packed `(w, x, y, z)` with `q = (b-128)/128`
 *
 * @see https://github.com/antimatter15/splat
 */
export function parseSplat(buffer: ArrayBuffer): GsplatData {
  const ROW = 32;
  if (buffer.byteLength % ROW !== 0) {
    throw new Error(
      `parseSplat: buffer length ${buffer.byteLength} is not a multiple of ${ROW}`,
    );
  }
  const count = buffer.byteLength / ROW;
  const f32 = new Float32Array(buffer);
  const u8 = new Uint8Array(buffer);

  const centers = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const f = i * 8; // 32 bytes / 4 = 8 float32 slots
    const b = i * ROW;

    centers[i * 3 + 0] = f32[f + 0];
    centers[i * 3 + 1] = f32[f + 1];
    centers[i * 3 + 2] = f32[f + 2];

    scales[i * 3 + 0] = f32[f + 3];
    scales[i * 3 + 1] = f32[f + 4];
    scales[i * 3 + 2] = f32[f + 5];

    colors[i * 4 + 0] = u8[b + 24] / 255;
    colors[i * 4 + 1] = u8[b + 25] / 255;
    colors[i * 4 + 2] = u8[b + 26] / 255;
    colors[i * 4 + 3] = u8[b + 27] / 255;

    // Packed as (w, x, y, z); decode and re-emit as (x, y, z, w).
    const qw = (u8[b + 28] - 128) / 128;
    const qx = (u8[b + 29] - 128) / 128;
    const qy = (u8[b + 30] - 128) / 128;
    const qz = (u8[b + 31] - 128) / 128;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    rotations[i * 4 + 0] = qx / len;
    rotations[i * 4 + 1] = qy / len;
    rotations[i * 4 + 2] = qz / len;
    rotations[i * 4 + 3] = qw / len;
  }

  return new GsplatData({ count, centers, scales, rotations, colors });
}
