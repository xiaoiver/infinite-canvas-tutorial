---
outline: deep
description: '吸附與對齊'
head:
    - ['meta', { property: 'og:title', content: '第 27 課 - 吸附與對齊' }]
---

<script setup>
import SnapToPixelGrid from '../../components/SnapToPixelGrid.vue'
import SnapToObjects from '../../components/SnapToObjects.vue'
</script>

# 第 27 課 - 吸附與對齊 {#lesson-27-snap-and-align}

吸附是圖形編輯器應用程式中的常見功能。核心想法是：在移動、繪製或縮放元素時，自動把元素邊界或錨點對齊到最近的像素網格線，或其他圖形上。這一課會介紹它們的實作。

## 吸附到像素網格 {#snap-to-pixel-grid}

在 [第 5 課 - 繪製網格] 中，我們介紹了如何高效繪製直線網格。在移動、繪製等某些拖曳互動中，吸附到網格的最小單位，可以確保圖形的位置或幾何資訊是整數。這項功能在 Figma 中稱為 “Snap to pixel grid”，可以在「使用者偏好設定」中開啟。

![吸附到像素網格](https://user-images.githubusercontent.com/490574/85198268-4ff5f300-b322-11ea-897e-602ef5936995.gif)

來源：[Excalidraw 中的網格吸附]。

```ts
export interface AppState {
    snapToPixelGridEnabled: boolean; // [!code ++]
    snapToPixelGridSize: number; // [!code ++]
}
```

為了實作這項功能，首先需要計算點在世界座標系中的座標。當使用者拖曳、縮放或繪製圖形時，我們取得目前座標（例如 x、y），再把這些座標四捨五入到最近的整數（像素點），或指定的網格間距：

```ts
// Snap to custom grid (e.g. 10px)
function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}
```

然後在所有需要計算世界座標系中點座標的 System（例如 Select、DrawRect）中套用這個處理函式：

```ts
let { x: sx, y: sy } = api.viewport2Canvas({
    x: prevX,
    y: prevY,
});
let { x: ex, y: ey } = api.viewport2Canvas({
    x,
    y,
});
const { snapToPixelGridEnabled, snapToPixelGridSize } = api.getAppState(); // [!code ++]
// [!code ++]
if (snapToPixelGridEnabled) {
    // [!code ++]
    sx = snapToGrid(sx, snapToPixelGridSize);
    // [!code ++]
    sy = snapToGrid(sy, snapToPixelGridSize);
    // [!code ++]
    ex = snapToGrid(ex, snapToPixelGridSize);
    // [!code ++]
    ey = snapToGrid(ey, snapToPixelGridSize);
    // [!code ++]
}
```

在下面的範例中，我們把 `snapToPixelGridSize` 設為 10。你可以透過拖曳、移動與繪製來體驗效果：

<SnapToPixelGrid />

## 物件層級吸附 {#snap-to-objects}

Excalidraw 中吸附功能的實作分為以下關鍵步驟：

-   檢查目前操作是否允許吸附（[isSnappingEnabled]）。
-   計算所有可吸附的點與間隙（[getPointSnaps]）。
-   在拖曳／縮放過程中即時計算吸附偏移與輔助線（[snapDraggedElements] / [snapResizingElements]）。
-   把 snapLines 傳給 UI 層，並在畫布上渲染輔助線（[renderSnaps]）。

下面我們依照上述步驟來實作。

物件吸附與像素網格彼此獨立。`snapToObjectsDistance` 是以 CSS 像素為單位的半徑，因此縮放不會改變感受到的吸附距離。移動時，根據按下指標時的幾何，以及未經處理的指標位移來計算候選位置；吸附只套用到顯示位置。如果把吸附後的位置送進下一次取樣，物件會不斷被拉回輔助線。

移動支援包圍盒的邊緣／中心對齊，以及等間距輔助線。縮放時，會把移動中的邊或角吸附到其他物件的邊緣與中心，同時保留對邊、長寬比限制與置中縮放。對於旋轉過的物件，移動中的控制點會在世界座標中對齊。參考對象會排除隱藏或螢幕外的物件，以及選取範圍的祖先與後代。以上是目前已實作的行為；縮放時的間距分配、等尺寸匹配，以及繪製過程中的吸附，仍是後續工作，因此這尚未涵蓋 Figma 的全部行為。

### 是否啟用吸附 {#is-snapping-enabled}

我們在應用程式設定中加入了下列設定選項，也可以在「偏好設定選單」中開啟：

```ts
export interface AppState {
    snapToObjectsEnabled: boolean; // [!code ++]
}
```

在移動或調整已選取圖形的大小時觸發：

![來源: https://github.com/excalidraw/excalidraw/issues/263#issuecomment-577605528](https://user-images.githubusercontent.com/5153846/72973602-d804ba80-3dcd-11ea-9717-05448160044c.gif)

### 取得點吸附 {#get-point-snaps}

吸附點分為兩類：已選取的圖形，以及其他圖形。對於一個或多個已選取的圖形，常見的吸附點包括包圍盒的四個角與中心：

```ts
const { minX, minY, maxX, maxY } = api.getGeometryBounds(
    elements.map((id) => api.getNodeById(id)),
);
const boundsWidth = maxX - minX;
const boundsHeight = maxY - minY;
return [
    [minX, minY], // corners
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
    [minX + boundsWidth / 2, minY + boundsHeight / 2], // center
] as [number, number][];
```

考量效能，我們應該盡量減少偵測已選取圖形的吸附點相對於所有其他圖形的次數。我們在 [第 8 課 - 使用空間索引] 中已經討論過類似問題：只取回視口內的圖形。

```ts
const unculledAndUnselected = api
    .getNodes()
    .map((node) => api.getEntity(node))
    .filter((entity) => !entity.has(Culled) && !entity.has(Selected));
```

同樣地，計算這些圖形的參考點：

```ts
const referenceSnapPoints: [number, number][] = unculledAndUnselected
    .map((entity) => getElementsCorners(api, [api.getNodeByEntity(entity).id]))
    .flat();
```

接下來，逐一比較已選取圖形與其他圖形的吸附點。找出在水平或垂直方向上較接近的點對，並把它們之間的距離差記錄為後續的吸附距離：

```ts
nearestSnapsX.push({
    type: 'point',
    points: [thisSnapPoint, otherSnapPoint],
    offset: offsetX,
});
minOffset[0] = Math.abs(offsetX);
```

所有吸附點都計算完成後，這個最小距離就可以作為吸附距離。要注意的是，此階段圖形尚未依照吸附距離移動。因此，我們需要假設圖形已經移到最終位置，再進行另一輪計算：

```ts
// 1st round
getPointSnaps();
const snapOffset: [number, number] = [
    nearestSnapsX[0]?.offset ?? 0,
    nearestSnapsY[0]?.offset ?? 0,
];

// Clear the min offset
minOffset[0] = 0;
minOffset[1] = 0;
nearestSnapsX.length = 0;
nearestSnapsY.length = 0;
const newDragOffset: [number, number] = [
    round(dragOffset[0] + snapOffset[0]),
    round(dragOffset[1] + snapOffset[1]),
];

// 2nd round, a new offset must be considered.
getPointSnaps(newDragOffset);

// Render snap lines
```

### 取得間隙吸附 {#get-gap-snaps}

除了畫布上目前選取的圖形，其他圖形之間也可能形成帶有間隙的配對。Excalidraw 程式碼中的示意圖說明得很清楚——以 `horizontalGap` 為例：

```ts
// https://github.com/excalidraw/excalidraw/blob/f55ecb96cc8db9a2417d48cd8077833c3822d64e/packages/excalidraw/snapping.ts#L65C1-L81C3
export type Gap = {
    //  start side ↓     length
    // ┌───────────┐◄───────────────►
    // │           │-----------------┌───────────┐
    // │  start    │       ↑         │           │
    // │  element  │    overlap      │  end      │
    // │           │       ↓         │  element  │
    // └───────────┘-----------------│           │
    //                               └───────────┘
    //                               ↑ end side
    startBounds: Bounds;
    endBounds: Bounds;
    startSide: [GlobalPoint, GlobalPoint];
    endSide: [GlobalPoint, GlobalPoint];
    overlap: InclusiveRange;
    length: number;
};
```

如果已選取圖形的包圍盒與間隙沒有重疊，就跳過檢測。

```ts
for (const gap of horizontalGaps) {
    if (!rangesOverlap([minY, maxY], gap.overlap)) {
        continue;
    }
}
```

依序檢測中心點、右邊緣與左邊緣：

```ts
// center
if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset[0]) {
}
// side right
if (Math.abs(sideOffsetRight) <= minOffset[0]) {
}
// side left
if (Math.abs(sideOffsetLeft) <= minOffset[0]) {
}
```

若符合條件就記錄下來。過程中持續記錄最小距離：

```ts
const snap: GapSnap = {
    type: 'gap',
    direction: 'center_horizontal',
    gap,
    offset: centerOffset,
};
nearestSnapsX.push(snap);
```

### 渲染吸附線 {#render-snap-lines}

在 SVG 容器中渲染吸附線，見：[第 26 課 - 套索選取]。

吸附點通常以「十字」表示，連接這些點的線可以用 `<line>` 渲染。

```ts
renderSnapLines(
    api: API,
    snapLines: { type: string; points: [number, number][] }[],
) {
    const { svgSVGElement } = this.selections.get(api.getCamera().__id);
    this.clearSnapLines(api);

    snapLines.forEach(({ type, points }) => {
        if (type === 'points') {
            const pointsInViewport = points.map((p) =>
                api.canvas2Viewport({ x: p[0], y: p[1] }),
            );
            const line = createSVGElement('polyline') as SVGPolylineElement;
            svgSVGElement.appendChild(line);
        }
    });
}
```

關於間隙吸附線的顯示，Excalidraw 的文件非常清楚。在此基礎上，我們可以在輔助線下方（水平方向）或右側（垂直方向）加上表示距離的文字標籤，類似 Figma 的做法：

```ts
// a horizontal gap snap line
// |–––––––||–––––––|
// ^    ^   ^       ^
// \    \   \       \
// (1)  (2) (3)     (4)
```

![顯示間隙吸附線與距離標籤](/snap-to-objects.gif)

移動或調整下方中間矩形的大小。使用各自獨立的控制項，比較物件吸附與像素網格吸附：

<SnapToObjects />

## 延伸閱讀 {#extended-reading}

-   [如何在拖曳時用 Konva 吸附圖形位置？]
-   [tldraw 中的自訂吸附]

[第 5 課 - 繪製網格]: /zh-Hant/guide/lesson-005
[如何在拖曳時用 Konva 吸附圖形位置？]: https://konvajs.org/docs/sandbox/Objects_Snapping.html
[Excalidraw 中的網格吸附]: https://github.com/excalidraw/excalidraw/issues/521
[tldraw 中的自訂吸附]: https://tldraw.dev/examples/bounds-snapping-shape
[isSnappingEnabled]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L162C14-L162C31
[getPointSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L636
[snapDraggedElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L692
[snapResizingElements]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/snapping.ts#L1108C14-L1108C34
[renderSnaps]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/renderer/renderSnaps.ts
[第 8 課 - 使用空間索引]: /zh-Hant/guide/lesson-008#using-spatial-indexing
[第 26 課 - 套索選取]: /zh-Hant/guide/lesson-026#lasso-selection
