/** Owns resources and releases dependants before their dependencies. */
export class ResourceScope {
  private callbacks = new Set<() => void>();
  private disposed = false;

  add(callback: () => void): () => void {
    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      this.callbacks.delete(dispose);
      callback();
    };
    if (this.disposed) dispose();
    else this.callbacks.add(dispose);
    return dispose;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    [...this.callbacks].reverse().forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    });
    if (errors.length)
      throw new AggregateError(errors, 'Resource cleanup failed');
  }
}
