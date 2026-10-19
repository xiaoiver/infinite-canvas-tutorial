import { DOMAdapter } from '../environment';
import { computeLinearEnvironmentIrradiance } from './environment-irradiance';

export const ENV_ATLAS_WIDTH = 128;
export const ENV_ATLAS_HEIGHT = 124;
const LEVELS = 5;
const RGBM_RANGE = 16;

export interface LinearEnvironment {
  width: number;
  height: number;
  /** Linear RGBA, first row at the north pole. */
  pixels: Float32Array;
}

function srgbToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Read ordinary panorama images into linear pixels before filtering. */
export function environmentFromBitmap(bitmap: ImageBitmap): LinearEnvironment {
  const canvas = DOMAdapter.get().createCanvas(
    ENV_ATLAS_WIDTH,
    ENV_ATLAS_WIDTH / 2,
  );
  const context = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context)
    throw new Error('A 2D canvas is required to read environment pixels');
  context.drawImage(bitmap, 0, 0, ENV_ATLAS_WIDTH, ENV_ATLAS_WIDTH / 2);
  const source = context.getImageData(
    0,
    0,
    ENV_ATLAS_WIDTH,
    ENV_ATLAS_WIDTH / 2,
  ).data;
  const pixels = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 4) {
    pixels[i] = srgbToLinear(source[i]);
    pixels[i + 1] = srgbToLinear(source[i + 1]);
    pixels[i + 2] = srgbToLinear(source[i + 2]);
    pixels[i + 3] = source[i + 3] / 255;
  }
  return { width: ENV_ATLAS_WIDTH, height: ENV_ATLAS_WIDTH / 2, pixels };
}

/** Decode Radiance RGBE, including modern per-channel scanline RLE. */
export function decodeRadianceHDR(bytes: Uint8Array): LinearEnvironment {
  let offset = 0;
  const line = (): string => {
    const start = offset;
    while (offset < bytes.length && bytes[offset] !== 10) offset++;
    if (offset >= bytes.length) throw new Error('Truncated Radiance header');
    const value = new TextDecoder()
      .decode(bytes.subarray(start, offset))
      .trim();
    offset++;
    return value;
  };
  if (!/^#\?(RADIANCE|RGBE)$/.test(line()))
    throw new Error('Invalid Radiance header');
  let format = false;
  let headerLine: string;
  while ((headerLine = line()) !== '') {
    if (headerLine === 'FORMAT=32-bit_rle_rgbe') format = true;
  }
  if (!format) throw new Error('Unsupported Radiance pixel format');
  const match = /^([+-])Y\s+(\d+)\s+([+-])X\s+(\d+)$/.exec(line());
  if (!match) throw new Error('Unsupported Radiance image orientation');
  const height = Number(match[2]);
  const width = Number(match[4]);
  if (width < 1 || height < 1 || width * height > 16_777_216)
    throw new Error('Invalid Radiance image size');
  const pixels = new Float32Array(width * height * 4);
  const scanline = new Uint8Array(width * 4);
  const read = (): number => {
    if (offset >= bytes.length) throw new Error('Truncated Radiance pixels');
    return bytes[offset++];
  };
  for (let y = 0; y < height; y++) {
    if (
      width >= 8 &&
      width <= 32767 &&
      bytes[offset] === 2 &&
      bytes[offset + 1] === 2 &&
      ((bytes[offset + 2] << 8) | bytes[offset + 3]) === width
    ) {
      offset += 4;
      for (let channel = 0; channel < 4; channel++) {
        let x = 0;
        while (x < width) {
          const count = read();
          if (count > 128) {
            const run = count - 128;
            const value = read();
            if (!run || x + run > width)
              throw new Error('Invalid Radiance RLE run');
            scanline.fill(
              value,
              channel * width + x,
              channel * width + x + run,
            );
            x += run;
          } else {
            if (!count || x + count > width)
              throw new Error('Invalid Radiance RLE literal');
            for (let i = 0; i < count; i++)
              scanline[channel * width + x++] = read();
          }
        }
      }
    } else {
      for (let x = 0; x < width; x++)
        for (let channel = 0; channel < 4; channel++)
          scanline[channel * width + x] = read();
    }
    const row = match[1] === '-' ? y : height - y - 1;
    for (let x = 0; x < width; x++) {
      const column = match[3] === '+' ? x : width - x - 1;
      const index = (row * width + column) * 4;
      const exponent = scanline[3 * width + x];
      const scale = exponent ? 2 ** (exponent - 136) : 0;
      for (let channel = 0; channel < 3; channel++)
        pixels[index + channel] = (scanline[channel * width + x] + 0.5) * scale;
      pixels[index + 3] = 1;
    }
  }
  return { width, height, pixels };
}

function direction(u: number, v: number): [number, number, number] {
  const longitude = (u - 0.5) * 2 * Math.PI;
  const latitude = (v - 0.5) * Math.PI;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.sin(longitude),
  ];
}

function sample(
  environment: LinearEnvironment,
  ray: readonly number[],
): [number, number, number] {
  const { pixels, width, height } = environment;
  const u = Math.atan2(ray[2], ray[0]) / (2 * Math.PI) + 0.5;
  const v = Math.asin(Math.max(-1, Math.min(1, ray[1]))) / Math.PI + 0.5;
  const px = u * width - 0.5;
  const py = (1 - v) * height - 0.5;
  const x0 = Math.floor(px);
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(py)));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = px - x0;
  const ty = Math.max(0, Math.min(1, py - y0));
  const x = (column: number) => ((column % width) + width) % width;
  const at = (column: number, row: number, channel: number) =>
    pixels[(row * width + x(column)) * 4 + channel];
  return [0, 1, 2].map(
    (channel) =>
      ((1 - tx) * at(x0, y0, channel) + tx * at(x0 + 1, y0, channel)) *
        (1 - ty) +
      ((1 - tx) * at(x0, y1, channel) + tx * at(x0 + 1, y1, channel)) * ty,
  ) as [number, number, number];
}

function radicalInverse(index: number): number {
  let bits = index;
  bits = (bits << 16) | (bits >>> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2);
  bits = ((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4);
  bits = ((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8);
  return (bits >>> 0) / 4294967296;
}

/** RGBM panorama atlas: five GGX roughness levels stacked north-at-top. */
export function prefilterEnvironment(environment: LinearEnvironment): {
  pixels: Uint8ClampedArray;
  irradiance: Float32Array;
} {
  const { width, height, pixels } = environment;
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4)
    throw new Error('Invalid environment pixels');
  const atlas = new Uint8ClampedArray(ENV_ATLAS_WIDTH * ENV_ATLAS_HEIGHT * 4);
  const diffuseSource = new Float32Array(
    ENV_ATLAS_WIDTH * (ENV_ATLAS_WIDTH / 2) * 4,
  );
  let top = 0;
  for (let level = 0; level < LEVELS; level++) {
    const levelWidth = ENV_ATLAS_WIDTH >> level;
    const levelHeight = ENV_ATLAS_WIDTH >> (level + 1);
    const roughness = level / (LEVELS - 1);
    for (let y = 0; y < levelHeight; y++)
      for (let x = 0; x < levelWidth; x++) {
        const normal = direction(
          (x + 0.5) / levelWidth,
          1 - (y + 0.5) / levelHeight,
        );
        let color: [number, number, number];
        if (level === 0) {
          color = sample(environment, normal);
          diffuseSource.set([...color, 1], (y * levelWidth + x) * 4);
        } else {
          const axis = Math.abs(normal[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
          const tangent = [
            normal[1] * axis[2] - normal[2] * axis[1],
            normal[2] * axis[0] - normal[0] * axis[2],
            normal[0] * axis[1] - normal[1] * axis[0],
          ];
          const length = Math.hypot(...tangent);
          for (let i = 0; i < 3; i++) tangent[i] /= length;
          const bitangent = [
            normal[1] * tangent[2] - normal[2] * tangent[1],
            normal[2] * tangent[0] - normal[0] * tangent[2],
            normal[0] * tangent[1] - normal[1] * tangent[0],
          ];
          const sum = [0, 0, 0];
          let weight = 0;
          for (let i = 0; i < 64; i++) {
            const phi = (2 * Math.PI * i) / 64;
            const a = roughness * roughness;
            const cosTheta = Math.sqrt(
              (1 - radicalInverse(i)) / (1 + (a * a - 1) * radicalInverse(i)),
            );
            const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
            const half = [0, 1, 2].map(
              (channel) =>
                tangent[channel] * Math.cos(phi) * sinTheta +
                bitangent[channel] * Math.sin(phi) * sinTheta +
                normal[channel] * cosTheta,
            );
            const dotVH =
              normal[0] * half[0] + normal[1] * half[1] + normal[2] * half[2];
            const ray = [0, 1, 2].map(
              (channel) => 2 * dotVH * half[channel] - normal[channel],
            );
            const dotNL = Math.max(
              0,
              normal[0] * ray[0] + normal[1] * ray[1] + normal[2] * ray[2],
            );
            if (dotNL <= 0) continue;
            const radiance = sample(environment, ray);
            for (let channel = 0; channel < 3; channel++)
              sum[channel] += radiance[channel] * dotNL;
            weight += dotNL;
          }
          color = sum.map((channel) => channel / Math.max(weight, 1e-6)) as [
            number,
            number,
            number,
          ];
        }
        const max = Math.max(...color.map((channel) => Math.max(0, channel)));
        const multiplier = Math.max(
          1 / 255,
          Math.ceil(Math.min(1, max / RGBM_RANGE) * 255) / 255,
        );
        const index = ((top + y) * ENV_ATLAS_WIDTH + x) * 4;
        for (let channel = 0; channel < 3; channel++)
          atlas[index + channel] = Math.round(
            Math.min(
              1,
              Math.max(0, color[channel]) / (multiplier * RGBM_RANGE),
            ) * 255,
          );
        atlas[index + 3] = Math.round(multiplier * 255);
      }
    top += levelHeight;
  }
  return {
    pixels: atlas,
    irradiance: computeLinearEnvironmentIrradiance(
      diffuseSource,
      ENV_ATLAS_WIDTH,
      ENV_ATLAS_WIDTH / 2,
    ),
  };
}
