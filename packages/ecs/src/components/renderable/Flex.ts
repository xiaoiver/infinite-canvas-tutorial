/**
 * 标记该节点为 flex 容器（`display: 'flex'`），供渲染与 Yoga 插件识别。
 * padding、margin、gap、flexDirection 等布局数据存放在序列化节点（FlexboxLayoutAttributes）
 * 上，由反序列化与 `mutateElement` 维护，而非存在本组件字段中。
 */
export class Flex {
}