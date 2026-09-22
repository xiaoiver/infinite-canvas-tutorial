import {
  DrawVectorNetwork,
  Last,
  Plugin,
  system,
} from '@infinite-canvas-tutorial/ecs';
import { DrawEraser } from './system';

export const EraserPlugin: Plugin = () => {
  // After DrawVectorNetwork (which runs after DrawPencil) to avoid a schedule cycle.
  system((s) => s.after(DrawVectorNetwork).before(Last))(DrawEraser);
};
