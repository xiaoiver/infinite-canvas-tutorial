import { component, ComputeBounds, DrawPencil, GlobalTransform, Last, Plugin, system, Transform } from '@infinite-canvas-tutorial/ecs';
import { YogaLayoutApplied } from './YogaLayoutApplied';
import { YogaSystem } from './system';

/** Flex 布局样式来自序列化节点；ECS 侧仅 Flex / FlexLayoutDirty 等标记组件，由 Renderer 与 Yoga 插件注册。 */
export const YogaPlugin: Plugin = () => {
  component(YogaLayoutApplied);
  system((s) => s.after(DrawPencil, ComputeBounds).inAnyOrderWithWritersOf(GlobalTransform, Transform).before(Last))(YogaSystem);
};
