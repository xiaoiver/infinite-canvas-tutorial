import type { App } from '@infinite-canvas-tutorial/ecs';

export type CanvasPlugin = Parameters<App['addPlugin']>[0];

export interface CanvasRuntimeOptions {
  /** Additional plugins, registered once per App startup. */
  plugins?: readonly CanvasPlugin[];
  /** Register optional plugin UI elements before mounting any canvas. */
  loadUI?: () => Promise<unknown>;
}

export interface CanvasRuntime {
  /** Acquire a shared App. Always release the lease after removing the canvas. */
  acquire(): { ready: Promise<void>; release: () => void };
}

// Web Components currently use global initialization queues. Only one runtime
// may own them at a time; multiple canvases should share that runtime.
let activeRuntime: CanvasRuntime | undefined;

/** Create outside render. Browser dependencies are loaded only on acquisition. */
export function createCanvasRuntime(
  options: CanvasRuntimeOptions = {},
): CanvasRuntime {
  const plugins = [...(options.plugins ?? [])];
  const loadUI = options.loadUI;
  let users = 0;
  let app: App | undefined;
  let starting: Promise<void> | undefined;
  let stopping = Promise.resolve();
  let generation = 0;

  const runtime: CanvasRuntime = {
    acquire() {
      if (activeRuntime && activeRuntime !== runtime) {
        return {
          ready: Promise.reject(
            new Error('Mounted canvases must share the same CanvasRuntime.'),
          ),
          release() {},
        };
      }
      activeRuntime = runtime;
      users++;
      generation++;
      starting ??= stopping.then(async () => {
        const [{ App, DefaultPlugins }, { UIPlugin }] = await Promise.all([
          import('@infinite-canvas-tutorial/ecs'),
          import('@infinite-canvas-tutorial/webcomponents'),
        ]);
        await import('@infinite-canvas-tutorial/webcomponents/spectrum');
        await loadUI?.();
        app = new App().addPlugins(...DefaultPlugins, UIPlugin, ...plugins);
        await app.run();
      });
      const ready = starting;
      let released = false;

      return {
        ready,
        release() {
          if (released) return;
          released = true;
          users--;
          const releaseGeneration = ++generation;
          // StrictMode's setup/cleanup/setup can reuse the pending startup.
          // Lit's disconnected cleanup runs before App.exit().
          queueMicrotask(() => {
            if (users || releaseGeneration !== generation) return;
            starting = undefined;
            stopping = ready
              .catch(() => undefined)
              .then(async () => {
                const previousApp = app;
                app = undefined;
                await previousApp?.exit();
              })
              .catch((error) => {
                console.error('Canvas App cleanup failed', error);
              })
              .finally(() => {
                if (!users && activeRuntime === runtime) {
                  activeRuntime = undefined;
                }
              });
          });
        },
      };
    },
  };
  return runtime;
}

export const defaultCanvasRuntime = createCanvasRuntime();
