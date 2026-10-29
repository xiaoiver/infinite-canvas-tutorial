---
outline: deep
description: '實作畫布模式與輔助 UI，包含 zIndex 與 sizeAttenuation 繪製屬性。加入手形模式以操作畫布，並加入選取模式，以便編輯圖形並顯示屬性面板。'
head:
    - ['meta', { property: 'og:title', content: '第 14 課 - 畫布模式與輔助 UI' }]
---
# 第 14 課 - 畫布模式與輔助 UI {#lesson-14-canvas-mode-and-auxiliary-ui}

先前我們用 Web Components 實作了一些畫布 UI 元件，包括相機縮放與圖片下載。在這一課，我們會透過元件暴露更多畫布能力，並實作一些新的繪製屬性：

-   實作 `zIndex` 與 `sizeAttenuation` 繪製屬性
-   在手形模式中移動、旋轉與縮放畫布
-   在選取模式中選取、拖曳與移動圖形，並顯示圖形屬性面板

在實作畫布模式之前，需要先做一些準備，以支援 `zIndex` 與 `sizeAttenuation` 繪製屬性。

## 實作 zIndex {#z-index}

選取圖形後顯示的遮罩層需要畫在所有圖形之上，這牽涉到顯示順序，由 `zIndex` 控制：

```ts
mask.zIndex = 999;
```

在 CSS 的 [z-index] 中，這個值只在同一個 [堆疊上下文] 裡才有意義。例如下圖中，雖然 `DIV #4` 的 `z-index` 比 `DIV #1` 高，但它仍因為處在 `DIV #3` 的上下文中而畫得比較下面：

![理解 z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

由於排序非常耗效能，我們為 Shape 加上 `sortDirtyFlag` 屬性，每當 `zIndex` 改變就設為 `true`：

```ts
class Sortable {
    get zIndex() {
        return this.#zIndex;
    }
    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex) {
            this.#zIndex = zIndex;
            this.renderDirtyFlag = true;
            if (this.parent) {
                this.parent.sortDirtyFlag = true; // [!code ++]
            }
        }
    }
}
```

在 `appendChild` 與 `removeChild` 時也要考慮這一點：

```ts
class Shapable {
    appendChild(child: Shape) {
        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.transform._parentID = -1;
        this.children.push(child);

        if (!isUndefined(child.zIndex)) {
            this.sortDirtyFlag = true; // [!code ++]
        }

        return child;
    }
}
```

接著，在渲染迴圈的每一幀做髒檢查，必要時才排序。我們也不想直接改 `children`，而是用 `sorted` 存放排序結果。畢竟 `z-index` 只應影響渲染順序，不應改變場景圖中的實際順序：

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

`sortByZIndex` 的實作如下：若設定了 `zIndex`，就依降序排序，否則維持父節點中的原始順序。這也說明了為什麼不改 `children`：它保留了預設的排序依據：

```ts
export function sortByZIndex(a: Shape, b: Shape) {
    const zIndex1 = a.zIndex ?? 0;
    const zIndex2 = b.zIndex ?? 0;
    if (zIndex1 === zIndex2) {
        const parent = a.parent;
        if (parent) {
            const children = parent.children || [];
            return children.indexOf(a) - children.indexOf(b);
        }
    }
    return zIndex1 - zIndex2;
}
```

```js eval code=false
circle1Zindex = Inputs.range([-10, 10], {
    label: 'z-index of red circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
circle2Zindex = Inputs.range([-10, 10], {
    label: 'z-index of green circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
circle1 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false inspector=false
circle2 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 150,
        cy: 150,
        r: 50,
        fill: 'green',
    });
});
```

```js eval code=false inspector=false
call(() => {
    circle1.zIndex = circle1Zindex;
    circle2.zIndex = circle2Zindex;
});
```

```js eval code=false inspector=false
call(() => {
    $icCanvas3.setAttribute('modes', '[]');

    $icCanvas3.style.width = '100%';
    $icCanvas3.style.height = '250px';

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
    });
});
```

匯出成 SVG 時，`z-index` 無法直接對應到元素屬性，因為 SVG 是依照元素在文件中出現的順序渲染的，見：[如何在 SVG 元素中使用 z-index？]

> 在 SVG 中，z-index 由元素在文件中出現的順序決定。

因此匯出時需要額外排序，`SerializedNode` 的排序實作與 `Shape` 幾乎相同，這裡不展開：

```ts
export function toSVGElement(node: SerializedNode, doc?: Document) {
    // Omit handling other attributes.
    [...children]
        .sort(sortByZIndex) // [!code ++]
        .map((child) => toSVGElement(child, doc))
        .forEach((child) => {
            $g.appendChild(child);
        });

    return $g;
}
```

## 實作 sizeAttenuation {#size-attenuation}

先前我們提過 [折線的 sizeAttenuation]。選取圖形後顯示遮罩層與錨點時，不希望它們的大小跟著相機縮放改變。例如在 excalidraw 中，拖曳把手（handle）這類輔助 UI 會依照縮放等級調整線寬，使用的是 Canvas2D API：

```ts
const renderTransformHandles = (): void => {
    context.save();
    context.lineWidth = 1 / appState.zoom.value; // [!code ++]
};
```

當然，我們已經把 `u_ZoomScale` 傳進著色器以便調整。

### 頂點壓縮 {#vertex-compression}

對於 `sizeAttenuation` 這類只有 0 與 1 的旗標位元，可以使用頂點壓縮技術。簡單來說，我們盡量用 vec4 存放這些頂點資料，並搭配某些壓縮技巧，這能縮短資料從 CPU 傳到 GPU 的時間，並省下不少 GPU 記憶體。此外，OpenGL 支援的 attribute 數量有上限。壓縮方式也很單純：在 CPU 端用 JS 壓縮，在頂點著色器中解壓。mapbox 與 Cesium 都有採用，見：[Cesium 的圖形技術 - 頂點壓縮]。下面看看如何把兩個值壓進一個 `float`：

在 GLSL 中，float 是單精度浮點數 [純量]，也就是 IEEE-754 [單精度浮點格式]

![binary32 位元配置](https://picx.zhimg.com/v2-05e8c5427795ebe84919ceef053adaad_1440w.png)

我們可以把 `sizeAttenuation` 與 `type` 壓進同一個 `float`，其中 `sizeAttenuation` 佔 1 個位元，`type` 佔 23 個位元。

```ts
const LEFT_SHIFT23 = 8388608.0;
const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;

const u_Opacity = [opacity, fillOpacity, strokeOpacity, type]; // [!code --]
const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed]; // [!code ++]
```

在著色器中解碼時，也必須維持與編碼相同的順序：

```glsl
#define SHIFT_RIGHT23 1.0 / 8388608.0
#define SHIFT_LEFT23 8388608.0

// unpack data(sizeAttenuation(1-bit), type(23-bit))
float compressed = a_Opacity;

// sizeAttenuation(1-bit)
float sizeAttenuation = floor(compressed * SHIFT_RIGHT23);
compressed -= sizeAttenuation * SHIFT_LEFT23;

// type(23-bit)
float type = compressed;
```

取得 `sizeAttenuation` 之後，在頂點著色器中用它調整頂點座標，以 SDF 實作為例：

```glsl
float scale = 1.0;
if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
}
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * model
    * vec3(position + v_FragCoord, 1)).xy, zIndex, 1); // [!code --]
    * vec3(position + v_FragCoord * scale, 1)).xy, zIndex, 1); // [!code ++]
```

### 匯出 SVG {#export-svg}

由於這個屬性與相機縮放有關，匯出 SVG 時需要額外處理。SVG 提供 [vector-effect]：

-   `non-scaling-size` -> `sizeAttenuation`，但這些還沒有實作，而且被視為有風險。
-   `non-scaling-stroke` -> `strokeAttenuation`

## 畫布模式 {#canvas-mode}

無限畫布通常支援許多模式，例如選取模式、手形模式、畫筆模式等，可以參考 [Excalidraw ToolType] 與 [rnote]。

同一個互動動作在不同模式下對應不同操作。例如在畫布上拖曳，在選取模式中對應選取操作；在手形模式中會拖曳整塊畫布；在畫筆模式中則是自由繪製筆跡。

首先，讓我們為畫布加入選取與手形模式，之後還可以擴充：

```ts
export enum CanvasMode {
    SELECT,
    HAND,
    DRAW_RECT,
}

class Canvas {
    #mode: CanvasMode = CanvasMode.HAND;
    get mode() {
        return this.#mode;
    }
    set mode(mode: CanvasMode) {
        this.#mode = mode;
    }
}
```

接著實作一個新的 UI 元件來切換這些模式。

## 模式選擇工具列 {#mode-toolbar}

使用 Lit 的 [動態 class 與樣式]，可以做出類似 [clsx] 的效果（如果在專案裡用過 [tailwindcss]，一定不陌生），用來管理 `className`，例如依條件產生。這裡用它實作選取模式下的醒目樣式：

```ts
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
    render() {
        const items = [
            { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
            { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
            {
                name: CanvasMode.DRAW_RECT,
                label: 'Draw rectangle',
                icon: 'sqaure',
            },
        ];
        return html`
            <sl-button-group label="Zoom toolbar">
                ${map(items, ({ name, label, icon }) => {
                    const classes = { active: this.mode === name }; // [!code ++]
                    return html`<sl-tooltip content=${label}>
                        <sl-icon-button
                            class=${classMap(classes)}
                            name=${icon}
                            label=${label}
                            @click="${() => this.changeCanvasMode(name)}"
                        ></sl-icon-button>
                    </sl-tooltip>`;
                })}
            </sl-button-group>
        `;
    }
}
```

此外，為了減少範本程式碼，我們使用 Lit 的 [內建指示詞 - map]。效果如下：

```js eval code=false
call(() => {
    const $canvas = document.createElement('ic-canvas');
    $canvas.style.width = '100%';
    $canvas.style.height = '100px';
    return $canvas;
});
```

## 手形模式 {#hand-mode}

顧名思義，在這個模式中，使用者只能平移、旋轉與縮放整塊畫布。我們先前已經實作 [CameraControlPlugin]，現在把它和畫布模式結合。在手形模式中，行為與原本一致，也就是移動或旋轉畫布。差別只是在拖曳開始與過程中，把滑鼠樣式改成 `grab` 與 `grabbing`：

```ts
export class CameraControl implements Plugin {
    apply(context: PluginContext) {
        root.addEventListener('drag', (e: FederatedPointerEvent) => {
            const mode = getCanvasMode();
            if (mode === CanvasMode.HAND) {
                setCursor('grabbing'); // [!code ++]

                if (rotate) {
                    rotateCamera(e);
                } else {
                    moveCamera(e);
                }
            }
        });
    }
}
```

### 用滾輪平移畫布 {#pan-with-wheel}

我一直誤把 `wheel` 和捲動行為或 `scroll` 事件混在一起。下面是 MDN 對 [元素：wheel 事件] 的說明：

> wheel 事件不一定會派發 scroll 事件。例如，元素可能完全無法捲動。使用滾輪或觸控板縮放也會觸發 wheel 事件。

使用 Figma 與 Excalidraw 時，我發現除了拖曳，用滾輪也能快速完成畫布平移。Excalidraw 還支援在其他畫布模式中按住 `Space` 再拖曳，見：[handleCanvasPanUsingWheelOrSpaceDrag]。因此先改原本的縮放邏輯：

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    // zoomByClientPoint(  // [!code --]
    //     { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }, // [!code --]
    //     e.deltaY, // [!code --]
    // ); // [!code --]
    camera.x += e.deltaX / camera.zoom; // [!code ++]
    camera.y += e.deltaY / camera.zoom; // [!code ++]
});
```

需要注意的是，每次移動的距離都要考慮相機目前的縮放等級，放大時每次移動的距離應該更小。

### 用滾輪縮放畫布 {#zoom-with-wheel}

當然，縮放行為仍要保留，在按下 `Command` 或 `Control` 時觸發。如果在 Mac 觸控板上開啟了 `pinch to zoom`，觸發的 `wheel` 事件會自動帶有 `ctrlKey`，見：[捕捉 Mac 觸控板縮放]：

![Mac 觸控板縮放](/mac-trackpad-zoom.gif)

這樣就能輕易區分 `wheel` 事件在縮放與平移情境下的不同行為：

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
        zoomByClientPoint(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            e.deltaY,
        );
    } else {
        camera.x += e.deltaX / camera.zoom;
        camera.y += e.deltaY / camera.zoom;
    }
});
```

值得一提的是，Excalidraw 也支援按住 <kbd>Shift</kbd> 水平捲動畫布。不過我們已經把畫布的這個行為分配給旋轉操作，所以這裡不實作。

## 選取模式 {#select-mode}

在選取模式中，使用者可以點擊畫布上的圖形來選取。選取狀態下，會在原圖形上疊一層輔助 UI，通常由遮罩層與數個錨點組成。在遮罩層上拖曳可以移動圖形，在錨點上拖曳可以朝各個方向改變圖形大小。我們也會在圖形上方外側加一個用於旋轉的錨點。

![具有實體屬性的錨點定位示意圖](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### 點擊選取圖形 {#select-shape}

下面實作 Selector 外掛，下列介面也會暴露給 Canvas：

```ts
export class Selector implements Plugin {
    selectShape(shape: Shape): void;
    deselectShape(shape: Shape): void;
}
```

在這個外掛裡監聽 `click` 事件後，需要處理下列情況：

-   點擊圖形時顯示選取狀態的 UI。如果先前已選取其他圖形，先取消選取。
-   點擊畫布空白處會取消目前選取的圖形。
-   按住 <kbd>Shift</kbd> 進入多選模式。

```ts
const handleClick = (e: FederatedPointerEvent) => {
    const mode = getCanvasMode();
    if (mode !== CanvasMode.SELECT) {
        return;
    }

    const selected = e.target as Shape;

    if (selected === root) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
            this.#selected = [];
        }
    } else if (selected.selectable) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
        }
        this.selectShape(selected);
    } else if (e.shiftKey) {
        // Multi select
    }
};
root.addEventListener('click', handleClick);
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, CanvasMode, RoughEllipse } = Core;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    // $icCanvas.setAttribute('zoom', '200');
    $icCanvas.setAttribute('mode', CanvasMode.SELECT);
    $icCanvas.style.width = '100%';
    $icCanvas.style.height = '200px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const ellipse = new RoughEllipse({
            cx: 200,
            cy: 100,
            rx: 50,
            ry: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(ellipse);

        // setTimeout(() => {
        canvas.selectShape(ellipse);
        // }, 1000);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 拖曳移動圖形 {#dragndrop-move}

HTML 原生支援拖曳，當然也可以用 `pointermove / up / down` 這類更底層的事件實作，見：[使用滑鼠事件拖放]。我們的實作也借用了這篇文章的想法。在 `dragstart` 事件中記錄滑鼠在畫布上的偏移。注意這裡使用 `screen` 座標系，因為需要考慮相機縮放：

```ts
let shiftX = 0;
let shiftY = 0;
this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        shiftX = e.screen.x;
        shiftY = e.screen.y;
    }
});
```

在 `drag` 事件中，依照偏移調整遮罩層位置。使用 `position` 屬性不必修改遮罩路徑定義，反映到底層渲染時只有 `u_ModelMatrix` 會改變：

```ts
const moveAt = (canvasX: number, canvasY: number) => {
    const { x, y } = this.mask.position;
    const dx = canvasX - shiftX - x;
    const dy = canvasY - shiftY - y;

    this.mask.position.x += dx;
    this.mask.position.y += dy;
};

this.addEventListener('drag', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    const { x, y } = e.screen;

    if (target === this.mask) {
        moveAt(x, y);
    }
});
```

在 `dragend` 事件中，把遮罩層位置同步到圖形，此時會修改遮罩路徑：

```ts
this.addEventListener('dragend', (e: FederatedEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        this.tlAnchor.cx += this.mask.position.x;
        this.tlAnchor.cy += this.mask.position.y;

        const { cx: tlCx, cy: tlCy } = this.tlAnchor;

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
    }
});
```

### 顯示屬性面板 {#property-panel}

選取圖形時，我們希望顯示該圖形對應的屬性面板，見 [抽屜 - 限制在元素內]，這裡不展開。以 `stroke` 屬性為例，我們做雙向繫結：監聽目前選取的圖形，使用者手動修改後，把新值同步回圖形：

```html
<sl-color-picker
    hoist
    size="small"
    value="${this.shape?.stroke}"
    @sl-input="${this.handleStrokeChange}"
    opacity
></sl-color-picker>
```

需要注意的是，對於顏色，我們希望把透明度分開，因此要用 [sl-color-picker] 的 `getFormattedValue` 方法取得顏色值，再用 `d3-color` 函式庫解析，分別賦值給 `stroke` 與 `strokeOpacity`：

```ts
const strokeAndOpacity = (e.target as any).getFormattedValue('rgba') as string;
const { rgb, opacity } = rgbaToRgbAndOpacity(strokeAndOpacity); // with d3-color
```

當然，選取模式下還有許多功能要實作，例如把選取項目合併成群組、旋轉圖形等，我們會在後續課程繼續完善。此外，在繪製模式下，我們希望支援繪製矩形、線段、多邊形等，也會在後續課程實作。

## 延伸閱讀 {#extended-reading}

-   [Excalidraw ToolType]
-   [介紹 CSS 錨點定位 API]
-   [使用滑鼠事件拖放]

[介紹 CSS 錨點定位 API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[動態 class 與樣式]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[內建指示詞 - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /zh-Hant/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[元素：wheel 事件]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[捕捉 Mac 觸控板縮放]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[堆疊上下文]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[如何在 SVG 元素中使用 z-index？]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
[純量]: https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Scalars
[單精度浮點格式]: https://en.wikipedia.org/wiki/Single-precision_floating-point_format
[Cesium 的圖形技術 - 頂點壓縮]: https://cesium.com/blog/2015/05/18/vertex-compression/
[使用滑鼠事件拖放]: https://javascript.info/mouse-drag-and-drop
[抽屜 - 限制在元素內]: https://shoelace.style/components/drawer#contained-to-an-element
[sl-color-picker]: https://shoelace.style/components/color-picker
[vector-effect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect
