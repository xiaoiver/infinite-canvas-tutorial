import { System, World } from '@lastolivegames/becsy';
import { Plugin } from './plugins';
import { DOMAdapter } from './environment';
import { Canvas, Cursor, Grid, Theme } from './components';

export class PreStartUp extends System {}
export class StartUp extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(PostStartUp).after(PreStartUp));
  }
}
export class PostStartUp extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(First).after(StartUp));
  }
}
export class First extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(PreUpdate).after(PostStartUp));
  }
}
export class PreUpdate extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(Update).after(First));
  }
}
export class Update extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(PostUpdate).after(PreUpdate));
  }
}
export class PostUpdate extends System {
  constructor() {
    super();
    this.schedule((s) => s.before(Last).after(Update));
  }
}
export class Last extends System {
  constructor() {
    super();
    this.schedule((s) => s.after(PostUpdate));
  }
}

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
    // /**
    //  * The schedule that contains the app logic that is evaluated each tick of [`App::update()`].
    //  *
    //  * By default, it will run the following schedules in the given order:
    //  *
    //  * On the first run of the schedule (and only on the first run), it will run:
    //  * * [`PreStartup`]
    //  * * [`Startup`]
    //  * * [`PostStartup`]
    //  *
    //  * Then it will run:
    //  * * [`First`]
    //  * * [`PreUpdate`]
    //  * * [`StateTransition`]
    //  * * [`RunFixedUpdateLoop`]
    //  *     * This will run [`FixedUpdate`] zero to many times, based on how much time has elapsed.
    //  * * [`Update`]
    //  * * [`PostUpdate`]
    //  * * [`Last`]
    //  */

    // /**
    //  * The schedule that runs before [`Startup`].
    //  */
    // const PreStartUp = System.group(PreStartUp);

    // /**
    //  * The schedule that runs once when the app starts.
    //  */
    // const StartUp = System.group(StartUp);

    // /**
    //  * The schedule that runs once after [`Startup`].
    //  */
    // const PostStartup = System.group(PostStartUp);

    // /**
    //  * Runs first in the schedule.
    //  */
    // const First = System.group(First);

    // /**
    //  * The schedule that contains logic that must run before [`Update`]. For example, a system that reads raw keyboard
    //  * input OS events into an `Events` resource. This enables systems in [`Update`] to consume the events from the `Events`
    //  * resource without actually knowing about (or taking a direct scheduler dependency on) the "os-level keyboard event system".
    //  *
    //  * [`PreUpdate`] exists to do "engine/plugin preparation work" that ensures the APIs consumed in [`Update`] are "ready".
    //  * [`PreUpdate`] abstracts out "pre work implementation details".
    //  *
    //  * See the [`Main`] schedule for some details about how schedules are run.
    //  */
    // const PreUpdate = System.group(PreUpdate);

    // /**
    //  * The schedule that contains app logic.
    //  */
    // const Update = System.group(Update);

    // /**
    //  * The schedule that contains logic that must run after [`Update`]. For example, synchronizing "local transforms" in a hierarchy
    //  * to "global" absolute transforms. This enables the [`PostUpdate`] transform-sync system to react to "local transform" changes in
    //  * [`Update`] without the [`Update`] systems needing to know about (or add scheduler dependencies for) the "global transform sync system".
    //  *
    //  * [`PostUpdate`] exists to do "engine/plugin response work" to things that happened in [`Update`].
    //  * [`PostUpdate`] abstracts out "implementation details" from users defining systems in [`Update`].
    //  *
    //  * See the [`Main`] schedule for some details about how schedules are run.
    //  */
    // const PostUpdate = System.group(PostUpdate);

    // /**
    //  * Runs last in the schedule.
    //  */
    // const Last = System.group(Last);

    const allDefs: any[] = [];
    // Build all plugins.
    for (const plugin of this.#plugins) {
      if (Array.isArray(plugin)) {
        const pluginDefs = await plugin[0](plugin[1]);
        if (Array.isArray(pluginDefs)) {
          allDefs.push(...pluginDefs);
        }
      } else {
        const pluginDefs = await plugin();
        if (Array.isArray(pluginDefs)) {
          allDefs.push(...pluginDefs);
        }
      }
    }

    // Create world.
    // All systems will be instantiated and initialized before the returned promise resolves.
    this.world = await World.create({
      // Multithreading is not supported yet.
      threads: 1,
      defs: [
        PreStartUp,
        StartUp,
        PostStartUp,
        First,
        PreUpdate,
        Update,
        PostUpdate,
        Last,
        Canvas,
        Cursor,
        Grid,
        Theme,
        ...allDefs,
      ],
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
