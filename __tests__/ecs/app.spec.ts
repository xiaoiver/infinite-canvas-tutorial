import { App, DOMAdapter, DefaultPlugins } from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('App', () => {
  it('should register custom plugin correctly', async () => {
    const app = new App();

    const CustomPlugin = jest.fn(() => {});
    app.addPlugins(...DefaultPlugins, CustomPlugin);

    await app.run();
    await app.exit();

    expect(CustomPlugin.mock.calls).toHaveLength(1);
  });
});
