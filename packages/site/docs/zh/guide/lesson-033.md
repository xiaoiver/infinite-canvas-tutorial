---
outline: deep
description: '集成Flex布局系统，支持Yoga排版引擎。探索WebGL环境下的布局引擎构建，实现响应式界面设计。'
publish: false
---

# 课程 33 - 布局引擎

浏览器实现了若干布局，例如 Flexbox、Grid、Block，很容易实现类似“居中”这样的效果，无需手动计算指定节点位置。

对于脱离了 DOM 的无限画布类应用，就只能自己实现一套布局引擎逻辑了。Figma 实现了 Auto layout，其中 `Grid` 目前处于测试阶段，而 `Vertical` 和 `Horizontal` 就对应了 CSS 的 `flex-direction` 属性，详见：[Figma - Guide to auto layout]

![source: https://www.figma.com/community/file/1284819663700490015](/figma-flexbox.png)

![source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts/basics1.svg)

在本节课中我们将实现 Flexbox 布局，在节点上支持 CSS 同名属性：

```ts
const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 10,
    width: 100,
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rect',
    width: '50%',
    height: '50%',
};
```

## Yoga {#yoga}

在前端使用 [Yoga] 排版引擎只能通过 WASM，目前有几个可用的实现：

-   [yoga-layout-prebuilt] 已经很久没有更新了
-   [yoga-wasm-web] 早期 [satori] 使用它将 HTML 转换成 SVG，计算布局。[taffy] 也有相关 [示例](https://github.com/DioxusLabs/taffy/pull/394#issuecomment-1476430705)
-   [yoga-layout] 推荐使用。[react-pdf/yoga] 使用的就是它，我们的实现也基于它

值得一提的是，Yoga 也适用于 3D 空间，前提是指定应用平面，详见：[react-three-flex]

> Another important difference with DOM Flexbox is that you have to specify the plane of the container in 3D. The elements will be positioned in the 2D plane given by the two axes, using width and height calculated along the two axes.

![axes_orientation](https://github.com/pmndrs/react-three-flex/raw/master/docs/axes_orientation.png)

### pixijs/layout {#pixijs-layout}

[pixijs/layout] 也是基于 Yoga 实现的，类似的实现还有 [pixi-flex-layout]

```ts
const container = new Container({layout: {
    width: '80%',
    height: '80%',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
}});
```

### troika-flex-layout {#troika-flex-layout}

[troika-flex-layout]，使用 [yoga-layout-prebuilt] 在 WebWorker 中计算：

```ts
import { requestFlexLayout } from 'troika-flex-layout'

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
  id: 'root',
  width: 100,
  height: 100,
  alignItems: 'center',
  justifyContent: 'center',
  children: [
    {
      id: 'child',
      width: '50%',
      height: '50%'
    }
  ]
}

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, results => {
  // The results are a mapping of node ids to layout boxes:
  // {
  //   root: { left: 0, top: 0, width: 100, height: 100 },
  //   child: { left: 25, top: 25, width: 50, height: 50 }
  // }
})
```

## Yoga 之外的选择 {#alternatives-to-yoga}

纯 JS 实现：

-   [Motion Canvas Layouts] 基于浏览器原生的 Flexbox 实现，无需重新实现复杂的布局算法
-   [Simplifying WebGL: Building an Effective Layout Engine]

Rust 实现：

-   [stretch] 实现了 Flexbox，也提供了 `stretch-layout` WASM 绑定，但已经很久没有维护了
-   [taffy] 一个用 Rust 编写的高性能 UI 布局库，目前实现了几种 CSS 布局算法，包括了 Flexbox、Grid 和 Block。但暂时没有 WASM 绑定，详见：[taffy wasm bindings]

## [WIP] 我们的实现 {#our-implementation}

需要构造一棵平行于场景图的布局树。

### 在 WebWorker 中计算布局 {#calculate-layout-in-webworker}

## 扩展阅读 {#extended-reading}

-   [Simplifying WebGL: Building an Effective Layout Engine]
-   [clay]
-   [react-three-flex]
-   [Figma - Guide to auto layout]

[Yoga]: https://yogalayout.com/
[yoga-layout-prebuilt]: https://github.com/vadimdemedes/yoga-layout-prebuilt
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[yoga-layout]: https://www.yogalayout.dev/
[taffy]: https://github.com/DioxusLabs/taffy
[Simplifying WebGL: Building an Effective Layout Engine]: https://blog.certa.dev/building-a-layout-engine-for-webgl
[troika-flex-layout]: https://github.com/protectwise/troika/blob/main/packages/troika-flex-layout/
[clay]: https://github.com/nicbarker/clay
[Motion Canvas Layouts]: https://motioncanvas.io/docs/layouts
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[pixijs/layout]: https://github.com/pixijs/layout
[pixi-flex-layout]: https://github.com/fireveined/pixi-flex-layout/
[react-three-flex]: https://github.com/pmndrs/react-three-flex/
[satori]: https://github.com/vercel/satori
[stretch]: https://github.com/vislyhq/stretch
[taffy wasm bindings]: https://github.com/DioxusLabs/taffy/pull/394
[Figma - Guide to auto layout]: https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
[react-pdf/yoga]: https://github.com/diegomura/react-pdf/blob/master/packages/layout/src/yoga/index.ts