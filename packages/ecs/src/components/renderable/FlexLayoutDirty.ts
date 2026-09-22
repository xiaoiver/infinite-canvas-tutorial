/**
 * 序列化节点上的 flex 布局属性（padding、gap 等）变更时由 mutateElement 打上标记，
 * Yoga 插件据此在几何尺寸未变时仍重新跑布局。
 */
export class FlexLayoutDirty {}
