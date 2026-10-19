import { DOMAdapter } from '../environment';

/** Nine RGB Lambertian spherical-harmonic coefficients, padded to vec4 for std140. */
export const ENVIRONMENT_IRRADIANCE_FLOATS = 9 * 4;

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Integrate a north-at-top equirectangular sRGB image into diffuse irradiance. */
export function computeEnvironmentIrradiance(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const linear = new Float32Array(pixels.length);
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    linear[i] = linearChannel(pixels[i]);
    linear[i + 1] = linearChannel(pixels[i + 1]);
    linear[i + 2] = linearChannel(pixels[i + 2]);
    linear[i + 3] = pixels[i + 3] / 255;
  }
  return computeLinearEnvironmentIrradiance(linear, width, height);
}

/** Integrate a linear-light, north-at-top panorama (LDR or HDR). */
export function computeLinearEnvironmentIrradiance(
  pixels: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const coefficients = new Float32Array(ENVIRONMENT_IRRADIANCE_FLOATS);
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4)
    return coefficients;

  const longitudeStep = (2 * Math.PI) / width;
  for (let y = 0; y < height; y++) {
    const topLatitude = Math.PI * (0.5 - y / height);
    const bottomLatitude = Math.PI * (0.5 - (y + 1) / height);
    const solidAngle =
      longitudeStep * (Math.sin(topLatitude) - Math.sin(bottomLatitude));
    const latitude = (topLatitude + bottomLatitude) / 2;
    const horizontal = Math.cos(latitude);
    const ny = Math.sin(latitude);
    for (let x = 0; x < width; x++) {
      const longitude = (x + 0.5) * longitudeStep - Math.PI;
      const nx = horizontal * Math.cos(longitude);
      const nz = horizontal * Math.sin(longitude);
      const basis = [
        0.282095,
        0.488603 * ny,
        0.488603 * nz,
        0.488603 * nx,
        1.092548 * nx * ny,
        1.092548 * ny * nz,
        0.315392 * (3 * nz * nz - 1),
        1.092548 * nx * nz,
        0.546274 * (nx * nx - ny * ny),
      ];
      const pixel = (y * width + x) * 4;
      const color = [pixels[pixel], pixels[pixel + 1], pixels[pixel + 2]];
      for (let i = 0; i < 9; i++) {
        // Lambert convolution divided by PI: l=0: 1, l=1: 2/3, l=2: 1/4.
        const kernel = i === 0 ? 1 : i < 4 ? 2 / 3 : 1 / 4;
        for (let channel = 0; channel < 3; channel++)
          coefficients[i * 4 + channel] +=
            color[channel] * basis[i] * solidAngle * kernel;
      }
    }
  }
  return coefficients;
}

/** Downsample before integration so a large source image does not stall the UI. */
export function irradianceFromBitmap(bitmap: ImageBitmap): Float32Array | null {
  const width = 64;
  const height = 32;
  const canvas = DOMAdapter.get().createCanvas(width, height);
  const context = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return computeEnvironmentIrradiance(image.data, width, height);
}
