---
outline: deep
description: '使用 CanvasGradient API 實作漸層與圖案，以包含雜訊效果的著色器建立網格漸層，並打造漸層編輯面板。支援 CSS 漸層語法與重複圖案。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第 17 課 - 漸層與圖案' },
      ]
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# 第 17 課 - 漸層與圖案 {#lesson-17-gradient-and-pattern}

在這一課，我們會探索如何實作漸層與重複圖案。

-   使用 CanvasGradient 實作漸層
    -   命令式。使用 Device API 建立紋理
    -   宣告式。支援 CSS 漸層語法：`linear-gradient`、`radial-gradient`、`conic-gradient`
    -   使用 Shoelace 實作漸層設定面板
-   使用著色器實作網格漸層
    -   模擬隨機
    -   數值雜訊與梯度雜訊
    -   Voronoi、FBM 與域扭曲
-   匯出 SVG
-   使用 CanvasPattern 實作重複圖案

## 使用 CanvasGradient {#canvas-gradient}

我們可以用 [CanvasGradient] API 建立各種漸層效果，再把它們當成紋理來使用。下面會介紹命令式與宣告式兩種實作。

### 以命令式建立漸層紋理 {#create-gradient-texture}

以線性漸層為例，建立 `<canvas>` 並取得它的 context 之後，[createLinearGradient] 需要起點與終點來定義漸層方向。接著加入多個色標，畫到 `<canvas>` 上，並把它當成建立紋理的來源：

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

使用 [Device] API 建立紋理物件，最後傳給圖形的 `fill` 屬性，就完成繪製。

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = { texture };
```

<Gradient />

不過，我們希望支援宣告式語法，好提高易用性，也方便序列化。

### 宣告式 CSS 漸層語法 {#css-gradient-syntax}

依照 CSS 漸層語法，我們可以用 [gradient-parser] 取得結構化結果，再用它呼叫 [createLinearGradient] 這類 API：

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

在 ECS 中，漸層函式名稱，以及方向、形狀、尺寸與位置關鍵字都不區分大小寫。偵測時檢查的是函式名稱，因此網址裡含有 `linear` 或 `radial` 的圖片不會被當成漸層。`top center`、`bottom center` 這類雙關鍵字位置會保留垂直軸。圓形放射漸層也支援落在邊界外的中心：`closest-side` 使用到最近一邊的距離，這個距離維持非負。

剖析器支援圓形放射漸層；橢圓與重複漸層目前還不會繪製。圓錐漸層字串目前使用預設角度，以及既有的 `circle at …` 位置語法；CSS 的 `from … at …` 語法尚未實作。結構化的 `ConicGradient.angle` 值以度為單位，在一般填色與濾鏡輸入中的方向一致。

剖析結果如下：

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

常見的漸層類型有好幾種，我們目前支援前三種：

-   [linear-gradient] CSS 與 Canvas 都支援
-   [radial-gradient] CSS 與 Canvas 都支援
-   [conic-gradient] CSS 與 Canvas 都支援
-   [repeating-linear-gradient] CSS 支援，也可以用 Canvas 變通實作，見 [如何製作重複的 CanvasGradient]
-   [repeating-radial-gradient] CSS 支援
-   [sweep-gradient] CanvasKit / Skia 支援

<DeclarativeGradient />

此外，我們也支援把多個漸層疊加在一起，例如：

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### 漸層編輯面板 {#gradient-editor}

受 Figma 漸層編輯面板的啟發，我們實作了類似的編輯器。在上面的範例中選取一個圖形，就可以打開編輯面板。

![Figma 漸層面板](/figma-gradient-panel.png)

## 把漸層套用到填色與描邊 {#applying-gradients-to-fill-and-stroke}

填色漸層由 `SDF`、`Mesh` 這類 draw call 消費，描邊漸層則由 `SmoothPolyline` 消費。漸層被柵格化成紋理之後，剩下的問題是頂點著色器要如何計算 UV。

對於網格填色，頂點著色器使用 **`u_FillUVRect`**（`minX`、`minY`、`1/width`、`1/height`）把**局部幾何座標**對應到紋理空間。

對於描邊，頂點著色器在模型矩陣之後已經有**世界空間**中的 **`pos`**，也就是描邊帶上展開後的點。為了與 **`ComputedBounds.geometryBounds`** 對齊，我們先變回**局部空間**，再減去 `min`，並乘上範圍的倒數：

`local = inverse(model) * vec3(pos, 1.0)`，接著 `v_StrokeUv = (local.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw`。

在 **WebGPU** 路徑上，GLSL 透過 **naga** 降到 WGSL 時，**不支援 `inverse(mat3)`**，因此實作改用手寫的 **`inverseMat3`**（伴隨矩陣／行列式），而不是內建的 `inverse`。

## 用網格實作漸層 {#mesh-gradient}

ECS 的網格漸層剖析器會保留明確的點位置。選用的 type、warp 與 time 控制可以序列化，並再次剖析。在點數可變的模式中，`points(10)` 會保留第 10 個著色器槽位；固定網格模式（`gtype(2)`）則繼續使用它的 3×3 網格。打包後的 uniform 資料在 96 個 float 的緩衝區中使用 92 個 float，其中包含對齊用的填充。

以 Canvas 與 SVG 為基礎實作的漸層，表現力有限，無法呈現複雜效果。Sketch / Figma 這類設計工具的社群裡，有許多以 Mesh 為基礎的實作，例如：

-   [Sketch 的網格漸層外掛]
-   [Figma 的 Mesh Gradient 外掛]
-   [Figma 的照片漸層外掛]
-   [Figma 的雜訊與紋理外掛]

我們參考了一些開源實作，有的寫在頂點著色器，有的寫在片段著色器。我們選擇後者：

-   [meshgradient]
-   [網格漸層產生器]
-   [react-mesh-gradient]

<MeshGradient />

由於要相容 WebGL1 的 GLSL100 語法，我們必須避免使用 `switch`，否則會出現這樣的錯誤：

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

另外，在 `for` 迴圈中，不能用 Uniform 當作 `index` 的結束條件：

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

因此，我們只能用常數 `MAX_POINTS` 限制迴圈次數，這和 Three.js chunk 處理光源的方式類似：

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

接下來深入著色器的細節。可以參考 [著色器之書 - 生成式設計] 了解更多。

### 隨機 {#random}

要實作雜訊效果，需要一個隨機函式。然而 GLSL 沒有內建的 `random` 函式，所以我們得模擬這個行為。既然是模擬，同一個 `random(x)` 永遠得到同一個回傳值，因此它是偽隨機數。

如果想要一個回傳 0 到 1 之間數值的 `random` 函式，可以使用 `y = fract(sin(x)*1.0);`，它只保留小數部分。

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

觀察這個函式可以發現，如果把週期縮到極短，同一個 x 對應的值就可以視為近似隨機（偽隨機）。具體做法是加大係數，例如 `y = fract(sin(x)*10.0);`。

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

再提高到 100000，我們就再也分辨不出 `sin` 的波形。要再次強調，這和 JS 的 `Math.random()` 不同，這個方法是決定性隨機，本質上其實是雜湊函式。

我們需要把 `random` 函式用到 2D 場景，輸入從單一的 `x` 變成 `xy` 座標。我們得把二維向量對應到單一數值。The Book of Shaders 用內建的 `dot` 函式乘上一個特定向量，但沒有解釋原因。

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

在網路上搜尋之後，我們找到這個解答：[這行 GLSL rand() 程式碼的由來是什麼？]。據說它最初來自一篇論文，而那三個魔術數字為什麼這樣選，並沒有說明。總之，產生出來的效果很好，類似黑白電視的雪花畫面。把上面範例中的 `NoiseRatio` 調高，就可以看到這個效果。

### 數值雜訊 {#value-noise}

用我們定義的 `random` 函式，再加上 `floor`，可以得到階梯狀的函式。

```glsl
float i = floor(x);
y = random(i);
```

![階梯](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

如果想在相鄰的「階梯」之間插值，可以使用線性函式，或平滑插值函式 `smoothstep`：

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

在一維中我們選擇 `i+1`，在二維中則可以選擇相鄰的 4 個點。對應的混合函式也要修改。原文的混合函式是展開形式，比較難懂，但好處是少呼叫兩次 `mix`。

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // It's actually the expanded form below
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

上面這種產生雜訊的方法，是在隨機值之間插值，所以稱為「數值雜訊」。仔細觀察可以發現，這個方法產生的結果有明顯的方塊痕跡，如下方範例的左側。

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### 梯度雜訊 {#gradient-noise}

> 1985 年，Ken Perlin 開發了另一種稱為梯度雜訊（Gradient Noise）的雜訊演算法。Ken 解決了如何插入隨機梯度（梯度、梯度），而不是一個固定值。這些梯度值來自一個二維隨機函式，它回傳的是方向（vec2 格式的向量），而不是單一數值（float 格式）。

具體演算法如下。它和數值雜訊最大的差別，是使用 `dot` 對四個方向做插值：

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> 對 Ken Perlin 來說，這個演算法的成功還遠遠不夠。他覺得還可以更好。在 2001 年的 Siggraph 上，他展示了「simplex noise」。

具體實作可以見：[2d-snoise-clear]，另外也有 3D 版本。

### Voronoi 雜訊 {#voronoi-noise}

我們在「繪製圖案」一節已經學過如何把空間分成小網格。可以為每個網格產生一個隨機特徵點；對於網格內的片段，只需要計算它到相鄰 8 個網格中特徵點的最小距離，計算量就大幅減少。這是 Steven Worley 論文的主要想法。

隨機特徵點使用我們先前所學的 `random` 方法。因為它是決定性隨機，每個網格內的特徵點是固定的。

```glsl
// Divide the grid
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 directions
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // Current adjacent grid
        vec2 neighbor = vec2(float(x),float(y));
        // Feature point in adjacent grid
        vec2 point = random2(i_st + neighbor);
        // Distance from fragment to feature point
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // Save the minimum value
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

基於這個想法的 Voronoi 雜訊實作，可以在 [lygia/generative] 找到。

### fBM {#fbm}

見 [Inigo Quilez 的 fBM]，這裡的 `noise` 可以是數值雜訊或梯度雜訊：

> 所以我們會使用某種標準的 fBM（Fractional Brownian Motion，分數布朗運動），也就是把頻率遞增、振幅遞減的雜訊波簡單相加。

原文也詳細說明了使用 `gain = 0.5` 的原因，它對應 `H = 1`。`H` 反映曲線的「自我相似性」，在程序化生成中用來模擬雲、山、海洋這類自然形狀：

$$ G=2^{-H} $$

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

見 [Inigo Quilez 的域扭曲] 與 [Mike Bostock 的域扭曲]。遞迴呼叫 `fbm`：

```glsl
f(p) = fbm( p )
f(p) = fbm( p + fbm( p ) )
f(p) = fbm( p + fbm( p + fbm( p )) )
```

<DomainWarping />

## 實作圖案 {#pattern}

我們可以使用 Canvas API 的 [createPattern] 建立圖案，支援下列語法：

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

字串形式的 `transform` 需要剖析成 `mat3`，再傳給 [setTransform]。

<Pattern />

## 把漸層匯出成 SVG {#export-gradient-to-svg}

### 線性漸層 {#linear-gradient}

SVG 提供 [linearGradient] 與 [radialGradient]，但它們支援的屬性和 [CanvasGradient] 差異相當大。

### 圓錐漸層 {#conic-gradient}

可以參考 [SVG 角度漸層] 做近似實作。[CSS conic-gradient() polyfill] 的做法是用 Canvas 繪製並匯出成 dataURL，再用 `<image>` 引用。

### 多重漸層疊加 {#multiple-gradient-overlay}

對於多重漸層疊加，在 Canvas API 中可以多次設定 `fillStyle` 來疊加。在宣告式 SVG 中，可以使用多個 `<feBlend>` 達成。

## 延伸閱讀 {#extended-reading}

-   [拆解流動的 WebGL 漸層]
-   [靜態網格漸層]

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Sketch 的網格漸層外掛]: https://www.meshgradients.com/
[Figma 的 Mesh Gradient 外掛]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Figma 的照片漸層外掛]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[Figma 的雜訊與紋理外掛]: https://www.figma.com/community/plugin/1138854718618193875
[meshgradient]: https://meshgradient.com/
[網格漸層產生器]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez 的 fBM]: https://iquilezles.org/articles/fbm/
[Inigo Quilez 的域扭曲]: https://iquilezles.org/articles/warp/
[Mike Bostock 的域扭曲]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG 角度漸層]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[如何製作重複的 CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[這行 GLSL rand() 程式碼的由來是什麼？]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[著色器之書 - 生成式設計]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
[lygia/generative]: https://lygia.xyz/generative
[拆解流動的 WebGL 漸層]: https://alexharri.com/blog/webgl-gradients
[靜態網格漸層]: https://shaders.paper.design/static-mesh-gradient
