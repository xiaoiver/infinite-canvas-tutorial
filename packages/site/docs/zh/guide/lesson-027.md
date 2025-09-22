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

吸附是一种常见于图形编辑器应用中的功能，其核心思想是在元素移动、绘制或缩放时，自动将其边界或锚点对齐到最近的像素网格线或者其他图形上，本节课我们就来介绍它们的实现。

## 网格吸附 {#snap-to-pixel-grid}

在 [课程 5 - 绘制网格] 中我们介绍了如何高效绘制直线网格，在一些拖拽交互例如移动和绘制时，吸附到网格的最小单位，能保证图形的位置或者几何信息为整数。这个功能在 Figma 中被称为 “Snap to pixel grid”，在“用户偏好设置”中可以开启。

![source: [Snap to grid in Excalidraw] ](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

我们在应用状态中增加两个配置项：

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

实现这一功能，首先需要计算世界坐标系下点的坐标。当用户拖动、缩放、绘制图形时，获取当前的坐标（如 x, y），然后将该坐标四舍五入到最近的整数（像素点）或者指定的 grid 间距：

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

然后在所有需要计算世界坐标系下点的坐标的 System 里（例如 Select、DrawRect）中，都应用这个处理函数：

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

在下面的例子中，我们将 `snapToPixelGridSize` 设置成 10，你可以通过拖拽移动、绘制来感受效果：

<SnapToPixelGrid />

## 对象级吸附 {#snap-to-objects}

Excalidraw 中的 snapping 功能实现分为以下几个关键步骤：

-   [isSnappingEnabled] 检查当前操作是否允许吸附
-   [getPointSnaps] 计算所有可吸附的点和间隙
-   [snapDraggedElements] / [snapResizingElements] 拖拽/缩放时实时计算吸附偏移和辅助线
-   [renderSnaps] 把 snapLines 传递到 UI 层，canvas 上渲染辅助线

下面我们参考以上步骤来实现。

### 检查是否允许吸附 {#is-snapping-enabled}

我们在应用状态中增加以下配置项：

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

### 计算可吸附点 {#get-point-snaps}

可吸附点分成两类：被选中的图形与其他图形。对于选中的一个或多个图形，常用的可吸附点包括包围盒的四个角和中心：

```ts
const { minX, minY, maxX, maxY } = api.getBounds(
    selected.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
const selectionSnapPoints = [
    new Point(minX, minY), // 4 corners
    new Point(maxX, minY),
    new Point(minX, maxY),
    new Point(maxX, maxY),
    new Point(minX + boundsWidth / 2, minY + boundsHeight / 2), // center
];
```

考虑性能，我们应该尽量减少被选中图形吸附点与其他所有图形吸附点的检测次数。类似问题我们在 [课程 8 - 使用空间索引加速] 中已经介绍过了，只检索视口范围内的图形即可。

```ts
const unculled = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled));
```

### 渲染辅助线 {#render-snap-lines}

## 扩展阅读 {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[课程 5 - 绘制网格]: /zh/guide/lesson-005
[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Snap to grid in Excalidraw]: https://github.com/excalidraw/excalidraw/issues/521
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[课程 8 - 使用空间索引加速]: /zh/guide/lesson-008#using-spatial-indexing
