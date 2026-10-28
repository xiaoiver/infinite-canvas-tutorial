---
outline: deep
description: '任意の線幅、ストロークの接合と端、破線、アンチエイリアスを備えたポリラインを実装します。CPU と GPU でのメッシュ構築、およびバウンディングボックスの計算を学びます。'
head:
    - ['meta', { property: 'og:title', content: '第12課 - ポリラインを描く' }]
---

<script setup>
import Wireframe from '../../components/Wireframe.vue';
</script>

# 第 12 課 - ポリラインを描く {#lesson-12-draw-polyline}

基本図形の追加を続け、ポリラインを扱います。この課では次の内容を学びます。

-   `gl.LINES` をそのまま使わない理由
-   CPU またはシェーダーでのメッシュ構築
-   シェーダーの詳細分析:
    -   頂点と接合の押し出し
    -   アンチエイリアス
    -   破線を描く
-   ポリラインのバウンディングボックスを計算する方法

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            fill: 'none',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'bevel',
            fill: 'none',
        });
        canvas.appendChild(polyline2);

        const polyline3 = new Polyline({
            points: [
                [340, 100],
                [340, 200],
                [440, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            fill: 'none',
        });
        canvas.appendChild(polyline3);

        const polyline4 = new Polyline({
            points: [
                [100, 300],
                [200, 300],
                [300, 210],
                [400, 300],
                [500, 300],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            strokeDasharray: [10, 5],
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const rect2 = new Rect({
            x: 500,
            y: 100,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## gl.LINES の限界 {#limitation-of-gl-lines}

WebGL が提供する `gl.LINES` と `gl.LINE_STRIP` は、実際の場面では使いにくいことが多いです。

-   幅をサポートしません。[lineWidth] を使おうとすると、Chrome のような一般的なブラウザは警告を出します。

> [!WARNING]
> 2017 年 1 月時点で、ほとんどの WebGL 実装は基盤技術と同じ制限により、最小値 1 と最大値 1 しかサポートしていません。

-   隣接する線分の間の接続形状 [lineJoin] と、端点の形状 [lineCap] を定義できません。
-   既定の実装にはジャギーが目立ち、追加のアンチエイリアスが必要です。

[第 5 課 - 直線グリッド] の方法は、任意の線分を描くには向きません。線分の両端を任意に定めることさえできません。また、線分とポリラインの最大の違いは接合の扱いで、deck.gl はそれぞれ [LineLayer] と [PathLayer] を提供しています。

ここで、ポリラインに実装したい機能を明確にします。

-   任意の線幅
-   任意個の端点。SVG の [points] 属性に似ています。
-   隣接する線分の間の接続形状 [stroke-linejoin] と、端点の形状 [stroke-linecap]
-   破線。[stroke-dashoffset] と [stroke-dasharray]
-   良好なアンチエイリアス
-   インスタンス描画。以前紹介した [インスタンス描画] を参照してください。

設計した API は次のとおりです。

```ts
const line = new Polyline({
  points: [
    [0, 0],
    [100, 100]
  ],
  strokeWidth: 100,
  strokeLinejoin: 'round'
  strokeLinecap: 'round',
  strokeMiterlimit: 4,
  strokeDasharray: [4, 1],
  strokeDashoffset: 10
});
```

まず最初の問いを見ます。`strokeWidth` の任意の値をどう実装するかです。

## メッシュの構築 {#construct-mesh}

次の図は、Pixi.js が WebGL meetup で共有した [How 2 draw lines in WebGL] からのものです。この文章ではその資料のスクリーンショットを多く参照し、PPT のページ番号を示します。ネイティブの方法が使えないため、メッシュを構築する従来の描画方式に戻ります。

![WebGL で線を描く方法 - 5ページ](/how-to-draw-line-in-webgl.png)

一般的な方法は、線分の法線方向へ押し出してから三角形分割することです。次の図は [Drawing Antialiased Lines with OpenGL] からのものです。線分の両端を赤い破線の法線に沿って両側へ押し出すと頂点が 4 つになり、三角形 2 つに分割されます。これで `strokeWidth` は任意の値にできます。

![線の押し出し](/extrude-line.png)

### CPU で構築する {#construct-mesh-on-cpu}

線分の押し出しと、`strokeLinejoin` および `strokeLinecap` のメッシュ構築は、CPU でもシェーダーでも行えます。前者の考え方に沿った実装には次があります。

-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [regl-gpu-lines]

![セグメントのインスタンスメッシュ](https://wwwtyro.net/media/instanced-lines/segment-instance.svg)

![セグメントのインスタンス、lineCap と lineJoin のメッシュ](https://rreusser.github.io/regl-gpu-lines/docs/debug.png)

`strokeLinejoin` と `strokeLinecap` が `round` のとき、角丸を滑らかに見せるにはメッシュ構築に最も多くの頂点が必要です。[regl-gpu-lines] では、各区間に最大 `32 * 4 + 6 = 134` 個の頂点が必要です。

```ts
// @see https://github.com/rreusser/regl-gpu-lines/blob/main/src/index.js#L81
cache.indexBuffer = regl.buffer(
    new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]), // MAX_ROUND_JOIN_RESOLUTION = 32
);
```

`strokeLinecap` と線分は、別々のドローコールで描く必要があります。引き続き [regl-gpu-lines] の [instanced example] を例にすると、プログラムを 2 つコンパイルし、ドローコール 3 つで描きます。その内訳は次のとおりです。

-   両端は同じプログラムを使いますが、ユニフォーム `orientation` が異なります。頂点数は `cap + join` です。
-   中間の線分はすべて 1 つのドローコールで描きます。頂点数は `join + join` で、インスタンス数は線分数です。

```ts
const computeCount = isEndpoints
    ? // Draw a cap
      (props) => [props.capRes2, props.joinRes2]
    : // Draw two joins
      (props) => [props.joinRes2, props.joinRes2];
```

ポリラインが複数あるとき、まとめられる条件は `strokeLinecap` と `strokeLinejoin` の値が同じで、線分数も同じことです。次の図はポリラインを 5 本描く場合です。各ポリラインの中間線分には `instance` が 8 個あるので、`instance` の合計は 40 です。

![ラインキャップとセグメントのドローコール](/regl-gpu-lines.png)

### シェーダーで構築する {#construct-mesh-on-shader}

Pixi.js が WebGL meetup で共有した資料では、シェーダー内でメッシュを構築します。

-   [How 2 draw lines in WebGL]
-   [pixijs/graphics-smooth]

CPU で構築する場合と比べた利点は次のとおりです。

-   `strokeLinecap`、`strokeLineJoin`、中間の線分を 1 つのドローコールで描けます。
-   頂点は 9 個に固定されます。頂点 1、2、3、4 が作る三角形 2 つで線分を描き、頂点 5、6、7、8、9 が作る三角形 3 つで接合を描きます。
-   `strokeLinecap` と `strokeLinejoin` が `round` のときは、より滑らかです。フラグメントシェーダーで SDF により円を描くのに近い方法を使うためです。
-   アンチエイリアスの効果が高いです。

![接合をインスタンスに詰める - 15ページ](/pack-joints-into-instances.png)

```glsl
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
```

バッファのレイアウトは次のとおりで、各ストライドの大きさは `4 * 3` です。バッファ内の `x1 y1 t1` のような同じ連続データは、最初のインスタンスでは `A_0` として、2 番目のインスタンスでは `Prev_1` として読まれます。このように重なり合う配置にすると、バッファサイズを最大限節約できます。

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 3,
                shaderLocation: Location.POINTA,
            },
            {
                format: Format.F32_R,
                offset: 4 * 5,
                shaderLocation: Location.VERTEX_JOINT,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 6,
                shaderLocation: Location.POINTB,
            },
            {
                format: Format.F32_RG,
                offset: 4 * 9,
                shaderLocation: Location.NEXT,
            },
        ],
    },
];
```

ただし WebGPU レンダラーに切り替えると、次のエラーになります。

> [!WARNING]
> 属性オフセット (12) とフォーマット VertexFormat::Float32x2（サイズ 8）が、頂点バッファのストライド (12) に収まりません。

理由は、WebGPU が VertexBufferLayout に次の検証規則を持ち、arrayStride が `4 * 3` だからです。[WebGPU instancing problem] と [spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)] もこの点に触れています。

> attrib.offset + byteSize(attrib.format) ≤ descriptor.arrayStride.
>
> 4 \* 3 + 4 \* 2 ≤ 4 \* 3 // 成り立ちません

そのため、バッファのレイアウトを変える必要があります。まずレイアウトで、1 つのバッファが複数の属性を持つ配置を複数のバッファに分け、各バッファには属性を 1 つだけ置きます。

```ts
const vertexBufferDescriptors: InputLayoutBufferDescriptor[] = [
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.PREV,
            },
        ],
    },
    {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.INSTANCE,
        attributes: [
            {
                format: Format.F32_RG,
                offset: 4 * 0,
                shaderLocation: Location.POINTA,
            },
        ],
    },
    // Omit VERTEX_JOINT
    // Omit POINTB
    // Omit NEXT
];
```

BufferLayout の宣言は複数に分かれていますが、実際に参照するのは同じバッファで、`offset` によって対応する属性だけを読みます。詳細は [Offset in bytes into buffer where the vertex data begins] を参照してください。

```ts
const buffers = [
    {
        buffer: this.#segmentsBuffer, // PREV
    },
    {
        buffer: this.#segmentsBuffer, // POINTA
        offset: 4 * 3,
    },
    {
        buffer: this.#segmentsBuffer, // VERTEX_JOINT
        offset: 4 * 5,
    },
    {
        buffer: this.#segmentsBuffer, // POINTB
        offset: 4 * 6,
    },
    {
        buffer: this.#segmentsBuffer, // NEXT
        offset: 4 * 9,
    },
];
renderPass.setVertexInput(this.#inputLayout, buffers, {
    buffer: this.#indexBuffer,
});
```

この後のほかの機能も、この方式に基づいて実装します。

<Wireframe />

## シェーダー実装の分析 {#shader-implementation}

まず、線分の本体と接合で頂点をどのように押し出すかを見ます。

### 線分の押し出し {#extrude-segment}

頂点 1 から 4、つまり線分の本体に注目します。その線分と隣接する線分が作る角度を考えると、`/-\`、`\-/`、`/-/`、`\-\` の 4 つの形があります。

![線分に沿った押し出し - 16ページ](/line-vertex-shader.png)

単位法線ベクトルを計算する前に、各頂点の位置をモデル座標系へ変換します。

```glsl
vec2 pointA = (model * vec3(a_PointA, 1.0)).xy;
vec2 pointB = (model * vec3(a_PointB, 1.0)).xy;

vec2 xBasis = pointB - pointA;
float len = length(xBasis);
vec2 forward = xBasis / len;
vec2 norm = vec2(forward.y, -forward.x);

xBasis2 = next - base;
float len2 = length(xBasis2);
vec2 norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
float D = norm.x * norm2.y - norm.y * norm2.x;
```

たとえば最初の形では、頂点 1 と 2 を法線に沿って外側へ押し出し、頂点 3 と 4 は接合の角の二等分線（`doBisect()`）に沿って内側へ押し出します。

```glsl
if (vertexNum < 3.5) { // Vertex #1 ~ 4
    if (abs(D) < 0.01) {
        pos = dy * norm;
    } else {
        if (flag < 0.5 && inner < 0.5) { // Vertex #1, 2
            pos = dy * norm;
        } else { // Vertex #3, 4
            pos = doBisect(norm, len, norm2, len2, dy, inner);
        }
    }
}
```

### 接合の押し出し {#extrude-linejoin}

次に接合の頂点 5〜9 に注目します。接合の形状によって押し出す方向と距離が変わり、原著者の実装はとても複雑です。そのうち `bevel` と `round` は同じ押し出し方を共有し、後者はフラグメントシェーダーで SDF により角丸の描画を仕上げます。

![線分に沿った押し出し - 16ページ](/line-vertex-shader2.png)

最も単純な `miter` から分析を始めます。定義上、`strokeMiterlimit` を超えると `bevel` に変わります。

```glsl
if (length(pos) > abs(dy) * strokeMiterlimit) {
    type = BEVEL;
} else {
    if (vertexNum < 4.5) {
        dy = -dy;
        pos = doBisect(norm, len, norm2, len2, dy, 1.0);
    } else if (vertexNum < 5.5) {
        pos = dy * norm;
    } else if (vertexNum > 6.5) {
        pos = dy * norm2;
    }
    v_Type = 1.0;
    dy = -sign * dot(pos, norm);
    dy2 = -sign * dot(pos, norm2);
    hit = 1.0;
}
```

Cairo では、round と bevel のどちらを使うかを `arc height` に基づいて決める必要があります。次の図の出典は [Cairo - Fix for round joins] です。

![丸い接合を修正した Cairo](https://gitlab.freedesktop.org/-/project/956/uploads/b53d20cf0156e48b4a9766f6c5ff5cff/round_join.png)

### アンチエイリアス {#anti-aliasing}

最後に、線分の縁をどうアンチエイリアスするかを見ます。以前 [SDF のアンチエイリアス] を紹介しており、ここでは似た方法を使います。

1. 頂点シェーダーで、頂点から線分への垂直な単位ベクトルを計算し、`varying` でフラグメントシェーダーへ渡して自動的に補間します。
2. 補間後のベクトルは、もはや単位ベクトルではありません。その長さを計算すると、現在のピクセルから線分までの垂直距離になり、範囲は `[0, 1]` です。
3. この値でピクセルの最終的な透明度を計算し、アンチエイリアスを完成させます。`smoothstep` は線分の縁、つまり区間 `[linewidth - feather, linewidth + feather]` で起きます。次の図は [Drawing Antialiased Lines with OpenGL] からのもので、具体的な計算は後で説明します。

![フェザー](https://miro.medium.com/v2/resize:fit:818/format:webp/0*EV5FGcUOHAbFFPjy.jpg)

この「feather」はどれくらいが適切でしょうか。以前の [矩形の外側の影を描く] では、矩形の元のサイズを `3 * dropShadowBlurRadius` だけ外側へ広げました。次の図も [How 2 draw lines in WebGL] からのもので、外側へ 1 ピクセル広げる（`w` から `w+1`）だけで十分です。反対側の 2 つの頂点（#3 と #4）の距離は負です。

```glsl
const float expand = 1.0;
lineWidth *= 0.5;

float dy = lineWidth + expand; // w + 1
if (vertexNum >= 1.5) { // Vertex #3 & #4
  dy = -dy; // -w - 1
}
```

右下の図からも分かるように、フラグメントシェーダーの各ピクセルを拡大して見ると、この向きのある距離 `d` から、線分と現在のピクセルの被覆率（次の図の三角形の面積）を計算し、アンチエイリアスの効果を得られます。

![外側へ 1 ピクセル拡張](/line-segment-antialias.png)

この距離で被覆率をどう計算するのでしょうか。線分の本体と接合に分けて考える必要があります。

まず線分の本体です。垂直な線分の場合へさらに単純化でき、原著者は回転を考慮した計算も示していますが、単純化した推定と大きな差はありません。`clamp` で片側の被覆率を計算し、線幅が非常に細い場合も考慮して、右側から左側を引いたものを最終的な被覆率とします。これが最終的な色の透明度係数になります。

![符号付き距離による被覆率の計算](/line-segment-antialias2.png)

線分と直線の交差領域を計算するのが、最も単純な場合です。接合と端点の処理は非常に複雑になります。Miter 接合を例に、回転は無視したまま、隣接する線分が垂直な場合だけを考えます（次の図右側の赤い枠）。上の線分には向きのある距離 `d` が 1 つだけですが、ここでは接合の前後 2 本の線分を表す `d1` と `d2` があります。同様に、1 ピクセル内の非常に細い線を考えると、被覆領域は大小 2 つの正方形の面積差（`a2 * b2 - a1 * b1`）です。

![マイター接合の被覆率の計算](/line-segment-antialias3.png)

Bevel 接合の計算は、おおむね Miter と同じです（次の図の中央の場合）。`d3` はピクセル中心から「bevel line」までの距離で、これを使って次の図右側の被覆率を計算できます。この 2 つの場合の最小値を取ると、近似の計算結果になります。

![ベベル接合の被覆率の計算](/line-segment-antialias5.png)

![ベベル接合の被覆率の計算](/line-segment-antialias4.png)

最後に丸い接合です。頂点シェーダーから、円の中心からピクセルまでの距離 `d3` を追加で渡す必要があります。SDF で円を描くのと似ています。

![丸い接合の被覆率の計算](/line-segment-antialias6.png)

![丸い接合の被覆率の計算](/line-segment-antialias7.png)

原著者は `pixelLine` の厳密な実装も示していますが、紙幅の都合で展開しません。

### stroke-alignment のサポート {#stroke-alignment}

以前、SDF で描いた Circle、Ellipse、Rect に [拡張 SVG: ストローク配置] を実装しました。今度はポリラインにもこの属性を加えます。次の図は Pixi.js の `lineStyle.alignment` の効果です。赤い線はポリラインの幾何的な位置を表し、値に応じてその上下に浮きます。

![stroke-alignment - 27ページ](/line-stroke-alignment.png)

ECS のポリラインでは、ストロークの配置は計算されたジオメトリ境界にも影響します。`strokeWidth` や `strokeAlignment` を変更する、ストロークのジオメトリを削除する、それらの編集を取り消す、またはやり直すと、オフセット後の点とその境界が更新されます。ストロークのないポリラインは元の点を保ちます。連続する重複サンプルは共通頂点のオフセットを共有し、サンプルがすべて一致するポリラインは有限の座標を保ちます。SVG 書き出しでは、元の点の順序と個数を維持します。

シェーダーでは、この属性を法線方向へ押し出すときのオフセットに反映します。`strokeAlignment` が `center` のとき、オフセットは `0` です。

```glsl
float shift = strokeWidth * strokeAlignment;
pointA += norm * shift;
pointB += norm * shift;
```

左から `outer`、`center`、`inner` の効果です。

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

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

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'outer',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        const polyline4 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            // strokeAlignment: 'outer',
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            cursor: 'pointer',
            fill: 'none',
        });
        canvas.appendChild(polyline2);
        const polyline5 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline5);

        const polyline3 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeAlignment: 'inner',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        const polyline6 = new Polyline({
            points: [
                [360, 100],
                [360, 200],
                [460, 200],
                [460, 100],
            ],
            stroke: 'red',
            strokeWidth: 2,
            fill: 'none',
        });
        canvas.appendChild(polyline6);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
        polyline2.addEventListener('pointerenter', () => {
            polyline2.stroke = 'green';
        });
        polyline2.addEventListener('pointerleave', () => {
            polyline2.stroke = 'black';
        });
        polyline3.addEventListener('pointerenter', () => {
            polyline3.stroke = 'green';
        });
        polyline3.addEventListener('pointerleave', () => {
            polyline3.stroke = 'black';
        });
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

最後に、注意点が 2 つあります。

1. `stroke-alignment` は標準の SVG 属性ではないため、SVG へ書き出すときは `points` を再計算する必要があります。これはシェーダーで法線と角の二等分線に沿って押し出す論理と同じで、紙幅の都合で展開しません。
2. ピッキング判定、つまり `containsPoint` も、`points` をオフセットした頂点に基づいて計算する必要があります。上の例でマウスを出入りさせ、ポリラインの色が変わるか試せます。

### 破線 {#dash}

破線の各断片には、それぞれ両端があります。実線のストロークに周期的なアルファマスクを掛けると、直線区間では平らに切れた断面を作れますが、丸い端は作れません。角を入ってくる線分だけへ投影すると、位置のずれたくさびができます。

まず、**中心線**に沿って累積した距離を、正しい線分インスタンスへ対応させます。`[[0, 0], [100, 0], [200, 0]]` では、インスタンスは省略可能な開始キャップと 2 本の線分で、開始距離は `[0, 0, 100]` です。各インスタンスは、前の線分と次の線分の開始距離も持ちます。`-1` はその隣接が存在しないことを意味します。

```glsl
layout(location = ${Location.TRAVEL}) in vec3 a_Travel;
// x: current segment start; y: previous start; z: next start
```

フラグメントシェーダーでは `period = dash + gap` を使って最も近い塗られる区間を見つけ、その区間を対応する中心線の線分へクリップします。塗られる長さは **dash** であり、gap ではありません。この課では、まだ 2 つの数値からなるパターンだけをサポートします。周期は正の値ならすべて有効で、1 ピクセル未満も含みます。gap が 0 なら実線になります。

`strokeLinecap: 'round'` のとき、塗られる各区間はカプセルです。ここで `p.x` はその区間に沿ったワールド単位の距離、`p.y` は中心線からの垂直距離、`dashLength` は同じ単位でのクリップ後の長さです。

```glsl
float radius = strokeWidth * 0.5;
float alongOutside = max(max(-p.x, p.x - dashLength), 0.0);
float distance = length(vec2(alongOutside, p.y)) - radius;
float coverage = clamp(
    0.5 - distance / max(fwidth(distance), 0.0001),
    0.0, 1.0
);
```

半径には線幅の半分をそのまま使います。すでにスケールされた垂直距離と混ぜると、端と本体が細くなりすぎます。`butt` は矩形を使い、`square` は両端でその矩形を半幅だけ延ばします。丸い端と四角い端は名目上の gap の中へ入るので、gap がストローク幅より狭いと、隣り合う破線が接することがあります。

角では、両方の線分の方向が必要です。

1. 現在、前、次の線分で見える破線区間を評価し、その和集合を取ります。隣の周期のマスも調べるので、端の不完全な破線と負のオフセットが動作します。
2. 1 本の破線が頂点をまたいで続く場合は、その線分境界の人工的な端を抑制し、外側の角には `strokeLinejoin` を使います。
3. 破線がそこで止まる、または頂点が gap の中にある場合は、実線の接合くさびを追加しません。実際の破線の端は角に重なり得ます。実線ストロークの round や bevel の接合で、その端をクリップしないでください。
4. 閉じたパスは、最初と最後の線分を実際の累積距離でつなぎます。独立したサブパスは 0 から数え直します。

`strokeDashoffset` が変わってもジオメトリは固定で、変わるのはユニフォームだけです。符号付き距離のアンチエイリアスの分母は 0 から離れるよう制限し、被覆率が一定のフラグメントも例外にしません。

`stroke-dashoffset` をリアルタイムに変化（増加）させ、マーチングアンツの効果を出すこともできます。このようなアニメーションは、通常同じ名前の SVG 属性で実装します。参照: [How to animate along an SVG path at the same time the path animates?]

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 200],
                [200, 100],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeDasharray: [10, 10],
            strokeDashoffset: 0,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [300, 200],
                [500, 200],
                [500, 100],
            ],
            stroke: 'black',
            strokeWidth: 10,
            strokeDasharray: [20, 20],
            strokeDashoffset: 0,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        polyline1.addEventListener('pointerenter', () => {
            polyline1.stroke = 'green';
        });
        polyline1.addEventListener('pointerleave', () => {
            polyline1.stroke = 'black';
        });
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
        polyline1.strokeDashoffset += 0.1;
    });
});
```

別の実装方法では `fract()` を使います。参照: [Pure WebGL Dashed Line]。

SVG 仕様では、属性 `stroke-dasharray` と `stroke-dashoffset` を Circle / Ellipse / Rect などのほかの図形にも適用できます。したがってこの 2 つの属性に妥当な値があるときは、もともと SDF で描いていた輪郭を Polyline の実装へ変える必要があります。Rect を例にすると、外側の影、矩形の本体、破線の輪郭を描くために、ドローコールが最大 3 つ必要になることがあります。

```ts
SHAPE_DRAWCALL_CTORS.set(Rect, [ShadowRect, SDF, SmoothPolyline]);
```

Rect では 5 つの点を作ります。4 つの角と、繰り返した最初の点です。GPU インスタンスを用意するとき、最初の線分の前の点を最後の線分へ、最後の線分の次の点を最初の線分へつなぎます。これで、長さがイプシロンの余分な線分や端のキャップなしに接合が閉じます。Circle と Ellipse も同じ閉じ方で、サンプル数だけ多くします（ここでは `64`）。

```ts
if (object instanceof Polyline) {
    points = object.points.reduce((prev, cur) => {
        prev.push(cur[0], cur[1]);
        return prev;
    }, [] as number[]);
} else if (object instanceof Rect) {
    const { x, y, width, height } = object;
    points = [x, y, x + width, y, x + width, y + height, x, y + height, x, y];
}
```

```js eval code=false
$icCanvas5 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas5.parentElement.style.position = 'relative';
    $icCanvas5.parentElement.appendChild($stats);

    $icCanvas5.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            stroke: 'red',
            strokeWidth: 10,
        });
        rect.width = 100;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 200,
            y: 50,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);

        const circle = new Circle({
            cx: 400,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(circle);

        const circle2 = new Circle({
            cx: 550,
            cy: 100,
            r: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 20],
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle2);

        const ellipse = new Ellipse({
            cx: 150,
            cy: 250,
            rx: 100,
            ry: 50,
            fill: 'black',
            stroke: 'red',
            strokeWidth: 20,
            strokeDasharray: [5, 5],
        });
        canvas.appendChild(ellipse);
    });

    $icCanvas5.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## バウンディングボックスの計算 {#geometry-bounds}

レンダリングから一旦離れ、幾何計算を行います。これまでの課で紹介したとおり、バウンディングボックスはピッキングとカリングの両方で計算する必要があります。

線幅のような描画属性を無視すれば、幾何的なバウンディングボックスの計算はとても単純です。ポリラインのすべての頂点について、最小座標と最大座標を求めれば十分です。

```ts
const minX = Math.min(...points.map((point) => point[0]));
const maxX = Math.max(...points.map((point) => point[0]));
const minY = Math.min(...points.map((point) => point[1]));
const maxY = Math.max(...points.map((point) => point[1]));

return new AABB(minX, minY, maxX, maxY);
```

線幅、端点、接合が関わると、ポリラインのバウンディングボックス計算はより複雑になります。精密な結果が不要なら、前述のバウンディングボックスを線幅の半分だけ外側へ広げれば済みます。[Calculate bounding box of line with thickness] は、Cairo が提供する [cairo-stroke-extents] の方法を使います。線幅が `0` なら [cairo-path-extents] へ退化します。

> ユーザ座標で、影響を受ける領域（つまり「インクが載る」領域）を覆うバウンディングボックスを計算します。

Cairo のソースコードをさらに読み進めると、ストロークのバウンディングボックスにも 2 つの方法があることが分かります（ここでは多数のパラメータを省きます）。前者は推定なのでより速く、後者は端点と接合の具体的な形状を考慮して精密に計算します。

```c
cairo_private void
_cairo_path_fixed_approximate_stroke_extents ();

cairo_private cairo_status_t
_cairo_path_fixed_stroke_extents ();
```

### 簡易推定 {#approximate-stroke-extents}

この推定は、幾何的なバウンディングボックスを基準に、水平方向と垂直方向へ一定距離だけ外側へ広げることです。距離は `style_expansion * strokeWidth` です。

```c
/*
 * For a stroke in the given style, compute the maximum distance
 * from the path that vertices could be generated.  In the case
 * of rotation in the ctm, the distance will not be exact.
 */
void
_cairo_stroke_style_max_distance_from_path (const cairo_stroke_style_t *style,
         const cairo_path_fixed_t *path,
                                            const cairo_matrix_t *ctm,
                                            double *dx, double *dy)
{
    double style_expansion = 0.5;

    if (style->line_cap == CAIRO_LINE_CAP_SQUARE)
 style_expansion = M_SQRT1_2;

    if (style->line_join == CAIRO_LINE_JOIN_MITER &&
 ! path->stroke_is_rectilinear &&
 style_expansion < M_SQRT2 * style->miter_limit)
    {
 style_expansion = M_SQRT2 * style->miter_limit;
    }

    style_expansion *= style->line_width;
}
```

`stroke-linecap="square"` の場合を考えると、次の図は最も理想的な状況で `style_expansion` が `0.5` になることを示します。つまり赤い本体から `0.5 * strokeWidth` だけ広げ、黒い領域が `<polyline>` のバウンディングボックスです。

<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="10,10 300,10"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="10,10 300,10"
    />
  </g>
</svg>

ただしポリラインが 45 度ほど傾くと、このとき外側へ広げる距離は `sqrt(2) / 2 * strokeWidth` です。

<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <g>
    <polyline
      fill="none"
      stroke="black"
      stroke-width="20"
      stroke-linecap="square"
      points="30,30 200,200"
    />
    <polyline
      fill="none"
      stroke="red"
      stroke-width="2"
      points="30,30 200,200"
    />
    <polygon
      fill="none"
      stroke="red"
      stroke-width="2"
      points="15,15 215,15 215,215 15,215"
    />
  </g>
</svg>

同様に `stroke-linejoin="miter"` の場合も考慮する必要があります。この推定は、頂点と接合を一つずつ精密には考慮せず、バウンディングボックスがポリラインを収められるよう、最も楽観的な見積もりだけを行います。

以下ではポリラインのバウンディングボックスをリアルタイムに描き、左から `strokeLinecap` の異なる値を示します。

```js eval code=false
$icCanvas6 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline, Rect } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas6.parentElement.style.position = 'relative';
    $icCanvas6.parentElement.appendChild($stats);

    function drawBounds(canvas, polyline) {
        const { minX, minY, maxX, maxY } = polyline.getBounds();
        const bounds = new Rect({
            x: minX,
            y: minY,
            stroke: 'red',
            fill: 'none',
        });
        bounds.width = maxX - minX;
        bounds.height = maxY - minY;
        canvas.appendChild(bounds);
    }

    $icCanvas6.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [200, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);
        drawBounds(canvas, polyline1);

        const polyline2 = new Polyline({
            points: [
                [300, 100],
                [400, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        drawBounds(canvas, polyline2);

        const polyline3 = new Polyline({
            points: [
                [500, 100],
                [600, 200],
            ],
            stroke: 'black',
            strokeWidth: 20,
            strokeLinecap: 'square',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        drawBounds(canvas, polyline3);
    });

    $icCanvas6.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 精密な計算 {#stroke-extents}

本当に精密に計算したい場合はどうするのでしょうか。Cairo の考えは、まず Polygon へ変換し、そのバウンディングボックスを計算することです。

![ストロークの範囲](/polyline-extents.png)

```c
cairo_status_t
_cairo_path_fixed_stroke_extents (const cairo_path_fixed_t *path,
      const cairo_stroke_style_t *stroke_style,
      const cairo_matrix_t  *ctm,
      const cairo_matrix_t  *ctm_inverse,
      double    tolerance,
      cairo_rectangle_int_t  *extents)
{
    cairo_polygon_t polygon;
    cairo_status_t status;
    cairo_stroke_style_t style;

    _cairo_polygon_init (&polygon, NULL, 0);
    status = _cairo_path_fixed_stroke_to_polygon (path,
        stroke_style,
        ctm, ctm_inverse,
        tolerance,
        &polygon);
    _cairo_box_round_to_rectangle (&polygon.extents, extents);
    _cairo_polygon_fini (&polygon);

    return status;
}
```

## 性能テスト {#perf}

性能を試します。それぞれ 20,000 点を含むポリラインをいくつか表示します。

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    let polyline1;
    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50]);
        polyline1 = new Polyline({
            points: data,
            stroke: 'black',
            strokeWidth: 2,
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline1);

        const data2 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 100]);
        polyline2 = new Polyline({
            points: data2,
            stroke: 'black',
            strokeWidth: 2,
            strokeLinejoin: 'round',
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);

        const data3 = new Array(20000)
            .fill(undefined)
            .map((_, i) => [i, Math.random() * 50 + 200]);
        polyline3 = new Polyline({
            points: data3,
            stroke: 'black',
            strokeWidth: 2,
            strokeDasharray: [4, 4],
            fill: 'none',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

悪くは見えませんが、よく考えると次の問題が残っており、今後の改善の方向と見なせます。

-   各インスタンスが頂点を 15 個使い、バッファにもサイズ制限があるため、1 本のポリラインに含められる頂点数は実際には限られます。
-   現在はポリライン 1 本がドローコール 1 つに対応します。似たポリラインが大量に繰り返される場合はどうするのでしょうか。[regl-gpu-lines] は 2 つの考え方を示しています。
    -   1 つのドローコールで複数のポリラインを描くこともできます。`[NaN, NaN]` で切れ目を示します。例: [Multiple lines]
    -   複数のポリラインの頂点データが同じでオフセットだけが違うなら、各ポリラインを 1 つのインスタンスと見なせます。もちろん各ポリライン内部の頂点は展開する必要があります。例: [Fake instancing]
-   現在のカメラのズームレベルに基づいて頂点を簡略化します。

以下では、この方針に沿って最適化を続けます。

### 複数の区間を持つポリライン {#polyline-with-multiple-segments}

ドローコール数を減らす先の最適化と同じ方針で、複数のポリラインをつなげられます。もちろん何らかの区切りが必要で、[regl-gpu-lines] にならい `[NaN, NaN]` を使います。パスを描くときにも、すぐにこれを使います。1 本のパスに複数のサブパスが含まれることがあるためです。

```bash
Polyline1: [[0, 0], [100, 100]]
Polyline2: [[100, 0], [200, 100]]
MultiPolyline: [[0, 0], [100, 100], [NaN, NaN], [100, 0], [200, 100]]
```

区切りで分割したあとでも、各区間の頂点配列は上と同じ方法で構築します。

```ts
const subPaths = [];
let lastNaNIndex = 0;
for (let i = 0; i < points.length; i += stridePoints) {
    if (isNaN(points[i]) || isNaN(points[i + 1])) {
        subPaths.push(points.slice(lastNaNIndex, i));
        lastNaNIndex = i + 2;
    }
}
subPaths.push(points.slice(lastNaNIndex));
subPaths.forEach((points) => {
    // Omit constructing each segments
});
```

効果は次のとおりで、注意点は次のとおりです。

-   複数のポリラインが 1 本にまとまるため、ピッキングも全体を 1 つとして追います。下の 3 組の上にマウスを乗せてみてください。
-   SVG へ書き出すとき、対応する `<polyline>` 要素へ直接書き出せなくなります。

```js eval code=false
$icCanvas7 = call(() => {
    return document.createElement('ic-canvas-lesson12');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Polyline } = Lesson12;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas7.parentElement.style.position = 'relative';
    $icCanvas7.parentElement.appendChild($stats);

    $icCanvas7.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        const data = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200, Math.random() * 200],
            [Math.random() * 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline = new Polyline({
            points: data.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline);
        polyline.addEventListener(
            'pointerenter',
            () => (polyline.stroke = 'red'),
        );
        polyline.addEventListener(
            'pointerleave',
            () => (polyline.stroke = 'black'),
        );

        const data2 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 200, Math.random() * 200],
            [Math.random() * 200 + 200, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline2 = new Polyline({
            points: data2.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline2);
        polyline2.addEventListener(
            'pointerenter',
            () => (polyline2.stroke = 'green'),
        );
        polyline2.addEventListener(
            'pointerleave',
            () => (polyline2.stroke = 'black'),
        );

        const data3 = new Array(200).fill(undefined).map((_, i) => [
            [Math.random() * 200 + 400, Math.random() * 200],
            [Math.random() * 200 + 400, Math.random() * 200],
            [NaN, NaN],
        ]);
        const polyline3 = new Polyline({
            points: data3.flat(1),
            stroke: 'black',
            strokeWidth: 2,
            strokeLinecap: 'round',
            cursor: 'pointer',
        });
        canvas.appendChild(polyline3);
        polyline3.addEventListener(
            'pointerenter',
            () => (polyline3.stroke = 'blue'),
        );
        polyline3.addEventListener(
            'pointerleave',
            () => (polyline3.stroke = 'black'),
        );
    });

    $icCanvas7.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### [WIP] 似たポリラインをまとめる {#merge-similar-polylines}

### ポリラインの簡略化 {#simplify-polyline}

頂点を大量に含むポリライン（およびその後の Path と Polygon）では、現在のズームレベルに応じて簡略化し、レンダリングするデータ量をできるだけ減らすことが重要な最適化です。簡略化の根拠は 2 つです。

1. 短すぎる線分と、小さすぎるポリゴンは除外できます。
2. ポリラインの中で、全体の形状への影響が小さい頂点は除外できます。

線分の頂点を簡略化する基本アルゴリズムは [Ramer–Douglas–Peucker algorithm] で、次のように動作します。

1. まずポリラインの最初と最後の頂点を残し、それらを結びます。
2. 残りの頂点のうち、その線分から最も遠い頂点を見つけ、その距離を保持します。
3. 距離がしきい値より小さければ破棄します。
4. 距離がしきい値より大きければその頂点を残し、始点と終点とともに 2 つの部分線分に分割します。
5. 分割統治法で 2 つの部分線分を処理し、1 に戻ります。

下の図（wiki より）がこの過程を示します。赤い点は破棄し、緑の点は残します。

![Douglas–Peucker アルゴリズムで区分線形曲線を単純化する様子](https://upload.wikimedia.org/wikipedia/commons/3/30/Douglas-Peucker_animated.gif)

しきい値（ε）を大きくするほど、最終的な簡略化のあとに残る頂点数（n）は減り、ポリラインは滑らかでなくなります。

![RDP のパラメトリック実装でイプシロンを変えたときの効果](https://upload.wikimedia.org/wikipedia/commons/6/69/RDP%2C_varying_epsilon.gif)

このアルゴリズムに基づく JS 実装は多数あります。[simplify-js]、[turf-simplify]、[geojson-vt] などです。geojson-vt の実装を例に取ります。

```ts
export default function simplify(coords, first, last, sqTolerance) {
    let maxSqDist = sqTolerance;
    const mid = (last - first) >> 1;
    let minPosToMid = last - first;
    let index; // index of maximum distance

    const ax = coords[first];
    const ay = coords[first + 1];
    const bx = coords[last];
    const by = coords[last + 1];

    // Find the point with the greatest distance from the line segment
    for (let i = first + 3; i < last; i += 3) {
        const d = getSqSegDist(coords[i], coords[i + 1], ax, ay, bx, by);
        if (d > maxSqDist) {
            index = i;
            maxSqDist = d;
        }
    }

    if (maxSqDist > sqTolerance) {
        // Recursively process the first half of the line segment
        if (index - first > 3) simplify(coords, first, index, sqTolerance);
        // Preserving the maximum distance indicates that this vertex needs to be preserved
        coords[index + 2] = maxSqDist;
        // Half of the line segments after recursive processing
        if (last - index > 3) simplify(coords, index, last, sqTolerance);
    }
}
```

この方法は、後の [第 25 課 - ブラシモードでポリラインを使う] でも使います。

## その他の問題 {#followup-issues}

ここまでで、ポリラインの基本的な描画を終えました。最後に、関連するほかの問題を見ます。紙幅の都合で、一部は今後の課で詳しく扱います。

### SizeAttenuation {#size-attenuation}

場面によっては、図形の大きさがカメラのズームに合わせて変わってほしくないことがあります。たとえば Figma で図形を選択したときに表示される、バウンディングボックスのワイヤーフレームとその下のサイズラベルです。

![Figma のサイズ減衰](/size-attenuation.gif)

Three.js ではこれを `sizeAttenuation` と呼びます。透視投影では、Sprite はカメラの深度が大きくなるほど小さくなります。選択 UI を実装するときに、これを実装します。

### 線、パス、ポリゴン {#line-path-polygon}

SVG には、まだ `<line>`、`<path>`、`<polygon>` の 3 つの要素があります。

-   `<line>` は `strokeLinejoin` を考慮しなくてよいので、使う頂点数を減らせます。
-   `<polygon>` の塗りは、earcut などのアルゴリズムで三角形分割したあと描け、輪郭はポリラインとまったく同じです。
-   `<path>` も `<rect>` や `<circle>` と同じようにパス上をサンプリングし、最後はポリラインで描けますが、次のような問題があります。[Draw arcs, arcs are not smooth ISSUE]

次の課で、これらの描き方を詳しく紹介します。

## さらに読む {#extended-reading}

-   [How 2 draw lines in WebGL]
-   [regl-gpu-lines]
-   [Drawing Instanced Lines with regl]
-   [Instanced Line Rendering Part I]
-   [Instanced Line Rendering Part II]
-   [pixijs/graphics-smooth]
-   [Polar Stroking: New Theory and Methods for Stroking Paths]

[第 5 課 - 直線グリッド]: /ja/guide/lesson-005#lines-grid
[lineJoin]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin
[lineCap]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineCap
[lineWidth]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/lineWidth
[points]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
[stroke-linejoin]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
[stroke-linecap]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
[stroke-dashoffset]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
[stroke-dasharray]: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
[Instanced Line Rendering Part I]: https://wwwtyro.net/2019/11/18/instanced-lines.html
[Instanced Line Rendering Part II]: https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html
[LineLayer]: https://deck.gl/docs/api-reference/layers/line-layer
[PathLayer]: https://deck.gl/docs/api-reference/layers/path-layer
[Drawing Antialiased Lines with OpenGL]: https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc
[regl-gpu-lines]: https://github.com/rreusser/regl-gpu-lines
[instanced example]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Drawing Instanced Lines with regl]: https://observablehq.com/@rreusser/drawing-instanced-lines-with-regl
[pixijs/graphics-smooth]: https://github.com/pixijs/graphics-smooth
[How 2 draw lines in WebGL]: https://www.khronos.org/assets/uploads/developers/presentations/Crazy_Panda_How_to_draw_lines_in_WebGL.pdf
[インスタンス描画]: /ja/guide/lesson-008#instanced
[SDF のアンチエイリアス]: /ja/guide/lesson-002#antialiasing
[矩形の外側の影を描く]: /ja/guide/lesson-009#drop-shadow
[WebGPU instancing problem]: https://github.com/pixijs/pixijs/issues/7511#issuecomment-2247464973
[spec: It is useful to allow GPUVertexBufferLayout.arrayStride to be less than offset + sizeof(attrib.format)]: https://github.com/gpuweb/gpuweb/issues/2349
[Draw arcs, arcs are not smooth ISSUE]: https://github.com/pixijs/graphics-smooth/issues/23
[拡張 SVG: ストローク配置]: /ja/guide/lesson-010#stroke-alignment
[Calculate bounding box of line with thickness]: https://stackoverflow.com/questions/51210467/calculate-bounding-box-of-line-with-thickness
[cairo-stroke-extents]: https://cairographics.org/manual/cairo-cairo-t.html#cairo-stroke-extents
[cairo-path-extents]: https://cairographics.org/manual/cairo-Paths.html#cairo-path-extents
[Cairo - Fix for round joins]: https://gitlab.freedesktop.org/cairo/cairo/-/merge_requests/372#note_1698225
[Pure WebGL Dashed Line]: https://webgl2fundamentals.org/webgl/lessons/webgl-qna-pure-webgl-dashed-line.html
[How to animate along an SVG path at the same time the path animates?]: https://benfrain.com/how-to-animate-along-an-svg-path-at-the-same-time-the-path-animates/
[Fake instancing]: https://rreusser.github.io/regl-gpu-lines/docs/instanced.html
[Multiple lines]: https://rreusser.github.io/regl-gpu-lines/docs/multiple.html
[Offset in bytes into buffer where the vertex data begins]: https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-setvertexbuffer-slot-buffer-offset-size-offset
[simplify-js]: https://github.com/mourner/simplify-js
[geojson-vt]: https://github.com/mapbox/geojson-vt
[turf-simplify]: https://github.com/Turfjs/turf/tree/master/packages/turf-simplify
[Ramer–Douglas–Peucker algorithm]: https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
[第 25 課 - ブラシモードでポリラインを使う]: /ja/guide/lesson-025#use-polyline
[Polar Stroking: New Theory and Methods for Stroking Paths]: https://developer.download.nvidia.com/video/siggraph/2020/presentations/sig03-polar-stroking-new-theory-and-methods-for-stroking-paths.pdf
