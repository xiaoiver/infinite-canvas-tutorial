import { WorkerClient } from '../../packages/ecs/src/WorkerClient';

class FakeWorker extends EventTarget {
  requests: any[] = [];
  terminate = jest.fn();
  postMessage(message: any) {
    this.requests.push(message);
    if (message.type === 'ping')
      queueMicrotask(() => this.reply(message.requestId, { success: true }));
  }
  reply(requestId: number, data: unknown, type = 'result', done = true) {
    this.dispatchEvent(
      new MessageEvent('message', { data: { requestId, data, type, done } }),
    );
  }
}
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('starts lazily, serializes operations and ignores progress and unrelated replies', async () => {
  const worker = new FakeWorker();
  const create = jest.fn(() => worker as unknown as Worker);
  const client = new WorkerClient(create);
  expect(create).not.toHaveBeenCalled();
  const first = client.run(() => client.request('encode', 'a'));
  const second = client.run(() => client.request('encode', 'b'));
  await tick();
  expect(worker.requests.map((r) => r.type)).toEqual(['ping', 'encode']);
  worker.reply(worker.requests[1].requestId, 'progress', 'progress', false);
  worker.reply(999, 'wrong request');
  await tick();
  expect(worker.requests).toHaveLength(2);
  worker.reply(worker.requests[1].requestId, 'a');
  await expect(first).resolves.toBe('a');
  await tick();
  worker.reply(worker.requests[2].requestId, 'b');
  await expect(second).resolves.toBe('b');
  client.dispose();
  client.dispose();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('rejects in-flight and queued operations on disposal', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(() => worker as unknown as Worker);
  const first = client.run(() => client.request('encode'));
  const second = client.run(() => client.request('encode'));
  const outcomes = Promise.allSettled([first, second]);
  await tick();
  client.dispose();
  expect((await outcomes).every((result) => result.status === 'rejected')).toBe(
    true,
  );
  expect(worker.requests).toHaveLength(2);
});

it('propagates model errors and permits the next operation', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(() => worker as unknown as Worker);
  const result = client.run(() => client.request('encode'));
  const failed = expect(result).rejects.toThrow('model failed');
  await tick();
  worker.dispatchEvent(
    new MessageEvent('message', {
      data: {
        requestId: worker.requests[1].requestId,
        type: 'error',
        done: true,
        error: 'model failed',
      },
    }),
  );
  await failed;
  const next = client.run(() => client.request('encode'));
  await tick();
  worker.reply(worker.requests[2].requestId, 'ok');
  await expect(next).resolves.toBe('ok');
  client.dispose();
});

it('rejects callers immediately when disposed during asynchronous image preparation', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(() => worker as unknown as Worker);
  let finish: () => void;
  const preparation = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const active = client.run(async () => {
    await preparation;
    return client.request('encode');
  });
  const queued = client.run(() => client.request('encode'));
  const outcomes = Promise.allSettled([active, queued]);
  await tick();
  client.dispose();
  expect((await outcomes).map((result) => result.status)).toEqual([
    'rejected',
    'rejected',
  ]);
  finish();
  await tick();
  expect(worker.requests.map((request) => request.type)).toEqual(['ping']);
});
