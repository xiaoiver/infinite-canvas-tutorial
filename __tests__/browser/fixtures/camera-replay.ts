/** Diagnostic camera poses are explicit, ordered and independent of wall time. */
export interface ReplayView {
  x: number;
  y: number;
  zoom: number;
}
export interface ReplayPose extends ReplayView {
  id: string;
}
export const CAMERA_REPLAY_VERSION = 1;
export function validateReplayView(view: ReplayView) {
  if (![view.x, view.y, view.zoom].every(Number.isFinite) || view.zoom <= 0)
    throw new Error('Replay camera must be finite with positive zoom');
}
export function sameReplayView(a: ReplayView, b: ReplayView) {
  return (
    Math.abs(a.x - b.x) <= 1e-4 &&
    Math.abs(a.y - b.y) <= 1e-4 &&
    Math.abs(a.zoom - b.zoom) <= Math.max(1, Math.abs(b.zoom)) * 1e-6
  );
}
export function fixedCameraTrace(
  workload: 'strokes' | 'workflow',
): ReplayPose[] {
  const rows =
    workload === 'strokes'
      ? [
          ['overview', 0, 0, 0.13],
          ['idle', 0, 0, 0.13],
          ['pan', 20, 20, 0.13],
          ['zoom-2', 20, 20, 0.26],
          ['zoom-4', 20, 20, 0.52],
          ['focus', 180, 1300, 0.52],
          ['focus-pan', 185, 1305, 0.52],
          ['focus-return', 180, 1300, 0.52],
          ['coarsen', 0, 0, 0.13],
          ['offscreen', 100000, 100000, 0.13],
          ['reentry', 0, 0, 0.13],
          ['final-idle', 0, 0, 0.13],
        ]
      : [
          ['overview', -1800, -6480, 0.0278],
          ['idle', -1800, -6480, 0.0278],
          ['bucket-low', 0, 0, 0.0332],
          ['bucket-high', 220, 0, 0.0369],
          ['pan', 660, 0, 0.0417],
          ['focus', 2130, 1470, 0.0539],
          ['readable', 2300, 1600, 0.35],
          ['readable-pan', 2400, 1680, 0.35],
          ['coarsen', 0, 0, 0.0332],
          ['offscreen', 100000, 100000, 0.0332],
          ['reentry', -1800, -6480, 0.0278],
          ['final-idle', -1800, -6480, 0.0278],
        ];
  return rows.map(([id, x, y, zoom]) => ({
    id: id as string,
    x: x as number,
    y: y as number,
    zoom: zoom as number,
  }));
}
export interface CompletedReplayFrame<T> {
  view: ReplayView;
  startedAt: number;
  elapsed: number;
  completedAt: number;
  observedAt: number;
  observationMs: number;
  data: T;
}
/** Wrap complete engine executions; never label a frame from app state alone. */
export function completedCameraReplay<T>(options: {
  view: () => ReplayView;
  snapshot: () => T;
  before?: () => void;
  after?: () => void;
  now?: () => number;
  maxFrames?: number;
}) {
  const now = options.now ?? (() => performance.now());
  const maxFrames = options.maxFrames ?? 8;
  if (!Number.isInteger(maxFrames) || maxFrames < 1)
    throw new Error('Invalid replay frame budget');
  let inFlight: Promise<unknown> | undefined;
  let busy = false,
    disposed = false;
  let cancel: ((error: Error) => void) | undefined;
  let pending:
    | {
        target: () => ReplayView;
        matched?: ReplayView;
        frames: CompletedReplayFrame<T>[];
        resolve: () => void;
        reject: (e: unknown) => void;
      }
    | undefined;
  async function step(target: () => ReplayView, apply: () => Promise<unknown>) {
    if (busy || disposed) throw new Error('Replay is busy or disposed');
    busy = true;
    let request: typeof pending;
    const cancelled = new Promise<never>((_resolve, reject) => {
      cancel = reject;
    });
    try {
      // Finish any execution already in progress before applying a new pose.
      await Promise.race([inFlight, cancelled]);
      if (disposed) throw new Error('Replay is disposed');
      const requestedAt = now();
      const frames: CompletedReplayFrame<T>[] = [];
      const complete = new Promise<void>((resolve, reject) => {
        request = { target, frames, resolve, reject };
        pending = request;
      });
      await Promise.race([
        Promise.all([complete, Promise.resolve().then(apply)]),
        cancelled,
      ]);
      return {
        requested: { ...request!.matched! },
        frames,
        operationToFrameMs: frames.at(-1)!.completedAt - requestedAt,
        operationToResultMs: now() - requestedAt,
      };
    } finally {
      if (pending === request) pending = undefined;
      busy = false;
      cancel = undefined;
    }
  }
  return {
    get busy() {
      return busy;
    },
    run(execute: () => Promise<void>): Promise<void> {
      const request = pending;
      const execution = (async () => {
        let started = 0,
          entered = false;
        try {
          if (request) {
            options.before?.();
            entered = true;
            started = now();
          }
          await execute();
          const completedAt = request ? now() : 0;
          if (entered) {
            entered = false;
            options.after?.();
          }
          if (request && pending === request && !disposed) {
            const view = { ...options.view() };
            const target = request.target();
            validateReplayView(target);
            const data = options.snapshot();
            const observedAt = now();
            request.frames.push({
              view,
              startedAt: started,
              elapsed: completedAt - started,
              completedAt,
              observedAt,
              observationMs: observedAt - completedAt,
              data,
            });
            if (sameReplayView(view, target)) {
              request.matched = { ...target };
              pending = undefined;
              request.resolve();
            } else if (request.frames.length >= maxFrames) {
              pending = undefined;
              request.reject(
                new Error(
                  'Target camera did not reach the replay frame budget',
                ),
              );
            }
          }
        } catch (error) {
          if (request && pending === request) {
            pending = undefined;
            request.reject(error);
          }
          throw error;
        } finally {
          if (entered) options.after?.();
        }
      })();
      inFlight = execution;
      void execution.then(
        () => {
          if (inFlight === execution) inFlight = undefined;
        },
        () => {
          if (inFlight === execution) inFlight = undefined;
        },
      );
      return execution;
    },
    async step(target: ReplayView, apply: () => Promise<unknown>) {
      validateReplayView(target);
      const fixed = { ...target };
      return step(() => fixed, apply);
    },
    // UI event handlers may run after microtasks from earlier listeners. Resolve
    // their requested target only after a complete engine execution.
    stepFromInput(target: () => ReplayView) {
      return step(target, async () => {});
    },
    dispose() {
      disposed = true;
      cancel?.(new Error('Replay is disposed'));
      const request = pending;
      pending = undefined;
      request?.reject(new Error('Replay is disposed'));
    },
  };
}

/** The same translated cubic-stroke document is used by both real renderers. */
export function replayStrokeNodes(count: number) {
  if (!Number.isInteger(count) || count < 1)
    throw new Error('Invalid replay count');
  return Array.from({ length: count }, (_, i) => ({
    id: `replay-${i}`,
    type: 'path' as const,
    x: 20 + (i % 20) * 40,
    y: 20 + Math.floor(i / 20) * 35,
    width: 30,
    height: 30,
    batchable: true,
    zIndex: i * 2,
    d: `M0 15 C${5 + (i % 4)} -10 22 40 30 15`,
    fills: [],
    strokes: [{ type: 'solid' as const, value: '#2563eb' }],
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: 0.65,
  }));
}

export function replaySurface(canvas: HTMLCanvasElement) {
  return {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    bufferWidth: canvas.width,
    bufferHeight: canvas.height,
    dpr: canvas.width / canvas.clientWidth,
  };
}
