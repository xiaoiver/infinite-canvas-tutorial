import {
  Plugin,
  Last,
  system,
  Cursor,
  ViewportCulling,
} from '@infinite-canvas-tutorial/ecs';
import { LassoSystem } from './system';

export const LassoPlugin: Plugin = () => {
  system((s) =>
    s.afterWritersOf(Cursor).after(ViewportCulling).before(Last),
  )(LassoSystem);
};
