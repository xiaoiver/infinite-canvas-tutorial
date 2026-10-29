---
outline: deep
description: '使用後處理來處理影像。使用渲染圖來最佳化管線。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 30 課 - 後處理與渲染圖',
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

# 第 30 課 - 後處理與渲染圖 {#lesson-30-post-processing-and-render-graph}

這一課會回顧以著色器為基礎的傳統影像後處理（全螢幕 pass、取樣，以及常見效果），接著介紹如何用渲染圖組織多個 pass、管理渲染目標與同步，並最佳化整條後處理管線。

## 後處理效果 {#post-processing}

以 Shader 為基礎，可以做出常見的影像處理效果，例如高斯模糊、Perlin 雜訊、Glitch，當然也包括最近流行的「液態玻璃」：

![來源：https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![在 Photoshop Web 中調整](/adjust-ps-web.png)

更多效果見：

-   [影像處理]
-   [glfx.js]
-   [Paper Shaders]

實作上，[Pixi.js filters] 會依照物件的包圍盒計算套用區域，把物件渲染到暫存的渲染紋理，再對該紋理套用著色器效果。

### 渲染到 RenderTarget {#render-to-render-target}

在 Pixi.js 中：

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

### 取樣 {#sample}

接下來，需要從整張畫布的紋理中，取樣目標圖形所在的區域：

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### 大三角形 {#big-triangle}

這裡可以使用全螢幕三角形，比起 Quad 少一個頂點，見：[最佳化全螢幕 pass 的三角形]

![藍色矩形代表視埠。紅色是幾何的範圍](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

頂點著色器非常簡單；它只需要正確對應 `v_Uv` 紋理座標：

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### 多重填色與濾鏡順序 {#fill-filter-order}

在 ECS 中，SDF 基本圖形與 Path 上的柵格濾鏡，會在已啟用的 `fills` 依繪製順序合成之後才執行。圖層不透明度與混合模式會參與這次合成；濾鏡鏈只處理合成後的紋理一次，圖形不透明度則套用在最終繪製上。若把同一條鏈分別套用到每一層，可能會取代較早圖層仍然需要的紋理。

例如，紅色的底層填色，加上 `opacity: 0.5` 的藍色上層填色，在 `brightness(0) contrast(0)` 下仍然是紫色。這兩個濾鏡採用 glfx 的調整慣例，其中零是中性值。非中性效果會依照 `filter` 字串中的寫入順序執行；對調亮度與對比可能改變結果。

變更填色或幾何會重建受影響的柵格輸入。移除柵格濾鏡會釋放離屏鏈，包括圖形回到直接的單色繪製時。中間圖層紋理在合成後釋放，附加的渲染紋理則透過各自的渲染目標釋放。

### 顏色濾鏡中的 alpha {#filter-alpha}

亮度、對比、色相／飽和度、雜訊、網點與彩色半色調調整，作用在非預乘 RGB 上，與繪製 alpha 無關。每個圖形的填色紋理儲存非預乘 RGBA；全畫布濾鏡收到的是預乘 RGBA，並為了調整而轉換。RGB 會在再次預乘之前箝制到可顯示範圍，alpha 則保留。這也能避免過亮的中間結果意外改變下一個濾鏡。

例如，`rgba(64,128,192,0.5)` 搭配 `brightness(0.2)`，在套用圖形不透明度之前會大約變成 `rgba(115,179,243,0.5)`。降低繪製 alpha 不應削弱亮度調整本身。這些顏色濾鏡會更新 WebGL1 上的一般 uniform，以及 WebGL2 上的 uniform buffer；純量 std140 區塊會保留 WebKit 所要求的 16 位元組對齊。

### 超出原始圖形的模糊 {#blur-bounds}

對於 SDF 基本圖形與一般 Path 填色，正值的 `blur()` 會先把圖形的填色、輪廓與 SDF 實心描邊擷取到帶有透明留白的紋理。最終繪製覆蓋這塊留白區域，因此模糊可以延伸到圓角之外，並進入 Path 的孔洞。只有渲染範圍會擴大；選取幾何維持不變。例如，`filter: 'blur(6px, 3)'` 會柔化輪廓，而 `blur(0px)` 會保留輪廓。

取樣會先插值預乘 texel，再轉回非預乘 RGBA。這樣半透明的藍色邊緣仍是藍色，透明黑色不會混進它的 RGB，放大時也一樣。留白包含每一次 pass、以及每一段連續模糊的取樣範圍。WebGL1 會在繪製每一個 pass 之前，立即更新該 pass 的 kernel uniform。

這條擷取路徑目前涵蓋 SDF 填色／實心描邊，以及一般 Path／VectorNetwork 填色。文字、分開的 Path 描邊、手繪填色、線框／模板繪製，以及外部的 `FillTexture` 輸入，仍走既有的濾鏡路徑；它們還沒有收到這份擴大的幾何。完整的 WebGPU 渲染仍需要另行驗證。

### 亮度與對比 {#brightness-contrast}

可以使用 [CSS filter] 語法，例如 `filter: brightness(0.4);`

下面的著色器說明預乘的全畫布路徑；見 [brightnesscontrast.js]。每個圖形的濾鏡使用共用的 alpha 輔助函式，以保留非預乘 RGBA。

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

### 雜訊 {#noise}

後處理中的雜訊，通常由螢幕 UV 產生偽隨機值並疊加到 RGB 上，用來模擬底片顆粒、訊號干擾等效果。本教學的實作遵循 [glfx.js 的 noise 濾鏡][glfx-noise]，使用均勻隨機與強度係數 `u_Noise` 控制擾動。寫入之前，顏色會先解除預乘，再乘回 alpha，以避免透明處出現灰色邊緣。

在 `filter` 字串中可以寫 `noise(0.1)`；括號內的值是強度（大約 0–1）。如果從設計工具出發，也可以對照 [Spline 的雜訊圖層][Spline - Noise Layer]：它同樣把程序性雜訊疊在材質／填色上；這裡則是在已經柵格化的紋理上套用全螢幕 pass。

### 半色調 {#halftone}

半色調用規則圖樣調變明暗，以模擬印刷網點。

-   **網點（半色調網屏）**：見 [Pixi `dot.frag`][dot.frag]：在旋轉後的座標中取樣 `sin(x)·sin(y)`，得到黑白網點；可以搭配灰階，做出舊印刷與漫畫半色調。`filter` 範例：`dot(1, 5, 1)`（縮放、角度、灰階開／關）。
-   **彩色半色調**：見 [glfx `colorhalftone.js`][colorhalftone.js]：以 CMY/K 的方式處理 RGB，並用四個相位不同的正弦網格調變青、洋紅、黃與黑，呈現彩色印刷的樣子。簡寫 `color-halftone(6)`（只有網點直徑），或 `color-halftone(6, 0.5)`（直徑與以弧度表示的角度）；完整的四參數形式可以設定圖樣中心與角度。

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

[Paper Shaders] 採用另一種做法，支援大型報紙風格網點、與明暗連動的網點大小，以及可替換的網點形狀、六角網格、顆粒等。

<HalftoneDots />

### 像素化 {#pixelate}

取樣並放大區塊，形成馬賽克；見 [Pixi `pixelate.frag`][pixelate.frag]，例如 `pixelate(12px)`。也可以把它套用在疊加了雜訊的漸層上。

<Pixelate />

### CRT 與暗角 {#crt-vignette}

模仿舊式 CRT 的外觀，再加上暗角：

<CRT />

### Glitch {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### Ascii {#ascii}

先用 `uSize` 把影像分成格子並計算灰階；依灰階挑選點陣常數 `n`，再對格子中的每個像素使用 `n` 的位元決定明暗，並乘進顏色。這是常見的點陣字型／ASCII 藝術做法，而不是向量字形或紋理字型。

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### 液態玻璃 {#liquid-glass}

<LiquidGlass />

### 液態金屬 {#liquid-metal}

<LiquidMetal />

### 熱力圖 {#heatmap}

<Heatmap />

### 生成煙霧 {#gen-smoke}

<GenSmoke />

### 時間動畫 {#time-animation}

有些後處理效果可以做動畫；通常會傳入每幀的時間值（類似 Shadertoy 上的 `u_Time`）：

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[第 10 課 - 匯出 GIF]

## 渲染圖 {#render-graph}

渲染圖（Render Graph，有時稱為 FrameGraph）是一種現代渲染架構，把渲染過程建模成有向無環圖（DAG）。在這個模型裡，每個渲染 pass 與它所使用的資源都被視為節點與邊；圖結構會自動管理資源狀態轉換、同步與生命週期。

-   [FrameGraph：Frostbite 中的可擴充渲染架構]
-   [為什麼要談渲染圖]

![幀圖範例](/frame-graph.png)

[bevy 中的渲染圖] 的用法如下：

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### 設計概念 {#design-concept}

我們參考 [noclip] 的渲染圖實作，它採用三階段設計：

1. 圖的建構階段：以宣告式定義渲染管線。下一小節會看到它如何使用。
2. 排程階段：自動配置並重用資源。還可以再拆成：

    - 統計階段：走訪所有 pass，統計每個 RenderTarget 與 ResolveTexture 的參照
    - 配置階段：按需配置資源。從物件池取出，或在第一次使用時建立。重用規格相同的資源。參照計數歸零時歸還物件池。
    - 釋放階段：參照計數歸零時歸還物件池。

3. 執行階段：依序執行渲染 pass。

渲染圖的資料結構如下。它儲存渲染圖的宣告式描述，不含實際資源。它只記錄 Pass 與 Render Target 之間的 ID 關係。

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### 用法 {#usage}

每次需要重繪時，都會建立一個新的 RenderGraphBuilder 來建構 DAG。目前這個簡單的 DAG 包含一個主渲染 pass，把結果輸出到 ColorRT 與 DepthRT。之後會用 `pushPass` 加入其他 pass。ColorRT 可以當作輸入被消耗，最終這個 ColorRT 會渲染到螢幕上。主要渲染邏輯寫在 `pass.exec` 的回呼函式中，它會收到一個 `RenderPass` 物件。細節見：[第 2 課]。

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

現在我們在主渲染 pass 之外，另外建立一個 FXAA pass，做快速反鋸齒。與 MSAA 這類以幾何取樣為基礎的傳統方法不同，FXAA 不需要額外取樣，也不需要知道場景幾何；它直接處理最終像素，因此效能成本非常低。這個方法用 NTSC 權重 `0.299R + 0.587G + 0.114B` 把 RGB 轉成灰階，以偵測邊緣：

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

回到渲染圖的宣告式語法。首先取得上一步的 ColorRT：

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

我們把下列三種後處理效果套用到整張畫布：

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## 延伸閱讀 {#extended-reading}

-   [Blob Tracking]
-   [reveals.cool]
-   [液態金屬標誌]

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[影像處理]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph：Frostbite 中的可擴充渲染架構]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[為什麼要談渲染圖]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[bevy 中的渲染圖]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[第 2 課]: /zh-Hant/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[最佳化全螢幕 pass 的三角形]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[液態金屬標誌]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[第 10 課 - 匯出 GIF]: /zh-Hant/guide/lesson-010#to-gif
