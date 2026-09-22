/**
 * CPU Poisson solve + R/G pack for {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts paper-design liquid-metal}:
 * R = edge gradient, G = original shape alpha. Ported from `toProcessedLiquidMetal` / solver in that file.
 * Works on {@link ImageData} (e.g. readback of a premultiplied RGBA layer).
 */

export const LIQUID_METAL_POISSON_DEFAULTS = {
  workingSize: 512, // Size to solve Poisson at (will upscale to original size)
  iterations: 40, // SOR converges ~2-20x faster than standard Gauss-Seidel
} as const;

export interface ImageDataToLiquidMetalPoissonOptions {
  workingSize?: number;
  iterations?: number;
  measurePerformance?: boolean;
}

interface SparsePixelData {
  interiorPixels: Uint32Array;
  boundaryPixels: Uint32Array;
  pixelCount: number;
  neighborIndices: Int32Array;
}

function buildSparseData(
  shapeMask: Uint8Array,
  boundaryMask: Uint8Array,
  interiorPixels: Uint32Array,
  boundaryPixels: Uint32Array,
  width: number,
  height: number,
): SparsePixelData {
  const pixelCount = interiorPixels.length;
  const neighborIndices = new Int32Array(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    neighborIndices[i * 4 + 0] = x < width - 1 && shapeMask[idx + 1] ? idx + 1 : -1;
    neighborIndices[i * 4 + 1] = x > 0 && shapeMask[idx - 1] ? idx - 1 : -1;
    neighborIndices[i * 4 + 2] = y > 0 && shapeMask[idx - width] ? idx - width : -1;
    neighborIndices[i * 4 + 3] =
      y < height - 1 && shapeMask[idx + width] ? idx + width : -1;
  }

  return { interiorPixels, boundaryPixels, pixelCount, neighborIndices };
}

function solvePoissonSparse(
  sparseData: SparsePixelData,
  _shapeMask: Uint8Array,
  _boundaryMask: Uint8Array,
  width: number,
  height: number,
  iterations: number,
): Float32Array {
  const C = 0.01;
  const inv4 = 0.25;
  const u = new Float32Array(width * height);
  const { interiorPixels, neighborIndices, pixelCount } = sparseData;
  const omega = 1.9;
  const oneMinusOmega = 1 - omega;

  /** Red–black lists as dense indices into `interiorPixels` (TypedArray: fast indexed hot loops, no `for..of` on huge `number[]`). */
  let nRed = 0;
  let nBlack = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const y = (idx / width) | 0;
    const x = idx - y * width;
    if ((x + y) & 1) {
      nBlack++;
    } else {
      nRed++;
    }
  }
  const redOfInterior = new Uint32Array(nRed);
  const blackOfInterior = new Uint32Array(nBlack);
  let ir = 0;
  let ib = 0;
  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const y = (idx / width) | 0;
    const x = idx - y * width;
    if ((x + y) & 1) {
      blackOfInterior[ib++] = i;
    } else {
      redOfInterior[ir++] = i;
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (let r = 0; r < nRed; r++) {
      const i = redOfInterior[r]!;
      const q = i << 2;
      const idx = interiorPixels[i]!;
      const eastIdx = neighborIndices[q]!;
      const westIdx = neighborIndices[q + 1]!;
      const northIdx = neighborIndices[q + 2]!;
      const southIdx = neighborIndices[q + 3]!;
      let sumN = 0;
      if (eastIdx >= 0) {
        sumN += u[eastIdx]!;
      }
      if (westIdx >= 0) {
        sumN += u[westIdx]!;
      }
      if (northIdx >= 0) {
        sumN += u[northIdx]!;
      }
      if (southIdx >= 0) {
        sumN += u[southIdx]!;
      }
      u[idx] = omega * (C + sumN) * inv4 + oneMinusOmega * u[idx]!;
    }
    for (let b = 0; b < nBlack; b++) {
      const i = blackOfInterior[b]!;
      const q = i << 2;
      const idx = interiorPixels[i]!;
      const eastIdx = neighborIndices[q]!;
      const westIdx = neighborIndices[q + 1]!;
      const northIdx = neighborIndices[q + 2]!;
      const southIdx = neighborIndices[q + 3]!;
      let sumN = 0;
      if (eastIdx >= 0) {
        sumN += u[eastIdx]!;
      }
      if (westIdx >= 0) {
        sumN += u[westIdx]!;
      }
      if (northIdx >= 0) {
        sumN += u[northIdx]!;
      }
      if (southIdx >= 0) {
        sumN += u[southIdx]!;
      }
      u[idx] = omega * (C + sumN) * inv4 + oneMinusOmega * u[idx]!;
    }
  }

  return u;
}

/**
 * Converts full-resolution RGBA (e.g. scene readback) into a same-size `ImageData` with
 * R = distance-field style gradient, G = original per-pixel alpha, matching paper.
 */
export function imageDataToLiquidMetalPoissonMap(
  originalRgba: ImageData,
  options?: ImageDataToLiquidMetalPoissonOptions,
): ImageData {
  const D = LIQUID_METAL_POISSON_DEFAULTS;
  const workingSize = options?.workingSize ?? D.workingSize;
  const iterations = options?.iterations ?? D.iterations;
  const measure = options?.measurePerformance ?? false;

  const totalStart = measure ? performance.now() : 0;
  const originalWidth = originalRgba.width;
  const originalHeight = originalRgba.height;
  if (originalWidth < 1 || originalHeight < 1) {
    return originalRgba;
  }

  const minDimension = Math.min(originalWidth, originalHeight);
  const scaleFactor = workingSize / minDimension;
  const width = Math.max(1, Math.round(originalWidth * scaleFactor));
  const height = Math.max(1, Math.round(originalHeight * scaleFactor));

  if (typeof document === 'undefined') {
    return originalRgba;
  }

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = originalWidth;
  fullCanvas.height = originalHeight;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) {
    return originalRgba;
  }
  fullCtx.putImageData(originalRgba, 0, 0);

  const shapeCanvas = document.createElement('canvas');
  shapeCanvas.width = width;
  shapeCanvas.height = height;
  const shapeCtx = shapeCanvas.getContext('2d', { willReadFrequently: true })!;
  shapeCtx.drawImage(fullCanvas, 0, 0, width, height);

  const startMask = measure ? performance.now() : 0;
  const shapeImageData = shapeCtx.getImageData(0, 0, width, height);
  const data = shapeImageData.data;
  const shapeMask = new Uint8Array(width * height);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const a = data[i + 3]!;
    shapeMask[idx] = a === 0 ? 0 : 1;
  }

  const boundaryIndices: number[] = [];
  const interiorIndices: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!shapeMask[idx]) {
        continue;
      }
      let isBoundary = false;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        isBoundary = true;
      } else {
        isBoundary =
          !shapeMask[idx - 1]! ||
          !shapeMask[idx + 1]! ||
          !shapeMask[idx - width]! ||
          !shapeMask[idx + width]! ||
          !shapeMask[idx - width - 1]! ||
          !shapeMask[idx - width + 1]! ||
          !shapeMask[idx + width - 1]! ||
          !shapeMask[idx + width + 1]!;
      }
      if (isBoundary) {
        boundaryIndices.push(idx);
      } else {
        interiorIndices.push(idx);
      }
    }
  }

  if (measure) {
    console.log(
      `[liquidMetal Poisson] mask: ${(performance.now() - startMask).toFixed(2)}ms, interior=${interiorIndices.length}`,
    );
  }

  const sparseData = buildSparseData(
    shapeMask,
    new Uint8Array(width * height),
    new Uint32Array(interiorIndices),
    new Uint32Array(boundaryIndices),
    width,
    height,
  );
  const startSolve = measure ? performance.now() : 0;
  const u = solvePoissonSparse(
    sparseData,
    shapeMask,
    new Uint8Array(width * height),
    width,
    height,
    iterations,
  );
  if (measure) {
    console.log(
      `[liquidMetal Poisson] solve ${width}×${height} it=${iterations}: ${(performance.now() - startSolve).toFixed(2)}ms`,
    );
  }

  let maxVal = 0;
  for (let i = 0; i < interiorIndices.length; i++) {
    const idx = interiorIndices[i]!;
    if (u[idx]! > maxVal) {
      maxVal = u[idx]!;
    }
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  const tempImg = tempCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const px = idx * 4;
      if (!shapeMask[idx]) {
        tempImg.data[px] = 255;
        tempImg.data[px + 1] = 255;
        tempImg.data[px + 2] = 255;
        tempImg.data[px + 3] = 0;
      } else {
        const poissonRatio = maxVal > 0 ? u[idx]! / maxVal : 0;
        const gray = 255 * (1 - poissonRatio);
        tempImg.data[px] = gray;
        tempImg.data[px + 1] = gray;
        tempImg.data[px + 2] = gray;
        tempImg.data[px + 3] = 255;
      }
    }
  }
  tempCtx.putImageData(tempImg, 0, 0);

  fullCtx.save();
  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = 'high';
  fullCtx.clearRect(0, 0, originalWidth, originalHeight);
  fullCtx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, originalWidth, originalHeight);
  fullCtx.restore();
  const outImg = fullCtx.getImageData(0, 0, originalWidth, originalHeight);
  const originalData = originalRgba.data;

  for (let i = 0; i < outImg.data.length; i += 4) {
    const a = originalData[i + 3]!;
    const upscaledAlpha = outImg.data[i + 3]!;
    if (a === 0) {
      outImg.data[i] = 255;
      outImg.data[i + 1] = 0;
    } else {
      outImg.data[i] = upscaledAlpha === 0 ? 0 : outImg.data[i]!;
      outImg.data[i + 1] = a;
    }
    outImg.data[i + 2] = 255;
    outImg.data[i + 3] = 255;
  }

  if (measure) {
    console.log(
      `[liquidMetal Poisson] total: ${(performance.now() - totalStart).toFixed(2)}ms for ${originalWidth}×${originalHeight}`,
    );
  }

  return outImg;
}

export function isLiquidMetalReadbackSyncSupported(
  device: { queryVendorInfo: () => { platformString: string } },
): boolean {
  return device.queryVendorInfo().platformString !== 'WebGPU';
}
