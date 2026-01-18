---
outline: deep
description: ''
publish: false
---

# 课程 31 - 图形间的连接关系

在 [课程 23 - 思维导图] 中，我们仅关注了节点和边的布局算法，并没有深入交互，例如移动节点时绑定的边也要跟着移动。同样在 [课程 25 - 绘制箭头] 中，直线和箭头的属性中也不包含绑定信息，这节课我们将补全这一点。

## 数据结构 {#data-structure}

### Excalidraw 中的线性元素 {#excalidraw-linear-element}

Excalidraw 中，连接线（如箭头）在数据模型中用 `ExcalidrawLinearElement` 表示，该类型增加了连接相关字段：

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

如上所示，每条箭头具有可选的 `startBinding` 和 `endBinding` 字段（类型 `PointBinding` 或 `null`），以及起止箭头样式（`startArrowhead/endArrowhead`）。`PointBinding` 中的 `elementId` 指向被连接的图形（可绑定元素，如矩形、椭圆、文本、图片等），`focus` 和 `gap` 则用于定位连接点（一个浮点索引和偏移距离）。例如，下面是一个箭头元素在 JSON 中的示例：

```ts
{
  "type": "arrow",
  // ... 省略其它属性 ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

在该例中，箭头的 `startBinding` 指向 ID 为 `"xw25sQBsbd2mecyjTrYHA"` 的图形，`focus` 和 `gap` 定义了从该图形边界出发的连接位置。

同时，每个被绑定的图形（例如矩形或椭圆）的基本数据结构里有一个 `boundElements` 列表，用于记录所有连接到它的箭头或文本元素。该字段类型通常为 `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null`。也就是说，箭头与图形之间的连接是双向维护的：箭头记录自己绑定的目标元素 ID，目标元素记录指向它的箭头 ID。

### tldraw 中的绑定 {#tldraw-binding}

在 tldraw 中，“连线”本身也是一种形状（默认是 箭头 形状），其连接关系通过绑定（Binding）对象来表示。每个绑定记录在存储中单独存在，表示两个形状间的关联。对于箭头连接，使用 `TLArrowBinding` 类型，它是 `TLBaseBinding<'arrow',TLArrowBindingProps>` 的特化。一个典型的箭头绑定记录示例如下：

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // 绑定类型为箭头
  fromId: 'shape:arrow1',  // 箭头形状的ID（箭头形状出发端）
  toId:   'shape:rect1',   // 目标形状的ID（箭头指向的形状）
  props: {
    terminal: 'end',       // 绑定到箭头的哪一端（start 或 end）
    normalizedAnchor: { x: 0.5, y: 0.5 }, // 目标形状上的标准化锚点
    isExact: false,        // 箭头是否进入目标形状内部
    isPrecise: true,       // 是否精确使用锚点，否则使用形状中心
    snap: 'edge',          // 吸附模式（如贴边等）
  },
  meta: {}
}
```

这里 `fromId/toId` 字段以形状 ID 的方式关联箭头与目标，`props` 中存储了连接细节（如锚点、对齐选项等）

[课程 23 - 思维导图]: /zh/guide/lesson-023
[课程 25 - 绘制箭头]: /zh/guide/lesson-025#draw-arrow
