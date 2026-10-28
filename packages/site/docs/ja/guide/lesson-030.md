---
outline: deep
description: 'ポストプロセスで画像を処理します。レンダーグラフでパイプラインを最適化します。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第30課 - ポストプロセスとレンダーグラフ',
          },
      ]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import HalftoneDots from '../../components/HalftoneDots.vue'
import Pixelate from '../../components/Pixelate.vue'
import CRT from '../../components/CRT.vue'
import Glitch from '../../components/Glitch.vue'
import LiquidGlass from '../../components/LiquidGlass.vue'
import LiquidMetal from '../../components/LiquidMetal.vue'
import Heatmap from '../../components/Heatmap.vue'
import GenSmoke from '../../components/GenSmoke.vue'
import Ascii from '../../components/Ascii.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# 第 30 課 - ポストプロセスとレンダーグラフ {#lesson-30-post-processing-and-render-graph}

この課では、画像に対する伝統的なシェーダーベースのポストプロセスを振り返ります。フルスクリーンパス、サンプリング、よくある効果です。続いて、レンダーグラフで複数のパスを整理し、レンダーターゲットと同期を管理し、ポストプロセスパイプライン全体を最適化する方法を紹介します。

## ポストプロセス効果 {#post-processing}

シェーダーに基づいて、ガウシアンブラー、パーリンノイズ、グリッチのような一般的な画像処理効果を実現できます。もちろん、最近よく見かける「リキッドグラス」もあります。

![出典: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Photoshop Web での調整](/adjust-ps-web.png)

ほかの効果は次を参照してください。

-   [Image Processing]
-   [glfx.js]
-   [Paper Shaders]

実装では、[Pixi.js filters] がオブジェクトのバウンディングボックスから適用領域を計算し、オブジェクトを一時的なレンダーテクスチャへ描いてから、そのテクスチャにシェーダー効果を適用します。

### RenderTarget へレンダリング {#render-to-render-target}

Pixi.js では次のとおりです。

```ts
// src/filters/FilterSystem.ts
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
```

### サンプリング {#sample}

次に、キャンバス全体のテクスチャから、対象図形がある領域をサンプリングする必要があります。

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### 大きな三角形 {#big-triangle}

ここではフルスクリーン三角形を使えます。Quad より頂点が一つ少なくなります。[Optimizing Triangles for a Full-screen Pass] を参照してください。

![青い矩形はビューポートです。赤はジオメトリの境界です](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

頂点シェーダーはとても単純です。`v_Uv` テクスチャ座標を正しく対応させるだけで済みます。

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### 複数の塗りとフィルタの順序 {#fill-filter-order}

ECS では、SDF プリミティブと Path のラスターフィルタは、有効な `fills` がペイント順に合成されたあとに実行されます。レイヤーの不透明度とブレンドモードはその合成に参加します。フィルタチェーンは合成結果のテクスチャを一度だけ処理し、図形の不透明度は最終的な描画に適用されます。同じチェーンをレイヤーごとに別々に適用すると、前のレイヤーがまだ必要としているテクスチャを置き換えてしまうことがあります。

たとえば、赤い下の塗りと `opacity: 0.5` の青い上の塗りは、`brightness(0) contrast(0)` の下でも紫のままです。この二つのフィルタは glfx の調整の慣例に従い、ゼロはニュートラルです。ニュートラルでない効果は、`filter` 文字列に書かれた順に実行されます。明るさとコントラストを入れ替えると、結果が変わることがあります。

塗りやジオメトリを変えると、影響を受けるラスター入力が作り直されます。ラスターフィルタを外すとオフスクリーンチェーンが解放されます。図形が単色の直接描画に戻るときも含まれます。中間レイヤーのテクスチャは合成のあとに解放され、付属のレンダーテクスチャはそれぞれのレンダーターゲットを通じて解放されます。

### 色フィルタのアルファ {#filter-alpha}

明るさ、コントラスト、色相/彩度、ノイズ、dot、color-halftone の調整は、ペイントのアルファとは独立に、ストレート RGB に対して動作します。図形ごとの塗りテクスチャはストレート RGBA を保存します。キャンバス全体のフィルタはプリマルチプライド RGBA を受け取り、調整のために変換します。RGB は再びプリマルチプライする前に表示可能な範囲へクランプし、アルファは保持します。これにより、明るすぎる中間結果が次のフィルタを予期せず変えることも防げます。

たとえば `rgba(64,128,192,0.5)` に `brightness(0.2)` を適用すると、図形の不透明度を適用する前におおよそ `rgba(115,179,243,0.5)` になります。ペイントのアルファを下げても、明るさの調整そのものが弱まってはいけません。これらの色フィルタは、WebGL1 の通常の uniform と WebGL2 の uniform buffer の両方を更新します。スカラの std140 ブロックは、WebKit が要求する 16 バイトアライメントを保ちます。

### 元の図形の外へ広がるブラー {#blur-bounds}

SDF プリミティブと通常の Path 塗りでは、正の `blur()` がまず図形の塗り、シルエット、SDF の単色ストロークを、透明なパディング付きのテクスチャへ取り込みます。最終描画はそのパディング領域を覆うので、ブラーは角丸の外へ、そして Path の穴の中へ広がれます。広がるのはレンダーバウンドだけで、選択ジオメトリは変わりません。たとえば `filter: 'blur(6px, 3)'` は輪郭を柔らかくし、`blur(0px)` は輪郭を保ちます。

サンプリングはプリマルチプライドのテクセルを補間してから、ストレート RGBA に戻します。これにより、半透明の青い縁は透明な黒が RGB に混ざらず青のままになり、拡大したときも同じです。パディングには、すべてのパスと、連続するすべてのブラーのサンプリング範囲が含まれます。WebGL1 は各パスを描く直前に、そのパスのカーネル uniform を更新します。

この取り込み経路が現在覆うのは、SDF の塗り/単色ストロークと、通常の Path/VectorNetwork の塗りです。テキスト、分離した Path ストローク、ラフ塗り、ワイヤーフレーム/ステンシル描画、外部の `FillTexture` 入力は既存のフィルタ経路のままで、この拡張されたジオメトリはまだ受け取りません。完全な WebGPU レンダリングは、別途の検証が必要です。

### 明るさとコントラスト {#brightness-contrast}

[CSS filter] の構文を使えます。たとえば `filter: brightness(0.4);` です。

次のシェーダーは、プリマルチプライドされたキャンバス全体の経路を示します。[brightnesscontrast.js] を参照してください。図形ごとのフィルタは、共通のアルファヘルパーを使ってストレート RGBA を保ちます。

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb = clamp(color.rgb, 0.0, 1.0) * color.a;
  } else {
    color = vec4(0.0);
  }

  outputColor = color;
}
```

<ImageProcessing />

### ノイズ {#noise}

ポストプロセスのノイズは、通常、画面 UV から擬似乱数を作り RGB に重ねて、フィルムグレインや信号の干渉などを模擬します。このチュートリアルの実装は [glfx.js の noise フィルタ][glfx-noise] に従い、一様な乱数と強度係数 `u_Noise` で揺らぎを制御します。書き込む前に色を非プリマルチプライドし、アルファを掛け戻して、透明部分に灰色の縁が出ないようにします。

`filter` 文字列には `noise(0.1)` と書けます。括弧内の値は強度で、おおよそ 0〜1 です。デザインツールから入るなら、[Spline の Noise Layer][Spline - Noise Layer] と比べることもできます。あちらも手続き的なノイズをマテリアルや塗りに重ねますが、ここではすでにラスタライズされたテクスチャにフルスクリーンパスを適用します。

### ハーフトーン {#halftone}

ハーフトーンは規則的なパターンで明暗を変調し、印刷の網点を模擬します。

-   **Dot（ハーフトーンスクリーン）**: [Pixi `dot.frag`][dot.frag] を参照してください。回転した座標で `sin(x)·sin(y)` をサンプリングし、白黒の網点を作ります。グレースケールと組み合わせると、古い印刷物や漫画のハーフトーンに使えます。`filter` の例: `dot(1, 5, 1)`（スケール、角度、グレースケールのオン/オフ）。
-   **カラーハーフトーン**: [glfx `colorhalftone.js`][colorhalftone.js] を参照してください。RGB を CMY/K の考え方で扱い、位相の異なる四つのサイン格子でシアン、マゼンタ、イエロー、ブラックを変調して、カラー印刷のように見せます。短縮形は `color-halftone(6)`（網点の直径のみ）、または `color-halftone(6, 0.5)`（直径とラジアンの角度）です。四パラメータの完全な形式では、パターンの中心と角度を指定できます。

```glsl
float halftonePattern(float rotAngle) {
// Continuous sine screen; no dot shape, grain, hex grid, etc.
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  // ...
  vec3 cmy = 1.0 - color.rgb; // CMYK separation
  float k = min(cmy.x, min(cmy.y, cmy.z));
  // ...
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  // ...
}
```

[Paper Shaders] は別のアプローチを取ります。新聞のような大きな網点、明度に結び付いた点の大きさ、差し替え可能な点の形、六角グリッド、グレインなどに対応します。

<HalftoneDots />

### ピクセル化 {#pixelate}

ブロックをサンプリングして拡大したモザイクです。[Pixi `pixelate.frag`][pixelate.frag] を参照してください。例: `pixelate(12px)`。ノイズを重ねたグラデーションにも適用できます。

<Pixelate />

### CRT とビネット {#crt-vignette}

古い CRT の見た目を模倣し、ビネットを加えます。

<CRT />

### グリッチ {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### アスキー {#ascii}

まず `uSize` で画像をセルに分割し、グレースケールを計算します。グレーの段階からビットマップ定数 `n` を選び、セル内の各ピクセルでは `n` のビットで明暗を決めて色に掛けます。これは一般的なビットマップフォント / ASCII アートの方法であり、ベクターグリフやテクスチャフォントではありません。

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### リキッドグラス {#liquid-glass}

<LiquidGlass />

### リキッドメタル {#liquid-metal}

<LiquidMetal />

### ヒートマップ {#heatmap}

<Heatmap />

### 煙の生成 {#gen-smoke}

<GenSmoke />

### 時間アニメーション {#time-animation}

一部のポストプロセス効果はアニメーションできます。通常はフレームごとの時間値を渡し、Shadertoy の `u_Time` に似ています。

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[第 10 課 - GIF の書き出し]

## レンダーグラフ {#render-graph}

レンダーグラフ（Render Graph、FrameGraph と呼ばれることもあります）は、レンダリング過程を有向非巡回グラフ（DAG）としてモデル化する、現代的なレンダリングアーキテクチャです。このモデルでは、各レンダリングパスとそれが使うリソースがノードと辺になり、グラフ構造がリソース状態の遷移、同期、ライフタイムを自動的に管理します。

-   [FrameGraph: Extensible Rendering Architecture in Frostbite]
-   [Why Talking About Render Graphs]

![フレームグラフの例](/frame-graph.png)

[Render graph in bevy] での使い方は次のとおりです。

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### 設計の考え方 {#design-concept}

[noclip] のレンダーグラフ実装を参考にします。三つの段階で設計されています。

1. グラフ構築段階: レンダリングパイプラインを宣言的に定義します。次の小節で使い方を見ます。
2. スケジューリング段階: リソースを自動的に割り当て、再利用します。さらに次のように分けられます。

    - 統計段階: すべてのパスを走査し、各 RenderTarget と ResolveTexture の参照を数えます
    - 割り当て段階: 必要に応じてリソースを割り当てます。オブジェクトプールから取り出すか、初回使用時に作ります。仕様が同じリソースは再利用します。参照カウントがゼロになるとオブジェクトプールへ戻します。
    - 解放段階: 参照カウントがゼロになるとオブジェクトプールへ戻します。

3. 実行段階: レンダリングパスを順に実行します。

レンダーグラフのデータ構造は次のとおりです。実際のリソースは持たず、レンダーグラフの宣言的な記述だけを保存します。Pass と Render Target のあいだの ID 関係だけを記録します。

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### 使い方 {#usage}

再描画が必要になるたびに、新しい RenderGraphBuilder を作って DAG を構築します。現在この単純な DAG には、結果を ColorRT と DepthRT へ出力するメインのレンダリングパスがあります。続いて `pushPass` でパスを追加します。ColorRT を入力として消費でき、最終的にこの ColorRT が画面へ描かれます。主なレンダリングロジックは `pass.exec` のコールバックに書き、このコールバックは `RenderPass` オブジェクトを受け取ります。詳しくは [第 2 課] を参照してください。

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // Render grid
        // Render shapes in current scene
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

ここで、メインのレンダーパスの外に、高速なアンチエイリアスのための FXAA パスを別に作ります。ジオメトリサンプリングに基づく MSAA のような伝統的な方法と異なり、FXAA は追加サンプルもシーンジオメトリの知識も必要としません。最終ピクセルを直接処理するので、性能コストはとても低くなります。この方法は NTSC の重み `0.299R + 0.587G + 0.114B` で RGB をグレースケールに変換し、エッジを検出します。

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

レンダーグラフの宣言的な構文に戻ります。まず前の段階の ColorRT を取得します。

```ts
builder.pushPass((pass) => {
    pass.setDebugName('FXAA');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

    const mainColorResolveTextureID =
        builder.resolveRenderTarget(mainColorTargetID);
    pass.attachResolveTexture(mainColorResolveTextureID);

    pass.exec((passRenderer, scope) => {
        postProcessingRenderer.render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
        );
    });
});
```

キャンバス全体に、次の三つのポストプロセス効果を適用します。

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## さらに読む {#extended-reading}

-   [Blob Tracking]
-   [reveals.cool]
-   [Liquid Metal Logo]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Image Processing]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph: Extensible Rendering Architecture in Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Why Talking About Render Graphs]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Render graph in bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[第 2 課]: /ja/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizing Triangles for a Full-screen Pass]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[Liquid Metal Logo]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[第 10 課 - GIF の書き出し]: /ja/guide/lesson-010#to-gif
