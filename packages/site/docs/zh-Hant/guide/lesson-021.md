---
outline: deep
description: '實作具備調整大小與旋轉能力的圖形 Transformer。了解錨點、座標系統轉換、CSS 游標自訂，以及擴大拾取區域，以完成直覺的圖形編輯。'
head:
    - ['meta', { property: 'og:title', content: '第 21 課 - Transformer' }]
---

<script setup>
import TransformerRect from '../../components/TransformerRect.vue'
import TransformerRectRotated from '../../components/TransformerRectRotated.vue'
import TransformerLine from '../../components/TransformerLine.vue'
import TransformerPolyline from '../../components/TransformerPolyline.vue'
import TransformerPath from '../../components/TransformerPath.vue'
</script>

# 第 21 課 - Transformer {#lesson-21-transformer}

在[第 14 課]裡，我們簡短介紹了畫布模式中的「選取模式」。在這個模式中，選取圖形之後，會在圖形上疊一層操作層，並能透過拖曳移動它。這一課會提供更多圖形編輯能力，包括調整大小與旋轉。

在 Konva 中，選取圖形上的操作層稱為 [Transformer]，並提供以下範例：

-   [HTML5 Canvas 圖形的選取、調整大小與旋轉]
-   [限制拖曳與調整大小]

我們也選擇使用 Transformer 這個名稱。它看起來和圖形的 AABB（軸對齊包圍盒）非常相似。實際上它稱為 OBB（oriented bounding box，有向包圍盒），是世界座標下帶有旋轉角的矩形。

<TransformerRect />

## 序列化變換矩陣與尺寸資訊 {#serialize-transform-dimension}

在 Figma 中，圖形的局部變換矩陣與尺寸資訊如下。我們知道，對 2D 圖形而言，mat3 變換矩陣可以分解成平移、縮放與旋轉。其中 X/Y 對應平移，縮放會在[翻轉](#flip)一節介紹。[fig-file-parser]

![來源：https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

因此我們選擇修改 [SerializedNode] 的結構，讓它盡可能描述多種圖形，同時移除一些表示位置的屬性，例如 Circle 的 `cx/cy`，因為可以透過 `x/y` 與 `width/height` 算出 `cx/cy`。

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />` 會被序列化成下面這樣。這裡用 `ellipse` 表示它，以便日後更彈性地調整大小：

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

對於透過 `point` 與 `d` 屬性定義的折線、路徑這類圖形，不能刪掉這些屬性。相反地，需要計算它們的 AABB，並重新計算這些屬性。以 `<polyline points="50,50 100,100, 100,50" />` 為例：

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## 錨點 {#anchors}

Transformer 的錨點分成兩類：調整大小與旋轉。數量上有兩種常見組合。

一種是 Excalidraw 與 Konva 採用的做法：周邊用 8 個錨點做調整大小，再加上一個獨立的旋轉錨點：

![來源：https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

另一種是 tldraw 與 Figma 採用的做法：只用 4 個錨點。從外側靠近這 4 個錨點時變成旋轉，水平與垂直的調整大小則靠拖曳四條邊：

![來源：https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

我們選擇這個看起來更簡潔的方案：以一個 `Rect` 遮罩作為父節點，再加上四個作為子節點的 `Circle` 錨點：

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Transformer 座標系統 {#transformer-coordinates}

在[第 6 課 - 座標系統轉換]中，我們實作了視埠、畫布與 Client 座標系統之間的轉換。這裡需要再引入一套新的座標系統，也就是遮罩的局部座標系統。例如當遮罩帶有變換（例如旋轉）時，作為子節點的錨點需要知道自己在世界座標系統中的位置。我們加上這組轉換方法：

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### 顯示 CSS 游標 {#display-css-cursor}

滑鼠懸停在錨點上時，游標樣式需要直覺地表示對應的功能。做法是在網頁端修改 `<canvas>` 的樣式。預設的 [CSS 游標] 支援的圖示有限，例如沒有表示旋轉語意的圖示，在 Excalidraw 與 Konva 中只能改用 `grab`。另一個例子是，調整大小確實有 8 種圖示，但因為圖形可以旋轉，當旋轉角不是 45 的整數倍時，就算像 Konva 那樣計算並選出合適的圖示，也無法精確表示：

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

因此需要使用自訂滑鼠樣式，並且能依照旋轉角動態調整。[如何旋轉 CSS 游標]提供了一種使用 SVG 的做法，tldraw 在此基礎上加入動態角度計算，見：[useCursor]。以右上錨點為例：

![旋轉錨點](/transformer-anchor-rotate.png)

把旋轉變換套用到 SVG 圖示上，得到此時的 Cursor 值：

```ts
// SVG angles are in degrees; both reflections are in the object's local axes.
const sx = scaleX < 0 ? -1 : 1;
const sy = scaleY < 0 ? -1 : 1;
const r = (rotation - cameraRotation) * RAD_TO_DEG;
const transform = `translate(16 16) rotate(${r}) scale(${sx} ${sy}) rotate(${tr}) translate(-16 -16)`;
```

保留每個縮放軸的正負號。SVG 由右向左套用變換：先依控制點方向擺好圖示，再在物件的局部軸上鏡射，然後旋轉到視埠中。單靠行列式無法區分水平、垂直與雙重鏡射；若在旋轉之後才鏡射，游標會指向錯誤的方向。

當滑鼠更靠近錨點時，互動會從旋轉變成調整大小：

![調整大小錨點](/transformer-anchor-resize.png)

從遠處靠近錨點時，要如何觸發拾取？

### 擴大拾取區域 {#hit-area}

首先想到的是允許圖形擴大、甚至自訂拾取區域。例如 Pixi.js 提供 [hitArea]。我們也可以在 Renderable 元件上加入這個欄位：

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

在 ComputeBounds System 計算包圍範圍時考慮這個屬性，這樣就能設定一個比錨點更大的圓形偵測區域：

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

但這個做法有個明顯的問題：就算把拾取區域設成錨點的 5 倍大，相機縮放之後，仍然必須懸停在錨點上才會觸發拾取。因此需要在 Canvas 世界座標系統之外考慮拾取。

### 在視埠座標中拾取 {#picking-in-viewport-coordinates}

我們需要在視埠座標系統中做拾取偵測，這樣就能忽略相機縮放。

首先要計算四個錨點在 Canvas 世界座標系統中的位置，而不是直接使用錨點的 `cx/cy`，否則當 Transformer 本身有旋轉時會出錯（我們很快就會看到這種情況）：

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

然後先判斷到四個錨點的最短距離是否達到調整大小互動的門檻。若達到，就回傳對應的滑鼠樣式圖示名稱，並加上旋轉角以得到旋轉後的 SVG：

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

接著進入旋轉互動偵測。此時偵測點不能位於 Transformer 內部，可以使用[檢查點是否在多邊形內]介紹的偵測方法：

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

最後是 Transformer 四條邊的調整大小偵測。這裡需要計算偵測點到線段的距離，參考 [Gist - 二維點到線段]：

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## 單一圖形的調整大小 {#resize-single-shape}

在 Figma / FigJam 中，除了拖曳四個角錨點與四條邊來自由改變尺寸，還可以：

-   拖曳時按住 <kbd>Option</kbd> 或 <kbd>Alt</kbd>，從幾何中心縮放
-   拖曳時按住 <kbd>Shift</kbd>，固定對角／對邊，沿水平與垂直方向等比例縮放
-   組合這些按鍵

效果如下，來源：[在 FigJam 中調整大小、旋轉與翻轉物件]

![在 FigJam 中調整大小](https://help.figma.com/hc/article_attachments/1500011223302)

先看如何實作自由改變尺寸。以左上錨點為例，拖曳時固定右下錨點：

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

最後依照左上與右下錨點變換選取的圖形。

### 變換圖形 {#transform-shape}

既然已經知道調整大小前後的屬性（變換與尺寸資訊），就很容易計算這兩個狀態之間的過渡矩陣：

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

但不能把這個矩陣直接套用到選取的圖形上，還要考慮場景圖中父節點在世界座標系統裡的變換：

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

把父節點的世界變換左乘之後，就能得到選取圖形在局部座標系統中的新變換：

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

最後把局部座標系統下的新矩陣套用到選取的圖形上。

### 鎖定長寬比 {#lock-aspect-ratio}

仍以左上錨點為例。鎖定長寬比時，不能直接設定它的位置。需要依照開始拖曳時圖形的長寬比，重新計算左上錨點的位置，同時保持右下錨點的位置不變。

首先，在開始拖曳錨點時記錄選取圖形的 OBB 與長寬比，這相當於對角線的斜率：

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

拖曳過程中：

1. 保持右下錨點的位置不變
2. 計算此時從左上到右下的對角線距離
3. 依照先前保存的長寬比，重新計算左上錨點的位置

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

值得注意的是，Konva.js 不支援在保持長寬比的同時拖曳全部四條邊。在那種情況下，需要停用這四個錨點。詳見：[變換時能否保持圖片長寬比？]。

不過我們可以很容易做到。以拖曳右側邊錨點為例：

1. 先設定右下錨點的 X 座標
2. 由於左上錨點的 X 座標不變，可以算出變換後的寬度
3. 長寬比鎖定之後，變換後的高度也隨之確定，因而可以算出變換後的高度
4. 依照變換前後的高度差，設定左上與右下錨點的 Y 座標

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

拖曳過程中，可以即時顯示對角線，給使用者清楚的提示（通常是虛線）。

### 以中心為基準縮放 {#centered-scaling}

仍以左上錨點為例。此時固定的參考點從右下錨點改成幾何中心點，同樣在開始拖曳時記錄：

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

然後重新計算右下錨點的位置，使它與左上錨點關於中心點對稱：

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### 翻轉 {#flip}

把錨點或邊拖到相反方向時，就會發生翻轉。下面是 Figma 中的效果，注意 Rotation 的變化：

![翻轉時旋轉 180 度](/resize-flip.gif)

我們用漸層背景把這個翻轉效果顯示得更清楚：

![翻轉帶有漸層填色的矩形](/rotate-when-flipped.png)

跨邊翻轉預設為關閉。本頁頂部的互動範例會啟用它，並使用橘到藍的漸層，讓鏡射看得出來：

```ts
api.setAppState({ flipEnabled: true });
```

在整個手勢過程中，保持按下指標當下的選取框、節點變換與控制點身分不變。把指標轉換到那個原始框，並以對角或對邊（按住 Alt / Option 時則是中心）為基準計算帶正負號的尺寸。負的尺寸表示鏡射。若過早交換控制點並取尺寸的絕對值，就會失去這次鏡射，或在下一幀移動本應固定的邊。尺寸恰好為零時，改用一個很小的非零尺寸，並繼續以原始框計算後續取樣。

套用變換之後，節點的 `width` / `height` 保持為正，並從同一次矩陣分解取得 `rotation` 與 `scaleX` / `scaleY`。把分解得到的旋轉和舊的縮放正負號組合在一起是不正確的。將路徑、折線或 VectorNetwork 幾何烘焙進去時，要去掉 Transform 裡已經保留的旋轉與鏡射，以免幾何被鏡像兩次。

鏡射矩陣可以有等價的旋轉／縮放分解。應檢查鏡射後的圖形與漸層、固定邊以及控制點位置，而不要求 Rotation 必須改變 180°。Shift 保持長寬比，Alt / Option 保持中心；放開後的框、下一次手勢，以及復原／重做都應保持一致。

## 旋轉 {#rotation}

Figma 中的旋轉：

> 將游標移到圖層邊界外側附近，直到圖示出現。
> 按住並拖曳以旋轉選取範圍：
> 順時針拖曳會產生負角度（朝向 -180°）。
> 逆時針拖曳會產生正角度（朝向 180°）。
> 按住 Shift，讓旋轉值以 15° 為間距吸附。

1. 指標按下時，保存 OBB，以及局部與世界兩套軸心。沒有自訂軸心時，使用幾何中心。
2. 在畫布座標中追蹤上一個指標角度。累加相鄰的 `atan2` 差值，並用 `atan2(sin, cos)` 正規化，以便在跨越 ±π 時保持連續。
3. 由這個固定軸心與初始 OBB 解出新的原點與旋轉，再透過 `Select.fitSelected` 更新節點。多選旋轉時，顯示同一個旋轉後的初始框；放開時還原成與世界軸對齊的聯集。

ECS 模組 `systems/select/rotate-gesture.ts` 負責手勢的開始、取樣、完成與清理。`Select` 保留輸入分派、節點更新與歷史紀錄。`resize-gesture.ts` 負責調整大小的約束、吸附、端點拖曳與觸控偏移。

```ts
// Pointer down, after converting to canvas coordinates and pixel snapping:
beginRotateGesture(api, selection, { x: canvasX, y: canvasY });

// Pointer move:
updateRotateGesture(api, selection, { x: canvasX, y: canvasY }, (obb) => {
    this.fitSelected(api, obb, selection);
});

// Pointer up; Select records the resulting document once afterwards:
finishRotateGesture(api, selection);
```

<TransformerRectRotated />

### 變更旋轉原點 {#change-the-rotation-origin}

下面是 Figma 的[變更旋轉原點]效果：

![變更旋轉原點](https://help.figma.com/hc/article_attachments/31937330391447)

實作要點：

1. 在 transformer 遮罩上加入一個中心錨點（`AnchorName.CENTER`）。這個錨點可以拖曳。
2. 把自訂旋轉原點存在 transformer 局部座標（`rotatePivotX/Y`）中，並標記它是否由使用者釘選（`rotatePivotPinned`）。
3. 拖曳中心錨點時，在指標移動的過程中把畫布座標轉換成 transformer 局部座標：

```ts
const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
tf.rotatePivotX = x;
tf.rotatePivotY = y;
tf.rotatePivotPinned = true;
```

4. 旋轉時使用這個軸心（若未設定則退回幾何中心），然後在解出新的 OBB 原點時，保持軸心的世界位置不變：

```ts
const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
} = gesture;
const rotation = obb.rotation + gesture.accumulated;
const c = Math.cos(rotation);
const s = Math.sin(rotation);
const newAttrs = {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
};
```

5. 選取的節點集合改變時，把軸心重設到中心。

## 用方向鍵移動圖形 {#nudge-the-position}

Figma 提供[微移圖層]功能，可以用上、下、左、右方向鍵移動圖形，也可以搭配 <kbd>Shift</kbd> 做更大的移動。在我們的實作中，使用固定距離：

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## 對齊並均分選取範圍 {#align-distribute}

ECS API 提供六種對齊模式：`left`、`right`、`top`、`bottom`、`centerH` 與 `centerV`。它們使用世界空間的幾何包圍範圍，不含描邊粗細。只有位置會改變：旋轉、鏡射、尺寸、路徑資料、文字度量與 Flex 尺寸偏好都保持不變，在旋轉或縮放過的父節點下也是如此。

```ts
const ids = [...api.getAppState().layersSelected];
await api.edit((editor) => {
    editor.alignSelectedNodes('left', ids);
});
// Run a separate edit so derived geometry is refreshed between operations.
await api.edit((editor) => {
    editor.distributeSelectedNodesSpacing('horizontal', ids);
});
```

間距接受 `horizontal` 或 `vertical`，沿該世界軸排序節點，並依選取範圍的跨度計算相等的邊到邊間隙。重疊的圖形可以出現負間隙。重複的 ID、已刪除／遺失／鎖定的節點，以及不可逆的父變換都會被略過。被選取的後代會跟著被選取的祖先一起移動，而不會移動兩次；至少需要兩個符合條件的頂層節點。這些方法回傳是否有節點移動了，版面沒有變化時不會自行記錄。

屬性面板透過 `api.edit()` 送出這些操作。它保留點擊當下接受的畫布與 ID，在寫入階段解析仍然存在的節點，並提交一步復原。如果刪除或鎖定導致沒有任何變化，排隊中的操作會被取消，而不會把無關的待處理編輯一併捕捉進去。API 呼叫端也可以把 `AbortSignal` 傳給 `edit()`，在變更發生前取消。

## 其他圖形的 Transformer {#transformer-for-other-shapes}

到目前為止實作的 transformer 適用於圓、橢圓、矩形這類圖形，但不適用於直線、折線段或分段曲線，那些需要更多控制點。

### 直線的 Transformer {#transformer-for-line}

最後，直線只需要兩個錨點，因此前面介紹的、以包圍矩形為基礎的一連串操作可以大幅簡化。

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![直線的 Transformer](/line-transformer.gif)

<TransformerLine />

### 折線的 Transformer {#transformer-for-polyline}

對於折線，每個連接點都有對應的控制點，並在每一對相鄰控制點之間再插入一個點，以產生新的線段：

```ts
export class Transformable {
    @field.ref declare polylineMask: Entity;
    @field.object declare controlPoints: Entity[];
    @field.object declare segmentMidpoints: Entity[];
}
```

對應的互動是：滑鼠懸停在控制點上時，可以按 <kbd>Delete</kbd> 鍵刪除它。為了同時容納矩形 Transformer 的調整大小、旋轉，以及頂點編輯，也支援雙擊進入控制點編輯模式。

<TransformerPolyline />

### 路徑 {#transformer-for-path}

tldraw 提供了一個範例：[cubic-bezier-shape]。互動編輯需要解決兩個問題：

1. **穩定的可編輯點**：每個錨點與每個貝茲控制點都可以被選取與拖曳，變更會寫回 `d`。
2. **往返而不遺失語意**：盡可能使用一小組可預測的指令類型，並避免在編輯器裡手寫一套完整的路徑解析器。

因此我們把 `d` 正規化成一小套指令詞彙（例如把相對指令轉成絕對指令），再用**指令索引 + 陣列中的座標偏移**作為每個控制點的身分。拖曳時只改變數值座標；最後由 `path2String` 序列化回字串。

| 指令    | 產生的控制點 | `meta` 的意義                                                                                      |
| ------- | ------------ | --------------------------------------------------------------------------------------------------- |
| M / L   | 一個頂點     | `coordOffset: 1` → 該點 `(x, y)`                                                                    |
| Q       | 控制點 + 終點 | 偏移 `1` 與 `3`                                                                                     |
| C       | cp1、cp2、終點 | 偏移 `1`、`3`、`5`                                                                                  |
| A       | 僅終點       | 偏移 `6`（此編輯器中的弧線沒有貝茲控制點；只暴露端點）                                              |

```ts
interface PathControlHandleMeta {
    commandIndex: number; // Index in the normalized command array.
    coordOffset: number; // Start index of this handle’s coordinates (1-based, since `command[0]` is the command letter).
}

type HandlePoint = {
    x: number;
    y: number;
    meta: PathControlHandleMeta;
};
```

同樣地，雙擊即可進入控制點編輯模式。

<TransformerPath />

## 延伸閱讀 {#extended-reading}

-   [圖形編輯器開發：自訂游標]

[第 14 課]: /zh-Hant/guide/lesson-014
[限制拖曳與調整大小]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas 圖形的選取、調整大小與旋轉]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[變更旋轉原點]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[在 FigJam 中調整大小、旋轉與翻轉物件]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[微移圖層]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[如何旋轉 CSS 游標]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[圖形編輯器開發：自訂游標]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS 游標]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[檢查點是否在多邊形內]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - 二維點到線段]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[第 6 課 - 座標系統轉換]: /zh-Hant/guide/lesson-006#coordinates
[SerializedNode]: /zh-Hant/guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[變換時能否保持圖片長寬比？]: https://github.com/konvajs/react-konva/issues/407
[cubic-bezier-shape]: https://examples.tldraw.com/cubic-bezier-shape
