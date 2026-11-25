import { completedCameraReplay, type ReplayView } from './camera-replay';

/** Time one trusted input through its real handler and a completed camera frame. */
export function inputReplay<T, I extends { isTrusted: boolean }>(
  replay: ReturnType<typeof completedCameraReplay<T>>,
  target: () => ReplayView,
  now = () => performance.now(),
) {
  type Result = Awaited<ReturnType<typeof replay.step>> & {
    input: I;
    receivedAt: number;
    inputToFrameMs: number;
    inputToResultMs: number;
  };
  let disposed = false;
  let pending:
    | {
        result: Promise<Result>;
        resolve: (value: Result) => void;
        reject: (error: unknown) => void;
        events: number;
        taken: boolean;
      }
    | undefined;
  return {
    get busy() {
      return !!pending;
    },
    arm() {
      if (disposed || pending) throw new Error('Input replay busy or disposed');
      let resolve!: (value: Result) => void, reject!: (error: unknown) => void;
      const result = new Promise<Result>((a, b) => {
        resolve = a;
        reject = b;
      });
      // The browser driver may request the result after a rejection has occurred.
      void result.catch(() => {});
      pending = { result, resolve, reject, events: 0, taken: false };
    },
    observe(input: I) {
      const request = pending;
      if (!request || disposed) return;
      request.events++;
      if (request.events > 1) return;
      const receivedAt = now();
      void Promise.resolve()
        .then(async () => {
          if (disposed || pending !== request) return;
          if (!input.isTrusted) throw new Error('Trusted input required');
          // The target reader runs after execution, beyond the event dispatch.
          const step = await replay.stepFromInput(target);
          if (disposed || pending !== request) return;
          if (request.events !== 1)
            throw new Error('Multiple inputs during one capture');
          request.resolve({
            ...step,
            input,
            receivedAt,
            inputToFrameMs: step.frames.at(-1)!.completedAt - receivedAt,
            inputToResultMs: now() - receivedAt,
          });
        })
        .catch(request.reject);
    },
    take() {
      const request = pending;
      if (!request || request.taken) throw new Error('No unread input replay');
      request.taken = true;
      return request.result.finally(() => {
        if (pending === request) pending = undefined;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const request = pending;
      pending = undefined;
      replay.dispose();
      request?.reject(new Error('Input replay disposed'));
    },
  };
}

/** ECS camera translations use float32; retain the UI target separately. */
export function float32ReplayTarget(view: ReplayView): ReplayView {
  return { x: Math.fround(view.x), y: Math.fround(view.y), zoom: view.zoom };
}
