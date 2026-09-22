import { TaskQueue } from '../../packages/ecs/src/TaskQueue';

describe('canvas task queues', () => {
  it('defers nested work and isolates queues', () => {
    const a = new TaskQueue();
    const b = new TaskQueue();
    const calls: string[] = [];
    a.add(() => {
      calls.push('a');
      a.add(() => calls.push('nested'));
    });
    b.add(() => calls.push('b'));
    a.flush();
    expect(calls).toEqual(['a']);
    a.flush();
    b.flush();
    expect(calls).toEqual(['a', 'nested', 'b']);
  });

  it('preserves remaining tasks after a failure without replaying it', () => {
    const queue = new TaskQueue();
    const failed = jest.fn(() => {
      throw new Error('failed');
    });
    const remaining = jest.fn();
    queue.add(failed);
    queue.add(remaining);
    expect(() => queue.flush()).toThrow('failed');
    queue.flush();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(remaining).toHaveBeenCalledTimes(1);
  });

  it('cancels remaining and future work when disposed during a flush', () => {
    const queue = new TaskQueue();
    const cancelled = jest.fn();
    queue.add(() => queue.dispose());
    queue.add(cancelled);
    queue.flush();
    queue.add(cancelled);
    queue.flush();
    expect(cancelled).not.toHaveBeenCalled();
  });
});
