import {
  Plugin,
  Last,
  system,
  DrawPencil,
  RenderTransformer,
  RenderHighlighter,
  Cursor,
} from '@infinite-canvas-tutorial/ecs';
import { DrawLaserPointer } from './system';

export const LaserPointerPlugin: Plugin = () => {
  system((s) =>
    s
      .after(DrawPencil)
      .inAnyOrderWithWritersOf(Cursor)
      .before(Last, RenderHighlighter, RenderTransformer),
  )(DrawLaserPointer);
};
