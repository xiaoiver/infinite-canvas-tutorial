import { sameReplayView, type ReplayView } from './camera-replay';

/** Count completed engine executions during a stream; never drive or replace input. */
export function continuousWheel<I extends { isTrusted: boolean }, N>(
  advance: (view: ReplayView, input: I) => ReplayView,
  now = () => performance.now(),
  normalizeTarget = (view: ReplayView) => view,
  markInput?: (sequence: number) => { name: string; pageMs: number },
) {
  type Input = {
    sequence: number;
    receivedAt: number;
    input: I;
    requested: ReplayView;
    traceMark?: { name: string; pageMs: number };
  };
  type Frame = {
    startedAt: number;
    completedAt: number;
    elapsed: number;
    observedAt: number;
    observationMs: number;
    view: ReplayView;
    native: N;
  };
  let active = false,
    disposed = false;
  let initial: ReplayView, target: ReplayView;
  let events: Input[] = [],
    frames: Frame[] = [],
    errors: string[] = [];
  const settledIndex = () => {
    const last = events.at(-1);
    if (!last || errors.length) return -1;
    return frames.findIndex(
      (f) =>
        f.startedAt >= last.receivedAt &&
        sameReplayView(f.view, normalizeTarget(last.requested)),
    );
  };
  return {
    get busy() {
      return active;
    },
    start(view: ReplayView) {
      if (active || disposed)
        throw new Error('Continuous input busy or disposed');
      initial = { ...view };
      target = { ...view };
      events = [];
      frames = [];
      errors = [];
      active = true;
    },
    observe(input: I) {
      if (!active) return;
      if (!input.isTrusted) {
        errors.push('Trusted input required');
        return;
      }
      const receivedAt = now();
      try {
        target = advance(target, input);
        if (
          ![target.x, target.y, target.zoom].every(Number.isFinite) ||
          target.zoom <= 0
        )
          throw new Error('Invalid stream target');
        events.push({
          sequence: events.length + 1,
          receivedAt,
          input: { ...input },
          requested: { ...target },
          ...(markInput ? { traceMark: markInput(events.length + 1) } : {}),
        });
      } catch (error) {
        errors.push(String(error));
      }
    },
    frame(startedAt: number, completedAt: number, view: ReplayView, native: N) {
      if (!active) return;
      const observedAt = now();
      frames.push({
        startedAt,
        completedAt,
        elapsed: completedAt - startedAt,
        observedAt,
        observationMs: observedAt - completedAt,
        view: { ...view },
        native,
      });
    },
    status: () => ({
      events: events.length,
      errors: [...errors],
      ready: settledIndex() >= 0,
    }),
    finish() {
      if (!active) throw new Error('No active continuous input');
      const settled = settledIndex();
      if (settled < 0)
        throw new Error(errors[0] ?? 'Final stream target has not completed');
      active = false;
      const first = events[0].receivedAt;
      return {
        initial,
        events: [...events],
        frames: frames
          .slice(0, settled + 1)
          .filter((f) => f.completedAt >= first),
      };
    },
    cancel() {
      active = false;
      events = [];
      frames = [];
      errors = [];
    },
    dispose() {
      this.cancel();
      disposed = true;
    },
  };
}
