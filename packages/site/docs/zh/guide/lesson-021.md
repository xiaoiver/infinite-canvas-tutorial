---
outline: deep
publish: false
---

# 课程 21 - VectorNetwork

在这节课中你将学习到以下内容：

-   SVG Path 的局限性
-   什么是 VectorNetwork？
-   使用 Pen 工具修改 Path

## SVG Path 的局限性 {#limitations-of-svg-path}

在 [课程 13] 中我们学习了 Path 的绘制方式。Figma 也提供了 [VectorPath API]，它支持 SVG Path 的路径命令子集（详见：[VectorPath-data]）和 [fillRule]（Figma 中称作 windingRule）。

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

那为什么还要引入 [VectorNetwork API] 呢？原因在于 SVG Path 存在一些天然的局限性。[The Engineering behind Figma's Vector Networks] 一文很直观地展示了这一点。下面的图形是无法仅仅使用一个 Path 描述的：

![Not valid paths](https://alexharri.com/images/posts/vector-networks/3.svg)

只能通过拆分成多个 Path 描述，虽然可行，但在编辑场景下无法实现某些很符合直觉的操作。例如拖动左下的中心顶点时，只有一个顶点会跟随，因为它由两个独立的 Path 组成：

![Multiple paths are used to create more complex shapes](https://alexharri.com/images/posts/vector-networks/4.svg)

除了顶点无法拥有超过 2 条边，边也无法共享。[Vector Graphics Complexes] 的原始论文和 PPT 中对比了 SVG 和 Planar maps，两者都无法支持重叠、共享顶点和边这些特性，这才引出了一种新的几何表达（下文简称为 VGC）：

![Comparison between SVG and planar maps](/svg-path-vector-network-comparison.jpeg)

[vpaint] 就是基于 VGC 实现的，可以看到完成合并点和边的操作之后，编辑中的联动效果是多么自然：

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

或者使用 [The Engineering behind Figma's Vector Networks] 一文中拖拽立方体一条边的例子：

![Dragging an edge of cube](https://alexharri.com/images/posts/vector-networks/31.svg)

值得一提的是，[Discussion in HN] 中提到了 VGC 和 Figma 的 VectorNetwork 之间奇妙的相似程度，考虑到两者几乎处于同一时期开始探索，在某种程度上算殊途同归，因此下文就使用 VectorNetwork 这一名词了。

> CEO of Figma here. Most of the original insights around vector networks were in 2013, though we continued to polish the implementation over time. We didn't exit stealth and ship the closed beta of Figma until December 2015 which is why there isn't blog content before then.
> At first glance, this thesis looks super neat! I'm excited to check it out! I don't believe I've seen it before which is surprising given the overlap.

下面我们来看 VectorNetwork 是如何定义的。

## VectorNetwork 的拓扑定义 {#topology-of-vector-network}

VectorNetwork / VGC 的定义相比 Path 路径要复杂得多，其数据结构是一个图，由顶点、边和面（填充区域）组成，下图来自 [Vector Graphics Complexes] 原始论文。

![Topology of VGC](/vgc-topology.png)

这里仅讨论拓扑定义，其他绘图属性和 Path 可以保持一致：

> On top of this core structure, more drawing attributes can be added for fine control on rendering. For instance, we added vertex radius, variable edge width, cell color (possibly transparent), and edge junctions style (mitre join or bevel join).

顶点很好理解，在 VGC 中的边由一组 `start` 和 `end` 的顶点索引组成，两者重合时为自环。

![Nodes and edges in VGC](/vgc-node-edge.png)

而填充区域由一组顶点组成的闭合环路定义。在 VGC 中使用一组 halfedge 定义：

![Faces in VGC](/vgc-face.png)

下面三角形的例子来自 [VectorNetwork API]，可以看到和 VGC 基本一致，只是填充区域由顶点索引和 fillRule 定义。其他非几何定义属性例如 `strokeCap` 和 Path 保持一致：

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

在编辑场景下，顶点和边由用户定义，而填充区域需要系统自动计算。那如何找到这些填充区域呢？

## Filling

在 `click to fill` 这样的操作中，需要找到顶点组成的最小环路。

![Source: https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

## Bending

下文来自 [Introducing Vector Networks - Bending]，对于贝塞尔曲线的编辑，在 Path 和 VectorNetwork 中都是通用的：

> Vector graphics today are based on cubic bezier splines, which are curves with two extra points called control handles that are positioned away from the curve itself and that control how much it bends, sort of like how a magnet might bend a wire towards it. Changing the shape of a curve involves dragging a control handle off in space instead of dragging the curve directly.

![Control points in edge](https://alexharri.com/images/posts/vector-networks/39.svg)

在 VectorNetwork 的边定义中，使用 `tangentStart` 和 `tangentEnd` 可以定义三阶贝塞尔曲线的两个控制点，当两者为 `[0, 0]` 时退化为直线。

## Topological operators

### Creation & delete

[Delete and Heal for Vector Networks]

### Glue & unglue

![Glue and unglue operator](/vgc-operator-glue-unglue.png)

### Cut & uncut

![Cut and uncut operator](/vgc-operator-cut-uncut.png)

## 扩展阅读 {#extended-reading}

-   [Introducing Vector Networks]
-   [The Engineering behind Figma's Vector Networks]
-   [Vector Graphics Complexes]
-   [图形编辑器开发：钢笔工具的实现]
-   [vpaint]
-   [penpot]

[Introducing Vector Networks]: https://www.figma.com/blog/introducing-vector-networks/
[Introducing Vector Networks - Bending]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Delete and Heal for Vector Networks]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[Vector Graphics Complexes]: https://www.borisdalstein.com/research/vgc/
[The Engineering behind Figma's Vector Networks]: https://alexharri.com/blog/vector-networks
[Discussion in HN]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[图形编辑器开发：钢笔工具的实现]: https://zhuanlan.zhihu.com/p/694407842
[课程 13]: /zh/guide/lesson-013
[fillRule]: /zh/guide/lesson-013#fill-rule
