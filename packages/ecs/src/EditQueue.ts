/** Completion and cancellation for synchronous edits at an ECS write boundary. */
export class EditQueue {
  private cancellations = new Set<() => void>();
  private disposed = false;

  constructor(private enqueue: (task: () => void) => void) {}

  add(
    update: () => void,
    commit: () => void,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (this.disposed || signal?.aborted) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        this.cancellations.delete(cancel);
        signal?.removeEventListener('abort', cancel);
        settle();
      };
      const cancel = () => finish(() => resolve(false));
      this.cancellations.add(cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        this.enqueue(() => {
          if (settled) return;
          try {
            const result: unknown = update();
            if (
              result &&
              typeof (result as { then?: unknown }).then === 'function'
            ) {
              // Observe rejected Promises, but never await across an ECS write phase.
              Promise.resolve(result).catch(() => {});
              throw new TypeError(
                'Canvas edits must be synchronous. Await work before edit().',
              );
            }
            if (settled) return;
            commit();
            finish(() => resolve(true));
          } catch (error) {
            finish(() => reject(error));
          }
        });
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    [...this.cancellations].forEach((cancel) => cancel());
  }
}
