import { System } from '@lastolivegames/becsy';
import { setPostEffectEngineTimeSeconds } from './utils/postEffectEngineTime';

/** Updates global post-processing engine time before {@link MeshPipeline}. */
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
