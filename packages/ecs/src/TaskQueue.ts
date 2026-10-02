/** Synchronous work owned by one canvas, drained at an ECS frame boundary. */
export class TaskQueue {
  private pending: (() => void)[] = [];
  private deferred: (() => void)[] = [];
  private disposed = false;

  add(task: () => void, deferToFollowingFlush = false) {
    if (!this.disposed) {
      (deferToFollowingFlush ? this.deferred : this.pending).push(task);
    }
  }

  flush() {
    const batch = this.pending;
    this.pending = this.deferred;
    this.deferred = [];
    for (let i = 0; i < batch.length && !this.disposed; i++) {
      try {
        batch[i]();
      } catch (error) {
        // Preserve unexecuted work without replaying the failed task.
        if (!this.disposed) this.pending.unshift(...batch.slice(i + 1));
        throw error;
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.pending = [];
    this.deferred = [];
  }
}
