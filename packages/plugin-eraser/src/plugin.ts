import {
  DrawPencil,
  Last,
  Plugin,
  system,
} from '@infinite-canvas-tutorial/ecs';
import { DrawEraser } from './system';

export const EraserPlugin: Plugin = () => {
  system((s) => s.after(DrawPencil).before(Last))(DrawEraser);
};
