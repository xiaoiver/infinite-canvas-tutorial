import { createWorld } from 'koota';
import { Runnable, Schedule } from 'directed';
import { DOMAdapter } from './environment';
import { Commands } from './Commands';
import { TransformSystem } from './systems/Transform';
import { RendererSystem } from './systems/Renderer';
import {
  AppConfig,
  CanvasConfig,
  DEFAULT_APP_CONFIG,
} from './components/AppConfig';

/**
 * @example
 * ```ts
 * const app = new App();
 * app.run();
 * ```
 */
export class App {
  #world = createWorld();
  #schedule = new Schedule<{ commands: Commands; delta: number }>();

  #rafId: number;

  #running = false;

  constructor(config: CanvasConfig) {
    // @see https://github.com/pmndrs/koota?tab=readme-ov-file#world-traits
    this.#world.add(
      AppConfig({
        ...DEFAULT_APP_CONFIG,
        ...config,
      }),
    );

    this.#schedule.add(TransformSystem);
    this.#schedule.add(RendererSystem);
  }

  addSystems(...systems: Runnable<{ commands: Commands; delta: number }>[]) {
    this.#schedule.add(systems);
    return this;
  }

  run() {
    if (this.#running) return;

    this.#running = true;

    this.#schedule.build();

    const commands = new Commands(this.#world);

    const tick: FrameRequestCallback = (time: number) => {
      this.#schedule.run({ commands, delta: time });
      this.#rafId = DOMAdapter.get().requestAnimationFrame(tick);
    };
    this.#rafId = DOMAdapter.get().requestAnimationFrame(tick);
  }

  /**
   * Exit the app.
   * @see https://bevy-cheatbook.github.io/programming/app-builder.html#quitting-the-app
   */
  exit() {
    DOMAdapter.get().cancelAnimationFrame(this.#rafId);
    this.#world.destroy();
  }
}
