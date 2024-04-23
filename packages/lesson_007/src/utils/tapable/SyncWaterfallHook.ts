import type { AsArray } from './interfaces';
export class SyncWaterfallHook<T, R> {
  #callbacks: ((...args: AsArray<T>) => R)[] = [];

  tap(fn: (...args: AsArray<T>) => R) {
    this.#callbacks.push(fn);
  }

  call(...argsArr: AsArray<T>): R {
    if (this.#callbacks.length) {
      /* eslint-disable-next-line prefer-spread */
      let result = this.#callbacks[0].apply(void 0, argsArr);
      for (let i = 0; i < this.#callbacks.length - 1; i++) {
        const callback = this.#callbacks[i];
        result = callback(...(result as AsArray<T>));
      }

      return result;
    }

    return null;
  }
}
