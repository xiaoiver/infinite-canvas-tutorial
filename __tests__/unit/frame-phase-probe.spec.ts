import { framePhaseProbe } from '../browser/fixtures/frame-phase-probe';

it('keeps nested and recursive scopes exclusive while preserving return values and receivers', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  const target = {
    amount: 2,
    leaf(value: number) {
      time += this.amount;
      return value * 2;
    },
    parent() {
      time += 1;
      const value = this.leaf(3);
      time += 4;
      return value;
    },
  };
  probe.wrap(target, 'leaf', 'leaf');
  probe.wrap(target, 'parent', 'parent');
  probe.begin();
  expect(target.parent()).toBe(6);
  expect(probe.end()).toEqual({
    leaf: { calls: 1, inclusiveMs: 2, exclusiveMs: 2 },
    parent: { calls: 1, inclusiveMs: 7, exclusiveMs: 5 },
  });
  probe.begin();
  probe.run('recursive', () => {
    time++;
    probe.run('recursive', () => {
      time += 2;
    });
  });
  expect(probe.end()).toEqual({
    recursive: { calls: 2, inclusiveMs: 5, exclusiveMs: 3 },
  });
  probe.dispose();
});
it('preserves thrown errors, resets frames, and restores inherited method ownership', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  const failure = new Error('original failure');
  const base = {
    fail() {
      time += 3;
      throw failure;
    },
  };
  const target = Object.create(base);
  probe.wrap(target, 'fail', 'failure');
  probe.begin();
  expect(() => target.fail()).toThrow(failure);
  expect(probe.end()).toEqual({
    failure: { calls: 1, inclusiveMs: 3, exclusiveMs: 3 },
  });
  probe.begin();
  expect(probe.end()).toEqual({});
  probe.dispose();
  probe.dispose();
  expect(Object.hasOwn(target, 'fail')).toBe(false);
  expect(target.fail).toBe(base.fail);
});
it('does not time outside frames and restores exact own descriptors after a partial installation', () => {
  let reads = 0;
  const probe = framePhaseProbe(() => ++reads);
  const target = { method: () => 42 };
  const before = Object.getOwnPropertyDescriptor(target, 'method');
  probe.wrap(target, 'method', 'method');
  expect(target.method()).toBe(42);
  expect(reads).toBe(0);
  expect(() => probe.wrap(target, 'missing', 'missing')).toThrow(
    'synchronous method',
  );
  expect(() => probe.wrap({ async method() {} }, 'method', 'async')).toThrow(
    'synchronous method',
  );
  probe.dispose();
  expect(Object.getOwnPropertyDescriptor(target, 'method')).toEqual(before);
});
