/**
 * Raster export overrides for raindrop-fx (PNG warmup + GIF/WebM frame stepping).
 * Set by {@link MeshPipeline} for the duration of an export.
 */
export type RainFxPngExportContext = {
  kind: 'png';
  /** Simulate raindrop-fx physics for this many seconds (fixed sim dt steps). */
  warmupSec: number;
  /** Engine time (seconds) for the capture frame; defaults to `warmupSec`. */
  captureTimeSec?: number;
};

/** Mutable state while encoding GIF/WebM (raindrop-fx). */
export type RainFxAnimationExportContext = {
  kind: 'animation';
  timeStart: number;
  invFps: number;
  frameIndex: number;
  /** Simulate rain before the first encoded frame (seconds, from t=0). */
  rainWarmupSec: number;
  /** Set after offline warmup on the shared rain sim (once per export). */
  warmupApplied: boolean;
};

export type RainFxExportContext = RainFxPngExportContext | RainFxAnimationExportContext;

let active: RainFxExportContext | null = null;

export function setRainFxExportContext(ctx: RainFxExportContext | null): void {
  active = ctx;
}

export function getRainFxExportContext(): RainFxExportContext | null {
  return active;
}

export function getRainFxAnimationExportContext(): RainFxAnimationExportContext | null {
  return active?.kind === 'animation' ? active : null;
}

export function getRainFxPngExportContext(): RainFxPngExportContext | null {
  return active?.kind === 'png' ? active : null;
}

export function clearRainFxExportContext(): void {
  active = null;
}
