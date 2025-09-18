---
outline: deep
description: '吸附与对齐'
head:
    - ['meta', { property: 'og:title', content: '课程 27 - 吸附与对齐' }]
---

# 课程 27 - 吸附与对齐

Excalidraw 中的 snapping 功能实现分为以下几个关键步骤：

-   检查当前操作是否允许吸附（isSnappingEnabled）。
-   计算所有可吸附的点和间隙（getPointSnaps/getGapSnaps）。
-   拖拽/缩放时实时计算吸附偏移和辅助线（snapDraggedElements/snapResizingElements）。
-   把 snapLines 传递到 UI 层，canvas 上渲染辅助线（renderSnaps.ts）。

## 扩展阅读 {#extended-reading}

-   [How to snap shapes positions on dragging with Konva?]
-   [Custom snapping in tldraw]

[How to snap shapes positions on dragging with Konva?]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Custom snapping in tldraw]: https://tldraw.dev/examples/bounds-snapping-shape
