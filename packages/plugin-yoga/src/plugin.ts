import { component, ComputeBounds, DrawPencil, GlobalTransform, Last, Plugin, system, Transform } from '@infinite-canvas-tutorial/ecs';
import { YogaLayoutApplied } from './YogaLayoutApplied';
import { YogaSystem } from './system';

export const YogaPlugin: Plugin = () => {
  component(YogaLayoutApplied);
  system((s) => s.after(DrawPencil, ComputeBounds).inAnyOrderWithWritersOf(GlobalTransform, Transform).before(Last))(YogaSystem);
};
