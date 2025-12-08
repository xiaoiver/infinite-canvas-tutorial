import { Plugin, PreStartUp, system } from '@infinite-canvas-tutorial/ecs';
import { SAMSystem } from './system';

export const SAMPlugin: Plugin = () => {
  system((s) => s.after(PreStartUp))(SAMSystem);
};
