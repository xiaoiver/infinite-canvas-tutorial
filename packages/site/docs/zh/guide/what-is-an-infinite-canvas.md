# 什么是无限画布？

[infinitecanvas] 对“无限”的描述如下：

-   高扩展性。用户可以以非线形的形式自由组织内容结构。
-   缩放。模拟真实世界中的“放大”纵览全局和“缩小”观察细节。
-   直接操作。提供对于基础图形的直观编辑能力，包括移动、成组、修改样式等。
-   实时协作。

你一定见过甚至使用过各种包含无限画布的应用，[infinitecanvas] 上就展示了从设计工具到创意画板在内的众多案例，其中不乏一些知名产品包括 [Figma]、[Modyfi]、[rnote]、[tldraw]、[excalidraw]等等。

作为一个前端，我对其中涉及到的渲染技术很感兴趣。尽管 [tldraw]、[excalidraw] 等普遍使用易用性更高的 Canvas2D / SVG 技术，但 JS 和 Rust 生态中也有很多编辑器、设计工具使用更底层的渲染技术对 2D 图形进行 GPU 加速，以获得更好的性能和体验：

-   [Figma] 使用 C++ 编写了一个 tile-based 的渲染引擎，编译成 WASM 后调用 WebGL 渲染
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

![rust stack](/rust.png)

让我们开始吧！

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
