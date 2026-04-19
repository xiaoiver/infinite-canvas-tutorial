import { System } from '@lastolivegames/becsy';
import { setPostEffectEngineTimeSeconds } from '../utils/postEffectEngineTime';

/**
 * Updates global post-processing time (`performance.now() / 1000`) before rendering
 * so CRT `useEngineTime` / filter `time: auto` animates scanlines without manual updates.
 */
export class PostEffectTime extends System {
  execute() {
    const perf =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { performance?: { now?: () => number } })
        .performance?.now === 'function'
        ? (globalThis as { performance: { now: () => number } }).performance
        : null;
    setPostEffectEngineTimeSeconds(perf ? perf.now() / 1000 : 0);
  }
}
