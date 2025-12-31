import {
  Plugin,
  Last,
  system,
  DrawEraser,
  RenderTransformer,
  RenderHighlighter,
} from '@infinite-canvas-tutorial/ecs';
import { LaserPointerSystem } from './system';

export const LaserPointerPlugin: Plugin = () => {
  system((s) =>
    s
      .after(DrawEraser)
      .before(Last)
      .before(RenderTransformer, RenderHighlighter),
  )(LaserPointerSystem);
};
