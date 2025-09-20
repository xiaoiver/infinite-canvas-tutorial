---
outline: deep
description: '吸附与对齐'
head:
    - ['meta', { property: 'og:title', content: '课程 27 - 吸附与对齐' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
</script>

# 课程 27 - 吸附与对齐

## 网格吸附 {#snap-to-pixel-grid}

在 [课程 5 - 绘制网格] 中我们介绍了如何高效绘制直线网格，在一些拖拽交互例如移动和绘制时，吸附到网格的最小单位，能保证图形的位置或者几何信息为整数。这个功能在 Figma 中被称为 “Snap to pixel grid”，在“用户偏好设置”中可以开启。

![source: [Snap to grid in Excalidraw] ](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

实现这一功能，首先需要计算捕捉点的坐标。当用户拖动、缩放、绘制图形时，获取当前的坐标（如 x, y），然后将该坐标四舍五入到最近的整数（像素点）或者指定的 grid 间距：

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

然后在所有需要计算点坐标的 System 里（例如 Select）中，都应用这个处理函数：

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

在下面的例子中，我们将 `snapToPixelGridSize` 设置成 10，你可以通过拖拽感受效果：

<SnapToPixelGrid />

## 对象级吸附 {#snap-to-objects}

Excalidraw 中的 snapping 功能实现分为以下几个关键步骤：

-   检查当前操作是否允许吸附（isSnappingEnabled）。
-   计算所有可吸附的点和间隙（getPointSnaps/getGapSnaps）。
-   拖拽/缩放时实时计算吸附偏移和辅助线（snapDraggedElements/snapResizingElements）。
-   把 snapLines 传递到 UI 层，canvas 上渲染辅助线（renderSnaps.ts）。

## 扩展阅读 {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[课程 5 - 绘制网格]: /zh/guide/lesson-005
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
