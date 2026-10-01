import { App } from '../../packages/ecs/src/App';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import {
  System,
  system,
} from '../../packages/ecs/node_modules/@lastolivegames/becsy';
import { First, Last } from '../../packages/ecs/src/systems/stages';

const executed: string[] = [];
class RestartLast extends System {
  execute() {
    executed.push('last');
  }
}
class RestartFirst extends System {
  execute() {
    executed.push('first');
  }
}
// Register in reverse order to ensure the test checks stage constraints.
system(Last)(RestartLast);
system(First)(RestartFirst);

it('creates a new ECS World after a previous App exits', async () => {
  const previousAdapter = DOMAdapter.get();
  DOMAdapter.set({
    ...previousAdapter,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
  });
  const first = new App();
  const second = new App();
  try {
    await first.run();
    await first.world.execute();
    expect(executed.splice(0)).toEqual(['first', 'last']);
    await first.exit();
    await second.run();
    expect(second.world).not.toBe(first.world);
    await second.world.execute();
    expect(executed.splice(0)).toEqual(['first', 'last']);
  } finally {
    await Promise.allSettled([first.exit(), second.exit()]);
    DOMAdapter.set(previousAdapter);
  }
});
