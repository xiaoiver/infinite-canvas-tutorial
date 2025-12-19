import {
  Plugin,
  PreStartUp,
  system,
  PluginWithConfig,
} from '@infinite-canvas-tutorial/ecs';
import { fal } from '@fal-ai/client';
import { FalAISystem } from './system';

export interface FalAIPluginOptions {
  credentials: string;
}

/**
 * FalAI Plugin with configuration support.
 * Similar to tiptap's plugin system.
 *
 * @example
 * // With configuration
 * new App().addPlugins(FalAIPlugin.configure({
 *   credentials: 'your-credentials-here'
 * }))
 */
export const FalAIPlugin: PluginWithConfig<FalAIPluginOptions> = {
  configure(options: FalAIPluginOptions): Plugin {
    return () => {
      // Configure fal client with credentials before registering the system
      fal.config({
        credentials: options.credentials,
      });
      system((s) => s.after(PreStartUp))(FalAISystem);
    };
  },
};
