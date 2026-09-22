import { CapabilityRegistry } from '../../packages/ecs/src/CapabilityRegistry';

it('makes provider selection independent of registration order and canvas instances', async () => {
  for (const order of [
    ['fal-ai', 'sam'],
    ['sam', 'fal-ai'],
  ]) {
    const registry = new CapabilityRegistry();
    registry.select('encodeImage', 'sam');
    const called: string[] = [];
    order.forEach((name) =>
      registry.register('encodeImage', name, async () => {
        called.push(name);
      }),
    );
    await registry.get('encodeImage')('image');
    expect(called).toEqual(['sam']);
  }
  expect(() => new CapabilityRegistry().get('encodeImage')).toThrow(
    'no provider',
  );
});

it('rejects ambiguous or duplicate providers and disposes registrations', () => {
  const registry = new CapabilityRegistry();
  const fn = async () => {};
  const unregister = registry.register('encodeImage', 'sam', fn);
  expect(() => registry.register('encodeImage', 'sam', fn)).toThrow(
    'already registered',
  );
  registry.register('encodeImage', 'fal-ai', fn);
  expect(() => registry.get('encodeImage')).toThrow('multiple providers');
  registry.select('encodeImage', 'sam');
  unregister();
  unregister();
  expect(() => registry.get('encodeImage')).toThrow('unavailable');
  registry.dispose();
  expect(registry.list('encodeImage')).toEqual([]);
  expect(() => registry.register('encodeImage', 'sam', fn)).toThrow('disposed');
});
