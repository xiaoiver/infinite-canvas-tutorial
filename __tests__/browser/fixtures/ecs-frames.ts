import type { API } from '../../../packages/ecs/src';

/** Wait for ECS frame boundaries, or finish when the canvas is destroyed. */
export async function settleECSFrames(api: API, count = 2) {
  let destroyed = false;
  let resume = () => {};
  // Destruction discards queued tasks, so their callbacks cannot end a wait.
  // onDestroy also fires immediately when the canvas has already been removed.
  const dispose = api.onDestroy(() => {
    destroyed = true;
    resume();
  });
  try {
    for (let i = 0; i < count && !destroyed; i++) {
      await new Promise<void>((resolve) => {
        resume = resolve;
        api.runAtNextTick(resolve);
      });
    }
  } finally {
    resume = () => {};
    dispose();
  }
}
