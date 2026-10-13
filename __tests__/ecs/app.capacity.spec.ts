import { App } from '../../packages/ecs/src/App';
import { DOMAdapter } from '../../packages/ecs/src/environment';

it('enforces each App capacity in a real World and releases it on exit', async () => {
  const adapter = DOMAdapter.get();
  DOMAdapter.set({
    ...adapter,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
  });
  try {
    // A new App can choose another budget after the previous World exits.
    for (const capacity of [128, 256]) {
      const app = new App({ maxEntities: capacity });
      try {
        await app.run();
        const available = capacity - app.world.stats.numEntities;
        for (let i = 0; i < available; i++) app.world.createEntity();
        expect(app.world.stats.numEntities).toBe(capacity);
        expect(() => app.world.createEntity()).toThrow(
          `Pool capacity exceeded, please raise maxEntities above ${capacity}`,
        );
      } finally {
        await app.exit();
      }
    }
  } finally {
    DOMAdapter.set(adapter);
  }
});
