---
outline: deep
description: 'zIndex と sizeAttenuation プロパティを含むキャンバスモードと補助 UI を実装します。キャンバス操作用のハンドモードと、プロパティパネルで図形を編集する選択モードを追加します。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第14課 - キャンバスモードと補助 UI',
          },
      ]
---

# 第 14 課 - キャンバスモードと補助 UI {#lesson-14-canvas-mode-and-auxiliary-ui}

これまでに Web Components で、カメラのズームや画像のダウンロードを含むいくつかのキャンバス UI コンポーネントを実装しました。この課では、コンポーネントを通じてより多くのキャンバス機能を公開し、新しい描画プロパティを実装します。

-   `zIndex` と `sizeAttenuation` という描画プロパティの実装
-   ハンドモードでキャンバスを移動、回転、ズームする
-   選択モードで図形を選択し、ドラッグして移動し、図形のプロパティパネルを表示する

キャンバスモードを実装する前に、`zIndex` と `sizeAttenuation` という描画プロパティをサポートするための準備が必要です。

## zIndex の実装 {#z-index}

図形を選択したあとに表示するマスクレイヤーは、すべての図形より上に表示する必要があります。これは表示順の話であり、`zIndex` で制御します。

```ts
mask.zIndex = 999;
```

CSS の [z-index] では、値は同じ [Stacking context] の中でだけ意味を持ちます。たとえば下の図では、`DIV #4` の `z-index` が `DIV #1` より高くても、`DIV #3` のコンテキストにあるため、より下にレンダリングされます。

![z-index を理解する](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

ソートはパフォーマンスコストが非常に大きい処理なので、Shape に `sortDirtyFlag` プロパティを追加し、`zIndex` が変わるたびに `true` にします。

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

`appendChild` と `removeChild` のときも、これを考慮する必要があります。

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

次に、レンダリングループの各ティックでダーティチェックを行い、必要ならソートします。`children` を直接変えたくはないので、ソート結果は `sorted` に保存します。`z-index` はレンダリング順だけに影響し、シーングラフ上の実際の順序には影響しないようにしたいからです。

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

`sortByZIndex` の実装は次のとおりです。`zIndex` が設定されていれば降順にソートし、そうでなければ親ノード内の元の順序を保ちます。ここで `children` を変えない理由も分かります。それがデフォルトのソート基準を残しておくためです。

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

SVG へ書き出すとき、`z-index` を要素のプロパティに直接対応付けることはできません。SVG はドキュメント内で要素が現れる順序に基づいてレンダリングされるからです。詳しくは [How to use z-index in svg elements?] を参照してください。

> SVG では、z-index は要素がドキュメントに現れる順序によって定義されます。

そのため、書き出し時には追加のソートが必要です。`SerializedNode` のソート実装は `Shape` とほぼ同じなので、ここでは示しません。

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

## sizeAttenuation の実装 {#size-attenuation}

以前 [ポリラインの sizeAttenuation](/ja/guide/lesson-012#size-attenuation) に触れました。図形を選択したあとにマスクレイヤーとアンカーポイントを表示するとき、カメラのズームに合わせて大きさが変わるのは避けたいところです。たとえば excalidraw では、ドラッグハンドル（handle）のような補助 UI の線幅をズームレベルに合わせて調整しており、ここでは Canvas2D API を使っています。

```ts
const renderTransformHandles = (): void => {
    context.save();
    context.lineWidth = 1 / appState.zoom.value; // [!code ++]
};
```

もちろん、調整のために `u_ZoomScale` はすでにシェーダーへ渡してあります。

### 頂点圧縮 {#vertex-compression}

`sizeAttenuation` のように 0 と 1 しか取らないフラグビットには、頂点圧縮の技術を使えます。簡単に言うと、こうした頂点データをできるだけ vec4 に格納し、一定の圧縮技法を使うことで、CPU 側から GPU 側へデータを渡す時間を減らし、GPU メモリも大きく節約できます。また、OpenGL がサポートする attribute の数には上限があります。圧縮のやり方もとても単純で、CPU 側の JS で圧縮し、頂点シェーダーで展開します。mapbox と Cesium の両方で使われています。詳しくは [Graphics Tech in Cesium - Vertex Compression] を参照してください。以下では、二つの値を一つの `float` に圧縮する方法を見ます。

GLSL の float は単精度浮動小数点数の [Scalars]、すなわち IEEE-754 の [Single-precision floating-point format] です。

![binary32 のビット配置](https://picx.zhimg.com/v2-05e8c5427795ebe84919ceef053adaad_1440w.png)

`sizeAttenuation` と `type` を一つの `float` に圧縮できます。`sizeAttenuation` は 1 ビット、`type` は 23 ビットを占めます。

```ts
const LEFT_SHIFT23 = 8388608.0;
const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;

const u_Opacity = [opacity, fillOpacity, strokeOpacity, type]; // [!code --]
const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed]; // [!code ++]
```

シェーダーでデコードするときも、エンコードと同じ順序を保つ必要があります。

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

`sizeAttenuation` を得たあとは、頂点シェーダーでこの値を使って頂点座標を調整します。SDF の実装を例に取ります。

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

### SVG の書き出し {#export-svg}

このプロパティはカメラのズームに関係するため、SVG を書き出すときに追加の処理が必要です。SVG は [vector-effect] を提供しています。

-   `non-scaling-size` -> `sizeAttenuation`。ただし実装がなく、at-risk と見なされています。
-   `non-scaling-stroke` -> `strokeAttenuation`

## キャンバスモード {#canvas-mode}

無限キャンバスは通常、選択モード、ハンドモード、ペンモードのように多くのモードをサポートします。[Excalidraw ToolType] と [rnote] を参照できます。

同じインタラクション動作でも、モードによって対応する操作は異なります。たとえばキャンバス上のドラッグは、選択モードでは範囲選択に対応し、ハンドモードではキャンバス全体をドラッグし、ペンモードではペンの軌跡を自由に描きます。

まずキャンバスに選択モードとハンドモードを追加します。今後さらに拡張できます。

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

これらのモードを切り替える新しい UI コンポーネントを実装しましょう。

## モード選択ツールバー {#mode-toolbar}

Lit の [Dynamic classes and styles] を使うと、[clsx] に近い効果を得られます。プロジェクトで [tailwindcss] を使ったことがあれば、きっと馴染みがあるはずです。`className` を管理し、条件に応じて生成できます。ここでは、選択中のモードの強調スタイルを実装するために使います。

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

また、テンプレートコードの量を減らすために、Lit の [Built-in directives - map] を使いました。効果は次のとおりです。

```js eval code=false
call(() => {
    const $canvas = document.createElement('ic-canvas');
    $canvas.style.width = '100%';
    $canvas.style.height = '100px';
    return $canvas;
});
```

## ハンドモード {#hand-mode}

名前のとおり、このモードではユーザーはキャンバス全体のパン、回転、ズームしかできません。以前 [CameraControlPlugin] を実装したので、今度はキャンバスモードと組み合わせます。ハンドモードの挙動は元と同じで、キャンバスを移動するか回転します。変わるのは、ドラッグの開始時とドラッグ中にマウススタイルを `grab` と `grabbing` に変える点だけです。

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

### ホイールでキャンバスをパンする {#pan-with-wheel}

長いあいだ、`wheel` をスクロール動作や `scroll` イベントと誤って混同していました。[Element: wheel event] に対する MDN の説明は次のとおりです。

> wheel イベントは必ずしも scroll イベントを発生させるわけではありません。たとえば、要素がまったくスクロールできないこともあります。ホイールやトラックパッドによるズーム操作も wheel イベントを発生させます。

Figma と Excalidraw を使っているうちに、ドラッグ以外にもホイールでキャンバスのパンを素早く済ませられると気づきました。Excalidraw は、他のキャンバスモードでも `Space` を押したままドラッグすることをサポートしています。詳しくは [handleCanvasPanUsingWheelOrSpaceDrag] を参照してください。そこで、まず元のズームロジックを修正します。

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

毎回移動する距離はカメラの現在のズームレベルを考慮する必要があり、拡大しているときは一度に移動する距離を小さくする必要があります。

### ホイールでキャンバスをズームする {#zoom-with-wheel}

もちろんズームの挙動は残しておく必要があり、`Command` または `Control` を押したときに発生します。Mac のトラックパッドで `pinch to zoom` 機能を有効にしていると、発生する `wheel` イベントには自動的に `ctrlKey` が付きます。詳しくは [Catching Mac trackpad zoom] を参照してください。

![Mac トラックパッドでのズーム](/mac-trackpad-zoom.gif)

こうすると、ズームとパンの場面で `wheel` イベントが対応する異なる挙動を簡単に区別できます。

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

Excalidraw は <kbd>Shift</kbd> を押したままキャンバスを水平にスクロールすることもサポートしています。ただし、キャンバスのこの動作にはすでに回転操作を割り当てているので、ここでは実装しません。

## 選択モード {#select-mode}

選択モードでは、ユーザーはクリックでキャンバス上の図形を選択できます。選択状態では、元の図形の上に補助 UI が重なり、通常はマスクレイヤーと複数のアンカーポイントで構成されます。マスクレイヤーをドラッグすると図形を移動でき、アンカーポイントをドラッグすると各方向に図形のサイズを変えられます。図形の上端の外側には、回転用のアンカーポイントも一つ追加します。

![物理的な特性を示すアンカー配置の図](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### クリックで図形を選択する {#select-shape}

以下で Selector プラグインを実装します。次のインターフェースも Canvas に公開します。

```ts
export class Selector implements Plugin {
    selectShape(shape: Shape): void;
    deselectShape(shape: Shape): void;
}
```

このプラグインで `click` イベントを監視したあとは、次の状況を処理する必要があります。

-   図形をクリックすると、選択状態の UI を表示します。以前に他の図形が選択されていれば、まず選択を解除します。
-   キャンバスの空白をクリックすると、現在選択されている図形の選択を解除します。
-   <kbd>Shift</kbd> を押していると、複数選択モードに入ります。

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

### ドラッグで図形を移動する {#dragndrop-move}

HTML はドラッグをネイティブにサポートしています。もちろん `pointermove / up / down` のような、より低レベルのイベントでも実装できます。詳しくは [Drag'n'Drop with mouse events] を参照してください。私たちの実装もこの記事の考え方を参考にしています。`dragstart` イベントでは、キャンバス上のマウスのオフセットを記録します。カメラのズームを考慮する必要があるため、ここでは `screen` 座標系を使う点に注意してください。

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

`drag` イベントでは、オフセットに従ってマスクレイヤーの位置を調整します。`position` プロパティを使えばマスクのパス定義を変更する必要はなく、下層のレンダリングでは `u_ModelMatrix` だけが変わります。

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

`dragend` イベントでは、マスクレイヤーの位置を図形へ同期します。このときにマスクのパスが変更されます。

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

### プロパティパネルの表示 {#property-panel}

図形が選択されたとき、その図形に対応するプロパティパネルを表示したいところです。詳しくは [Drawer - Contained to an Element] を参照してください。ここでは展開しません。`stroke` プロパティを例に双方向バインディングを行い、現在選択されている図形を監視し、ユーザーが手で変更したあと、新しい値を図形へ同期します。

```html
<sl-color-picker
    hoist
    size="small"
    value="${this.shape?.stroke}"
    @sl-input="${this.handleStrokeChange}"
    opacity
></sl-color-picker>
```

色については透明度を分けたい点に注意が必要です。そのため [sl-color-picker] の `getFormattedValue` メソッドで色の値を取得し、続いて `d3-color` ライブラリで解析して、`stroke` と `strokeOpacity` にそれぞれ値を割り当てます。

```ts
const strokeAndOpacity = (e.target as any).getFormattedValue('rgba') as string;
const { rgb, opacity } = rgbaToRgbAndOpacity(strokeAndOpacity); // with d3-color
```

もちろん、選択モードで実装すべき機能はほかにもたくさんあります。選択をまとめてグループにする、図形を回転する、などです。これらは続く課で引き続き整えていきます。また描画モードでは、矩形、直線、多角形などの描画をサポートしたいと考えており、これらも続く課で実装します。

## さらに読む {#extended-reading}

-   [Excalidraw ToolType]
-   [Introducing the CSS anchor positioning API]
-   [Drag'n'Drop with mouse events]

[Introducing the CSS anchor positioning API]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[Dynamic classes and styles]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[Built-in directives - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /ja/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: wheel event]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Catching Mac trackpad zoom]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[Stacking context]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[How to use z-index in svg elements?]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
[Scalars]: https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Scalars
[Single-precision floating-point format]: https://en.wikipedia.org/wiki/Single-precision_floating-point_format
[Graphics Tech in Cesium - Vertex Compression]: https://cesium.com/blog/2015/05/18/vertex-compression/
[Drag'n'Drop with mouse events]: https://javascript.info/mouse-drag-and-drop
[Drawer - Contained to an Element]: https://shoelace.style/components/drawer#contained-to-an-element
[sl-color-picker]: https://shoelace.style/components/color-picker
[vector-effect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect
