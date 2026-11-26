export type PhaseTiming = {
  calls: number;
  inclusiveMs: number;
  exclusiveMs: number;
};
export type FramePhases = Record<string, PhaseTiming>;

/** Fixture-only synchronous CPU wall-time scopes; nested time is counted once. */
export function framePhaseProbe(now = () => performance.now()) {
  let active = false;
  let timings: FramePhases = {};
  const stack: { name: string; start: number; children: number }[] = [];
  const restore: (() => void)[] = [];
  function run<T>(name: string, callback: () => T): T {
    if (!active) return callback();
    const scope = { name, start: now(), children: 0 };
    stack.push(scope);
    try {
      return callback();
    } finally {
      const elapsed = now() - scope.start;
      stack.pop();
      const timing = (timings[name] ??= {
        calls: 0,
        inclusiveMs: 0,
        exclusiveMs: 0,
      });
      timing.calls++;
      timing.inclusiveMs += elapsed;
      timing.exclusiveMs += elapsed - scope.children;
      if (stack.length) stack[stack.length - 1].children += elapsed;
    }
  }
  return {
    begin() {
      if (active || stack.length)
        throw new Error('A phase frame is already active.');
      timings = {};
      active = true;
    },
    end(): FramePhases {
      if (!active || stack.length)
        throw new Error('Phase scopes must finish before the frame.');
      active = false;
      return structuredClone(timings);
    },
    run,
    wrap(target: object, key: string, name: string, within?: string) {
      const methods = target as Record<string, (...args: any[]) => any>;
      const original = methods[key];
      if (
        typeof original !== 'function' ||
        original.constructor.name === 'AsyncFunction'
      ) {
        throw new Error(`Phase probe requires a synchronous method: ${key}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        enumerable: descriptor?.enumerable ?? false,
        value: function (...args: any[]) {
          // Restrict high-frequency classification probes to the dirty planner.
          // The same methods can also run during submission, export or setup.
          if (within && !stack.some((scope) => scope.name === within))
            return original.apply(this, args);
          return run(name, () => original.apply(this, args));
        },
      });
      restore.push(() => {
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else delete methods[key];
      });
    },
    dispose() {
      restore
        .splice(0)
        .reverse()
        .forEach((undo) => undo());
      active = false;
      timings = {};
    },
  };
}
