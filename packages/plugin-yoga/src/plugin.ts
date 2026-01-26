import { Plugin, PreStartUp, system } from '@infinite-canvas-tutorial/ecs';
import { YogaSystem } from './system';

export const YogaPlugin: Plugin = () => {
  system((s) => s.after(PreStartUp))(YogaSystem);
};
