/**
 * Global effect clock in seconds, written each frame by `PostEffectTime` (renderer
 * plugin). CRT uniforms sample this when the filter uses `time: auto` /
 * `useEngineTime`.
 */
let engineTimeSeconds = 0;

export function setPostEffectEngineTimeSeconds(t: number): void {
  engineTimeSeconds = Number.isFinite(t) ? t : 0;
}

export function getPostEffectEngineTimeSeconds(): number {
  return engineTimeSeconds;
}
