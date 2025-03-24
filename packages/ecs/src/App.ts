import { system, System, World } from '@lastolivegames/becsy';
import { Plugin } from './plugins';
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
  #plugins: (Plugin | [Plugin, any])[] = [];

  #rafId: number;

  /**
   * @example
   * new App()
   *   .addPlugin(P1)
   */
  addPlugin(plugin: Plugin | [Plugin, any]) {
    this.#plugins.push(plugin);
    return this;
  }

  /**
   * @example
   * new App()
   *   .addPlugins(P1, P2)
   */
  addPlugins(...plugins: (Plugin | [Plugin, any])[]) {
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
    class PreStartUpPlaceHolder extends System {}
    @system(StartUp)
    class StartUpPlaceHolder extends System {}
    @system(PostStartUp)
    class PostStartUpPlaceHolder extends System {}
    @system(PreUpdate)
    class PreUpdatePlaceHolder extends System {}
    @system(Update)
    class UpdatePlaceHolder extends System {}
    @system(PostUpdate)
    class PostUpdatePlaceHolder extends System {}
    @system(First)
    class FirstPlaceHolder extends System {}
    @system(Last)
    class LastPlaceHolder extends System {}

    // Build all plugins.
    for (const plugin of this.#plugins) {
      if (Array.isArray(plugin)) {
        await plugin[0](plugin[1]);
      } else {
        await plugin();
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
