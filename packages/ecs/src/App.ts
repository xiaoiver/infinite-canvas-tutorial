import {
  system,
  System,
  SystemType,
  World,
  SystemGroup,
} from '@lastolivegames/becsy';
import { Plugin } from './plugins';
import {
  First,
  Last,
  PostStartup,
  PostUpdate,
  PreStartUp,
  PreUpdate,
  StartUp,
  Update,
} from './systems';
// import { Resource } from './Resource';
import { DOMAdapter } from './environment';
import {
  Cursor,
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from './components';

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

  /**
   * All the systems registered.
   */
  #systems: [SystemGroup, SystemType<any>][] = [];

  /**
   * All the groups registered.
   */
  #groups: SystemGroup[] = [];

  // private updateEventsSystemCounter = 0;
  // #resources = new WeakMap<any, Resource>();
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
   * Adds a system to the given schedule in this app's [`Schedules`].
   * @example
   * new App()
   *   .addSystems(StartUp, S1, S2);
   */
  addSystems(group: SystemGroup, ...systems: SystemType<any>[]) {
    this.#systems.push(
      ...systems.map((s) => [group, s] as [SystemGroup, SystemType<any>]),
    );
    return this;
  }

  addGroup(group: SystemGroup) {
    this.#groups.push(group);
    return this;
  }

  // /**
  //  * Initialize a [`Resource`] with standard starting values by adding it to the [`World`].
  //  */
  // initResource<K, R extends Resource>(key: K, resource: R) {
  //   this.#resources.set(key, resource);
  //   return this;
  // }

  // getResource<K, R extends Resource>(key: K): R {
  //   return this.#resources.get(key) as R;
  // }

  /**
   * Start the app and run all systems.
   */
  async run() {
    // const resources = this.#resources;

    PreStartUp.schedule((s) => s.before(StartUp));
    StartUp.schedule((s) => s.before(PostStartup));
    PostStartup.schedule((s) => s.before(First));
    First.schedule((s) => s.before(PreUpdate));
    PreUpdate.schedule((s) => s.before(Update));
    Update.schedule((s) => s.before(PostUpdate));
    PostUpdate.schedule((s) => s.before(Last));

    @system(PreStartUp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class PreStartUpPlaceHolder extends System {
      constructor() {
        super();
        this.singleton.read(Cursor);
        this.singleton.read(RasterScreenshotRequest);
        this.singleton.read(VectorScreenshotRequest);
        this.singleton.read(Screenshot);
      }
    }
    @system(StartUp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class StartUpPlaceHolder extends System {}
    @system(PostStartup)
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
        await plugin[0](this, plugin[1]);
      } else {
        await plugin(this);
      }
    }

    this.#systems.forEach(([group, s], i) => {
      // @see https://github.com/LastOliveGames/becsy/blob/main/tests/query.test.ts#L22C3-L22C58
      // @ts-ignore
      // if (import.meta.env.PROD) {
      // Object.defineProperty(s, 'name', { value: `_System${i}` });
      // }
      system(group)(s);
    });

    // Create world.
    // All systems will be instantiated and initialized before the returned promise resolves.
    this.world = await World.create({
      // Multithreading is not supported yet.
      threads: 1,
      defs: this.#groups,
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
