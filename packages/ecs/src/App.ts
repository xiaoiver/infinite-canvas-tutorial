import { system, System, World } from '@lastolivegames/becsy';
import { Plugin, PluginWithConfig } from './plugins';
import { DOMAdapter } from './environment';
import {
  StartUp,
  First,
  Edit,
  Last,
  PostUpdate,
  Update,
  PreStartUp,
  PostStartUp,
  PreUpdate,
  prepareStages,
} from './systems/stages';

// Becsy keeps system definitions globally. Reuse these types across Worlds;
// declaring new classes inside start() registers duplicate component names.
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
@system(Edit)
class EditPlaceHolder extends System {}
@system(Last)
class LastPlaceHolder extends System {}

// Registration happens in the decorators; no instances are constructed here.
void [
  PreStartUpPlaceHolder,
  StartUpPlaceHolder,
  PostStartUpPlaceHolder,
  PreUpdatePlaceHolder,
  UpdatePlaceHolder,
  PostUpdatePlaceHolder,
  FirstPlaceHolder,
  EditPlaceHolder,
  LastPlaceHolder,
];

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

  #rafId: number | undefined;
  #runPromise: Promise<this>;
  #exitPromise: Promise<void>;
  #frame: Promise<void>;
  #exiting = false;
  #adapter: ReturnType<typeof DOMAdapter.get>;

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
  run(): Promise<this> {
    if (this.#exiting) return Promise.reject(new Error('App has exited'));
    return (this.#runPromise ??= this.start());
  }

  private async start() {
    this.#adapter = DOMAdapter.get();
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
    prepareStages();
    this.world = await World.create({
      // Multithreading is not supported yet.
      threads: 1,
      maxEntities: 4194304,
      maxLimboComponents: 4194304,
    });

    const tick = async () => {
      this.#rafId = undefined;
      if (this.#exiting) return;
      this.#frame = this.world.execute();
      await this.#frame;
      if (!this.#exiting) {
        this.#rafId = this.#adapter.requestAnimationFrame(tick);
      }
    };
    if (!this.#exiting) {
      this.#rafId = this.#adapter.requestAnimationFrame(tick);
    }

    return this;
  }

  /**
   * Exit the app.
   * @see https://bevy-cheatbook.github.io/programming/app-builder.html#quitting-the-app
   */
  exit(): Promise<void> {
    if (!this.#runPromise) return Promise.resolve();
    if (this.#exitPromise) return this.#exitPromise;
    this.#exiting = true;
    if (this.#rafId !== undefined) {
      this.#adapter.cancelAnimationFrame(this.#rafId);
      this.#rafId = undefined;
    }
    this.#exitPromise = (async () => {
      await this.#runPromise;
      try {
        await this.#frame;
      } finally {
        await this.world.terminate();
      }
    })();
    return this.#exitPromise;
  }
}
