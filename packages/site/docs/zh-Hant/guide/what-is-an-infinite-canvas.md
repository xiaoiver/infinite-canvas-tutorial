---
description: '介紹無限畫布的概念，包括高可擴充性、縮放能力與直接操作。概述現代渲染技術，以及打造 GPU 加速無限畫布的路線圖。'
head:
    - ['meta', { property: 'og:title', content: '什麼是無限畫布？' }]
---

# 什麼是無限畫布？ {#what-is-an-infinite-canvas}

[infinitecanvas] 對「無限」一詞的說明如下：

-   高可擴充性。使用者可以用非線性的方式，自由組織內容結構。
-   縮放。模擬真實世界中「放大」以掌握全貌、「縮小」以觀察細節。
-   直接操作。為基本圖形提供直覺的編輯能力，包括移動、群組與修改樣式。

[infinitecanvas] 展示了從設計工具到創意白板的眾多案例，其中包括一些知名產品，例如：[Figma]、[Modyfi]、[rnote]、[tldraw]、[excalidraw] 等。

身為前端開發者，我對其中涉及的渲染技術非常有興趣。雖然 tldraw、excalidraw 等產品通常使用 Canvas2D/SVG 這類較易上手的技術，但 JS 與 Rust 生態系中也有許多編輯器與設計工具，使用更低階的渲染技術，以 GPU 加速 2D 圖形，從而獲得更好的效能與體驗：

-   [Figma] 使用以 C++ 撰寫的圖塊式渲染引擎，編譯成 WASM 後再呼叫 WebGL 與 WebGPU 進行渲染。
-   [Modyfi] 使用 Rust 生態系中的 [wgpu]，同樣編譯成 WASM 後再呼叫 WebGL2 進行渲染。
-   [Zed] 使用 GPUI 渲染矩形、陰影、文字、圖片與其他 UI 元素。
-   [Vello] 與 [xilem] 實驗性地使用 Compute Shader 進行 2D 渲染。

因此，在這份教學中，我希望實作下列功能：

-   使用 [@antv/g-device-api] 作為硬體抽象層，支援 WebGL1/2 與 WebGPU。
-   參考 [mapbox] 與 [Figma]，嘗試使用圖塊式渲染。
-   使用 SDF（有號距離場）渲染圓、橢圓、矩形等。
-   GPU 加速的文字與貝茲曲線渲染。
-   使用 [rough.js] 支援手繪風格。
-   使用 CRDT（無衝突複製資料型別）支援協作的 [Yjs]。

我希望未來用 Rust 重寫畫布的渲染部分，但目前專案的完成度仍然相對偏低：

-   [wgpu] 是非常可靠的硬體抽象層，甚至可以實作 [piet] 的後端。
-   著色器基本上可以重複使用。
-   手繪風格可以使用 [rough-rs]。
-   [y-crdt] 是 [Yjs] 的 Rust 實作。

![Rust 技術堆疊](/rust.png)

我已經使用 [vello]，在 Rust 中實作了基本圖形、素描風格與相關功能的渲染，並透過 WASM 呼叫。

讓我們開始吧！

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
