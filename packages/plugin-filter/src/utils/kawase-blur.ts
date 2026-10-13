import type { BlurEffect } from '../filter';
import { BLUR_DEFAULTS } from '../filter';

/** Kernel radii in pixels for each Kawase pass (Pixi {@link KawaseBlurFilter}). */
export function generateKawaseKernels(
  strength: number,
  quality: number,
): number[] {
  const blur = Math.max(0, strength);
  const q = Math.max(1, Math.round(quality));
  if (blur <= 0) {
    return [0];
  }
  const kernels: number[] = [blur];
  if (q <= 1) {
    return kernels;
  }
  let k = blur;
  const step = blur / q;
  for (let i = 1; i < q; i++) {
    k -= step;
    kernels.push(k);
  }
  return kernels;
}

export function kawaseKernelsForBlurEffect(effect: BlurEffect): number[] {
  const strength = Number.isFinite(effect.value)
    ? Math.max(0, effect.value)
    : 0;
  const quality = Number.isFinite(effect.quality)
    ? effect.quality!
    : BLUR_DEFAULTS.quality;
  return generateKawaseKernels(strength, quality);
}

export function blurEffectUsesClamp(effect: BlurEffect): boolean {
  return effect.clamp !== false;
}

function blurPixelSize(effect: BlurEffect): { x: number; y: number } {
  const ps = effect.pixelSize ?? BLUR_DEFAULTS.pixelSize;
  if (typeof ps === 'number') {
    const n = Number.isFinite(ps) ? ps : 1;
    return { x: n, y: n };
  }
  const x = Number.isFinite(ps.x) ? ps.x : 1;
  const y = Number.isFinite(ps.y) ? ps.y : 1;
  return { x, y };
}

/** std140: `u_Kawase0` + `u_Kawase1` (8 floats). */
export function kawaseBlurUniformValues(
  effect: BlurEffect,
  kernel: number,
  textureWidth: number,
  textureHeight: number,
): number[] {
  const tw = Math.max(1, textureWidth);
  const th = Math.max(1, textureHeight);
  const { x: pixelSizeX, y: pixelSizeY } = blurPixelSize(effect);
  const offset = effect.value > 0 ? kernel + 0.5 : 0;
  const uvX = (pixelSizeX / tw) * offset;
  const uvY = (pixelSizeY / th) * offset;
  const useClamp = blurEffectUsesClamp(effect) ? 1 : 0;
  // Clamp to texel centers. The shader also uses min.xy to recover texel size
  // when interpolating straight RGBA in premultiplied space.
  return [
    uvX,
    uvY,
    useClamp,
    0,
    0.5 / tw,
    0.5 / th,
    1 - 0.5 / tw,
    1 - 0.5 / th,
  ];
}

/** Conservative sampling footprint, including bilinear neighbors of every pass. */
export function kawaseBlurPadding(effect: BlurEffect): number {
  if (!(effect.value > 0)) return 0;
  const kernels = kawaseKernelsForBlurEffect(effect);
  const { x, y } = blurPixelSize(effect);
  const scale = Math.max(Math.abs(x), Math.abs(y));
  return kernels.reduce((acc, k) => acc + Math.ceil((k + 0.5) * scale), 0);
}
