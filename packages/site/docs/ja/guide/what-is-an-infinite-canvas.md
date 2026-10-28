---
description: '高い拡張性、ズーム、直接操作を含む無限キャンバスの概念を紹介します。現代のレンダリング技術と、GPU で加速する無限キャンバスを構築するためのロードマップを概観します。'
head:
    - ['meta', { property: 'og:title', content: '無限キャンバスとは？' }]
---

# 無限キャンバスとは？ {#what-is-an-infinite-canvas}

[infinitecanvas] では、「無限」という言葉は次のように説明されています。

-   高い拡張性。ユーザーは非線形なかたちで、コンテンツの構造を自由に編成できます。
-   ズーム。現実世界と同じように、「ズームイン」で全体を俯瞰し、「ズームアウト」で細部を観察することを模倣します。
-   直接操作。基本図形を直感的に編集する機能を提供します。移動、グループ化、スタイルの変更が含まれます。

[infinitecanvas] は、デザインツールからクリエイティブボードまで数多くの事例を紹介しており、[Figma]、[Modyfi]、[rnote]、[tldraw]、[excalidraw] といったよく知られた製品も含まれます。

フロントエンド開発者として、そこで使われるレンダリング技術に強い関心があります。tldraw や excalidraw などは、たいてい Canvas2D/SVG のように扱いやすい技術を使いますが、JS と Rust のエコシステムにも、より低水準のレンダリング技術で 2D グラフィックスを GPU 加速し、より良い性能と体験を得るエディタやデザインツールが数多くあります。

-   [Figma] は C++ で書かれたタイルベースのレンダリングエンジンを使い、WASM にコンパイルしたあと WebGL と WebGPU を呼び出して描画します。
-   [Modyfi] は Rust エコシステムの [wgpu] を使い、同じく WASM にコンパイルしたあと WebGL2 を呼び出して描画します。
-   [Zed] は GPUI を使って矩形、影、テキスト、画像、その他の UI 要素を描画します。
-   [Vello] と [xilem] は、実験的に Compute Shader を 2D レンダリングに使います。

そこで、このチュートリアルでは次の機能を実装したいと考えています。

-   [@antv/g-device-api] をハードウェア抽象化レイヤーとして使い、WebGL1/2 と WebGPU をサポートします。
-   [mapbox] と [Figma] を参考に、タイルベースレンダリングを試みます。
-   円、楕円、矩形などに SDF（符号付き距離場）レンダリングを使います。
-   GPU で加速するテキストとベジェ曲線のレンダリング。
-   [rough.js] を使って手描きスタイルをサポートします。
-   CRDT（競合のない複製データ型）で共同編集の [Yjs] をサポートします。

将来、キャンバスのレンダリング部分を Rust で書き直したいと考えていますが、現時点のプロジェクトの完成度はまだ比較的低いです。

-   [wgpu] は非常に信頼できるハードウェア抽象化レイヤーで、[piet] のバックエンドさえ実装できます。
-   シェーダーは基本的に再利用できます。
-   手描きスタイルには [rough-rs] を使えます。
-   [y-crdt] は [Yjs] の Rust 実装です。

![Rust のスタック](/rust.png)

[vello] を使って、Rust で基本図形、スケッチスタイル、関連機能のレンダリングを既に実装しており、WASM 経由で呼び出します。

さあ、始めましょう！

[infinitecanvas]: https://infinitecanvas.tools/
[Figma]: https://madebyevan.com/figma/building-a-professional-design-tool-on-the-web/
[Modyfi]: https://digest.browsertech.com/archive/browsertech-digest-how-modyfi-is-building-with/
[rnote]: https://github.com/flxzt/rnote
[tldraw]: https://github.com/tldraw/tldraw
[excalidraw]: https://github.com/excalidraw/excalidraw
[rough.js]: https://github.com/rough-stuff/rough
[rough-rs]: https://github.com/orhanbalci/rough-rs
[Zed]: https://zed.dev/blog/videogame
[wgpu]: https://wgpu.rs/
[vello]: https://github.com/linebender/vello
[xilem]: https://github.com/linebender/xilem
[piet]: https://github.com/linebender/piet
[@antv/g-device-api]: https://github.com/antvis/g-device-api
[mapbox]: https://blog.mapbox.com/rendering-big-geodata-on-the-fly-with-geojson-vt-4e4d2a5dd1f2?gi=e5acafcf219d
[Yjs]: https://yjs.dev/
[y-crdt]: https://github.com/y-crdt/y-crdt
