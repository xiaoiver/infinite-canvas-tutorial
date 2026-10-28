---
outline: deep
description: '繪製矩形、橢圓、多邊形、橡皮擦、雷射筆與筆刷模式。實作筆刷功能，包括消除抖動的畫線演算法，以及絲滑的繪製體驗。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 25 課 - 繪製模式與筆刷',
          },
      ]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
import DrawArrow from '../../components/DrawArrow.vue'
import DrawPolygon from '../../components/DrawPolygon.vue'
import Pencil from '../../components/Pencil.vue'
import PencilFreehand from '../../components/PencilFreehand.vue'
import Brush from '../../components/Brush.vue'
import BrushWithStamp from '../../components/BrushWithStamp.vue'
import LaserPointer from '../../components/LaserPointer.vue'
import Eraser from '../../components/Eraser.vue'
</script>

# 第 25 課 - 繪製模式與筆刷 {#lesson-25-drawing-mode-and-brush}

在 [第 14 課 - 畫布模式與輔助 UI] 中，我們介紹了手形模式與選取模式。這一課會介紹繪製模式：矩形、橢圓與箭頭，以及更自由的筆刷模式。

## 繪製矩形模式 {#draw-rect-mode}

<DrawRect />

首先加入下列畫布模式。繪製橢圓的實作幾乎相同，這裡不再重複介紹：

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

在 [第 18 課 - 以 ECS 重構] 中，我們介紹了 ECS 架構。這裡會建立一個 `DrawRect` System，一旦進入該模式，就把游標樣式設為 `crosshair`：

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

接著在拖曳滑鼠時，持續在目標區域重繪矩形，類似選取模式中的框選效果。放開滑鼠、完成矩形的建立後，會從繪製矩形模式切換到選取模式：

```ts
export class DrawRect extends System {
    execute() {
        //...
        // Draw rect brush when dragging
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // Create rect when pointerup event triggered
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect', // Change to 'ellipse' in draw-ellipse mode
                x,
                y,
                width,
                height,
            };
            api.setAppState({ penbarSelected: Pen.SELECT }); // Switch canvas mode
            api.updateNode(node);
            api.record(); // Save to history
        }
    }
}
```

接下來看看拖放過程中發生了什麼。

### 重繪矩形 {#redraw-rect}

和框選類似，為了避免只拖了一小段距離就開始繪製，需要設定一個閾值，並在視口座標系中計算：

```ts
handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const {
        pointerDownViewportX,
        pointerDownViewportY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
        distanceBetweenPoints(
            viewportX,
            viewportY,
            pointerDownViewportX,
            pointerDownViewportY,
        ) > 10;
}
```

輔助矩形的 `x/y` 座標，是觸發 `pointerdown` 的位置；`pointermove` 事件物件的座標則需要轉換到畫布座標系，才能計算寬度與高度：

```ts
const { x: cx, y: cy } = api.viewport2Canvas({
    x: viewportX,
    y: viewportY,
});

let x = pointerDownCanvasX;
let y = pointerDownCanvasY;
let width = cx - x;
let height = cy - y;

api.updateNode(
    selection.brush,
    {
        visibility: 'visible',
        x,
        y,
        width,
        height,
    },
    false,
);
```

也要考慮反向拖曳的情況。此時算出的 `width/height` 可能是負數，對應的 `x/y` 也不再位於 `pointerdown` 的位置，必須重新計算。Figma 也是這樣做的：

```ts
if (width < 0) {
    x += width;
    width = -width;
}
if (height < 0) {
    y += height;
    height = -height;
}
```

### 尺寸標籤 {#size-label}

我們希望在繪製過程中即時顯示矩形的尺寸，就像 Figma 一樣：

![Figma 中的尺寸標籤](/figma-size-label.png)

同樣地，這類位於視口空間的標註很適合放在 SVG 容器裡，下面介紹的雷射筆與橡皮擦也是如此。矩形標籤用 CSS 樣式設定背景色、內距、置中等屬性，文字內容則使用包圍盒的寬度與高度：

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

如果繪製的是直線，標籤可以沿著直線方向旋轉，同時確保文字始終朝向正向。你可以在下一節的箭頭範例中體驗：

```ts
label.style.top = `${y + height / 2}px`;
const rad = Math.atan2(height, width);
let deg = rad * (180 / Math.PI);
if (deg >= 90 && deg <= 180) {
    deg = deg - 180;
} else if (deg <= -90 && deg >= -180) {
    deg = deg + 180;
}
label.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
```

### 按住 Shift 繪製正方形 {#draw-square-with-shift}

拖曳時按住 <kbd>Shift</kbd>，可以建立完美的正方形、圓形與多邊形。此時會取寬度與高度絕對值中的較小者，作為正方形的邊長。

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## 繪製箭頭 {#draw-arrow}

除了矩形、橢圓、折線這類基本圖形，箭頭這類組合圖形也很常用。我們暫時不討論箭頭的綁定關係（當箭頭首尾所連接的圖形移動時，箭頭方向會跟著改變）；這個主題會在單獨的章節處理。這裡只關注箭頭是如何繪製的。

箭頭首先在 SVG 中用 `<marker>` 宣告，通常是一個 `<path>`，再透過目標圖形的 [marker-start] 與 [marker-end] 屬性與箭頭關聯：

```html
<defs>
    <!-- arrowhead marker definition -->
    <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
</defs>
<!-- Coordinate axes with a arrowhead in both direction -->
<polyline
    points="10,10 10,90 90,90"
    fill="none"
    stroke="black"
    marker-start="url(#arrow)"
    marker-end="url(#arrow)"
/>
```

把箭頭端點與箭身分開的做法非常靈活。不過在圖形編輯器的情境中，提供一些預設的常用樣式就夠了。例如 Figma 的箭頭，是附加在 Path 的兩個端點（`start/end point`）上，並有 `line/triangle/diamond` 等幾種預設樣式，見 [如何在 Figma 中彎曲箭頭]。

![Figma 中的箭頭](/arrow-in-figma.png)

drawio 也提供許多開箱即用的箭頭樣式：

![來源: https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png](https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png)

因此在宣告式用法中，完全可以捨棄自訂箭頭樣式的能力，改為提供一組內建的箭頭樣式字面值，在建構 Polyline / Path 時一併產生箭頭端點與箭身。用 SVG 渲染的 [plot - arrow] 也能看到這個想法：它不用 `<marker>`，而是完整的 `<path>` 定義。

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

接下來看看幾何建構過程。

### 起點與終點 {#start-end-point}

首先需要找出箭頭的起點與終點。

不過方向需要手動計算。這並不複雜，沿著切線即可。

<DrawArrow />

### 將箭頭匯出為 SVG {#export-arrow-to-svg}

在 SVG 中，可以用 [orient] 屬性調整 `<marker>` 的方向，但要注意這個屬性只有兩個字面值：`‘auto’` 與 `‘auto-start-reverse’`。

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

然後根據 marker 類型建立 `<path>`，讓它繼承目標圖形的 `stroke` 等屬性。完整的 SVG 可以在 [匯出箭頭] 測試案例中找到：

```ts
if (marker === 'line') {
    const points = lineArrow(0, 0, arrowRadius, Math.PI);
    const $path = createSVGElement('path');
    $path.setAttribute('fill', 'none');
    $path.setAttribute('stroke', stroke);
    $path.setAttribute('stroke-width', `${strokeWidth}`);
    $marker.appendChild($path);
}
```

相對地，匯出的 SVG 檔也必須支援重新匯入畫布。

## 繪製多邊形 {#draw-polygon}

[形狀工具 - 多邊形]

<DrawPolygon />

給定一個矩形包圍盒，以程式產生多邊形路徑：

```ts
function regularPolygonPathInRect(
    sides: number,
    width: number,
    height: number,
    rotation = -Math.PI / 2,
): string {
    if (sides < 3 || width <= 0 || height <= 0) {
        return '';
    }

    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const step = (Math.PI * 2) / sides;
    const points: [number, number][] = [];

    for (let i = 0; i < sides; i++) {
        const angle = rotation + i * step;
        points.push([
            formatNumber(cx + Math.cos(angle) * rx),
            formatNumber(cy + Math.sin(angle) * ry),
        ]);
    }

    return points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ')
        .concat(' Z');
}
```

## 鉛筆工具 {#pencil-tool}

先看最簡單的實作：以折線顯示，Figma 稱之為 Pencil。

為了盡量減少拖放所產生的頂點數量，尤其是重複的頂點，或彼此非常接近的頂點，我們會用 [第 12 課 - 簡化折線] 介紹的方法簡化折線，並選用 [simplify-js] 的實作。值得注意的是 `tolerance` 參數的定義，它會影響簡化程度：

> 影響簡化的程度（單位與點座標相同）。

我們希望依目前相機的縮放等級設定不同的 `tolerance`，否則在高縮放等級下，過度簡化造成的抖動會很容易被看出來：

![在 4 倍縮放下過度簡化的折線](/over-simplified-polyline.gif)

```ts
import simplify from 'simplify-js';

export class DrawPencil extends System {
    private handleBrushing() {
        // choose tolerance based on the camera zoom level
        const tolerance = 1 / zoom;
        selection.points = simplify(selection.pointsBeforeSimplify, tolerance);
    }
}
```

<Pencil />

### Perfect freehand {#perfect-freehand}

由於線寬固定，缺少一種「靈活」的感覺。為了做出手繪感，可以讓線條隨壓力變化。為此可以使用 [perfect-freehand]。值得注意的是，這項功能尚未整合進 Excalidraw，見：[Perfect Freehand 繪製議題]。
因為線寬可變，最終繪製出的圖形不再是 Polyline，而是 Path：

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

預設情況下，[perfect-freehand] 會根據相鄰點之間的距離計算可變線寬，藉此模擬筆畫速度。若要使用真實的 [pressure]（例如來自筆或觸控筆），請把壓力作為每個輸入點的第三個數字：

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

並把 simulatePressure 選項設為 false。

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## 筆刷模式 {#brush-mode}

在 Photoshop Web 中進入 Paint 模式後，可以選擇這個子工具，透過持續拖放來繪製筆畫：

![Photoshop Web 中的筆刷模式](/photoshopweb-brush-mode.png)

在 Figma 中，它稱為 [使用插畫工具繪製]。

如果仔細看這類筆畫，會發現它由一組連續的點組成。若這些點的半徑不同，就能產生粗細變化的效果。這可以透過把筆刷壓力對應到半徑來實現：

![來源: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

這裡我們參考 [筆刷渲染教學] 來實現這個效果。

### 基本實作 {#basic-implementation}

底層資料結構如下：

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

折線的 $N$ 個頂點形成 $N-1$ 個線段，每一段由兩個三角形、四個頂點組成。在 [第 12 課 - 擠出線段] 中，我們介紹了使用 9 個頂點的做法。這裡使用完全相同的方法，但不需要考慮線段的接合處，因此只需要 4 個頂點，並以 instanced 方式繪製：

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

如同我們在 [第 12 課 - 擠出線段] 所見，可以把 `a_VertexNum` 傳入頂點著色器；如果不考慮 WebGL 1 相容性，也可以像 [筆刷渲染教學] 那樣直接使用 `gl_VertexID`：

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

順帶一提，其他 `attributes` 裡，`a_PointA` 與 `a_PointB` 除了頂點位置座標，還儲存可變半徑。我們再次用 `vertexBufferOffsets` 複用同一個 Buffer，`a_PointB` 從偏移 `4 * 3` 的位置讀取。這樣在頂點著色器中就有可用來拉伸的頂點編號：

![來源: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

```glsl
vec2 position;
vec2 offsetSign;
float r;
if (vertexNum < 0.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, -1.0);
} else if (vertexNum < 1.5) {
    position = p0;
    r = r0;
    offsetSign = vec2(-1.0, 1.0);
}
```

為了支援可變寬度，拉伸距離並不總是等於目前這個點的半徑，而需要依線段的斜率計算：

![來源: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

```glsl
int MAX_i = 128; float currIndex = startIndex;
float A = 0.0;
for(int i = 0; i < MAX_i; i++){
    // Blend opacity
    A = A * (1.0-opacity) + opacity;
}
```

效果如下。選取筆刷工具，並改變拖曳速度：ECS 使用帶有時間戳的滑鼠／觸控取樣，讓快速的筆畫較細、慢速的筆畫較粗，並平滑過渡。壓感筆則改用它所測得的壓力。得到的半徑會儲存在筆畫中，因此復原、重做與重新載入都會保留形狀。

<Brush />

### 印章 {#stamp}

這樣還不太像真實的筆觸。我們新增 `brushStamp` 屬性來存放印章圖片的 URL，但它只控制筆刷的不透明度，顏色仍然由 `stroke` 決定。

```ts
api.updateNodes([
    {
        id: '1',
        type: 'brush',
        brushType: BrushType.STAMP,
        brushStamp: '/stamp.png',
        points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
        stroke: 'grey',
    },
]);
```

<BrushWithStamp />

目前所有紋理都以固定方向套用。我們可以為紋理加上隨機的旋轉角度：

```glsl
float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
pToCurrStamp *= rotate(angle);
```

混合不透明度時，也可以使用雜訊因子：

```glsl
float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
```

### [WIP] 匯出 SVG {#export-brush-to-svg}

Figma 可以把 Brush 匯出成 SVG。

## 雷射筆 {#laser-pointer}

在畫布上實作簡報功能時，雷射筆是必要功能。Excalidraw 支援這項能力，詳見：[雷射筆]。我們可以直接使用它封裝的 [@excalidraw/laser-pointer] 模組，該模組會根據一組輸入點座標產生軌跡路徑。這項功能的核心也使用了 [perfect-freehand]。

這項功能與先前畫在畫布上的圖形有以下差異：

1. 雷射筆軌跡的渲染發生在視口座標系中，與目前的畫布縮放等級無關。因此可以在獨立的 HTML 容器中實作。見：[第 29 課 - HTML 容器]
2. 軌跡會在設定的一段時間後自動淡出
3. 為多使用者協作情境而設計。見：[第 20 課 - 感知與在場]

<LaserPointer />

## 橡皮擦 {#eraser}

Excalidraw 支援 [手繪橡皮擦]。選取橡皮擦工具後，滑鼠游標經過的圖形會呈現「褪色」，表示即將被擦除。放開滑鼠即完成擦除。

實作上，我們使用上一節介紹的 Perfect freehand 技術來繪製拖曳路徑，但只儲存最近的 4 個點。同時即時偵測經過的圖形，設定它們的不透明度（但記得保存原始不透明度，以便取消時還原），並在放開滑鼠時移除被選取的圖形：

```ts
export class DrawEraser extends System {
    execute() {
        if (input.pointerUpTrigger) {
            api.runAtNextTick(() => {
                api.updateNode(brush, { visibility: 'hidden' }, false);
                api.setAppState({
                    penbarSelected: Pen.SELECT,
                });
                api.deleteNodesById(
                    Array.from(selected).map((e) => api.getNodeByEntity(e)?.id),
                );
                api.record();
            });
        }
    }
}
```

<Eraser />

### 非原子式 {#non-atomic}

擦除整塊圖形對大多數情境已經足夠，但在手繪情境中，非原子式擦除更為實用——例如從中間打斷一條直線。Excalidraw 目前缺少這項功能，見：[線性與手繪圖形的非原子式擦除]。FigJam 也有同樣的限制。如果畫布使用 Canvas 或 SVG 渲染，確實無法做到這種像素級的擦除效果。

由於我們的畫布以 WebGL/WebGPU 實作，最合適的技術是模板緩衝區（stencil buffer）。首先把橡皮擦的路徑畫到模板緩衝區上，再把它當作遮罩重繪場景。以 OpenGL 為例（WebGL 完全類似）：

```c++
// 1. Disable color/depth writes, enable stencil, and draw the eraser shape:
//    This writes “1” into the stencil where the eraser stamp is drawn.
glColorMask(false,false,false,false);
glDepthMask(false);
glEnable(GL_STENCIL_TEST);
glStencilFunc(GL_ALWAYS, 1, 0xFF);
glStencilOp(GL_REPLACE, GL_REPLACE, GL_REPLACE);
// draw eraser brush geometry here (e.g. a textured quad or circle)

glColorMask(true,true,true,true);
glDepthMask(true);
// 2. Now render the shapes with stencil test=EQUAL, so only pixels where stencil==1 pass:
glStencilFunc(GL_EQUAL, 1, 0xFF);
glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
// draw all scene objects (they will only appear where eraser just wrote 1)
```

稍後會在 [第 34 課 - Frame 與裁切] 中介紹。

## 延伸閱讀 {#extended-reading}

-   [使用插畫工具繪製]
-   [筆刷渲染教學]
-   [p5.brush]
-   [使用 WebGL 的即時繪製系統]
-   [簡簡單單實作筆刷工具，輕鬆繪製絲滑曲線]

[第 14 課 - 畫布模式與輔助 UI]: /zh-Hant/guide/lesson-014
[第 18 課 - 以 ECS 重構]: /zh-Hant/guide/lesson-018
[使用插畫工具繪製]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[使用 WebGL 的即時繪製系統]: https://chrisarasin.com/paint-system-webgl
[簡簡單單實作筆刷工具，輕鬆繪製絲滑曲線]: https://zhuanlan.zhihu.com/p/701668081
[第 12 課 - 簡化折線]: /zh-Hant/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[筆刷渲染教學]: https://shenciao.github.io/brush-rendering-tutorial/
[第 12 課 - 擠出線段]: /zh-Hant/guide/lesson-012#extrude-segment
[如何在 Figma 中彎曲箭頭]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[形狀工具 - 多邊形]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[匯出箭頭]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Perfect Freehand 繪製議題]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[手繪橡皮擦]: https://github.com/excalidraw/excalidraw/issues/3682
[線性與手繪圖形的非原子式擦除]: https://github.com/excalidraw/excalidraw/issues/4904
[雷射筆]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[第 29 課 - HTML 容器]: /zh-Hant/guide/lesson-029#create-html-container
[第 20 課 - 感知與在場]: /zh-Hant/guide/lesson-020#awareness-presence
[第 34 課 - Frame 與裁切]: /zh-Hant/guide/lesson-034
