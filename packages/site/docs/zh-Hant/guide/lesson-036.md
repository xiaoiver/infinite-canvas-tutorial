---
outline: deep
description: '實作動畫系統：宣告式動畫 API 的設計、與 Web Animations API 相容、以產生器為基礎的動畫流程，以及 SVG 路徑動畫技巧。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第 36 課 - 動畫' },
      ]
---

<script setup>
import AnimationController from '../../components/AnimationController.vue';
import AnimationEasing from '../../components/AnimationEasing.vue';
import AnimationTransformOrigin from '../../components/AnimationTransformOrigin.vue';
import AnimationDasharray from '../../components/AnimationDasharray.vue';
import AnimationDashoffset from '../../components/AnimationDashoffset.vue';
import AnimationMorphing from '../../components/AnimationMorphing.vue';
import AnimationLottieBouncyBall from '../../components/AnimationLottieBouncyBall.vue';
import AnimationLottiePolyStar from '../../components/AnimationLottiePolyStar.vue';
import AnimationLottieRepeater from '../../components/AnimationLottieRepeater.vue';
import AnimationTimeline from '../../components/AnimationTimeline.vue';
</script>

# 第 36 課 - 動畫 {#lesson-36-animation}

這一課你會學到：

-   如何設計動畫 API
-   如何實作與 Web Animations API 對齊的宣告式關鍵影格與控制器
-   如何實作路徑、描邊與形變效果
-   Lottie 這類格式如何融入

## 如何設計動畫 API {#api-design}

Motion 完全相容宣告式的 WAAPI 風格動畫，見 [Improvements to Web Animations API]。它會呼叫瀏覽器原生的 `element.animate()`，以獲得 GPU 加速、獨立的合成器執行緒，以及離開主執行緒的工作。JavaScript 補上 WAAPI 沒有提供的部分：

-   彈簧物理（WAAPI 只支援貝茲緩動）
-   獨立的 `transform` 屬性（分別動畫 `x`、`y`、`scale`，而不是一條合併的 transform 字串）
-   用於縮放與旋轉中心的 `transformOrigin`
-   `sequence()`、`stagger()` 這類時間軸輔助函式

```ts
import { animate, stagger } from 'motion';

// Returns a controller you can pause, play, and reverse
const controls = animate(
    '.box',
    { x: [0, 100], opacity: [0, 1] }, // keyframes
    { duration: 0.5, delay: stagger(0.1), easing: 'spring(1, 100, 10, 0)' },
);

// Serializable control calls
controls.pause();
controls.play();
controls.reverse();
```

關鍵影格與選項都是普通物件，可以序列化成 JSON。`animate()` 的執行期狀態——與 DOM 的繫結、目前時間、速度等——無法序列化。

## 遵循 WAAPI {#waapi}

我們可以遵循 WAAPI polyfill [web-animations-js]，並把它整合進 ECS。

**資料層：** 類似 WAAPI 的關鍵影格（可序列化）

```ts
interface Keyframe {
    offset?: number; // 0–1, same role as WAAPI offset
    [property: string]: any; // x, y, scale, fill, strokeWidth...
    easing?: string; // "ease-out", "spring(1, 100)"
}

interface AnimationOptions {
    duration: number; // ms
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fill?: 'forwards' | 'backwards' | 'both'; // How the animation appears when not running (before start, after end).
    easing?: string; // Global easing if a keyframe omits its own
}
```

**控制層：** 類似 WAAPI 的 `Animation` 控制器。與完整 WAAPI polyfill 的差異：

-   不解析 CSS 字串。WAAPI 允許 `{ transform: 'translate(100px)' }`，解析成本很高。比較好的做法是 `{ x: 100 }`（Motion 風格的獨立 transform 屬性）。
-   內建 `ease`、`ease-in`、`ease-out`、`linear`，以及 Motion 風格的 `spring(mass, stiffness, damping)`。
-   **Composite** 模式。如同 WAAPI 的 `composite: 'add' | 'replace'`，把動畫疊加在基礎值之上（例如實體位置再加上動畫偏移）。
-   **時間軸**支援。如同 Motion 的 `timeline()` 或 WAAPI 的 `GroupEffect`，包括跨實體的 stagger。

### 控制器 {#controller}

```ts
const animation = api.animate(
    node1,
    [
        { x: 100, fill: 'green' },
        { x: 200, fill: 'red' },
    ],
    {
        duration: 1000,
        direction: 'alternate',
        iterations: 'infinite',
        easing: 'ease-in-out',
    },
);
animation.pause();
animation.play();
animation.finish();
```

<AnimationController />

### 插值 {#interpolation}

`x`／`y`／`opacity` 這類純量的插值很直接。對於 `fill`／`stroke`，可以用類似 `d3-color` 的方式解析顏色，再逐一插值 rgba 通道。

線性漸層在停止點數量相同時，會插值每個停止點的位置與顏色。停止點數量不同時，使用兩端漸層合併後的停止點位置，並保留代表硬邊顏色轉換的重複位置。當兩個關鍵影格包含同一個漸層時，這樣可以保留不均勻的間距。

在 ECS 中，`fill`／`fillOpacity` 與 `stroke`／`strokeOpacity` 會一起更新第一個啟用的繪製層。其他圖層及其啟用狀態會保留。如果沒有啟用中的圖層，對 paint 做動畫會新增一層；只動畫不透明度則不會建立新圖層。

```ts
function interpolateValue(from: unknown, to: unknown, t: number) {
    if (isFiniteNumber(from) && isFiniteNumber(to)) {
        return interpolateNumber(from, to, t);
    }
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
        return colorToRgbaString({
            r: interpolateNumber(fromColor.r, toColor.r, t),
            g: interpolateNumber(fromColor.g, toColor.g, t),
            b: interpolateNumber(fromColor.b, toColor.b, t),
            a: interpolateNumber(fromColor.a, toColor.a, t),
        });
    }
    return t < 1 ? from : to;
}
```

### 緩動 {#easing-function}

除了標準曲線，我們也可以支援 `spring`：

```ts
function evaluateEasing(easing: string, t: number) {
    const p = clamp01(t);
    const bezier = EASING_FUNCTION[easing as keyof typeof EASING_FUNCTION];
    if (bezier) {
        return clamp01(bezier(p));
    }
    if (easing.startsWith('spring(')) {
        return evaluateSpringEasing(p, easing);
    }
    return p;
}
```

<AnimationEasing />

### 變形原點 {#transform-origin}

<AnimationTransformOrigin />

## 特殊動畫效果 {#special-effects}

### 路徑動畫 {#path-animation}

讓圖形沿著路徑移動很常見；CSS 用 Motion Path 來做這件事。

```css
#motion-demo {
    animation: move 3000ms infinite alternate ease-in-out;
    offset-path: path('M20,20 C20,100 200,0 200,100');
}
@keyframes move {
    0% {
        offset-distance: 0%;
    }
    100% {
        offset-distance: 100%;
    }
}
```

### 描邊動畫 {#stroke-animation}

我們需要路徑長度：

```ts
const length = api.getTotalLength(path);
api.animate(
    path,
    [{ strokeDasharray: [0, length] }, { strokeDasharray: [length, 0] }],
    {
        duration: 3500,
    },
);
```

<AnimationDasharray />

### 虛線偏移 {#dashline-offset}

draw.io 用動畫表示連接線的方向：

![來源: https://www.drawio.com/doc/faq/connector-animate](https://www.drawio.com/assets/img/blog/connector-flow-animation.svg)

> 把圖表匯出成 SVG 檔，這樣在網頁或支援 SVG 圖片的內容平台上發布時，就會包含連接線動畫。

```ts
api.animate(node, [{ strokeDashoffset: -20 }, { strokeDashoffset: 0 }], {
    duration: 500,
    iterations: Infinity,
});
```

<AnimationDashoffset />

### 形變 {#morphing}

許多 SVG 函式庫都示範過形變：

-   [Paper.js]
-   [Kute.js] 提供 Morph 與 CubicMorph
-   GreenSock 的 MorphSVGPlugin 甚至可以在 Canvas 中渲染
-   [vectalign]

有些函式庫要求形變前後的區段結構必須一致，否則插值會失敗。

遵循 Kute.js 的 CubicMorph：把路徑區段轉成三次貝茲，用簡單的細分把兩條路徑正規化成相同的區段數，再依區段插值控制點。

繞向與起點對齊只在兩條路徑都包含單一封閉輪廓時才套用。開放路徑保留端點順序，因此平移一條曲線時，不會交換端點，也不會在動畫中途把曲線壓扁。

```ts
function mergePaths(
    left: { absolutePath: AbsoluteArray; curve: CurveArray | null },
    right: { absolutePath: AbsoluteArray; curve: CurveArray | null },
): [CurveArray, CurveArray, (b: CurveArray) => CurveArray] {
    let curve1 = left.curve;
    let curve2 = right.curve;
    if (!curve1 || curve1.length === 0) {
        // convert to curves to do morphing & picking later
        // @see http://thednp.github.io/kute.js/svgCubicMorph.html
        curve1 = path2Curve(left.absolutePath, false) as CurveArray;
        left.curve = curve1;
    }
    if (!curve2 || curve2.length === 0) {
        curve2 = path2Curve(right.absolutePath, false) as CurveArray;
        right.curve = curve2;
    }

    let curves = [curve1, curve2];
    if (curve1.length !== curve2.length) {
        curves = equalizeSegments(curve1, curve2);
    }

    const closed = [left.absolutePath, right.absolutePath].every(
        (path) =>
            path[path.length - 1]?.[0] === 'Z' &&
            path.filter(([command]) => command === 'M').length === 1,
    );
    const curve0 =
        closed && getDrawDirection(curves[0]) !== getDrawDirection(curves[1])
            ? reverseCurve(curves[0])
            : (clonePath(curves[0]) as CurveArray);

    return [
        curve0,
        closed ? (getRotatedCurve(curves[1], curve0) as CurveArray) : curves[1],
        (pathArray: CurveArray) => pathArray,
    ];
}
```

<AnimationMorphing />

## Lottie {#lottie}

-   [lottie json schema]
-   [Tips for rendering]
-   [lottie-parser] — 我們主要遵循它的解析邏輯
-   [velato] — 建立在 Vello 上的渲染器

### 用法 {#lottie-usage}

我們實作了一個外掛，把 Lottie JSON 轉成圖形與關鍵影格。重點如下：

-   支援 Shape 圖層中的下列元素：
    -   [Rectangle](https://lottiefiles.github.io/lottie-docs/shapes/#rectangle)
    -   [Ellipse](https://lottiefiles.github.io/lottie-docs/shapes/#ellipse)
    -   [PolyStar](https://lottiefiles.github.io/lottie-docs/shapes/#polystar)
    -   [Path](https://lottiefiles.github.io/lottie-docs/shapes/#path)
    -   [Group](https://lottiefiles.github.io/lottie-docs/shapes/#group)
-   在 Lottie 裡，`anchorX`／`anchorY` 定義相對於圖形包圍盒左上角的縮放與旋轉中心——對應到 `transformOrigin` 時要特別注意
-   把多條動畫軌道合併成一組關鍵影格，並補上缺少的屬性

```ts
import { loadAnimation } from '@infinite-canvas-tutorial/lottie';

const response = await fetch('/bouncy_ball.json');
const animation = loadAnimation(await response.json(), {
    loop: true,
    autoplay: true,
    onDiagnostic: ({ code, path, message }) =>
        console.info(code, path, message),
});

await api.edit(() => animation.render(api), { capture: 'NEVER' });

// On component unmount (also automatically cleaned up on canvas destruction):
// await animation.destroy();
```

下面是在我們的環境中執行的官方範例：[Bouncy Ball]

<AnimationLottieBouncyBall />

### 相容性 {#lottie-compatibility}

這個匯入器把 Lottie 轉成 ECS 節點與關鍵影格，並不是完整的 Lottie 渲染器。解析某個欄位，並不表示已經實作它的視覺效果。

| 功能                                                   | 目前行為                                                                                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 矩形、橢圓、路徑、Group；基本填色／描邊                | 基本的靜態幾何、路徑形變，以及 2D 的位置／旋轉／縮放；基本圖形的尺寸與圓角動畫仍然有限                                                                                                                                         |
| PolyStar                                               | 星形／多邊形、兩種繞向、點數、位置、旋轉、內外半徑與圓角程度；帶有時間緩動與 hold 的數值關鍵影格                                                                                                                                 |
| Repeater                                               | 複製位於其前方的圖形／Group；數量、偏移、錨點、平移、縮放、旋轉、起迄不透明度與合成順序，包括數值關鍵影格                                                                                                                       |
| Solid、Null、父子關係、Precomp                         | 基本支援；圖層的進入／離開可見性、時間拉伸與重對應尚未完成                                                                                                                                                                     |
| 漸層與多重繪製                                         | 基本漸層；動畫中的漸層幾何、放射高光，以及多重繪製／運算子的順序仍然有限                                                                                                                                                       |
| Trim Paths                                             | 以描邊虛線近似，並修正全滿／全空的覆蓋、端點排序與偏移；填色幾何、多路徑模式、既有虛線樣式、長度為零的圓形端點動畫、方向與修飾器順序仍然有限                                                                                 |
| 空間貝茲運動、Skew                                     | 尚未完成；檢查時會回報                                                                                                                                                                                                           |
| Merge Paths、Round Corners 與其他修飾器                | 不會渲染                                                                                                                                                                                                                         |
| 影像                                                   | 部分支援；素材目錄與預先載入尚未實作                                                                                                                                                                                             |
| 文字、遮罩、Track Mattes、效果、混合模式、3D           | 尚未實作，或無法穩定渲染；ECS 具備某項能力，並不表示支援對應的 Lottie 匯入                                                                                                                                                     |
| Expressions                                            | 在匯入時烘焙；預設使用內建的 lottie-web ExpressionManager，以及有限的 shape 圖層環境，並非完整的 AE 語意                                                                                                                         |

`inspectLottie(data)` 會檢查已知的缺口，不會改動 JSON，也不會求值運算式。`animation.getDiagnostics()` 與 `onDiagnostic` 提供穩定的 `code`、`severity`（`partial`／`unsupported`）、JSON Pointer `path` 與訊息。即使有診斷，匯入仍會繼續；清單是空的，也不代表與 AE 相容。展開範例中的 **Compatibility notes**，可以查看它們的缺口。

播放使用同一個合成時鐘。`goTo(value, true)` 會跳到相對於合成的影格；預設單位是秒，並保留播放／暫停狀態。`stop()` 會在第 0 影格暫停。`setSpeed()` 接受正的倍率；`setDirection(-1)` 從目前位置反向播放，並保留速度。`playSegments([start, end])` 會遵守兩個端點；端點由大到小時會倒著播放。數值型的 `loop` 代表額外重複的次數。`getAnimations()` 回傳的 ECS 控制器由播放器取樣；請透過播放器 API 控制時間。

對同一個實例重複呼叫 `render(api)` 是冪等的；另一個畫布需要另外的實例。`destroy()` 也是冪等的，會取消播放，並在一次安全的編輯中移除匯入的節點樹。元件在卸載時也應取消尚未完成的 fetch 與排入佇列的編輯。瀏覽器回歸測試會把固定影格，和釘選版本的 lottie-web 比較位置、單一路徑描邊的 Trim Paths、整數／小數影格上的 PolyStar 幾何與 Repeater 群組；它們並不能證明整個格式都對等。

### 星形與多邊形 {#lottie-polystar}

PolyStar（`ty: "sr"`）會產生一條封閉的貝茲路徑：`sy: 1` 選星形，`sy: 2` 選多邊形。點數（`pt`）、位置（`p`）、旋轉（`r`）、半徑（`or`／`ir`）與圓角程度（`os`／`is`）可以各自動畫。內側屬性只適用於星形。`d: 3` 會反轉繞向。小數點數會無條件捨去，與 lottie-web 5.13 一致；這並不是在不同點數之間做連續形變。

這個範例會同時動畫兩種圖形。暫停、倒放，或拖曳 **Seek frame**，即可檢視中間的幾何。參數會在建構路徑之前先插值，因此旋轉會保留半徑，點數的變化也會在正確的時刻生效。

<AnimationLottiePolyStar />

動畫中的 PolyStar 幾何由合成時鐘上的外掛控制器取樣。請保留原始的 Lottie JSON 以便重新載入：一般的 ECS 關鍵影格序列化與動畫編輯器，還無法保留或編輯這些程序化參數軌道。空間位置切線、修飾器組合（包括在變化中的幾何上使用 Trim Paths）、運算式，以及表格中的其他限制仍然適用。曲線描邊也會繼承 ECS 渲染器在某些細分接合處既有的透明度接縫；它們的參考測試驗證的是輪廓與顏色，而不是 alpha 一致。

### Lottie 中的貝茲曲線 {#beziers-in-lottie}

[Beziers in Lottie]

-   `v` 是頂點陣列。
-   `i` 是相對於 `v` 的「in」切線點陣列。
-   `o` 是相對於 `v` 的「out」切線點陣列。
-   `c` 是布林值，決定這條 poly-Bézier 是否封閉。若封閉，`v` 的最後一點與第一點之間會多一段貝茲。

### Repeater {#repeater}

Repeater（`ty: "rp"`）會複製目前 shape group 中、位於它之前的運算子。把填色／描邊放在**被重複的 group 內部**，才能各自為每一份複本上色。巢狀的 shape group 與動畫中的 PolyStar 幾何也可以被重複。目前巢狀或堆疊的 Repeater 使用遞迴複製，並送出 `shape.repeater.nested`；複合順序與保留的來源複本可能和 lottie-web 不同。

複本數（`c`）會無條件進位；0 會隱藏每一份複本。偏移（`o`）接受小數與負值。變換（`tr`）包含錨點（`a`）、平移（`p`）、非均勻縮放（`s`）、旋轉（`r`）以及起迄不透明度（`so`／`eo`）。合成模式（`m`）會改變複本的堆疊順序。數值軌道支援時間緩動與 hold。變換遵循 lottie-web 5.13，包括負整數偏移時穿越單位變換的行為。

<AnimationLottieRepeater />

匯入器會依照數量軌道的上界配置複本池，並把緩動的 overshoot 算進去。播放與跳轉會重複使用這個池。很大的數量與巢狀 repeater 會使匯入的節點數相乘。和 PolyStar 一樣，請保留原始的 Lottie JSON：一般的 ECS 關鍵影格序列化與動畫編輯器不會保留這些程序化軌道。

Repeater **之後**的繪製運算子只有部分支援，並會送出 `shape.repeater.paint-scope`：逐份複本繼承繪製，無法重現 lottie-web 那種共用複合填色的覆蓋率／不透明度。修飾器順序、skew、空間運動與圖層時間，仍受相容性表格限制。奇異的逆縮放（例如縮放為零再配上負偏移）會隱藏受影響的複本，而不是送出無效的變換。

### 運算式 {#expression}

[Expressions]

```json
{
    "ty": "sh",
    "ks": {
        "a": 0,
        "k": {
            "i": [],
            "o": [],
            "v": []
        },
        "x": "var group = thisLayer.content(\"Quadratic Points\");\nvar num_points = 3;\nvar points = [];\nvar ip = [];\nvar op = [];\nfor ( var i = 0; i < num_points; i++ )\n{\n    var pos = group.content(\"p\" + i).position;\n    points.push(pos);\n    ip.push(pos);\n    op.push(pos);\n}\nvar $bm_rt = {\n    v: points,\n    i: ip,\n    o: op\n};\n"
    }
}
```

### 文字圖層 {#text-layer}

文字圖層與文字動畫器尚未匯入。

### 裁切遮罩 {#clipping-mask}

遮罩模式、反轉、動畫與 track matte 還無法穩定渲染。

[clipping-masks]

### 圖層效果 {#layer-effects}

Lottie 效果尚未對應到 ECS。

[Layer Effects]

## Rive {#rive}

[Rive vs Lottie]

![來源: https://rive.app/blog/rive-as-a-lottie-alternative](https://framerusercontent.com/images/gKzhMgEDMMUPLVkhMtTDfQdQrQ.png?width=1920&height=800)

## Manim {#manim}

<https://github.com/3b1b/manim>

-   [Discussion in HN]

## 動畫編輯器 {#animation-editor}

受到 [lottielab]、[Jitter] 這類產品的啟發，我們在 Web Components 層做了一個輕量的動畫編輯器：右側的**動畫面板**編輯所選元素的關鍵影格，底部的**時間軸面板**顯示整個場景的時間軸，並驅動該畫布的播放頭。兩者共用同一份可序列化的關鍵影格資料，以及 `AppState` 中的場景時鐘。

![來源: https://jitter.video/](/jitter.png)

### 版面配置 {#animation-editor-layout}

工作列提供兩個獨立的開關：

-   `SHOW_ANIMATION_PANEL` → `ic-spectrum-animation-panel`（右側，與屬性面板並列）
-   `SHOW_TIMELINE_PANEL` → `ic-spectrum-timeline-panel`（底部停駐，佔滿畫布寬度）

典型流程：

1. 選取單一元素，在動畫面板中加入動畫或編輯屬性軌道。
2. 打開時間軸，查看場景中每個動畫圖層及其時間範圍。
3. 拖曳播放頭或按下播放，在同一個時刻預覽整個場景。
4. 在時間軸中選取一條軌道也會選取它的元素；右側的動畫面板會顯示該元素的關鍵影格。

### 場景時鐘與編輯模式 {#animation-scene-clock}

時間軸驅動的是 **`AppState` 中這個畫布的播放頭**，與各個 `AnimationController` 分開。共用同一個 ECS world 的畫布，各自保有獨立的播放頭、播放狀態與場景時長：

| 欄位                   | 意義                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `animationEditing`     | 為 `true` 時進入**確定性拖曳預覽模式**：這個畫布上的每個控制器都在同一個 `animationCurrentTime` 取樣，而不是各自自由播放                                           |
| `animationCurrentTime` | 這個畫布的播放頭位置（毫秒）                                                                                                                                       |
| `animationPlaying`     | 播放頭是否自動前進                                                                                                                                                 |
| `animationLoop`        | 場景結束時播放是否回到 0                                                                                                                                           |

當 `animationEditing === true` 時，`AnimationSystem` 只取樣屬於該畫布的實體。暫停時，控制器固定在 `animationCurrentTime`；播放時，播放頭依 `performance.now()` 的差值前進。恢復播放時會排除暫停期間的牆鐘時間，場景時長則由該畫布的軌道決定。

離開編輯模式後，被編輯器暫停的控制器會從目前位置恢復自動播放。呼叫端已經暫停的控制器維持暫停，已取消的控制器不會重新啟動。

打開時間軸會自動呼叫 `setAnimationEditing(true)`，讓拖曳預覽與播放保持一致。

### 時間軸面板設計 {#animation-timeline}

<AnimationTimeline />

#### 軌道資料 {#track-data}

時間軸不會直接讀取節點 JSON，而是透過 `api.getAnimatedTracks()` 彙總：

```ts
interface Track {
    id: string; // node id
    name: string; // layer name; falls back to id
    properties: string[]; // e.g. ['opacity', 'x']
    delay: number; // ms
    duration: number; // active animation length (total − delay)
    totalDuration: number;
}
```

場景時長等於所有軌道中最大的 `totalDuration`。長條的 `left`／`width` 分別以 `delay * PX_PER_MS` 與 `duration * PX_PER_MS` 計算。

#### 互動 {#interactions}

| 動作             | 行為                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| 點擊軌道標籤     | `layersSelected = [track.id]`，反白該軌道，並驅動動畫面板                     |
| 拖曳軌道列／尺規 | 拖曳播放頭；畫布即時預覽該影格                                                |
| 播放／暫停       | `toggleAnimationPlaying()` 在編輯模式中推進全域時鐘                           |
| 循環             | `setAnimationLoop()` 控制場景結束時是否折返                                   |

### 動畫面板（與時間軸配合） {#animation-panel}

元件：`packages/webcomponents/src/spectrum/animation-panel.ts`。

-   只有**單一**選取時可以編輯；多選或沒有選取時顯示佔位內容。
-   全域選項：`duration`、`delay`、預設 `easing`、`iterations`（循環開關）。
-   關鍵影格依**屬性軌道**分組；每一列有 `offset`（0–1）、數值、`easing` 與刪除按鈕。
-   **在播放頭加入關鍵影格**：讀取 `animationCurrentTime`，換成正規化的 offset，並透過 `controller.getCurrentValues()` 取樣目前的屬性值——插入關鍵影格前，先打開時間軸並拖到目標時間。
-   `fill`／`stroke` 使用彈出層與 `ic-spectrum-color-picker`；其他數值屬性使用 `sp-number-field`。
-   面板的寬度與高度可以調整；尺寸存在 `localStorage`（操作方式和屬性面板的拖曳把手相同）。

所有編輯都經過 `setNodeAnimation`／`updateNodeAnimationKeyframe`，並參與復原歷史與文件序列化。

### 與 Lottie 風格編輯器的差異 {#animation-editor-vs-lottie}

目前的實作刻意維持簡單，對照的是 [lottielab] 這類完整的 DCC 工具：

-   時間軸是**每個節點一條軌道**，而不是 Lottie 那種圖層加屬性的多軌道配置；屬性名稱以標籤後綴顯示（`Rect · opacity, x`）。
-   關鍵影格與長條的時間還不能在時間軸上拖曳；時間是在動畫面板裡用 `offset` 編輯。
-   運算式使用有限的匯入時烘焙。文字圖層與裁切遮罩無法由這個編輯器穩定支援或製作。

可能的擴充：屬性子軌道、關鍵影格菱形標記、拖曳長條邊緣以改變 delay／duration，以及其他功能。

### 外部參考 {#external-references}

-   [lottielab]
-   [omnilottie]
-   [thorvg.viewer]
-   [Jitter]

## 延伸閱讀 {#further-reading}

-   [Magic Animator]
-   [A major breakthrough in real-time vector graphics]
-   [Art meets technology: the next step in bringing our characters to life]
-   [Canvas vs WebGL]

[Improvements to Web Animations API]: https://motion.dev/docs/improvements-to-the-web-animations-api-dx
[A major breakthrough in real-time vector graphics]: https://rive.app/renderer
[Art meets technology: the next step in bringing our characters to life]: https://blog.duolingo.com/world-character-visemes/
[Canvas vs WebGL]: https://rive.app/community/doc/canvas-vs-webgl/docanjXoQ1uT
[vectalign]: https://github.com/bonnyfone/vectalign
[Magic Animator]: https://magicanimator.com/
[Discussion in HN]: https://news.ycombinator.com/item?id=44994071
[lottielab]: https://www.lottielab.com/
[Jitter]: https://jitter.video/
[omnilottie]: https://fal.ai/models/fal-ai/omnilottie/api
[web-animations-js]: https://github.com/web-animations/web-animations-js
[lottie json schema]: https://lottiefiles.github.io/lottie-docs/schema/
[Paper.js]: http://paperjs.org/
[Kute.js]: https://thednp.github.io/kute.js/
[Tips for rendering]: https://lottiefiles.github.io/lottie-docs/rendering/
[lottie-parser]: https://github.com/pissang/lottie-parser
[velato]: https://github.com/linebender/velato
[Bouncy Ball]: https://lottiefiles.github.io/lottie-docs/breakdown/bouncy_ball/
[Beziers in Lottie]: https://lottiefiles.github.io/lottie-docs/breakdown/bezier/#beziers-in-lottie
[Expressions]: https://lottiefiles.github.io/lottie-docs/expressions/
[clipping-masks]: https://lottie-animation-community.github.io/docs/specs/layers/common/#clipping-masks
[Layer Effects]: https://lottiefiles.github.io/lottie-docs/effects/#layer-effects
[thorvg.viewer]: https://github.com/thorvg/thorvg.viewer
[Rive vs Lottie]: https://rive.app/blog/rive-as-a-lottie-alternative
