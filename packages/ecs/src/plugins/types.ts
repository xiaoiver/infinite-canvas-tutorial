/**
 * Plugins are simply collections of things to be added to the App Builder.
 * Think of this as a way to add things to the app from multiple places, like different Rust files/modules or crates.
 * @see https://bevy-cheatbook.github.io/programming/plugins.html
 *
 * @example
 * // Simple plugin function
 * const MyPlugin: Plugin = () => {
 *   system(StartUp)(MySystem);
 * }
 *
 * @example
 * // Plugin with configuration (similar to tiptap)
 * const MyPlugin = {
 *   configure(options: MyOptions): Plugin {
 *     return () => {
 *       system(StartUp)(MySystem);
 *     };
 *   }
 * }
 */
export type Plugin = (...args: any[]) => Promise<void> | void;

/**
 * Plugin with configuration support.
 * Similar to tiptap's plugin system, allows plugins to accept initialization parameters.
 *
 * @example
 * const MyPlugin = {
 *   configure(options: MyOptions): Plugin {
 *     return () => {
 *       // Use options here
 *       system(StartUp)(MySystem);
 *     };
 *   }
 * }
 */
export interface PluginWithConfig<Options = any> {
  configure(options: Options): Plugin;
}
