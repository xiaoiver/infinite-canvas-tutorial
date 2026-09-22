import {
  Device,
  Format,
  Texture,
  TextureDescriptor,
  TextureDimension,
  TextureUsage,
} from '@antv/g-device-api';
import { float32ToFloat16Bits } from './float32-to-float16-bits';
import { parseAdobeCube } from './parse-adobe-cube';

export type LutAtlasFormat = 'u8' | 'f16' | 'f32';

export type RegisterCubeLutOptions = {
  /**
   * GPU volume pixel format.
   * - `u8` (default): 8-bit normalized; values outside [0,1] are clamped when sampling.
   * - `f16` / `f32`: full table precision (HDR / wide DOMAIN ok); uses `parsed.volumeRgbaF32`.
   */
  atlasFormat?: LutAtlasFormat;
};

export type CubeLutGpu = {
  /** `TEXTURE_3D`, edge length {@link size} (Adobe / three.js voxel order). */
  texture: Texture;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
};

const cubeLutGpuByKey = new WeakMap<Device, Map<string, CubeLutGpu>>();

const warnedMissingLutKeys = new Set<string>();

/** One console warning per logical LUT key when a filter references an unregistered LUT. */
export function warnMissingCubeLutOnce(lutKey: string): void {
  if (warnedMissingLutKeys.has(lutKey)) {
    return;
  }
  warnedMissingLutKeys.add(lutKey);
  console.warn(
    `[LUT] Missing registered cube for key "${lutKey}". Use registerCubeLutFromText(device, "${lutKey}", cubeText).`,
  );
}

function atlasFormatToDeviceFormat(
  atlasFormat: LutAtlasFormat,
): Format {
  if (atlasFormat === 'f32') {
    return Format.F32_RGBA;
  }
  if (atlasFormat === 'f16') {
    return Format.F16_RGBA;
  }
  return Format.U8_RGBA_NORM;
}

function buildVolumePixelData(
  rgbaF32: Float32Array,
  atlasFormat: 'f16' | 'f32',
): Uint16Array | Float32Array {
  const n = rgbaF32.length;
  if (atlasFormat === 'f32') {
    const out = new Float32Array(n);
    out.set(rgbaF32);
    return out;
  }
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = float32ToFloat16Bits(rgbaF32[i]!);
  }
  return out;
}

/**
 * Register a named `.cube` LUT as a `TEXTURE_3D` (Adobe / three.js `LUTCubeLoader` voxel order;
 * shader sampling aligned with three.js `LUTPass` half-texel + `intensity` mix).
 * Call once per logical name; idempotent if the same key is registered again.
 */
export function registerCubeLutFromText(
  device: Device,
  lutKey: string,
  cubeText: string,
  options?: RegisterCubeLutOptions,
): void {
  let byKey = cubeLutGpuByKey.get(device);
  if (!byKey) {
    byKey = new Map();
    cubeLutGpuByKey.set(device, byKey);
  }
  if (byKey.has(lutKey)) {
    return;
  }

  const parsed = parseAdobeCube(cubeText);
  const atlasFormat = options?.atlasFormat ?? 'u8';
  const pixelFormat = atlasFormatToDeviceFormat(atlasFormat);
  const s = parsed.size;
  const pixelData =
    atlasFormat === 'u8'
      ? parsed.volumeRgba
      : buildVolumePixelData(parsed.volumeRgbaF32, atlasFormat);

  const texture = device.createTexture({
    dimension: TextureDimension.TEXTURE_3D,
    format: pixelFormat,
    width: s,
    height: s,
    depthOrArrayLayers: s,
    mipLevelCount: 1,
    usage: TextureUsage.SAMPLED,
  } as TextureDescriptor);

  texture.setImageData([pixelData]);

  byKey.set(lutKey, {
    texture,
    size: parsed.size,
    domainMin: parsed.domainMin,
    domainMax: parsed.domainMax,
  });
}

export function getCubeLutGpu(
  device: Device,
  lutKey: string,
): CubeLutGpu | undefined {
  return cubeLutGpuByKey.get(device)?.get(lutKey);
}

/** Logical keys currently registered on this device (see {@link registerCubeLutFromText}). */
export function listRegisteredCubeLutKeys(device: Device): string[] {
  const byKey = cubeLutGpuByKey.get(device);
  if (!byKey || byKey.size === 0) {
    return [];
  }
  return [...byKey.keys()];
}

export function unregisterCubeLut(device: Device, lutKey: string): void {
  const byKey = cubeLutGpuByKey.get(device);
  const gpu = byKey?.get(lutKey);
  if (!gpu) {
    return;
  }
  gpu.texture.destroy();
  byKey!.delete(lutKey);
}

export function unregisterAllCubeLuts(device: Device): void {
  const byKey = cubeLutGpuByKey.get(device);
  if (!byKey) {
    return;
  }
  for (const gpu of byKey.values()) {
    gpu.texture.destroy();
  }
  byKey.clear();
}
