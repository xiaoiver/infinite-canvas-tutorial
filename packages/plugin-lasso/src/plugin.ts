import {
  Plugin,
  Last,
  system,
  Cursor,
  ViewportCulling,
} from '@infinite-canvas-tutorial/ecs';
import { ZoomLevel } from '@infinite-canvas-tutorial/webcomponents';
import { LassoSystem } from './system';

export const LassoPlugin: Plugin = () => {
  system((s) =>
    s.afterWritersOf(Cursor).after(ZoomLevel, ViewportCulling).before(Last),
  )(LassoSystem);
};
