import { Plugin, PreStartUp, system } from '@infinite-canvas-tutorial/ecs';
import { FalAISystem } from './system';

export const FalAIPlugin: Plugin = () => {
  system((s) => s.after(PreStartUp))(FalAISystem);
};
