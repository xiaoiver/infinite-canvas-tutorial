import { Plugin, PreStartUp, system } from '@infinite-canvas-tutorial/ecs';
import { UpscalerSystem } from './system';

export const UpscalerPlugin: Plugin = () => {
  system((s) => s.after(PreStartUp))(UpscalerSystem);
};
