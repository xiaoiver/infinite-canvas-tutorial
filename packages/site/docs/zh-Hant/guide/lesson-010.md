---
outline: deep
description: '學習將畫布內容匯出為 PNG、JPEG 與 SVG 格式。在畫布中實作圖片渲染，並以 stroke-alignment 等功能擴充 SVG 能力，以強化設計工具。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 10 課 - 匯入與匯出圖片',
          },
      ]
---

<script setup>
import ObjectFit from '../../components/ObjectFit.vue';
</script>

# 第 10 課 - 匯入與匯出圖片 {#lesson-10-importing-and-exporting-images}

圖片的匯入與匯出是 Infinite Canvas 中非常重要的功能，透過匯出的圖片可以與其他工具對接。因此，雖然我們目前的畫布繪製能力還有限，最好還是先想清楚與圖片相關的問題。在本課中，你將學到以下內容：

-   將畫布內容匯出為 PNG、JPEG 與 SVG，並把以時間為基礎的效果匯出為 GIF
-   在畫布中渲染圖片，包括圖片填色上的 `object-fit` / `object-position`
-   擴充 SVG 的能力，以 `stroke-alignment` 為例

## 將畫布內容匯出為圖片 {#export-canvas-to-image}

首先看看如何把畫布內容匯出成圖片。文章 [從 Figma 匯出] 說明了如何在 Figma 中使用切片工具，把畫布匯出成包括 PNG 在內的多種格式。

![從 Figma 匯出](https://help.figma.com/hc/article_attachments/24423129974679)

一些基於 Canvas2D 實作的圖表函式庫也提供把內容存成圖片的能力。下圖來自 Highcharts，可以看到它同樣能把圖片匯出成多種格式，點擊後會立刻觸發瀏覽器的下載行為：

<img alt="Highcharts 中的匯出器" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

我們希望實作下列匯出功能：

-   支援多種圖片格式：PNG、JPEG 與 SVG。
-   支援指定裁剪區域
-   支援選擇是否包含網格

為此，我們把圖片匯出器設計成這樣使用：

```ts
const exporter = new ImageExporter({
    canvas,
});

const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

不過，不同格式的圖片有「些微」差異。下面先介紹匯出 PNG / JPEG 格式圖片的方式。

### 匯出 PNG / JPEG {#to-raster-image}

[HTMLCanvasElement.toDataURL()] 可以取得畫布內容對應的圖片 [DataURI]，透過 `type` 參數可以指定圖片格式，支援 PNG、JPEG 與 WebP。

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

因此我們為圖片匯出器加上 `toCanvas` 方法。這個方法用來把指定區域的畫布內容畫到另一個 HTMLCanvasElement 上，之後可以依需要再做處理，例如加上背景色、浮水印等。完整的方法簽名如下。值得注意的是，這個方法是非同步的，原因稍後說明：

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

各項設定的意義如下：

-   `grid` 是否包含網格
-   `clippingRegion` 畫布裁剪區域，用一個矩形表示。
-   `beforeDrawImage` 在繪製畫布內容之前呼叫，適合用來繪製背景色。
-   `afterDrawImage` 在繪製畫布內容之後呼叫，適合用來繪製浮水印。

完整的使用範例如下：

```ts
const canvas = await exporter.toCanvas({
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // Customize background-color
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // Watermark
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

我們把匯出圖片的下拉選單放在畫布右上角。如果對元件感興趣，可以參考：[使用 Lit 與 Shoelace 的 Web UI]。

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 100; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

現在來回答為什麼把 `toCanvas` 方法設計成非同步。由於 WebGL / WebGPU 使用 [SwapChain] 雙緩衝機制，而且建立 context 時 [preserveDrawingBuffer] 的預設值是 `false`，呼叫 `toDataURL` 時必須確保渲染結果沒有被清掉（例如呼叫了 `gl.clear()`），否則會得到一張空白圖片。我們在 [以外掛為基礎的架構] 的 `endFrame` 鉤子中加入下列邏輯：一旦收到匯出命令，就在目前這一幀結束前立刻把畫布內容存下來，以免下一幀到來時被清掉。這也使得這個行為變成非同步。

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

此外，可以選擇匯出的圖片是否包含 [網格]。後續處理暫時先不用裁剪與浮水印功能。類似 Figma 的「切片」功能需要框選互動，會在之後的實作中介紹。現在回到另一種特殊的圖片格式。

### 匯出 SVG {#to-vector-image}

向量圖形相對於點陣圖的優點是：

-   無限縮放而不失真。這表示它們可以無限放大或縮小而不損失清晰度，非常適合需要多種解析度的情況。
-   可編輯性：SVG 是文字檔案，可以用任何文字編輯器修改，因此很容易改圖形的屬性與樣式。
-   SVG 是文字檔案，可以用任何文字編輯器修改，因此很容易改圖形的屬性與各種樣式。

因此，設計工具必須提供轉換成這種格式的支援。對我們的無限畫布來說，可以把問題轉成：**如何序列化場景圖**，包括每個節點的繪製屬性、變換等。至於序列化格式，除了 JSON，由於我們二維圖形的繪製屬性設計大量參考了 SVG 的實作，匯出成 SVG 也就非常自然。

有趣的是，Three.js 也提供 [toJSON]，把場景的目前狀態（包括物件、變換、材質等）存成 [JSON-Object-Scene-format-4]。它甚至包含 [SVGRenderer]，在有限條件下（沒有複雜著色、陰影）盡可能把 3D 圖形渲染出來。

#### 從 Shape 到 SerializedNode {#shape-to-serialized-node}

許多白板工具也提供自訂的圖形序列化格式，例如 [tldraw 中的 JSON 物件] 與 [excalidraw 中的 JSON schema]。

從場景圖的根節點開始走訪，並對子元素遞迴呼叫。`transform` 這類具有複雜結構值（`position/scale/rotation`）的屬性需要進一步處理：

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

以下面的 Circle 為例，我們得到它的序列化物件：

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

可以透過反序列化方法把它匯入畫布。`deserializeNode` 會根據序列化節點的 `type` 屬性建立對應的圖形，並為繪製屬性賦值：

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return canvas;
})();
```

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

整個畫布的序列化與反序列化方法，可以直接套用在根節點上。當然，事件監聽器無法被序列化：

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### 從 SerializedNode 到 SVGElement {#serialized-node-to-svgelement}

至此，把序列化節點轉換成 [SVG 元素] 就很容易了。我們加上下列工具方法：

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

`fill / stroke / opacity` 等大多數屬性都是同名的 SVG 屬性，因此可以直接用 [setAttribute] 賦值，但有些特殊屬性需要特別處理，例如：

-   `transform` 我們使用 `@pixi/math` 中的 `Transform` 物件，需要把它的 `position / rotation / scale` 轉換成 `matrix()`。
-   `transform-origin` 對應 `transform` 中的 `pivot` 屬性。
-   `innerShadow` 沒有同名的 SVG 屬性，需要用濾鏡實作。
-   `outerShadow` 同上

下面的範例展示把序列化的圓轉換成 `<circle>` 的效果。它需要嵌入 [\<svg\>] 才能顯示在 HTML 頁面上，尺寸與畫布相同：

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### 從 SVGElement 到 SerializedNode {#svgelement-to-serialized-node}

當然，我們也需要一個從 SVGElement 轉換到 SerializedNode 的方法：

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

注意，這個轉換並非完全可逆。例如在稍後會介紹的 [描邊對齊的實作](#stroke-alignment-export-svg) 中，一個 Circle 對應兩個 `<circle>`。Figma 也是如此。下圖是匯入先前匯出的 Ellipse 的效果，可以看出兩個圖形並不完全相同。

![在 Figma 中匯入已匯出的橢圓](/import-exported-ellipse.png)

[@pixi-essentials/svg] 也想把 SVGElement 轉換成 Pixi.js 中的圖形，見 [使用 PixiJS 向量渲染 SVG 內容]。

#### SVG 中的場景圖 {#scene-graph-in-svg}

另一件需要注意的事是：我們場景圖中的任何圖形都可以有子節點，但在 SVG 中只有 `<g>` 可以有子節點，除此之外例如 `<circle>` 不能有子節點。解法很簡單：對於有子節點的非 Group 元素，在它外面生成一個 `<g>`，並把原本要套在它身上的 `transform` 套到這個 `<g>` 上。假設未來支援渲染文字，一個帶有文字子節點的 Circle，其 SVG 會像這樣：

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### 匯出內陰影與外陰影 {#export-inner-outer-shadow}

參考 [使用 CSS 與 SVG 濾鏡為 SVG 圖示加上陰影]，我們使用 [濾鏡基本元素] 來實現內陰影與外陰影。外陰影的範例：

```ts
const $feDropShadow = createSVGElement('feDropShadow', doc);
$feDropShadow.setAttribute('dx', `${(dropShadowOffsetX || 0) / 2}`);
$feDropShadow.setAttribute('dy', `${(dropShadowOffsetY || 0) / 2}`);
$feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
);
$feDropShadow.setAttribute('flood-color', dropShadowColor);
$filter.appendChild($feDropShadow);
```

內陰影更複雜一些，礙於篇幅這裡不展開。可以在下面的範例中下載 SVG 查看：

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            innerShadowColor: 'black',
            innerShadowOffsetX: 10,
            innerShadowOffsetY: 10,
            innerShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

#### 將圖片匯出為 fill 的值 {#export-image-as-fill-value}

雖然我們還沒介紹填色圖片的實作，直接序列化 `fill` 屬性的 Image 值會得到下面的結果：

```html
<circle fill="[object ImageBitmap]" />
```

這顯然無法正常顯示。我們需要把 Image 物件序列化成 DataURL，只要把圖片畫進 `<canvas>`，再用上一節介紹的 `toDataURL` 方法。參考 [將 ImageBitmap 轉換為 Blob]，我先試了 [ImageBitmapRenderingContext]。ImageBitmap 可以非同步解碼圖片，而不阻塞主執行緒，有助於提升應用程式的效能與回應速度。

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

不幸的是，我們得到下面的錯誤。原因是我們已經用這個 ImageBitmap 建立了紋理，不能再把它的控制權轉移給新的 `<canvas>`。

> [!CAUTION]
> 輸入的 ImageBitmap 已經被分離

因此只能用一般的 `drawImage` 方法，把圖片畫進 `<canvas>`。

#### ECS 的填色與手繪幾何匯出 {#ecs-export-paints}

ECS 匯出器會讀取 `fills` 與 `strokes` 中第一個啟用的圖層。`image` 填色會拉伸到圖形邊界。`pattern` 圖層則以圖片的原始尺寸嵌入解碼後的圖片，並保留 `repeat`、`repeat-x`、`repeat-y` 或 `no-repeat`。它的 SVG `<pattern>` 使用區域座標，節點變換只套用在外層群組上一次。當節點需要不同的重複範圍時，pattern 定義會使用不同的 ID。

```ts
const elements = await serializeNodesToSVGElements([
    {
        id: 'tile',
        type: 'rect',
        zIndex: 0,
        x: 40,
        y: 30,
        width: 200,
        height: 100,
        fills: [
            { type: 'pattern', value: imageDataURL, repetition: 'repeat-x' },
        ],
    },
]);
```

圖片解碼是非同步的。請 await `serializeNodesToSVGElements`；如果直接使用較低階的輔助函式，則 await `exportFillGradientOrPattern` / `exportStrokeGradientOrPattern`。圖片解碼失敗會讓匯出被拒絕。文字上的漸層、圖片與 pattern 填色會把它們的定義留在 `<text>` 元素旁邊，因此寫入文字內容時不會移除它的填色資源。

手繪圖形會把區域幾何匯出成 SVG 路徑。它們的群組不透明度、填色圖層不透明度與描邊圖層不透明度保持分開，包括不透明度為零的情況。排線（hachure）描邊使用 `roughFillWeight`（省略或為 `-1` 時，取外框寬度的一半）。橢圓的區域中心與半徑由 `width` 與 `height` 推導。重新匯入這些 SVG 路徑會保留渲染出來的幾何，但不會還原可編輯的手繪參數。此匯出支援不包含 pattern 的匯入。

若呼叫端需要 Canvas2D 的結果，`API.renderToCanvas(node, { width, height })` 會把該節點及其子節點畫進同一張畫布。它支援矩形、橢圓、路徑、折線與直線上的純色填色與描邊，以及以圖片填色的矩形。每個圖形各自開始一條路徑；SVG 路徑命令（包括弧線）以及 `evenodd` 填色規則會轉換成 Canvas2D 可用的形式。區域位置、圓角，以及節點／圖層的不透明度都會保留。子圖片會在繪製下一個兄弟節點之前完成解碼，因此順序保持穩定。如果圖片無法解碼，這個方法會拒絕，並讓傳入的畫布可以再畫一次。

#### SVG 中的網格 {#export-grid}

最後看看如何用 SVG 實作網格。參考 [如何使用 HTML5 與 canvas 或 SVG 繪製網格]，我們使用 `<pattern>` 平鋪：直線網格使用線寬為 1 與線寬為 2 的兩組；點狀網格則在「圖磚」的四個角各放一個圓：

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

另一種有趣的實作是利用 `<line>` 的 `stroke-dasharray`，它使用的 SVG 元素比大量重複的 `<circle>` 更少，見 [使用 pattern 的點狀網格]。

接著在繪製網格的邏輯中加上判斷：非截圖模式維持原樣，截圖模式只有在開啟包含網格的選項時才繪製：

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### 用 viewBox 反映相機參數 {#use-viewbox}

我們可以把畫布的寬度與高度放在 `<svg>` 元素上，但相機的變換參數，例如平移 `x/y` 與 `zoom`（我們尚未支援匯出相機旋轉），要如何反映到結果的 SVG 元素上？

這裡可以使用 [viewBox]：

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### SVG 最佳化工具 {#svg-optimizer}

如果仔細看目前的 SVG 產物，會發現有一些冗餘屬性，例如 `opacity=“1”`，它是預設值，不必明確出現在產物中。事實上，這正是 [svgo] 這類 SVG 最佳化工具會做的事之一：

> SVG 檔案，尤其是從向量編輯器匯出的檔案，通常包含大量冗餘資訊。這包括編輯器中繼資料、註解、隱藏元素、**預設值或並非最佳的值**，以及其他可以安全移除或轉換、而不影響渲染的內容。

因此我們需要維護一組預設屬性值的對照表。如果屬性值正好等於預設值，就不需要呼叫 `setAttribute` 去設定它：

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

#### [WIP] 內嵌網頁字型 {#inlined-web-font}

匯出 SVG 時，如果使用了網頁字型，我們希望把它們內嵌到檔案中。當然，由於字型檔案的大小限制，執行期需要做一些按需裁切。下面是 Excalidraw 的處理流程，詳見：[excalidraw 中的字型子集化]

![來源：https://link.excalidraw.com/readonly/MbbnWPSWXgadXdtmzgeO](https://github.com/user-attachments/assets/e255df0a-13de-4cb6-ae2e-9e885b643c63)

### 匯出 GIF {#to-gif}

在之後的 [第 30 課 - 以時間為基礎的動畫] 中，我們會介紹由後處理與時間 uniform 驅動的效果。要**匯出**那樣的動態，需要 GIF 或 WebM 這類格式；這裡概述前者。

1. 渲染路徑必須接受目前的**幀索引**（或引擎時間），這樣每一步才會顯示效果中正確的時刻。
2. **把畫布快照成點陣圖**，例如 PNG——上一節已經介紹過。
3. **讀取像素並量化**成調色盤（例如每幀 256 色）。如果可以接受一點品質損失，128 或 64 色通常能讓檔案小很多；漸層與像照片的內容會出現更多色帶或雜訊。
4. **逐幀調色盤：** 直接的做法是每一幀做一次 `quantize`，並在每次 `writeFrame` 使用一個 `palette`，這對扁平的 UI 很合適。對於幀與幀之間變化不大的短循環，**單一全域調色盤**或**較少的關鍵幀**可以再省一些空間，但實作成本明顯更高。

```ts
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const gif = GIFEncoder();
for (let i = 0; i < frameCount; i++) {
    renderFrame(i); // (1) drive time / frame
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const dataUrl = el.toDataURL('image/png', pngQuality); // (2) raster snapshot
    const imageData = await imageDataFromPngDataUrl(dataUrl, w, h, ctx!);
    const palette = quantize(imageData.data, 256); // (3) build palette
    const index = applyPalette(imageData.data, palette); // (4) map to indices
    gif.writeFrame(index, w, h, { palette, delay });
}
gif.finish();
return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
```

ECS 會在渲染每一幀之後等待瀏覽器的幀回呼，再讀取該幀的 PNG 快照，並且在整個 GIF 與 WebM 匯出過程中要求畫布尺寸固定。空白畫布、尺寸改變、PNG 解碼錯誤或繪製例外都會拒絕匯出，而不會回傳空檔案或部分動畫。暫存畫布在成功與失敗時都會釋放。WebM 還會停止錄製器與每一條擷取軌、取消尚未完成的幀回呼，並卸下圖片處理常式，因此失敗的匯出可以重試。呼叫端的來源畫布仍然可用。

WebM 的時間戳仍然跟隨即時的 `MediaRecorder` 擷取時鐘。所選的 FPS 會推進效果時間，但不保證精確的 WebM 幀率或時長。GIF 會寫入逐幀延遲，單位是 10 毫秒；瀏覽器也可能把過短的顯示時間往上箝制。

### 匯出 PDF {#to-pdf}

既然像素與向量都已經有了，如果還想匯出成 PDF，可以使用 [jsPDF]。它提供加入圖片的 API，礙於篇幅這裡不多作說明。

接下來換一個主題：如何在畫布中渲染圖片。

## 渲染圖片 {#render-image}

在 WebGL / WebGPU 中，經常需要載入圖片並把它們當作紋理使用。由於載入不同類型的資源是複雜的非同步過程，大多數渲染引擎都會提供資源載入器。除了不同類型的圖片，通常也支援音訊、JSON、glTF 等其他資料類型。下面是 [PIXI Assets] 的使用範例：

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

那麼要如何實作資源載入器？

### 圖片載入器 {#image-loader}

[loaders.gl] 為不同類型的資源提供一系列載入器，例如：

-   視覺化應用程式常用的 JSON、CSV、GeoJSON、GeoTiles 等。
-   glTF 等 3D 模型格式
-   各種壓縮紋理格式，使用 [CompressedTextureLoader] 在 WebWorker 中載入並解析。

這些載入器為上層應用程式的開發提供了很大的便利。我們可以直接使用 [ImageLoader]，它支援這些圖片格式：PNG、JPEG、GIF、WEBP、AVIF、BMP、SVG 等。core` 確保 API 呼叫一致，並讓不同類型的載入器可以擴充：

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

除了直接設定 `fill` 屬性，反序列化時也需要把 DataURL 還原成 Image 物件：

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### API 設計 {#image-api}

回到我們的 API 設計。當然可以仿照 Circle / Ellipse / Rect，為圖片新增一種圖形，它對應 SVG 中的 [\<image\>]：

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

但仔細想想，Image 應該具備 Rect 的全部能力，例如描邊、圓角、陰影等。有趣的是，在 Figma 中如果選擇把一張 1920 \* 1920 的圖片插入畫布並匯出成 SVG，會得到結構如下的 `<rect>` 元素（部分屬性值已省略），`fill` 屬性參考一個 [\<pattern\>]，間接使用圖片平鋪填色：

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

這給了我們一點啟發：圖片不必作為獨立的圖形存在，只要其他圖形的 `fill` 屬性支援對應，Circle / Rect 等就可以用圖片作為填色。想像我們要實作一個帶描邊的圓形圖示，原本的設計需要一個 Image 圖形，再搭配類似 [\<clipPath\>] 的東西；現在只需要用圖片填滿既有的 Circle 圖形：

```ts
circle.fill = image;
circle.stroke = 'black';
```

### 實作 {#implementation}

因此第一步，我們把 `fill` 支援的類型從顏色字串擴展到更多紋理來源：

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

頂點資料中需要一個欄位，用來表示是否使用紋理；如果使用，就對紋理取樣。其中 `SAMPLER_2D()` 不是標準 GLSL 語法，而是我們自訂的標記，在著色器編譯階段替換成 GLSL100 / GLSL300 / WGSL 的取樣語法。另外，目前的紋理是上傳的圖片，之後會支援用 Canvas2D API 建立的漸層，例如 [createLinearGradient]：

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

使用 `uniform` 會打破我們先前的批次渲染邏輯。[深入 PixiJS：批次渲染系統] 這篇文章描述了 Pixi.js BatchRenderer 實作的邏輯。從下面這個執行期編譯的著色器範本可以看出，同時能支援的取樣器數量上限是一組 `%count%` 個取樣器，每個實例使用頂點資料 `aTextureId` 從這組取樣器中選擇，每個實例都用 `aTextureId` 從這組取樣器裡挑出要用的那個。

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

為了簡單起見，我們把合併邏輯簡化如下：

1. 使用顏色字串的 `fill` 不能與 Image 合併。
2. 使用不同 Image 值的 `fill` 不能合併。

因此下面三個圓會畫在同一個批次中。

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage('/canvas.png');

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 渲染快取 {#render-cache}

先前我們沒有考慮快取 Program、Bindings、Sampler 等 GPU 物件。為此，我們加上資源快取管理器以便重複使用，並依資源類型實作命中邏輯。以 Sampler 為例，如果 `SamplerDescriptor` 中的屬性完全相同，就會命中快取，比較邏輯在 `samplerDescriptorEquals` 中。

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

### 物件契合（object-fit） {#object-fit}

矩形的幾何常常與圖片的固有長寬比不一致。到處都用 `drawImage(0, 0, width, height)` 來畫，會把圖示與照片拉變形。設計工具通常提供契合／填滿／裁切模式；我們在 `type: 'image'` 的 `FillLayers` 項目上遵循 CSS [object-fit] 與 [object-position]：

```ts
fills: [
    {
        type: 'image',
        value: '/canvas.png',
        objectFit: 'contain',
        objectPosition: 'top left',
    },
];
```

| `objectFit`           | 行為                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `fill`                | 拉伸以填滿幾何（**預設**，與早期的點陣行為相同） |
| `contain`             | 等比縮放；顯示完整圖片；可能出現留白邊            |
| `cover`               | 等比縮放；填滿幾何；裁掉超出部分                         |
| `none` / `scale-down` | 與 CSS 的語意相同                                                     |

這個對應如何對到 Figma 的圖片縮放，以及 Pencil 的 `mode`（`stretch` / `fill` / `fit`），見 [object-fit 範例](/example/object-fit)。

在 CPU 上，我們把圖片點陣化成紋理：依 `objectFit` 計算繪製矩形，再畫進畫布。對於 `contain` / `cover`，紋理尺寸是**幾何尺寸 × device pixel ratio**，而不是 `max(source width, geometry width)`——否則整張圖片會填滿點陣圖，對應到圖形上時看起來仍像被拉伸的 `fill`。

<ObjectFit />

### iOS 原況照片 {#ios-live-photo}

在檔案層級，一張 iOS 原況照片（Live Photo）通常是一張 HEIC 靜態圖片加上一段配套的 MOV。瀏覽器之間對原生 HEIC 的支援並不一致；ECS 圖片載入器使用 heic-to 提供一條轉換路徑。

我們希望把它當成一般圖片：把單一靜態幀解碼成點陣圖，再上傳成紋理。在畫布中播放原況照片內嵌的影片會是後續工作，並另外做一個專用元件（例如點一下就播放）。

`loadImageBitmapUniversal` 接受 URL、Blob 或 File。它會從 MIME、副檔名或檔案簽章辨認 HEIC/HEIF，並且只在需要時載入 heic-to，讓模組匯入在 SSR 期間保持安全。它把第一個靜態幀轉換成 PNG；如果轉換或點陣圖解碼失敗，會再用 JPEG 重試一次。非 HEIC 圖片繼續走 loaders.gl。

HTTP 錯誤會在轉換之前被拒絕。如果一張普通圖片解碼失敗，而且診斷用的 HEIC 探測也失敗，就保留原始錯誤。每一次呼叫都可以獨立重試；回傳的點陣圖屬於呼叫端，使用後應該關閉。傳入的 object URL 也仍然由呼叫端持有。

```ts
import { loadImageBitmapUniversal } from '@infinite-canvas-tutorial/ecs';

async function drawStill(
    context: CanvasRenderingContext2D,
    source: string | Blob,
) {
    const bitmap = await loadImageBitmapUniversal(source);
    try {
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close?.();
    }
}
```

解碼器使用 heic-to 1.6.6（libheif 1.23.6），修正了先前解碼器在全範圍 SDR 測試樣本上的色偏與透明度遺失。瀏覽器回歸測試會與來源顏色比較，並涵蓋灰階、PNG 透明度、多圖片容器中的第一張靜態圖、並行解碼，以及損壞輸入之後的恢復。
JPEG 備援仍然是有損的，無法保留 alpha。這些檢查不涵蓋任意 ICC 描述檔、廣色域色彩、HDR，或原況照片的影片播放。

## 強化 SVG：描邊對齊 {#stroke-alignment}

最後介紹一個有趣的主題。我們可以實作 SVG 規範目前尚未支援的功能。

先從 SVG 中 `opacity`、`stroke-opacity` 與 `fill-opacity` 的差異說起。左邊的圓是 `opacity=“0.5”`，右邊的圓是 `fill-opacity=“0.5” stroke-opacity=“0.5”`。可以看出描邊一半在圓內、一半在圓外：

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

Figma 中對應的描邊位置是 `Center`，其他選項還包括 `Inside` 與 `Outside`，下面分別展示。在 SVG 中這稱為 `stroke-alignment`，但目前仍是草案，見 [指定描邊對齊]。Pixi.js 在 WebGL 模式下也提供 [PIXI.LineStyle alignment]。

![Figma 中的描邊對齊](/figma-stroke-align.png)

我們為所有圖形加上 `strokeAlignment` 屬性：

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### 著色器中的描邊對齊 {#stroke-alignment-rendering}

著色器部分的實作只需要區分這三個值，並以不同方式混合填色與描邊顏色：

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

下面是我們的實作，可以看到渲染結果與 Figma 一致：

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

計算渲染包圍盒與拾取判斷時，也需要把這個屬性考慮進去。下面的函式反映了不同取值下，描邊應該從圖形本身向外延伸多遠。

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### 匯出 SVG {#stroke-alignment-export-svg}

如前所述，SVG 目前不支援 `stroke-alignment`，所以當下只能用變通方式模擬。如果繪製很簡單，可以分兩次畫出填色與描邊。下面是 Figma 匯出 `stroke-alignment: 'inner'` 的結果，同樣使用這個做法：

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

除此之外，[Figma widget 中的 StrokeAlign] 的 Figma 說明文件給了另一個想法，不需要建立兩個相似的元素。[如何在 SVG 中模擬 stroke-align（stroke-alignment）] 嘗試了這個想法：把描邊寬度放大到原來的兩倍，再用 clipPath 與 mask 去掉多餘的部分：

> 內側與外側描邊實際上是把描邊粗細加倍，再用填色去遮罩描邊。這表示內側對齊的描邊永遠不會畫到填色之外，外側對齊的描邊永遠不會畫到填色之內。

為了實作簡單，我們選擇第一種做法，建立兩個相似的元素，分別繪製填色與描邊。可以在上面的範例中試著匯出 SVG。

隨著畫布功能越來越豐富，需要引入測試，驗證匯入／匯出功能正常、渲染正確，以及 UI 元件可以互動。我們會在下一節介紹。

## 延伸閱讀 {#extended-reading}

-   [從 Figma 匯出]
-   [指定描邊對齊]
-   [如何在 SVG 中模擬 stroke-align（stroke-alignment）]
-   [使用 PixiJS 向量渲染 SVG 內容]

[從 Figma 匯出]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[如何在 SVG 中模擬 stroke-align（stroke-alignment）]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /zh-Hant/guide/lesson-001#swapchain
[使用 Lit 與 Shoelace 的 Web UI]: /zh-Hant/guide/lesson-007
[以外掛為基礎的架構]: /zh-Hant/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[網格]: /zh-Hant/guide/lesson-005
[SVG 元素]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[指定描邊對齊]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[Figma widget 中的 StrokeAlign]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[如何使用 HTML5 與 canvas 或 SVG 繪製網格]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[將 ImageBitmap 轉換為 Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[使用 PixiJS 向量渲染 SVG 內容]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[svgo]: https://github.com/svg/svgo
[使用 pattern 的點狀網格]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
[使用 CSS 與 SVG 濾鏡為 SVG 圖示加上陰影]: https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/
[濾鏡基本元素]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element#filter_primitive_elements
[tldraw 中的 JSON 物件]: https://tldraw.dev/docs/shapes#The-shape-object
[excalidraw 中的 JSON schema]: https://docs.excalidraw.com/docs/codebase/json-schema
[viewBox]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
[excalidraw 中的字型子集化]: https://github.com/excalidraw/excalidraw/issues/1972#issuecomment-2417744618
[第 30 課 - 以時間為基礎的動畫]: /zh-Hant/guide/lesson-030#time-animation
