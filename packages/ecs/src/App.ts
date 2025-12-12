import { system, System, World } from '@lastolivegames/becsy';
import { Plugin, PluginWithConfig } from './plugins';
import { DOMAdapter } from './environment';
import {
  StartUp,
  First,
  Last,
  PostUpdate,
  Update,
  PreStartUp,
  PostStartUp,
  PreUpdate,
} from './systems/stages';

/**
 * @see https://bevy-cheatbook.github.io/programming/app-builder.html
 */
export class App {
  /**
   * The main ECS [`World`] of the [`App`].
   * This stores and provides access to all the main data of the application.
   * The systems of the [`App`] will run using this [`World`].
   */
  world: World;

  /**
   * All the plugins registered.
   */
  #plugins: (Plugin | [Plugin, any] | PluginWithConfig<any>)[] = [];

  #rafId: number;

  /**
   * @example
   * new App()
   *   .addPlugin(P1)
   * @example
   * new App()
   *   .addPlugin(MyPlugin.configure({ option: 'value' }))
   */
  addPlugin(plugin: Plugin | [Plugin, any] | PluginWithConfig<any>) {
    this.#plugins.push(plugin);
    return this;
  }

  /**
   * @example
   * new App()
   *   .addPlugins(P1, P2)
   * @example
   * new App()
   *   .addPlugins(P1, MyPlugin.configure({ option: 'value' }))
   */
  addPlugins(...plugins: (Plugin | [Plugin, any] | PluginWithConfig<any>)[]) {
    plugins.forEach((plugin) => {
      this.addPlugin(plugin);
    });
    return this;
  }

  /**
   * Start the app and run all systems.
   */
  async run() {
    // Create a global init system.
    @system(PreStartUp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class PreStartUpPlaceHolder extends System {}
    @system(StartUp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class StartUpPlaceHolder extends System {}
    @system(PostStartUp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class PostStartUpPlaceHolder extends System {}
    @system(PreUpdate)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class PreUpdatePlaceHolder extends System {}
    @system(Update)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class UpdatePlaceHolder extends System {}
    @system(PostUpdate)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class PostUpdatePlaceHolder extends System {}
    @system(First)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class FirstPlaceHolder extends System {}
    @system(Last)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class LastPlaceHolder extends System {}

    // Build all plugins.
    for (const plugin of this.#plugins) {
      if (Array.isArray(plugin)) {
        // Support [Plugin, options] tuple format
        await plugin[0](plugin[1]);
      } else if (
        typeof plugin === 'object' &&
        plugin !== null &&
        'configure' in plugin
      ) {
        // Support PluginWithConfig - this should be called with configure() first
        // If it reaches here, it means configure() wasn't called, so we use default options
        throw new Error(
          'Plugin with configuration must be called with .configure(options) before adding to app',
        );
      } else {
        // Regular plugin function
        await (plugin as Plugin)();
      }
    }

    // Create world.
    // All systems will be instantiated and initialized before the returned promise resolves.
    this.world = await World.create({
      // Multithreading is not supported yet.
      threads: 1,
    });

    const tick = async () => {
      await this.world.execute();
      this.#rafId = DOMAdapter.get().requestAnimationFrame(tick);
    };
    this.#rafId = DOMAdapter.get().requestAnimationFrame(tick);

    return this;
  }

  /**
   * Exit the app.
   * @see https://bevy-cheatbook.github.io/programming/app-builder.html#quitting-the-app
   */
  async exit() {
    DOMAdapter.get().cancelAnimationFrame(this.#rafId);
    await this.world.terminate();
  }
}
