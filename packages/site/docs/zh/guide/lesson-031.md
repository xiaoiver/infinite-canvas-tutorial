---
outline: deep
description: ''
publish: false
---

<script setup>
import Binding from '../../components/Binding.vue'
</script>

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

如上所示，每条箭头具有可选的 `startBinding` 和 `endBinding` 字段，它们与 `points` 处在不同的语义层级，前者为语义约束，而后者 `points` 为几何表示，当两者同时存在时，`points` 需要被重新计算。以及起止箭头样式（`startArrowhead/endArrowhead`）。`PointBinding` 中的 `elementId` 指向被连接的图形（可绑定元素，如矩形、椭圆、文本、图片等），`focus` 和 `gap` 则用于定位连接点（一个浮点索引和偏移距离）。例如，下面是一个箭头元素在 JSON 中的示例：

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

### antv/g6 {#antv-g6}

连接关系是逻辑的，不是几何的，通过 `type` 和连线路由算法计算路径：

```ts
interface EdgeConfig {
    id?: string;
    source: string; // 源节点 ID
    target: string; // 目标节点 ID

    sourceAnchor?: number; // 源节点锚点索引
    targetAnchor?: number; // 目标节点锚点索引

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

在节点上声明锚点，坐标是归一化的：

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

在边上使用锚点索引，和 tldraw 的 `normalizedAnchor` 非常像，但 G6 把锚点定义权放在节点上

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

mxGraph 有完整的连接约束系统，定义在节点图形上，表示允许连接的点：

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = 上中 (1, 0.5) = 右中
    perimeter: boolean; // 表示沿形状边界投射
}
```

### 我们的设计 {#our-design}

类似 [课程 18 - 定义父子组件]，我们可以实现双向绑定关系：

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

声明一个从 `rect-1` 指向 `rect-2` 的箭头方法如下：

```ts
const edge = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

## 自动更新 {#auto-update}

当连接的图形位置发生变化时，需要重新计算绑定边的路径。我们可以查询所有持有 `Binded` 组件的图形，监听它们的包围盒变化，此时更新绑定的边：

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // 重新计算绑定边的路径并渲染
    }
}
```

在下面的例子中，你可以尝试拖动节点，边会重新计算路径并重绘：

<Binding />

目前边的起点和终点都是被连接图形的包围盒中心，和 tldraw 中 `isPrecise` 等于 `false` 时效果一致，表示不精确绑定。
而大多数情况下，我们希望箭头不穿过所连接的图形，而是优雅地停靠在图形边缘。

## 边界算法 {#perimeter}

对于图形的边界，drawio 提供了 `perimeter` 属性，改变它会导致连线，详见：[Change the shape perimeter]

![Perimeter styles and port constraints](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

## 路由规则 {#router}

自动选出口方向、插入拐点、避开节点包围盒：

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

![Connector styles](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

[课程 23 - 思维导图]: /zh/guide/lesson-023
[课程 25 - 绘制箭头]: /zh/guide/lesson-025#draw-arrow
[课程 18 - 定义父子组件]: /zh/guide/lesson-018#定义-component
[Change the shape perimeter]: https://www.drawio.com/doc/faq/shape-perimeter-change
