import {
  system,
  System,
  SystemType,
  World,
  SystemGroup,
} from '@lastolivegames/becsy';
import { Plugin } from './plugins';
import {
  CanvasConfig,
  CanvasMode,
  CheckboardStyle,
  Grid,
  Theme,
  ThemeMode,
} from './components';
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
// import { EventCtor, Events, EventsReader } from './Events';
import { Resource } from './Resource';
import { DOMAdapter } from './environment';

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
  #plugins: Plugin[] = [];

  /**
   * All the systems registered.
   */
  #systems: [SystemGroup, SystemType<any>][] = [];

  // private updateEventsSystemCounter = 0;
  #resources = new WeakMap<any, Resource>();
  #rafId: number;

  /**
   * @example
   * new App()
   *   .addPlugin(P1)
   */
  addPlugin(plugin: Plugin) {
    this.#plugins.push(plugin);
    return this;
  }

  /**
   * @example
   * new App()
   *   .addPlugins(P1, P2)
   */
  addPlugins(...plugins: Plugin[]) {
    plugins.forEach((plugin) => {
      this.addPlugin(plugin);
    });
    return this;
  }

  /**
   * Setup the application to manage events of type `T`.
   *
   * This is done by adding a [`Resource`] of type [`Events::<T>`],
   * and inserting an [`event_update_system`] into [`First`].
   *
   * See [`Events`] for defining events.
   *
   * @example
   * app.add_event(MyEvent);
   */
  // add_event<E>(eventCtor: EventCtor<E>) {
  //   const events = new Events<E>();
  //   const reader = new EventsReader(events, events.get_reader());
  //   this.init_resource(eventCtor, reader);

  //   class UpdateEvents extends System {
  //     execute(): void {
  //       if (
  //         events.events_a.events.length !== 0 ||
  //         events.events_b.events.length !== 0
  //       ) {
  //         events.update();
  //       }
  //     }
  //   }
  //   Object.defineProperty(UpdateEvents, 'name', {
  //     value: `_UpdateEventsSystem${this.updateEventsSystemCounter++}`,
  //   });

  //   this.add_systems(First, UpdateEvents);
  //   return this;
  // }

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

  /**
   * Initialize a [`Resource`] with standard starting values by adding it to the [`World`].
   */
  initResource<K, R extends Resource>(key: K, resource: R) {
    this.#resources.set(key, resource);
    return this;
  }

  getResource<K, R extends Resource>(key: K): R {
    return this.#resources.get(key) as R;
  }

  /**
   * Start the app and run all systems.
   */
  async run() {
    const resources = this.#resources;

    // Create a global init system.
    @system(PreStartUp)
    class InitAppConfig extends System {
      constructor() {
        super();
        this.singleton.write(CanvasConfig, {
          renderer: 'webgl',
          shaderCompilerPath: '',
          devicePixelRatio: 1,
          mode: CanvasMode.HAND,
        });
        this.singleton.write(Grid, {
          checkboardStyle: CheckboardStyle.GRID,
        });
        this.singleton.write(Theme, {
          mode: ThemeMode.LIGHT,
          colors: {
            [ThemeMode.LIGHT]: {
              background: '#fbfbfb',
              grid: '#dedede',
              selectionBrushFill: '#dedede',
              selectionBrushStroke: '#dedede',
            },
            [ThemeMode.DARK]: {
              background: '#121212',
              grid: '#242424',
              selectionBrushFill: '#242424',
              selectionBrushStroke: '#242424',
            },
          },
        });
      }

      async prepare() {}
    }

    @system(PreStartUp)
    class PreStartUpPlaceHolder extends System {}
    @system(StartUp)
    class StartUpPlaceHolder extends System {}
    @system(PostStartup)
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
    await Promise.all(this.#plugins.map((plugin) => plugin(this)));

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
