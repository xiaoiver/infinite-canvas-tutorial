import { ComputeBounds, DrawPencil, GlobalTransform, Last, Plugin, system, Transform } from '@infinite-canvas-tutorial/ecs';
import { YogaSystem } from './system';

export const YogaPlugin: Plugin = () => {
  system((s) => s.after(DrawPencil, ComputeBounds).inAnyOrderWithWritersOf(GlobalTransform, Transform).before(Last))(YogaSystem);
};
