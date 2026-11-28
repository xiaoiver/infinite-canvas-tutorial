/** One canvas generation; completion is published only by its device owner. */
export class CanvasInitialization {
  readonly promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;

  constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    // Readiness is opt-in. Keep failures observable to later callers without
    // creating unhandled rejections in existing applications that do not await it.
    this.promise.catch(() => {});
  }

  cancel() {
    this.reject(new Error('Canvas destroyed before GPU initialization'));
  }
}
