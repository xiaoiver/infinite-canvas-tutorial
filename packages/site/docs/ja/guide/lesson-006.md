---
outline: deep
description: '図形のピッキング、ドラッグ＆ドロップ、ジェスチャーを備えた、DOM 互換のイベントシステムを実装します。インタラクティブなキャンバスアプリケーションのために、ポインター、マウス、タッチのイベントを扱う方法を学びます。'
head:
    - ['meta', { property: 'og:title', content: '第6課 - イベントシステム' }]
---

# 第 6 課 - イベントシステム {#lesson-6-event-system}

この課では、次の内容を学びます。

-   DOM Event API と互換性のあるイベントシステムを実装します
-   円をピッキングする方法
-   このイベントシステムに基づくドラッグ＆ドロッププラグインを実装します
-   ピンチズームのジェスチャーに対応します

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

現在サポートしている操作は、キャンバス単位のものです。しかし今後は、個々の図形に対する編集機能も必ずサポートする必要があります。たとえばマウスで図形を選択するとき、キャンバス上のクリックイベントを検出したあと、どの図形が選ばれたのかをどう知るのでしょうか。次のコードのように、マウスが赤い円に入ったときと離れたときに、その色を変えたいのです。

```ts
sun.addEventListener('pointerenter', () => {
    sun.fill = 'green';
});
sun.addEventListener('pointerleave', () => {
    sun.fill = 'red';
});
```

これを実現するには、完全なイベントシステムを実装する必要があります。

## イベントシステムの設計 {#design-a-event-system}

イベントシステムを設計するときは、次の原則に従いたいと考えています。

-   DOM Event API と可能な限り揃えます。学習コストを下げるためだけでなく、ジェスチャーライブラリのような既存のエコシステムと統合するためでもあります。
-   標準イベントだけを提供します。ドラッグ＆ドロップやジェスチャーのような高度なイベントは、拡張によって定義します。

以下で紹介する実装は、すべて [PIXI.js Events Design Documents] に基づいており、PIXI.js v8 も今なおこれを使っています。詳細をさらに知りたい場合は、そのソースコードを読むことを勧めます。

### PointerEvent {#pointerevent}

ブラウザのインタラクティブイベント対応は、次の段階を経て発展してきました。詳しくは [The brief history of PointerEvent] を参照してください。

-   当初は、マウスイベントがサポートされていました。
-   モバイル機器が普及するとタッチイベントが現れ、同時にマウスイベントも発生するようになりました。
-   その後、ペンのような新しい入力デバイスが登場し、イベントの構造がまちまちになって、扱うのがかなり苦痛になりました。たとえば [hammer.js compatibility handling for various events] を参照してください。
-   上記の入力デバイスをすべてカバーすることを目指す、新しい標準 [PointerEvent] が提案されました。

![マウス、ポインター、タッチのイベント](/mouse-pointer-touch-events.png)

その結果、現在は Level 2 の [PointerEvent] をすべての主要なブラウザがサポートしています。Hammer.js は 2016 年からこれに対応しています。[hammer.js issue]。

![Can I Use の Pointer Events](/can-i-use-pointer-events.png)

そこで Mouse / Touch / PointerEvent を正規化したいのです。期待する使い方は次のとおりです。

```ts
circle.addEventListener('pointerdown', (e) => {
    e.target; // circle
    e.preventDefault();
    e.stopPropagation();
});
```

### DOMEventListener {#domeventlistener}

まず、キャンバス上の一連のインタラクティブイベントをリッスンする必要があり、これもプラグインの実装で行います。

```ts
export class DOMEventListener implements Plugin {}
```

現在の環境が Pointer イベントと Touch イベントをサポートしているかを、次のように検出します。

```ts
const supportsPointerEvents = !!globalThis.PointerEvent;
const supportsTouchEvents = 'ontouchstart' in globalThis;
```

現在の環境が PointerEvent をサポートしていれば、リッスンを始められます。すべてのイベントを `HTMLCanvasElement` でリッスンできるわけではありません。たとえば `pointermove` イベントのリスナーは、`window` か `document` に結び付ける必要があります。そうしないと、キャンバスの DOM 要素の外でイベントが起きたときに検出できません。

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

PointerEvent をサポートしていない場合は、MouseEvent のリッスンへ切り替えます。ただし `onPointerDown` のような処理関数を呼び出し、内部では対応するフック関数を発火します。

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

キャンバスにフックをさらに追加します。リスナープラグインがこれらのフックをトリガーし、その後のイベントシステム処理プラグインがそれらに応答します。

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

### 図形へリスナーを追加する {#add-listeners-to-shape}

基本となる図形クラスは、`on`、`once`、`off` メソッドを提供する `EventEmitter` を拡張する必要があります。

```ts
import EventEmitter from 'eventemitter3';
export abstract class Shape
    extends EventEmitter
    implements FederatedEventTarget {}
```

[addEventListener] を例にすると、既存のメソッドを使って DOM API の標準に合わせて実装する必要があります。たとえば一度だけ発火させたいイベントリスナーは、登録時に [once] パラメータで指定します。

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

紙幅の都合で、他のメソッドはここでは詳しく述べません。詳細な実装は PIXI.js のソースコードを参照できます。

-   イベントリスナーを削除する `removeEventListener`
-   すべてのイベントリスナーを削除する `removeAllListeners`
-   カスタムイベントを送出する `dispatchEvent`

これで、次の API を使ってイベントをリッスンできます。次に、リスナーへ渡されるイベントオブジェクト `e` を実装する必要があります。

```ts
circle.addEventListener('pointerenter', (e) => {
    circle.fill = 'green';
});
```

### イベントオブジェクト {#event-object}

DOM Event API に完全に従うため、PIXI.js は汎用性を表す `FederatedEvent` を使い、これで [UIEvent] インターフェースを実装できます。一部のメソッドは、`preventDefault` のようにネイティブイベントを直接呼び出せます。

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

では、ネイティブのイベントオブジェクトを `FederatedEvent` へどう変換するのでしょうか。PIXI.js は、まずそれらを `PointerEvent` の形へ整えます。特に `TouchEvent` のマルチタッチでは、`changedTouches` の各 Touch オブジェクトを、別々の `PointerEvent` にします。

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

次に、`PointerEvent` を `FederatedPointerEvent` へ変換する必要があります。

```ts
function bootstrapEvent(
    event: FederatedPointerEvent,
    nativeEvent: PointerEvent,
): FederatedPointerEvent {}
```

属性のほとんどはネイティブイベントからそのままコピーできますが、特別な扱いが必要なプロパティが 2 種類あります。

-   キャンバス座標系における、イベントの位置。
-   [target] イベント送出の対象オブジェクト、つまりキャンバス上のどのグラフィックオブジェクトでイベントが起きるか。

まず、1 種類目のプロパティを見ます。

### 座標 {#coordinates}

「位置」と言うときは、必ずある座標系に対する相対的な値です。Client、Screen、Page は、ブラウザが標準でサポートする座標系です。私たちは、キャンバスとビューポートという 2 つの座標系を追加しました。

Canvas 座標系は、ブラウザの Screen 座標系にたとえることができ、ワールド座標系とも呼ばれます。グラフィックを作るときに指定する位置は、すべてこの座標系に対する相対値です。原点はキャンバス DOM 要素の左上で、X 軸の正方向は画面の右、Y 軸の正方向は画面の下を向きます。これも「ワールド座標系」と呼ばれ、回転を扱うときは、座標軸の正方向に沿った時計回りを回転方向とします。

Viewport 座標系は、ブラウザの Client 座標系にたとえることができます。カメラは、私たちが世界を見る角度を決めます。カメラが動いていなければ、Viewport 座標系と Canvas 座標系は完全に一致します。したがって、見える範囲ではビューポート左上の座標は Canvas 座標系の原点と同じで、どちらも `[0, 0]` です。しかしカメラが移動、回転、ズームするとビューポートもそれに応じて変わり、このときビューポート左上の `[0, 0]` に対応する Canvas 座標系の位置は、もはや `[0, 0]` ではありません。

両者を変換するメソッドを用意し、プラグインのコンテキストに組み込みます。

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

その後のイベント処理に進む前に、ネイティブイベントの座標をビューポート座標系へ変換し、さらにワールド座標系へ変換します。これは `Event` プラグインの中で行います。

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

これで、イベントオブジェクト上の座標が定まります。「イベントがどのグラフィックオブジェクトで起きるか」という問題はいったん脇に置き、まず完全なイベント伝播の過程をどう実装するかを見ます。

### イベントの伝播過程 {#event-propagation-process}

DOM のイベントフローに慣れた開発者なら、次の概念はすぐに分かるはずです。

-   イベントオブジェクトの `target` プロパティは対象要素を指します。DOM API では当然 DOM 要素であり、私たちのキャンバスでは特定のグラフィックオブジェクトです。次の節で紹介します。
-   イベントフローにはキャプチャ段階とバブリング段階があり、イベントオブジェクトの一部のメソッドでこれらの段階に介入できます。
-   特定のイベントに 1 つ以上のリスナーを追加でき、登録した順に発火します。

[Bubbling and capturing] は、イベント伝播の 3 つの段階を示しています。キャプチャ段階ではリスナーが上から下へ呼び出され、ターゲットノードに達したあと上へバブリングします。リスナーの中では `eventPhase` で現在の段階を取得できます。

![イベントフロー](https://javascript.info/article/bubbling-and-capturing/eventflow.svg)

PIXI.js はこれらを `EventBoundary` で実装しています。

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

## ピッキング {#picking}

イベントがどのグラフィックオブジェクトの中で起きるのかは、ピッキング機能で判断します。DOM API は [elementsFromPoint] メソッドを提供し、ビューポート座標系における指定点に対応する要素のリストを返します。しかし私たちは SVG レンダラーを使っていないので、このメソッドは使えません。選択肢は次の 2 つです。

-   幾何学的な方法。たとえば、点が円の内側にあるかを判定します。
-   GPU の色エンコードに基づく方法。これは後で詳しく扱います。

ピッキングの基準という観点では、グラフィックの可視性、ストローク、塗りなどをすべて考慮できます。CSS が [pointer-events] プロパティを提供するのと似ています。グラフィックの基底クラスにも `pointerEvents` プロパティを追加します。

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

### ピッキングプラグイン {#picking-plugin}

ルートノードからシーングラフを走査し、ワールド座標系の点がグラフィックオブジェクトの内側にあるかを順に判定するピッキングプラグインを作ります。ヒットした項目はリストの先頭に追加する必要がある点に注意してください。後から描画される要素は、描画順のために、より上のレイヤーに現れるからです。もちろん後には、描画順を調整する `zIndex` 属性を導入します。

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

判定の最初のステップは、対象の点をワールド座標系からモデル座標系へ変換することです。モデル変換行列の逆行列を使って行います。モデル座標系へ変換すると、その後の幾何判定の方法を最大限に単純化できます。

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

ここで `containsPoint` メソッドを実装します。

### 幾何学的な方法 {#geometric-method}

点が円の内側にあるかを判定するには、おなじみの Signed Distance Field（SDF）を使えます。今回は `strokeWidth` と `pointerEvents` 属性も考慮に入れます。

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

うまくいっているように見えますが、毎回シーングラフのルートノードから走査を始める必要があります。シーン内のグラフィックオブジェクトが多いと、イベントが頻繁に発火するときのコストは大きくなります。次の課では、関連する最適化の方法を紹介します。

### hitArea {#hitarea}

グラフィックのインタラクティブ領域を変えたいことがあります。グラフィックが小さいときにクリックしやすいよう少し広げたり、実体を持たない `Group` にインタラクティブ領域を追加したりする場合です。

```ts
export interface FederatedEventTarget {
    hitArea?: Rectangle;
}
```

以前作った `CameraControl` プラグインを変更できます。まずルートノードに、無限に大きいインタラクティブ領域を追加します。ここで矩形の左上座標を `[-Infinity, -Infinity]` に直接設定してはいけません。そうすると幅と高さの計算が `NaN` になり、その後の判定ができなくなるからです。

```ts
root.hitArea = new Rectangle(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    Infinity,
);
```

ネイティブの MouseEvent ではなく、`FederatedPointerEvent` をリッスンします。

```ts
canvas.addEventListener('mousedown', (e: MouseEvent) => {}); // [!code --]
root.addEventListener('pointerdown', (e: FederatedPointerEvent) => {}); // [!code ++]
```

### hitStrokeWidth {#hit-stroke-width}

`Line`、`Polyline`、`Path` では、`strokeWidth` が小さすぎると操作しにくくなります。Konva はインタラクティブ領域を広げるために `hitStrokeWidth` を提供しています。[What is hitStrokeWidth?] を参照してください。

私たちもこのプロパティ名を使います。

### API によるピッキング {#picking-with-api}

ピッキングは、インタラクティブイベントを通じて行うだけでなく、[elementsFromPoint] のように明示的に呼び出せる API として公開することもできます。次の節でドラッグ＆ドロッププラグインを実装するときに、これを使います。

```ts
class Canvas {
    elementsFromPoint(x: number, y: number): Shape[] {}
    elementFromPoint(x: number, y: number): Shape {}
}
```

## ドラッグ＆ドロッププラグイン {#dragndrop-plugin}

[Drag'n'Drop with mouse events] を参考に、PointerEvent でドラッグ＆ドロッププラグインを実装できます。

```ts
export class Dragndrop implements Plugin {}
```

「ドラッグ開始」と判定する条件として、ドラッグ距離と時間にそれぞれ基づく次の設定項目を用意します。これらの条件がすべて満たされたときにだけ、`dragstart` のような一連のドラッグ＆ドロップイベントが発火します。

-   `dragstartDistanceThreshold`: この設定項目は、ドラッグ距離の検出しきい値をピクセル単位で設定します。この値より大きい距離だけを、有効な開始とみなします。既定値は `0` です。
-   `dragstartTimeThreshold`: この設定項目は、ドラッグ時間の検出しきい値をミリ秒単位で設定します。このしきい値より長い時間だけを、有効な開始とみなします。既定値は `0` です。

HTML Drag and Drop API の実装では、同じ操作に対して `click` イベントか `drag` イベントのどちらか一方だけが発火し、両方が発火することはありません。この挙動は、示されている [例](https://plnkr.co/edit/5mdl7oTg0dPWXIip) から分かります。

実装でもこの設定を残します。`dragend` イベントのあとには `click` イベントを発火させません。これは、ユーザーがドラッグ可能な要素を通常どのように理解し、操作するかに沿っています。ドラッグとクリックを明確に区別するので、一貫して予測できる挙動になり、ユーザー体験がよくなります。

```ts
if (!e.detail.preventClick) {
    this.dispatchEvent(clickEvent, 'click');
}
```

## CameraControl プラグインの変更 {#modify-cameracontrol-plugin}

ドラッグ機能で `CameraControl` プラグインを実装するには、まずルートノードをドラッグ可能にし、そのあと `pointerdown` などのイベントをリッスンしていた箇所を、ドラッグ関連のイベントのリッスンへ切り替えます。

```ts
root.draggable = true;
root.addEventListener('dragstart', (e: FederatedPointerEvent) => {});
root.addEventListener('drag', (e: FederatedPointerEvent) => {});
root.addEventListener('dragend', (e: FederatedPointerEvent) => {});
```

現在、カメラはジェスチャー操作に対応していません。マウスホイールでキャンバスをズームするのに加えて、[pixi-viewport] のように、2 本指の操作で一般的な `pinch` ジェスチャーを追加したいのです。

### ピンチジェスチャーへの対応 {#support-pinch-gesture}

PC で開発しているときにジェスチャーイベントをシミュレートするには、[hammer.js] エコシステムの一部である [hammer-touchemulator] を使えます。マウスと <kbd>Shift</kbd> キーを併用すると、複数の PointerEvent が発火する状況をエミュレートできます。もちろん Xcode の iOS シミュレータを使うこともでき、2 本指のピンチズームのようなジェスチャー操作を試せます。[Interacting with your app in the iOS and iPadOS simulator]

> 2 本指のピンチ、ズーム、回転: Option キーを押しながらクリックしてドラッグします。

`pointerdown` イベントをリッスンするときに、各タッチオブジェクトの位置を保存します。

```ts
this.#touches[event.pointerId] = { last: null };
```

`pointermove` イベントをリッスンするときは、2 つのタッチ点の間の距離を記録し、前回の距離と比較します。2 点が近づくとズームアウトに対応し、離れるとズームインに対応します。

```ts
zoomByPoint(point.x, point.y, (last / dist - 1) * PINCH_FACTOR);
```

iOS シミュレータでの効果は次のとおりです。

![iOS シミュレータでのピンチ](/pinch-ios-simulator.gif)

### use-gesture {#use-gesture}

[@use-gesture/vanilla] のように、すぐに使えるジェスチャーライブラリを使うこともできます。2 本指のピンチズームはカメラのズームイン／ズームアウトに対応し、2 本指のスワイプはカメラのパンに対応します。

```ts
import { Gesture } from '@use-gesture/vanilla';

const gesture = new Gesture(element as HTMLCanvasElement, {
    // camera zoom in/out
    onPinch: ({ event, first, last, da, origin }) => {},
});
```

## さらに読む {#extended-reading}

-   [The brief history of PointerEvent]
-   [Bubbling and capturing]
-   [Drag'n'Drop with mouse events]:

[The brief history of PointerEvent]: https://javascript.info/pointer-events#the-brief-history
[hammer.js compatibility handling for various events]: https://github.com/hammerjs/hammer.js/tree/master/src/input
[hammer.js issue]: https://github.com/hammerjs/hammer.js/issues/946
[PointerEvent]: https://www.w3.org/TR/pointerevents2/
[PIXI.js Events Design Documents]: https://docs.google.com/document/d/1RyXrhrcZly2oPHPApKahE8pC7mEIDvuCPbE9VeYvmZw/edit
[addEventListener]: https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
[pointer-events]: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
[elementsFromPoint]: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint
[Interacting with your app in the iOS and iPadOS simulator]: https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-the-ios-or-ipados-simulator#Interact-with-your-interface
[pixi-viewport]: https://github.com/davidfig/pixi-viewport
[hammer-touchemulator]: https://github.com/hammerjs/touchemulator
[hammer.js]: https://hammerjs.github.io/
[UIEvent]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/UIEvent
[once]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#once
[target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target
[Bubbling and capturing]: https://javascript.info/bubbling-and-capturing#capturing
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[What is hitStrokeWidth?]: https://konvajs.org/docs/events/Custom_Hit_Region.html#2-what-is-hitstrokewidth
[@use-gesture/vanilla]: https://github.com/pmndrs/use-gesture
