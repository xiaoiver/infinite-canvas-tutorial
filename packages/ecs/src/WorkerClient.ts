/** A lazy, canvas-owned worker with correlated replies and serialized model operations. */
export class WorkerClient {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (data: any) => void; reject: (error: Error) => void }
  >();
  private tail: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private disposed = false;
  private runs = new Set<(error: Error) => void>();

  constructor(private readonly createWorker: () => Worker) {}

  /** Serialize whole operations, including image preparation and encode/decode pairs. */
  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      this.assertActive();
      if (!this.ready) {
        this.worker = this.createWorker();
        this.worker.addEventListener('message', this.onMessage);
        this.worker.addEventListener('error', this.onError);
        this.worker.addEventListener('messageerror', this.onError);
        this.ready = this.request<{ success?: boolean }>('ping').then(
          (report) => {
            if (report?.success === false)
              throw new Error('Worker model initialization failed');
          },
        );
      }
      await this.ready;
      this.assertActive();
      return operation();
    });
    this.tail = result.catch(() => {});
    return new Promise<T>((resolve, reject) => {
      this.runs.add(reject);
      result.then(
        (value) => {
          this.runs.delete(reject);
          resolve(value);
        },
        (error) => {
          this.runs.delete(reject);
          reject(error);
        },
      );
    });
  }

  request<T>(type: string, data?: unknown): Promise<T> {
    this.assertActive();
    const requestId = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      try {
        this.worker.postMessage({ requestId, type, data });
      } catch (error) {
        this.pending.delete(requestId);
        reject(error);
      }
    });
  }

  private assertActive() {
    if (this.disposed) throw new Error('Worker client disposed');
  }

  private onMessage = (event: MessageEvent) => {
    const { requestId, type, data, error, done } = event.data;
    // Progress and stats messages do not complete a request.
    if (!done) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    if (type === 'error')
      pending.reject(new Error(error || 'Worker request failed'));
    else pending.resolve(data);
  };

  private onError = (event: ErrorEvent | MessageEvent) => {
    this.dispose(
      new Error(
        'message' in event
          ? event.message
          : 'Worker message could not be decoded',
      ),
    );
  };

  dispose(error = new Error('Worker client disposed')) {
    if (this.disposed) return;
    this.disposed = true;
    this.runs.forEach((reject) => reject(error));
    this.runs.clear();
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
    this.worker?.removeEventListener('message', this.onMessage);
    this.worker?.removeEventListener('error', this.onError);
    this.worker?.removeEventListener('messageerror', this.onError);
    this.worker?.terminate();
  }
}
