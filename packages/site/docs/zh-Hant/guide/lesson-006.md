---
outline: deep
description: '實作與 DOM 相容的事件系統，包含圖形拾取、拖放功能與手勢支援。學習如何處理指標、滑鼠與觸控事件，以打造互動式畫布應用程式。'
head:
    - ['meta', { property: 'og:title', content: '第 6 課 - 事件系統' }]
---
# 第 6 課 - 事件系統 {#lesson-6-event-system}

在本課中，你將學到以下內容：

-   實作與 DOM Event API 相容的事件系統
-   如何拾取圓形
-   基於我們的事件系統實作拖放外掛
-   支援捏合縮放手勢

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson6;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson6;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
        cursor: 'pointer',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    sun.addEventListener('pointerenter', () => {
        sun.fill = 'green';
    });
    sun.addEventListener('pointerleave', () => {
        sun.fill = 'red';
    });

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

目前我們支援的互動都在畫布層級。不過，將來一定需要支援針對個別圖形的編輯功能。例如，用滑鼠選取圖形時，在畫布上偵測到點擊事件之後，如何知道選到的是哪一個圖形？我們希望在滑鼠進入或離開紅色圓形時改變它的顏色，如下面的程式所示：

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

這需要實作一套完整的事件系統。

## 設計事件系統 {#design-a-event-system}

設計事件系統時，我們希望遵循以下原則：

-   盡可能與 DOM Event API 保持一致，這不僅能降低學習曲線，也能與既有生態系（例如手勢函式庫）整合。
-   只提供標準事件。拖放與手勢這類進階事件應透過擴充來定義。

下面介紹的實作完全基於 [PIXI.js 事件設計文件]，PIXI.js v8 仍在使用它。若想深入細節，鼓勵你閱讀它的原始碼。

### PointerEvent {#pointerevent}

瀏覽器對互動事件的支援經歷了以下階段，更多細節見：[PointerEvent 簡史]

-   最初提供對滑鼠事件的支援。
-   隨著行動裝置普及，觸控事件出現，同時也會觸發滑鼠事件。
-   後來引入了新的輸入裝置，例如觸控筆，造成事件結構五花八門，處理起來相當痛苦。例如見 [hammer.js 對各類事件的相容性處理]。
-   提出了新標準 [PointerEvent]，目標是涵蓋上述所有輸入裝置。

![滑鼠、指標與觸控事件](/mouse-pointer-touch-events.png)

因此，Level 2 [PointerEvent] 現在已獲所有主流瀏覽器支援。Hammer.js 自 2016 年起支援它，見 [hammer.js 問題]。

![Can I Use 上的 Pointer Events](/can-i-use-pointer-events.png)

所以我們想把 Mouse / Touch / PointerEvent 正規化。預期用法如下：

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### DOMEventListener {#domeventlistener}

首先，我們需要在畫布上監聽一系列互動事件，仍然透過外掛來實作：

```ts
export class DOMEventListener implements Plugin {}
```

偵測目前環境是否支援 Pointer 與 Touch 事件：

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

一旦目前環境支援 PointerEvent，就可以開始監聽。必須注意，並非所有事件都能在 `HTMLCanvasElement` 上監聽。例如，`pointermove` 事件的監聽器必須繫結到 `window` 或 `document`。否則，如果事件在畫布 DOM 元素之外觸發，就偵測不到。

```ts
const addPointerEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('pointermove', onPointerMove, true);
    $el.addEventListener('pointerdown', onPointerDown, true);
    $el.addEventListener('pointerleave', onPointerOut, true);
    $el.addEventListener('pointerover', onPointerOver, true);
    globalThis.addEventListener('pointerup', onPointerUp, true);
    globalThis.addEventListener('pointercancel', onPointerCancel, true);
};
```

如果不支援 PointerEvent，就改為監聽 MouseEvent，但它會呼叫 `onPointerDown` 這類處理函式，並在內部觸發對應的鉤子函式：

```ts
const addMouseEventListener = ($el: HTMLCanvasElement) => {
    globalThis.document.addEventListener('mousemove', onPointerMove, true);
    $el.addEventListener('mousedown', onPointerDown, true);
    $el.addEventListener('mouseout', onPointerOut, true);
    $el.addEventListener('mouseover', onPointerOver, true);
    globalThis.addEventListener('mouseup', onPointerUp, true);
};
const onPointerMove = (ev: InteractivePointerEvent) => {
    hooks.pointerMove.call(ev);
};
const onPointerUp = (ev: InteractivePointerEvent) => {
    hooks.pointerUp.call(ev);
};
```

我們為畫布加入更多鉤子，讓監聽用的外掛去觸發它們，後續的事件系統處理外掛則會回應它們：

```ts
export interface Hooks {
    pointerDown: SyncHook<[InteractivePointerEvent]>;
    pointerUp: SyncHook<[InteractivePointerEvent]>;
    pointerMove: SyncHook<[InteractivePointerEvent]>;
    pointerOut: SyncHook<[InteractivePointerEvent]>;
    pointerOver: SyncHook<[InteractivePointerEvent]>;
    pointerWheel: SyncHook<[InteractivePointerEvent]>;
    pointerCancel: SyncHook<[InteractivePointerEvent]>;
}
```

### 為圖形加入監聽器 {#add-listeners-to-shape}

我們的基礎圖形類別應擴充 `EventEmitter`，它提供 `on`、`once`、`off` 方法：

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

以 [addEventListener] 為例，我們需要用既有方法依照 DOM API 標準來實作。例如，若事件監聽器只打算觸發一次，就在註冊時使用 [once] 參數指定：

```ts{10}
export abstract class Shape {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const once = isObject(options) && options.once;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }
}
```

由於篇幅限制，其他方法這裡不再展開。詳細實作可以參考 PIXI.js 原始碼：

-   `removeEventListener` 用於移除事件監聽器
-   `removeAllListeners` 用於移除所有事件監聽器
-   `dispatchEvent` 用於派發自訂事件

這樣我們就可以用下面的 API 監聽事件。接下來需要實作傳給監聽器的事件物件 `e`：

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### 事件物件 {#event-object}

為了完全符合 DOM Event API，PIXI.js 使用 `FederatedEvent` 來體現它的通用性，讓它能實作 [UIEvent] 介面。有些方法可以直接呼叫原生事件，例如 `preventDefault`。

```ts
export class FederatedEvent<N extends UIEvent | PixiTouch = UIEvent | PixiTouch>
    implements UIEvent
{
    preventDefault(): void {
        if (this.nativeEvent instanceof Event && this.nativeEvent.cancelable) {
            this.nativeEvent.preventDefault();
        }

        this.defaultPrevented = true;
    }
}
```

那麼要如何把原生事件物件轉換成 `FederatedEvent`？PIXI.js 會先把它們格式化成 `PointerEvent`。特別是 `TouchEvent` 中的多點觸控，`changedTouches` 裡的每個 Touch 物件都會被格式化成獨立的 `PointerEvent`。

```ts
function normalizeToPointerEvent(
    event: InteractivePointerEvent,
): PointerEvent[] {
    if (supportsTouchEvents && event instanceof TouchEvent) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i] as PixiTouch;
        }
    }
}
```

接著需要把 `PointerEvent` 轉換成 `FederatedPointerEvent`。

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

大多數屬性可以直接從原生事件複製，但有兩類屬性需要特別處理：

-   事件在畫布座標系中的位置。
-   [target] 事件派發的目標物件，也就是事件發生在畫布上的哪一個圖形物件。

讓我們先看第一類屬性。

### 座標 {#coordinates}

當我們說「位置」時，它總是相對於某個座標系。Client、Screen 與 Page 是瀏覽器原生支援的座標系。我們新增了兩個座標系：canvas 與 viewport。

Canvas 座標系可以類比瀏覽器的 Screen 座標系，也稱為世界座標系。建立圖形時指定的位置都相對於這個座標系。它以畫布 DOM 元素的左上角為原點，X 軸指向螢幕右方，Y 軸指向螢幕下方。它也被稱為「世界座標系」；說到旋轉時，我們把旋轉方向定為沿座標軸正方向的順時針。

Viewport 座標系可以類比瀏覽器的 Client 座標系。相機決定我們觀察世界的角度。如果相機沒有移動，Viewport 座標系與 Canvas 座標系會完全重合。因此，在可見範圍內，視埠左上角的座標與 Canvas 座標系的原點相同，都是 `[0, 0]`。但如果相機移動、旋轉或縮放了，視埠會跟著改變，此時視埠中的左上角 `[0, 0]` 會對應到 Canvas 座標系中不同於 `[0, 0]` 的位置。

我們提供它們的轉換方法，並放進外掛的 context：

```ts
interface PluginContext {
    api: {
        client2Viewport({ x, y }: IPointData): IPointData;
        viewport2Client({ x, y }: IPointData): IPointData;
        viewport2Canvas({ x, y }: IPointData): IPointData;
        canvas2Viewport({ x, y }: IPointData): IPointData;
    };
}
```

在進行後續事件處理之前，我們把座標從原生事件轉換到視埠座標系，再轉換到世界座標系。這是在 `Event` 外掛中完成的：

```ts
export class Event implements Plugin {
    private bootstrapEvent(
        event: FederatedPointerEvent,
        nativeEvent: PointerEvent,
    ): FederatedPointerEvent {
        const { x, y } = this.getViewportXY(nativeEvent);
        event.client.x = x;
        event.client.y = y;
        const { x: canvasX, y: canvasY } = this.viewport2Canvas(event.client);
        event.screen.x = canvasX;
        event.screen.y = canvasY;
    }
}
```

這樣一來，事件物件上的座標就建立好了。暫時略過「事件發生在哪一個圖形物件上」這個問題，先看看如何實作完整的事件傳播過程。

### 事件傳播過程 {#event-propagation-process}

熟悉 DOM 事件流的開發者一定認得以下概念：

-   事件物件的 `target` 屬性指向目標元素。在 DOM API 的情境中，它自然是 DOM 元素；而在我們的畫布中，它是特定的圖形物件。下一節會介紹這一點。
-   事件流包含捕獲與冒泡兩個階段，事件物件上的某些方法可以介入這些階段。
-   可以為特定事件加入一個或多個監聽器，它們會依註冊順序觸發。

[冒泡與捕獲] 展示了事件傳播的三個階段：在捕獲階段，監聽器由上而下依序觸發，到達目標節點後再向上冒泡。在監聽器中可以使用 `eventPhase` 取得目前階段。

![事件流程](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

PIXI.js 在 `EventBoundary` 中實作了這些過程。

```ts
propagate(e: FederatedEvent, type?: string): void {
  const composedPath = e.composedPath();

  // Capturing phase
  e.eventPhase = e.CAPTURING_PHASE;
  for (let i = 0, j = composedPath.length - 1; i < j; i++) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }

  // At target phase
  e.eventPhase = e.AT_TARGET;
  e.currentTarget = e.target;
  this.notifyTarget(e, type);
  if (e.propagationStopped || e.propagationImmediatelyStopped) return;

  // Bubbling phase
  e.eventPhase = e.BUBBLING_PHASE;
  for (let i = composedPath.length - 2; i >= 0; i--) {
    e.currentTarget = composedPath[i];
    this.notifyTarget(e, type);
    if (e.propagationStopped || e.propagationImmediatelyStopped) return;
  }
}
```

## 拾取 {#picking}

判斷事件發生在哪一個圖形物件中，是透過拾取功能完成的。DOM API 提供 [elementsFromPoint] 方法，回傳視埠座標系下對應指定點的元素清單。不過，由於我們沒有使用 SVG 渲染器，這個方法並不適用。我們有以下兩種選擇：

-   幾何方法。例如判斷一個點是否在圓內。
-   基於 GPU 色彩編碼的方法。稍後會詳細說明。

從拾取條件來看，圖形的可見性、描邊與填色都可以納入考慮，類似 CSS 提供的 [pointer-events] 屬性。我們也在圖形的基礎類別上加入 `pointerEvents` 屬性：

```ts{2}
export abstract class Shape {
  pointerEvents: PointerEvents = 'auto';
}

type PointerEvents =
  | 'none'
  | 'auto'
  | 'stroke'
  | 'fill'
  | 'painted'
  | 'visible'
  | 'visiblestroke'
  | 'visiblefill'
  | 'visiblepainted'
  | 'all'
  | 'non-transparent-pixel';
```

### 拾取外掛 {#picking-plugin}

建立一個拾取外掛，從根節點開始走訪場景圖，依序判斷世界座標系下的點是否落在某個圖形物件內。必須注意，命中時要把該項目加到清單的最前面，因為後渲染的元素由於繪製順序會出現在較高的圖層。當然，之後我們會引入 `zIndex` 屬性來調整渲染順序。

```ts{10}
export class Picker implements Plugin {
  private pick(result: PickingResult, root: Group) {
    const {
      position: { x, y },
    } = result;

    const picked: Shape[] = [];
    traverse(root, (shape: Shape) => {
      if (this.hitTest(shape, x, y)) {
        picked.unshift(shape);
      }
    });

    result.picked = picked;
    return result;
  }
}
```

偵測時，第一步是把目標點從世界座標系轉換到模型座標系，這是透過模型變換矩陣的逆矩陣完成的。轉換到模型座標系能最大程度簡化後續的幾何判斷方法：

```ts
export class Picker implements Plugin {
    private hitTest(shape: Shape, wx: number, wy: number): boolean {
        // skip testing
        if (shape.pointerEvents === 'none') {
            return false;
        }

        shape.worldTransform.applyInverse({ x: wx, y: wy }, tempLocalMapping);
        const { x, y } = tempLocalMapping;
        return shape.containsPoint(x, y);
    }
}
```

現在來實作 `containsPoint` 方法。

### 幾何方法 {#geometric-method}

要判斷一個點是否在圓內，可以使用熟悉的有號距離場（SDF）方法，但這次也要考慮 `strokeWidth` 與 `pointerEvents` 屬性：

```ts
class Circle {
    containsPoint(x: number, y: number) {
        const halfLineWidth = this.#strokeWidth / 2;
        const absDistance = vec2.length([this.#cx - x, this.#cy - y]);

        const [hasFill, hasStroke] = isFillOrStrokeAffected(
            this.pointerEvents,
            this.#fill,
            this.#stroke,
        );
        if (hasFill) {
            return absDistance <= this.#r;
        }
        if (hasStroke) {
            return (
                absDistance >= this.#r - halfLineWidth &&
                absDistance <= this.#r + halfLineWidth
            );
        }
        return false;
    }
}
```

看起來不錯，但它每次都必須從場景圖的根節點開始走訪。如果場景中有大量圖形物件，事件頻繁觸發時成本就很可觀。下一課會介紹相關的最佳化方法。

### hitArea {#hitarea}

有時我們會想改變圖形的互動區域，例如圖形很小時稍微放大以便點擊，或是為沒有實體的 `Group` 加上互動區域。

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

我們可以修改先前建立的 `CameraControl` 外掛，先為根節點加上一塊無限大的互動區域。這裡不能直接把矩形的左上角座標設為 `[-Infinity, -Infinity]`，因為這樣會讓寬度與高度的計算變成 `NaN`，導致後續偵測無法進行：

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

我們改為監聽 `FederatedPointerEvent`，而不是原生的 MouseEvent。

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### hitStrokeWidth {#hit-stroke-width}

對於 `Line`、`Polyline` 與 `Path`，太小的 `strokeWidth` 會讓互動變得困難。Konva 提供 `hitStrokeWidth` 來擴大互動區域，見 [什麼是 hitStrokeWidth？]

我們也使用這個屬性名稱。

### 透過 API 拾取 {#picking-with-api}

拾取功能不只可以透過互動事件達成，也可以公開成 API 供明確呼叫，類似 [elementsFromPoint]。下一節實作拖放外掛時會用到。

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

## 拖放外掛 {#dragndrop-plugin}

我們可以依照 [使用滑鼠事件進行拖放]，用 PointerEvent 實作一個拖放外掛。

```ts
export class Dragndrop implements Plugin {}
```

為了判斷何時開始「drag start」，提供了以下設定選項，分別依據拖曳距離與時間。只有完全滿足這些條件時，才會觸發 `dragstart` 等一系列拖放事件。

-   `dragstartDistanceThreshold`：這個設定項目用來設定拖曳距離的偵測閾值，單位是像素。只有大於這個值的距離才會被視為有效的開始。預設值是 `0`。
-   `dragstartTimeThreshold`：這個設定項目用來設定拖曳時間的偵測閾值，單位是毫秒。只有大於這個閾值的時間才會被視為有效的開始。預設值是 `0`。

在 HTML Drag and Drop API 的實作中，同一個動作只會觸發 `click` 事件或 `drag` 事件，不會兩者都觸發。這個行為可以從提供的 [範例](https://plnkr.co/edit/5mdl7oTg0dPWXIip) 看出。

在你的實作中保留這個設定，也就是 `dragend` 事件之後不再觸發 `click` 事件，符合使用者對可拖曳元素的一般理解與互動方式。這種做法能確保行為一致且可預期，清楚區分拖曳與點擊，從而提升使用體驗。

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## 修改 CameraControl 外掛 {#modify-cameracontrol-plugin}

要用拖曳功能實作 `CameraControl` 外掛，你可以先讓根節點可拖曳，再把監聽從 `pointerdown` 之類的事件，改為監聽與拖曳相關的事件。

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

目前我們的相機不支援手勢操作。除了用滑鼠滾輪縮放畫布，我們還想加入常見的雙指 `pinch` 手勢，類似 [pixi-viewport]。

### 支援捏合手勢 {#support-pinch-gesture}

在 PC 上開發時，若要模擬手勢事件，可以使用 [hammer-touchemulator]，它是 [hammer.js] 生態系的一部分。搭配滑鼠與 <kbd>Shift</kbd> 鍵，就能模擬觸發多個 PointerEvent。當然，你也可以使用 Xcode 中的 iOS 模擬器，它允許測試手勢互動，例如雙指捏合縮放。[在 iOS 與 iPadOS 模擬器中與 App 互動]

> 雙指捏合、縮放或旋轉：按住 Option 鍵並點擊拖曳。

監聽 `pointerdown` 事件時，儲存每個觸控物件的位置。

```ts
this.#touches[event.pointerId] = { last: null };
```

監聽 `pointermove` 事件時，記錄兩個觸控點之間的距離，並與前一次的距離比較。兩點靠近對應縮小，兩點分開對應放大。

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

以下是 iOS 模擬器上的效果。

![iOS 模擬器中的捏合](/pinch-ios-simulator.gif)

### use-gesture {#use-gesture}

我們也可以使用現成的手勢函式庫，例如 [@use-gesture/vanilla]。雙指捏合縮放對應相機的放大／縮小，雙指滑動對應相機的平移。

```ts
import { Gesture } from '@use-gesture/vanilla';

const gesture = new Gesture(element as HTMLCanvasElement, {
    // camera zoom in/out
    onPinch: ({ event, first, last, da, origin }) => {},
});
```

## 延伸閱讀 {#extended-reading}

-   [PointerEvent 簡史]
-   [冒泡與捕獲]
-   [使用滑鼠事件進行拖放]:

[PointerEvent 簡史]: https://javascript.info/pointer-events#the-brief-history
[hammer.js 對各類事件的相容性處理]: https://github.com/hammerjs/hammer.js/tree/master/src/input
[hammer.js 問題]: https://github.com/hammerjs/hammer.js/issues/946
[PointerEvent]: https://www.w3.org/TR/pointerevents2/
[PIXI.js 事件設計文件]: https://docs.google.com/document/d/1RyXrhrcZly2oPHPApKahE8pC7mEIDvuCPbE9VeYvmZw/edit
[addEventListener]: https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[elementsFromPoint]: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
[在 iOS 與 iPadOS 模擬器中與 App 互動]: https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-the-ios-or-ipados-simulator#Interact-with-your-interface
[pixi-viewport]: https://github.com/davidfig/pixi-viewport
[hammer-touchemulator]: https://github.com/hammerjs/touchemulator
[hammer.js]: https://hammerjs.github.io/
[UIEvent]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/UIEvent
[once]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once
[target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
[冒泡與捕獲]: https://javascript.info/bubbling-and-capturing#capturing
[使用滑鼠事件進行拖放]: https://javascript.info/mouse-drag-and-drop
[什麼是 hitStrokeWidth？]: https://konvajs.org/docs/events/Custom_Hit_Region.html#2-what-is-hitstrokewidth
[@use-gesture/vanilla]: https://github.com/pmndrs/use-gesture
