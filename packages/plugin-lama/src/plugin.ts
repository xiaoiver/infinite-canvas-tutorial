import { Plugin, PreStartUp, system } from '@infinite-canvas-tutorial/ecs';
import { LaMaSystem } from './system';

export const LaMaPlugin: Plugin = () => {
  system((s) => s.after(PreStartUp))(LaMaSystem);
};
