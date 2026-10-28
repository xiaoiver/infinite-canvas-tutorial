---
outline: deep
description: '矩形、楕円、多角形、消しゴム、レーザー、ブラシの各モードを描きます。ぶれを抑える線描画アルゴリズムを含め、滑らかな描画体験をつくるブラシ機能の実装を扱います。'
head:
    - ['meta', { property: 'og:title', content: '第25課 - 描画モードとブラシ' }]
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

# 第 25 課 - 描画モードとブラシ {#lesson-25-drawing-mode-and-brush}

[第 14 課 - キャンバスモードと補助 UI] ではハンドモードと選択モードを紹介しました。この課では描画モードを紹介します。矩形、楕円、矢印、そしてより自由なブラシモードです。

## 矩形描画モード {#draw-rect-mode}

<DrawRect />

まず次のキャンバスモードを追加します。楕円を描く実装はほぼ同じなので、同じ説明は繰り返しません。

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

[第 18 課 - ECS でリファクタリング] で ECS アーキテクチャを紹介しました。そこでは `DrawRect` System を作成し、そのモードに入るとカーソルスタイルを `crosshair` に設定します。

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

そのあとマウスをドラッグしている間、対象領域に矩形を継続的に描き直します。選択モードのボックス選択に似ています。マウスを離して矩形の作成を終えると、矩形描画モードから選択モードへ切り替わります。

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

続いて、ドラッグの過程で何が起きるかを見ます。

### 矩形の再描画 {#redraw-rect}

ボックス選択と同様に、わずかな距離をドラッグしただけで描画が始まるのを避けるため、しきい値を設ける必要があります。この値は Viewport 座標系で計算します。

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

補助矩形の `x/y` 座標は、`pointerdown` が起きた位置です。`pointermove` イベントオブジェクトの座標は Canvas 座標系へ変換してから、幅と高さを計算する必要があります。

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

逆方向にドラッグする場合も考慮する価値があります。このとき計算された `width/height` は負になることがあり、対応する `x/y` はもはや `pointerdown` の位置ではないため、計算し直す必要があります。Figma も同じようにしています。

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

### サイズラベル {#size-label}

描画中に、矩形の寸法を Figma のようにリアルタイムで表示したいところです。

![Figma のサイズラベル](/figma-size-label.png)

同様に、この種のビューポート空間にある注釈は SVG コンテナに置くのに向いています。後述するレーザーポインターと消しゴムがその例です。矩形ラベルは CSS スタイルで背景色、padding、中央揃えなどのプロパティを指定し、テキスト内容にはバウンディングボックスの幅と高さを使います。

```ts
label.style.visibility = 'visible';
label.style.top = `${y + height}px`;
label.style.left = `${x + width / 2}px`;
label.innerText = `${Math.round(width)} × ${Math.round(height)}`;
```

直線を描く場合、ラベルは線の方向に沿って回転させつつ、テキストは常に正立したままにできます。次の節の矢印の例で試せます。

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

### Shift で正方形を描く {#draw-square-with-shift}

ドラッグ中に <kbd>Shift</kbd> を押すと、正方形、正円、正多角形を作成できます。このとき、幅と高さの絶対値のうち小さい方を正方形の辺の長さに使います。

```ts
if (isSquare) {
    if (Math.abs(width) > Math.abs(height)) {
        width = Math.sign(width) * Math.abs(height);
    } else {
        height = Math.sign(height) * Math.abs(width);
    }
}
```

## 矢印を描く {#draw-arrow}

矩形、楕円、ポリラインのような基本図形に加えて、矢印のような複合図形もよく使われます。矢印のバインディング関係（頭と尾がつながった図形が動くと、矢印の向きも変わる関係）は、今回は扱いません。この話題は別の章で扱います。ここでは、矢印をどのように描くかだけに注目します。

SVG では、まず `<marker>` で矢印を宣言します。通常は `<path>` です。そのあと、対象グラフィックの [marker-start] と [marker-end] 属性で矢印を関連付けます。

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

矢印の端点を本体から分離するこの方法は、とても柔軟です。ただしグラフィックエディタでは、あらかじめ用意した一般的なスタイルをいくつか提供すれば十分です。たとえば Figma の矢印は、Path の二つの端点（`start/end point`）に付けることで実現され、`line/triangle/diamond` などのプリセットスタイルがいくつかあります。[How to Curve an Arrow in Figma] を参照してください。

![Figma の矢印](/arrow-in-figma.png)

Drawio も、すぐに使える矢印スタイルを多数提供しています。

![出典: https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png](https://www.drawio.com/assets/img/blog/style-tab-line-start-line-end.png)

したがって宣言的な使い方では、カスタムの矢印スタイルという機能を諦め、組み込みの矢印スタイルリテラルを一式提供してもまったく問題ありません。Polyline / Path を構築するとき、矢印の端点と本体をまとめて生成します。この考え方は、SVG で描画する [plot - arrow] にも見られます。そちらは `<marker>` を使わず、完全な `<path>` 定義を使います。

```ts
export interface MarkerAttributes {
    markerStart: Marker['start'];
    markerEnd: Marker['end'];
}
```

次に、ジオメトリを構築する過程を見ます。

### 始点と終点 {#start-end-point}

まず、矢印の始点と終点を見つける必要があります。

ただし向きは手動で計算する必要があります。複雑ではなく、接線に沿って求めます。

<DrawArrow />

### 矢印を SVG に書き出す {#export-arrow-to-svg}

SVG では [orient] 属性で `<marker>` の向きを調整できます。ただし、この属性のリテラル値は `‘auto’` と `‘auto-start-reverse’` の二つだけです。

```ts
if (isEnd) {
    $marker.setAttribute('orient', 'auto');
} else {
    $marker.setAttribute('orient', 'auto-start-reverse');
}
```

そのあとマーカーの種類に基づいて `<path>` を作成し、対象グラフィックの `stroke` などのプロパティを継承させます。SVG 全体は [export arrow] テストケースで確認できます。

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

これに対して、書き出した SVG ファイルはキャンバスへ再インポートできる必要もあります。

## 多角形を描く {#draw-polygon}

[Shape tools - polygons]

<DrawPolygon />

矩形のバウンディングボックスが与えられたら、プログラムで多角形のパスを生成します。

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

## 鉛筆ツール {#pencil-tool}

最も単純な実装から見ます。ポリラインで表示する方式で、Figma では Pencil と呼ばれます。

ドラッグで生成される頂点の数、特に重複した頂点や互いに近い頂点の数をできるだけ減らすため、[第 12 課 - ポリラインを単純化する] で説明した方法を使ってポリラインを単純化します。実装には [simplify-js] を選びます。`tolerance` パラメータの定義に注意が必要です。この値が簡略化の度合いに影響します。

> 簡略化の量に影響します（点の座標と同じ単位です）。

現在のカメラのズームに応じて `tolerance` を変えて設定したいところです。そうしないと、高いズーム倍率で単純化しすぎて起きるぶれがすぐに目立ちます。

![4倍ズームで過度に単純化されたポリライン](/over-simplified-polyline.gif)

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

線幅が固定されていると、「しなやかさ」に欠けます。手描きの感じを出すには、線を圧力に応じて変えられます。このために [perfect-freehand] を使えます。この機能はまだ Excalidraw に統合されていません。参照: [Perfect Freehand Drawing Issue]。
線幅が可変なので、最終的に描かれる図形はもはや Polyline ではなく Path です。

```ts
import { getStroke } from 'perfect-freehand';

const outlinePoints = getStroke(points);
const d = getSvgPathFromStroke(outlinePoints); // 'M 0 0 L...'
```

<PencilFreehand />

既定では [perfect-freehand] が、隣り合う点の間の距離から可変の線幅を計算し、筆運びの速さをシミュレートします。ペンやスタイラスから得られる実際の [pressure] を使うには、各入力点の 3 番目の数値として筆圧を渡します。

```ts
export class Input {
    @field.float32 declare pressure: number; // [!code ++]
}
```

そして simulatePressure オプションを false に設定します。

```ts
const outlinePoints = getStroke(inputPoints, {
    simulatePressure: false,
});
```

## ブラシモード {#brush-mode}

Photoshop Web で Paint モードに入ると、このサブツールを選べます。連続してドラッグしながらストロークを描きます。

![Photoshop Web のブラシモード](/photoshopweb-brush-mode.png)

Figma では [Draw with illustration tools] と呼ばれます。

この種のストロークをよく見ると、連続した点の集合でできています。点の半径が異なれば、太さが変わる効果になります。ブラシの圧力を半径へ対応付けることで実現できます。

![出典: https://shenciao.github.io/brush-rendering-tutorial/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/brushes-9e58d24a7f40847be1ad6c1cb9f1b9dc.jpg)

ここでは [Brush Rendering Tutorial] を参考にして、この効果を実現します。

### 基本実装 {#basic-implementation}

基礎となるデータ構造は次のとおりです。

```ts
interface BrushPoint {
    x: number;
    y: number;
    radius: number;
}
```

ポリラインの $N$ 個の頂点は $N-1$ 本のセグメントを作り、各セグメントは三角形二つと頂点四つからなります。[第 12 課 - セグメントを押し出す] では、頂点を 9 個使う方法を紹介しました。ここではまったく同じ方法を使いますが、セグメントの継ぎ目は考慮しなくてよいので、頂点は 4 個だけ使い、インスタンシングで描画します。

```ts
renderPass.drawIndexed(6, points.length - 1); // indices: [0, 1, 2, 0, 2, 3]
```

[第 12 課 - セグメントを押し出す] で見たように、`a_VertexNum` を頂点シェーダーへ渡せます。WebGL 1 の互換性を考慮しないなら、[Brush Rendering Tutorial] のように `gl_VertexID` を直接使うこともできます。

```glsl
layout(location = ${Location.POINTA}) in vec3 a_PointA;
layout(location = ${Location.POINTB}) in vec3 a_PointB;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum; // [0, 1, 2, 3]
```

他の `attributes` にも触れておきます。`a_PointA` と `a_PointB` は、頂点の位置座標に加えて可変の半径も格納します。ここでも `vertexBufferOffsets` で同じ Buffer を併用し、`a_PointB` は `4 * 3` のオフセットから読みます。こうすると、頂点番号を使って頂点シェーダーで引き伸ばせます。

![出典: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/coordinate-68714349e3013c769921a0eb25796188.png)

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

可変の幅に対応するには、引き伸ばす距離が常に現在の点の半径と等しいわけではなく、線分の傾きに基づいて計算する必要があります。

![出典: https://shenciao.github.io/brush-rendering-tutorial/Basics/Vanilla/](https://shenciao.github.io/brush-rendering-tutorial/assets/images/var-parameters-9d4c6d7aa31d0f61fd39ba9f69eaae6d.png)

```glsl
int MAX_i = 128; float currIndex = startIndex;
float A = 0.0;
for(int i = 0; i < MAX_i; i++){
    // Blend opacity
    A = A * (1.0-opacity) + opacity;
}
```

効果は次のとおりです。ブラシツールを選び、ドラッグ速度を変えてみてください。ECS はタイムスタンプ付きのマウス／タッチサンプルを使い、速いストロークは細く、遅いストロークは太くし、その間を滑らかに遷移させます。感圧ペンでは、計測した筆圧を代わりに使います。算出した半径はストロークに保存されるため、取り消し、やり直し、再読み込みのあとでも形状が保たれます。

<Brush />

### スタンプ {#stamp}

これだけでは、本物の筆致のようにはまだなりません。スタンプ画像の URL として `brushStamp` プロパティを追加しますが、これが制御するのはブラシの不透明度だけで、色は引き続き `stroke` が決めます。

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

現在、すべてのテクスチャは固定された向きで適用されます。テクスチャにランダムな回転角を加えられます。

```glsl
float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
pToCurrStamp *= rotate(angle);
```

不透明度をブレンドするときに、ノイズ係数も使えます。

```glsl
float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
```

### [WIP] SVG の書き出し {#export-brush-to-svg}

Figma は Brush を SVG に書き出せます。

## レーザーポインター {#laser-pointer}

キャンバスでプレゼンテーション機能を実装するとき、レーザーポインターは欠かせない機能です。Excalidraw はこの機能をサポートしています。詳細は [laser pointer] を参照してください。カプセル化された [@excalidraw/laser-pointer] モジュールをそのまま利用できます。このモジュールは、入力点座標の集合から軌跡のパスを生成します。内部では [perfect-freehand] も使っています。

この機能は、これまでにキャンバスへ描いた図形と次の点で異なります。

1. レーザーポインターの軌跡のレンダリングはビューポート座標系で行われ、現在のキャンバスのズームとは独立しています。そのため、独立した HTML コンテナの中で実装できます。参照: [第 29 課 - HTML コンテナ]
2. 軌跡は一定時間のあと自動的に消えます
3. 複数ユーザーの共同編集シナリオ向けに設計されています。参照: [第 20 課 - Awareness と Presence]

<LaserPointer />

## 消しゴム {#eraser}

Excalidraw は [freedraw eraser] をサポートしています。消しゴムツールを選んだあと、マウスカーソルが通った図形は「薄く」表示され、これから消されることを示します。マウスを離すと消去が完了します。

実装では、前の節で紹介した Perfect freehand を使ってドラッグ経路を描きますが、保存するのは直近の 4 点だけです。同時に、通過した図形をリアルタイムで検出し、不透明度を設定します（キャンセル時に戻せるよう、元の不透明度は保存しておく必要があります）。マウスを離したときに、選択した図形を削除します。

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

### 非アトミックな消去 {#non-atomic}

図形全体を消すだけでも、ほとんどの場面には十分です。ただし自由描画では、非アトミックな消去の方が実用的です。たとえば直線を途中で断ち切る場合です。Excalidraw には現在この機能がありません。参照: [non-atomic erasing for linear & freedraw shapes]。FigJam にも同じ制限があります。キャンバスを Canvas または SVG でレンダリングしている場合、このピクセル単位の消去効果は実際に実現できません。

私たちのキャンバスは WebGL/WebGPU で実装しているため、最も適した手法はステンシルバッファです。まず消しゴムのパスをステンシルバッファへ描き、それをマスクとしてシーンを描き直します。OpenGL を例にすると次のとおりで、WebGL もまったく同様です。

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

この内容は、のちほど [第 34 課 - Frame とクリップ] で紹介します。

## さらに読む {#extended-reading}

-   [Draw with illustration tools]
-   [Brush Rendering Tutorial]
-   [p5.brush]
-   [Real-Time Paint System with WebGL]
-   [简简单单实现画笔工具，轻松绘制丝滑曲线]

[第 14 課 - キャンバスモードと補助 UI]: /ja/guide/lesson-014
[第 18 課 - ECS でリファクタリング]: /ja/guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
[Real-Time Paint System with WebGL]: https://chrisarasin.com/paint-system-webgl
[简简单单实现画笔工具，轻松绘制丝滑曲线]: https://zhuanlan.zhihu.com/p/701668081
[第 12 課 - ポリラインを単純化する]: /ja/guide/lesson-012#simplify-polyline
[simplify-js]: https://github.com/mourner/simplify-js
[Brush Rendering Tutorial]: https://shenciao.github.io/brush-rendering-tutorial/
[第 12 課 - セグメントを押し出す]: /ja/guide/lesson-012#extrude-segment
[How to Curve an Arrow in Figma]: https://imagy.app/how-to-curve-an-arrow-in-figma/
[marker-start]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
[marker-end]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
[Shape tools - polygons]: https://help.figma.com/hc/en-us/articles/360040450133-Shape-tools#polygons
[plot - arrow]: https://github.com/observablehq/plot/blob/main/src/marks/arrow.js
[orient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/orient
[export arrow]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/ecs/snapshots/export-arrow.svg
[perfect-freehand]: https://github.com/steveruizok/perfect-freehand
[Perfect Freehand Drawing Issue]: https://github.com/excalidraw/excalidraw/issues/4802
[pressure]: https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure
[freedraw eraser]: https://github.com/excalidraw/excalidraw/issues/3682
[non-atomic erasing for linear & freedraw shapes]: https://github.com/excalidraw/excalidraw/issues/4904
[laser pointer]: https://github.com/excalidraw/excalidraw/issues/5351
[@excalidraw/laser-pointer]: https://www.npmjs.com/package/@excalidraw/laser-pointer
[第 29 課 - HTML コンテナ]: /ja/guide/lesson-029#create-html-container
[第 20 課 - Awareness と Presence]: /ja/guide/lesson-020#awareness-presence
[第 34 課 - Frame とクリップ]: /ja/guide/lesson-034
