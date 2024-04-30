import type { AsArray } from './interfaces';

export class AsyncSeriesWaterfallHook<T, R> {
  #callbacks: ((...args: AsArray<T>) => Promise<R>)[] = [];

  tapPromise(fn: (...args: AsArray<T>) => Promise<R>) {
    this.#callbacks.push(fn);
  }

  async promise(...args: AsArray<T>): Promise<R | null> {
    if (this.#callbacks.length) {
      let result: R = await this.#callbacks[0](...args);
      for (let i = 0; i < this.#callbacks.length - 1; i++) {
        const callback = this.#callbacks[i];
        // @ts-ignore
        result = await callback(result);
      }

      return result;
    }

    return null;
  }
}
