import { App, DOMAdapter, DefaultPlugins, DefaultRenderer3DPlugin } from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Renderer3D schedule', () => {
  it('registers without precedence cycles', async () => {
    const app = new App();
    app.addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
    await app.run();
    await app.exit();
  });
});
