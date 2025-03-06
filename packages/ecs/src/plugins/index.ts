import { App } from '../App';

/**
 * Plugins are simply collections of things to be added to the App Builder.
 * Think of this as a way to add things to the app from multiple places, like different Rust files/modules or crates.
 * @see https://bevy-cheatbook.github.io/programming/plugins.html
 *
 * @example
 * class MyPlugin implements Plugin {
 *   build(app: App) {
 *     app.add_systems(HelloWorld);
 *   }
 * }
 */
export interface Plugin {
  build(app: App): Promise<void> | void;
}

export interface PluginType<P extends Plugin = Plugin> {
  new (): P;
}

export * from './Hierarchy';
export * from './Transform';
export * from './Renderer';
