export class AsyncParallelHook<T> {
  #callbacks: ((...args: T[]) => Promise<void>)[] = [];

  getCallbacksNum() {
    return this.#callbacks.length;
  }

  tapPromise(fn: (...args: T[]) => Promise<void>) {
    this.#callbacks.push(fn);
  }

  promise(...args: T[]): Promise<void[]> {
    return Promise.all(
      this.#callbacks.map((callback) => {
        return callback(...args);
      }),
    );
  }
}
