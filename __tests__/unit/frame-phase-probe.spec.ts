import { installCameraPhases } from '../browser/fixtures/camera-phase-probe';
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

it('camera stage/native scopes preserve receivers, arguments, nesting and descriptors', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  const failure = new Error('draw failed');
  const gl = {
    bufferSubData(...args: unknown[]) {
      expect(this).toBe(gl);
      expect(args).toEqual([3, 4]);
      time += 2;
      return 17;
    },
    drawArrays() {
      time += 4;
      throw failure;
    },
  };
  const before = Object.getOwnPropertyDescriptors(gl);
  const target = {
    geometry() {
      time += 3;
      expect(gl.bufferSubData(3, 4)).toBe(17);
      time += 1;
      gl.drawArrays();
    },
  };
  const original = target.geometry;
  installCameraPhases(
    probe,
    { getContext: () => gl } as unknown as HTMLCanvasElement,
    [[target, 'geometry', 'stroke.geometry']],
  );
  probe.begin();
  expect(() => target.geometry()).toThrow(failure);
  expect(probe.end()).toEqual({
    'native.buffer': { calls: 1, inclusiveMs: 2, exclusiveMs: 2 },
    'native.draw': { calls: 1, inclusiveMs: 4, exclusiveMs: 4 },
    'stroke.geometry': { calls: 1, inclusiveMs: 10, exclusiveMs: 4 },
  });
  probe.dispose();
  expect(Object.getOwnPropertyDescriptors(gl)).toEqual(before);
  expect(target.geometry).toBe(original);
});
it('camera phase installation rolls back preceding stages on failure', () => {
  const probe = framePhaseProbe();
  const target = { method: () => 42 };
  const before = Object.getOwnPropertyDescriptor(target, 'method');
  expect(() =>
    installCameraPhases(probe, {} as HTMLCanvasElement, [
      [target, 'method', 'ok'],
      [target, 'missing', 'bad'],
    ]),
  ).toThrow('synchronous');
  expect(Object.getOwnPropertyDescriptor(target, 'method')).toEqual(before);
  probe.dispose();
});

it('times static classification only inside its named planner, including nested scopes', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  class Material {
    static factor = 3;
    static key(value: number) {
      time += 2;
      return this.factor * value;
    }
  }
  const original = Object.getOwnPropertyDescriptor(Material, 'key');
  probe.wrap(Material, 'key', 'material.key', 'batch.plan');
  expect(Material.key(2)).toBe(6);
  probe.begin();
  expect(Material.key(3)).toBe(9);
  probe.run('other', () => Material.key(4));
  probe.run('batch.plan', () => {
    time++;
    probe.run('batch.resolve', () => expect(Material.key(5)).toBe(15));
    time++;
  });
  expect(probe.end()).toEqual({
    other: { calls: 1, inclusiveMs: 2, exclusiveMs: 2 },
    'material.key': { calls: 1, inclusiveMs: 2, exclusiveMs: 2 },
    'batch.resolve': { calls: 1, inclusiveMs: 2, exclusiveMs: 0 },
    'batch.plan': { calls: 1, inclusiveMs: 4, exclusiveMs: 2 },
  });
  probe.dispose();
  expect(Object.getOwnPropertyDescriptor(Material, 'key')).toEqual(original);
});

it('unwinds conditional scopes on errors and does not retain a parent across frames', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  const failure = new Error('classification failed');
  const base = {
    key(...args: unknown[]) {
      expect(this).toBe(target);
      expect(args).toEqual([1, 2]);
      time += 3;
      throw failure;
    },
  };
  const target = Object.create(base);
  probe.wrap(target, 'key', 'material.key', 'batch.plan');
  probe.begin();
  expect(() => probe.run('batch.plan', () => target.key(1, 2))).toThrow(
    failure,
  );
  expect(() => target.key(1, 2)).toThrow(failure);
  expect(probe.end()).toEqual({
    'material.key': { calls: 1, inclusiveMs: 3, exclusiveMs: 3 },
    'batch.plan': { calls: 1, inclusiveMs: 3, exclusiveMs: 0 },
  });
  probe.begin();
  expect(() => target.key(1, 2)).toThrow(failure);
  expect(probe.end()).toEqual({});
  probe.dispose();
  expect(Object.hasOwn(target, 'key')).toBe(false);
  expect(target.key).toBe(base.key);
});

it('camera installation forwards parent constraints and restores inherited static ownership', () => {
  let time = 0;
  const probe = framePhaseProbe(() => time);
  class Parent {
    static key() {
      time++;
      return 4;
    }
  }
  class Child extends Parent {}
  const before = Parent.key;
  installCameraPhases(
    probe,
    { getContext: () => ({}) } as unknown as HTMLCanvasElement,
    [[Child, 'key', 'material.child', 'batch.plan']],
  );
  probe.begin();
  expect(Child.key()).toBe(4);
  probe.run('batch.plan', () => expect(Child.key()).toBe(4));
  expect(probe.end()).toEqual({
    'material.child': { calls: 1, inclusiveMs: 1, exclusiveMs: 1 },
    'batch.plan': { calls: 1, inclusiveMs: 1, exclusiveMs: 0 },
  });
  probe.dispose();
  expect(Object.hasOwn(Child, 'key')).toBe(false);
  expect(Child.key).toBe(before);
});
