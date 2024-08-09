# 一个无限画布教程

[![Build Status](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/workflows/test.yml/badge.svg)](https://github.com/xiaoiver/infinite-canvas-tutorial/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/xiaoiver/infinite-canvas-tutorial/badge.svg?branch=master)](https://coveralls.io/github/xiaoiver/infinite-canvas-tutorial?branch=master)

什么是无限画布？[infinitecanvas] 对“无限”的描述如下：

-   高扩展性。用户可以以非线形的形式自由组织内容结构。
-   缩放。模拟真实世界中的“放大”纵览全局和“缩小”观察细节。
-   直接操作。提供对于基础图形的直观编辑能力，包括移动、成组、修改样式等。
-   实时协作。

你一定见过甚至使用过各种包含无限画布的应用，[infinitecanvas] 上就展示了从设计工具到创意画板在内的众多案例，其中不乏一些知名产品包括 [Figma]、[Modyfi]、[Motiff]、[rnote]、[tldraw]、[excalidraw]等等。

作为一个前端，我对其中涉及到的渲染技术很感兴趣。尽管 [tldraw]、[excalidraw] 等普遍使用易用性更高的 Canvas2D / SVG 技术，但 JS 和 Rust 生态中也有很多编辑器、设计工具使用更底层的渲染技术对 2D 图形进行 GPU 加速，以获得更好的性能和体验：

-   [Figma] 使用 C++ 编写了一个 tile-based 的渲染引擎，编译成 WASM 后调用 WebGL 渲染
-   [Motiff] 同样使用 WebGL 实现了一个 tile-based 渲染引擎
-   [Modyfi] 使用了 Rust 生态中的 [wgpu]，同样编译成 WASM 后调用 WebGL2 渲染
-   [Zed] 使用 GPUI 渲染矩形、阴影、文本、图片等 UI。
-   [vello] 和 [xilem] 实验性地使用了 Compute Shader 进行 2D 渲染。

因此在这个教程中，我希望实现以下特性：

-   使用 [@antv/g-device-api] 作为硬件抽象层，支持 WebGL1/2 和 WebGPU。
-   参考 [mapbox] 和 [Figma]，尝试使用 Tile-based 渲染。
-   使用 SDF 渲染圆、椭圆、矩形等。
-   GPU 加速的文本和贝塞尔曲线渲染。
-   使用 [rough.js] 支持手绘风格。
-   使用 CRDT 支持协同 [Yjs]。

未来我希望将画布的渲染部分用 Rust 重写，目前项目的完成度还比较低：

-   [wgpu] 是非常可靠的硬件抽象层，甚至可以为 [piet] 实现后端。
-   Shader 基本可以复用。
-   手绘风格可以使用 [rough-rs]。
-   [y-crdt] 是 [Yjs] 的 Rust 实现。

![rust stack](/images/rust.png)

让我们开始吧！

## 开始

课程项目使用了 [pnpm workspace]，因此需要先安装 [pnpm]

```bash
pnpm i
```

进入课程目录后，运行 [vite]

```bash
cd packages/lesson_001
pnpm run dev
```

## 课程 1 - 初始化画布 [🔗](https://infinitecanvas.cc/zh/guide/lesson-001)

-   基于 WebGL1/2 和 WebGPU 的硬件抽象层
-   画布 API 设计
-   实现一个简单的插件系统
-   基于硬件抽象层实现一个渲染插件

## 课程 2 - 绘制圆 [🔗](https://infinitecanvas.cc/zh/guide/lesson-002)

-   向画布中添加图形
-   使用 SDF 绘制一个圆形
-   反走样

## 课程 3 - 变换和场景图 [🔗](https://infinitecanvas.cc/zh/guide/lesson-003)

-   变换。让图形支持平移、缩放、旋转、斜切变换。
-   场景图。

<img src="./screenshots/lesson3.png" width="300" alt="Lesson 3">

## 课程 4 - 相机 [🔗](https://infinitecanvas.cc/zh/guide/lesson-004)

-   相机是什么？
-   投影变换。
-   相机变换。通过一个插件实现平移、旋转和缩放功能。
-   相机动画。平滑过渡到任意相机状态。

## 课程 5 - 绘制网格 [🔗](https://infinitecanvas.cc/zh/guide/lesson-005)

-   绘制直线网格。使用 Line Geometry 或者屏幕空间技术。
-   绘制点网格。

<img src="./screenshots/lesson5.png" width="300" alt="Lesson 5">

## 课程 6 - 事件系统 [🔗](https://infinitecanvas.cc/zh/guide/lesson-006)

-   参考 DOM API 实现事件系统
-   如何拾取一个圆形
-   实现一个拖拽插件
-   支持双指缩放手势

## 课程 7 - Web UI [🔗](https://infinitecanvas.cc/zh/guide/lesson-007)

-   使用 Lit 和 Shoelace 开发 Web UI
-   实现画布组件，监听页面宽高变换
-   实现缩放组件

## 课程 8 - 性能优化 [🔗](https://infinitecanvas.cc/zh/guide/lesson-008)

-   什么是 Draw call
-   使用剔除减少 draw call
-   使用合批减少 draw call
-   使用空间索引提升拾取效率

<img src="./screenshots/lesson8.png" width="300" alt="Lesson 8">

## 课程 9 - 绘制椭圆和矩形 [🔗](https://infinitecanvas.cc/zh/guide/lesson-009)

-   推导椭圆和圆角矩形的 SDF 表示
-   为 SDF 增加外阴影和内阴影
-   如何判定任意点是否在椭圆或圆角矩形内

<img src="./screenshots/lesson9.png" width="300" alt="Lesson 9 - drop shadow">
<img src="./screenshots/lesson9-2.png" width="300" alt="Lesson 9 - inner shadow">

## 课程 10 - 图片导入和导出 [🔗](https://infinitecanvas.cc/zh/guide/lesson-010)

-   将画布内容导出成 PNG，JPEG 和 SVG 格式的图片
-   在画布中渲染图片
-   拓展 SVG 的能力，以 `stroke-aligment` 为例

<img src="./screenshots/lesson10.png" width="300" alt="Lesson 10 - import and export images">

## 课程 11 - 测试与服务端渲染 [🔗](https://infinitecanvas.cc/zh/guide/lesson-011)

-   基于 Jest 的测试环境搭建，包含本地和 CI 环境
-   使用单元测试提升代码覆盖率
-   视觉回归测试
    -   基于 headless-gl 的 WebGL1 服务端渲染方案
    -   基于 Playwright 的 WebGL2 / WebGPU 端到端测试方案
-   E2E 测试
-   浏览器兼容性测试
-   在 WebWorker 中渲染画布

[infinitecanvas]: https://infinitecanvas.tools/
[Figma]: https://madebyevan.com/figma/building-a-professional-design-tool-on-the-web/
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[rnote]: https://github.com/flxzt/rnote
[tldraw]: https://github.com/tldraw/tldraw
[excalidraw]: https://github.com/excalidraw/excalidraw
[rough.js]: https://github.com/rough-stuff/rough
[rough-rs]: https://github.com/orhanbalci/rough-rs
[zed]: https://zed.dev/blog/videogame
[wgpu]: https://wgpu.rs/
[vello]: https://github.com/linebender/vello
[xilem]: https://github.com/linebender/xilem
[piet]: https://github.com/linebender/piet
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[mapbox]: https://blog.mapbox.com/rendering-big-geodata-on-the-fly-with-geojson-vt-4e4d2a5dd1f2?gi=e5acafcf219d
[Yjs]: https://yjs.dev/
[y-crdt]: https://github.com/y-crdt/y-crdt
[pnpm]: https://pnpm.io/installation
[pnpm workspace]: https://pnpm.io/workspaces
[Motiff]: https://www.motiff.com/blog/performance-magic-behind-motiff
