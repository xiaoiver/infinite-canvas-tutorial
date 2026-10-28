---
outline: deep
description: 'キャンバスに図形を追加し、SDF（符号付き距離場）を使って円を描く方法を学びます。性能を最適化するための、アンチエイリアスの手法とダーティフラグの設計パターンを扱います。'
head:
    - ['meta', { property: 'og:title', content: '第2課 - 円を描く' }]
---

# 第 2 課 - 円を描く {#lesson-2-draw-a-circle}

この課では、次の内容を学びます。

-   キャンバスへの図形の追加
-   SDF を使った円の描画
-   アンチエイリアス
-   ダーティフラグの設計パターン

プロジェクトを起動すると、キャンバスに描かれた円が表示され、幅と高さを変えたり、WebGL / WebGPU のレンダラーを切り替えたりできます。

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false inspector=false
canvas = (async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 100, 100, renderer);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

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

```js eval code=false inspector=false
call(() => {
    Utils.resizeCanvas(canvas, width, height);
});
```

```js eval code=false
call(() => {
    return canvas.getDOM();
});
```

## キャンバスに図形を追加する {#adding-shapes-to-canvas}

前の課では空のキャンバスを作りました。この後、さまざまな図形を追加していきます。そのような API はどう設計すればよいでしょうか。フロントエンド開発者なら、馴染みのある [Node API appendChild] を参考にしたくなるかもしれません。

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

一時的に図形の基底クラスを作ります。Circle、Ellipse、Rect などがこれを継承します。

```ts
export abstract class Shape {}
```

キャンバス内の図形の一覧は、配列で保持します。

```ts
#shapes: Shape[] = [];

appendChild(shape: Shape) {
  this.#shapes.push(shape);
}

removeChild(shape: Shape) {
  const index = this.#shapes.indexOf(shape);
  if (index !== -1) {
    this.#shapes.splice(index, 1);
  }
}
```

キャンバスの render メソッドでは図形の一覧を走査し、render フックを呼びます。

```ts{4}
render() {
  const { hooks } = this.#pluginContext;
  hooks.beginFrame.call();
  this.#shapes.forEach((shape) => {
    hooks.render.call(shape);
  });
  hooks.endFrame.call();
}
```

レンダリングプラグインでは、各フレームの開始前に `RenderPass` を作ります。これはハードウェア抽象化レイヤーの中でカプセル化されています。WebGL にはこの概念はありませんが、WebGPU では [beginRenderPass] が [GPURenderPassEncoder] を返します。これは `draw` コマンドを含む一連のコマンドを記録します。後で `render` フックの中で見ます。`RenderPass` を作るときは、次のパラメータを渡します。

-   `colorAttachment`
-   `colorResolveTo`
-   `colorClearColor` これは WebGL では [gl.clearColor] コマンドで実装します。WebGPU では [clearValue] プロパティで宣言し、ここでは白に設定します。

```ts{4}
hooks.beginFrame.tap(() => {
  this.#device.beginFrame();

  this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
  });
});
```

作成と対になる処理として、各フレームの終わりに `RenderPass` をサブミットします。対応する [submit] メソッドは WebGPU でも簡単に見つかります。もちろん、ネイティブ API が提出するのはエンコード済みのコマンドバッファであり、ハードウェア抽象化レイヤーはこれらの概念を簡略化しています。

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

最後が `render` フックです。各図形は、自分自身を描くロジックの実装を担当します。プラグインは、Device や `RenderPass` など、必要な GPU オブジェクトを渡すことを担当します。

```ts
hooks.render.tap((shape) => {});
```

## 円を描く {#draw-a-circle}

まず行うのは、円の基本的な属性を定義することです。SVG の [circle] に馴染みがあれば、中心 `cx/cy` と半径 `r` で円の形状を定義でき、汎用の描画属性 `fill` と `stroke` で基本的な要求を満たせることが分かるでしょう。

```ts
export class Circle extends Shape {
    constructor(
        config: Partial<{
            cx: number;
            cy: number;
            r: number;
            fill: string;
        }> = {},
    ) {}
}
```

### キャンバス座標 {#canvas-coordinates}

`cx/cy` のように円の中心を表す位置属性の話になったので、使っているキャンバス座標系を明確にしておく必要があります。Canvas と SVG のどちらでも、座標系の原点は左上で、X 軸の正方向は 👉、Y 軸の正方向は 👇 です。一方、WebGL で使う [クリップ座標系] は OpenGL の仕様に従います。原点はビューポートの中心にあり、X 軸は 👉、Y 軸は 👆、Z 軸は画面の内側を向きます。下の、各辺の長さが 2 の立方体は、正規化デバイス座標（normalized device coordinates、NDC）とも呼ばれます。

![クリップ空間](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

一方、WebGPU は Metal の仕様に従い、WebGL とは違って Y 軸の正方向は 👇、Z 軸の正方向は外側です。Z 軸のクリップ範囲も異なり、WebGL では `[-1, 1]`、WebGPU では `[0, 1]` です。

![WebGL と WebGPU における Z のクリップ空間の範囲](/clip-space-z-range.png)

ハードウェア抽象化レイヤーは、WebGL と WebGPU の違いを吸収しようとします。ただし座標系は Canvas / SVG に合わせます。ボードを使う人の習慣により近いと考えたためです。

![キャンバスの既定のグリッド](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

したがって、キャンバスの幅と高さがどちらも 200 なら、次の方法で追加した `Circle` はキャンバスの中央に現れます。

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

次の問題は、スクリーン座標系の `cx/cy` を、レンダーパイプラインのための NDC にどう変換するかです。キャンバスの幅と高さは Uniform として渡し、円の位置は Attribute として渡します。位置を幅と高さで割ると `[0, 1]` の範囲の値になり、それを 2 倍してから 1 を引くと `[-1, 1]`、つまり NDC の値の範囲になります。最後に Y 軸を反転します。

```glsl
layout(std140) uniform SceneUniforms {
  vec2 u_Resolution; // width & height of canvas
};
layout(location = 1) in vec2 a_Position; // cx & cy

// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = (a_Position + a_Size * a_FragCoord) / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

### 色の値を処理する {#processing-color-values}

Canvas や SVG とは違い、文字列の色の値は WebGL や WebGPU で直接は使えません。ただし [d3-color] を使えば `{ r, g, b, opacity }` 形式へ変換でき、その後 `vec4` として、または圧縮して、`attribute` へ直接渡せます。今のところ対応しているのは RGB 空間の色の値だけなので、[hsl] と [oklch] は使えません。

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

スタイルの問題は片付いたので、ジオメトリに戻りましょう。三角形メッシュは、3D レンダリングでよく使われるジオメトリの表現です。Three.js の [CircleGeometry] は、中心から円を三角形に分割し、手続き的にジオメトリを生成します。明らかに、三角形が多いほど円は滑らかになり、三角形が 2 つだけなら正方形に退化します。滑らかな円を得るには頂点を増やす必要があり、円の数が増えると GPU のメモリが大きく増えます。

![Three.js の CircleGeometry](/circle-geometry.png)

### SDF {#sdf}

符号付き距離関数（Signed Distance Functions、SDF）と呼ばれる方法を使うと、必要な頂点は 4 つだけです。次の図は SDF の概念を視覚化したもので、新興エディタ Zed の実践記事 [drawing-rectangles] からのものです。半径 100 の円に対する平面上の点は、円周上では距離が 0、円の内側では負、外側では正になります。

![SDF の円](/sdf.svg)

> 元の記事は Lottie アニメーションで、有向距離場の定義と、基本図形についてのいくつかの公式の導出を示しています。Zed の GPUI でも、性能を上げるために SDF で基本図形を描いています。

通常、座標系は頂点シェーダーで作ります。

```glsl
layout(location = 0) in vec2 a_FragCoord;
out vec2 v_FragCoord;
void main() {
  v_FragCoord = a_FragCoord;
}
```

距離の情報があれば、フラグメントシェーダーで図形ごとの SDF の式を使い、現在のピクセルの座標を代入して、その点が図形の内側にあるかを判定できます。外側ならそのまま破棄し、そうでなければ着色します。GLSL のコードは次のとおりです。一部の効果は部分的な透明度を気にせず、テクスチャの色の値に基づいて、何かを完全に表示するか、まったく表示しないかのどちらかだけを求めます。詳しくは [Discarding fragments] を参照してください。

```glsl
float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  float distance = sdf_circle(v_FragCoord, 1.0);
  if (distance > 0.0) {
    discard;
  }
  outputColor = vec4(1.0, 0.0, 0.0, 1.0);
}
```

頂点が少なくて済むことに加え、SDF には次の利点があります。

-   アンチエイリアスが容易です。次の小節で扱います。
-   組み合わせが容易です。交差と差の演算を組み合わせれば、複雑な図形を作れます。
-   見た目が複雑な効果を実現しやすいです。たとえばストローク、角丸、影です。もちろん、これらの効果を実装するときには、この方法の制限もいくつか紹介します。

SDF の説明と詳しい導出は [distfunctions] にもあります。この方法では、よくあるさまざまな 2D 図形や、3D 図形さえ描けます。この後、矩形やテキストを描くときも、引き続き使います。

図形の基底クラスに戻り、描画に必要なパラメータを受け取るメソッドを追加しましょう。

```ts{2}
export abstract class Shape {
  abstract render(device: Device, renderPass: RenderPass): void;
}
```

プラグインの `render` フックの中で呼び出し、必要なパラメータを渡します。

```ts
hooks.render.tap((shape) => {
    shape.render(this.#device, this.#renderPass);
});
```

`Circle` の `render` メソッドでは、クリップ空間と一致する単位座標系を作ります。頂点は 4 つで、`indexBuffer` のインデックス配列によって 2 つの三角形（V0 -> V1 -> V2 と V0 -> V2 -> V3）に分割します。

<img alt="単位円" src="/unit-circle.png" width="300" />

```ts
this.#fragUnitBuffer = device.createBuffer({
    viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
    usage: BufferUsage.VERTEX,
});

this.#indexBuffer = device.createBuffer({
    viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
    usage: BufferUsage.INDEX,
});
```

この 4 つの頂点は、円の中心、半径、塗り色など、同じスタイル属性を共有できます。これで頂点配列が使うメモリを減らせます。

```ts
this.#instancedBuffer = device.createBuffer({
    viewOrSize: new Float32Array([
        this.#cx,
        this.#cy,
        this.#r,
        this.#r,
        this.#fillRGB.r / 255,
        this.#fillRGB.g / 255,
        this.#fillRGB.b / 255,
        this.#fillRGB.opacity,
    ]),
    usage: BufferUsage.VERTEX,
});
```

次に、頂点配列のレイアウトを指定します。これは `shaderLocation` を通じてシェーダーと結び付きます。

```ts
this.#inputLayout = device.createInputLayout({
    vertexBufferDescriptors: [
        {
            arrayStride: 4 * 2,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
                {
                    shaderLocation: 0, // layout(location = 0) in vec2 a_FragCoord;
                    offset: 0,
                    format: Format.F32_RG,
                },
            ],
        },
        {
            arrayStride: 4 * 8,
            stepMode: VertexStepMode.INSTANCE,
            attributes: [
                {
                    shaderLocation: 1, // layout(location = 1) in vec2 a_Position;
                    offset: 0,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 2, // layout(location = 2) in vec2 a_Size;
                    offset: 4 * 2,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 3, // layout(location = 3) in vec4 a_FillColor;
                    offset: 4 * 4,
                    format: Format.F32_RGBA,
                },
            ],
        },
    ],
    indexBufferFormat: Format.U32_R,
    program: this.#program,
});
```

SDF は楕円、矩形、テキストなどの描画にも使えます。ただ、今は他の図形を足さず、先に別の問題を見ます。

## アンチエイリアス {#antialiasing}

よく見るか拡大すると、縁が明らかにギザギザなのが分かります。フラグメントシェーダーでは、各ピクセルを着色するか破棄するかの二択で判定していて、その間の遷移がないからです。

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

以下では、記事 [Smooth SDF Shape Edges] を参考に、いくつかの方法を使って結果を比べます。

### Smoothstep {#smoothstep}

まず思い浮かぶのは、GLSL / WGSL の組み込み関数 `smoothstep` で平滑化することです。`step` 関数と比べ、指定した値の範囲に対して平滑化した値を作り、イージング関数 `ease-in/out` に近い効果になります。[Smoothstep - thebookofshaders.com] でパラメータを変えると、その形を目で確認できます。たとえば次の図では、x が `0` より大きいとき y は 1、x が `-0.5` より小さいとき y は 0 で、その間は平滑化されています。

<img alt="smoothstep の形" src="/smoothstep.png" width="300" />

前の節で計算した SDF の距離は負の値です。固定の小さい値 `0.01` を選ぶと、縁の近くの狭い距離の範囲を平滑化でき、処理後の値は透明度として扱えます。

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);

outputColor = v_FillColor;
outputColor.a *= alpha;
```

効果は次のとおりです。

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 1,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

この方法の問題は、円の半径がわずかに増えることです。結局、1 パーセント分だけ大きくなります。また、拡大したとき（カメラ関連の機能は後で扱います）縁が十分に鋭くありません。

### 固定値で割る {#divide-fixed}

`saturate` 関数は GLSL にはなく、`clamp` で実装できます。

```glsl
float alpha = clamp(-distance / 0.01, 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 2,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

### スクリーンスペース微分 {#screen-space-derivatives}

距離に基づくアンチエイリアスに `fwidth` を使う方法は、[Using fwidth for distance based anti-aliasing] で説明されています。`fwidth` とは何でしょうか。

[What are screen space derivatives and when would I use them?] と [What is fwidth and how does it work?] が、この方法の概念と計算を詳しく説明しています。かいつまんで言うと、フラグメントシェーダーは 1 ピクセルではなく、一度に 2x2 の quad を処理します。GPU がそうする理由は、[A trip through the Graphics Pipeline 2011, part 8] に次のように書かれています。

> また、ここは、個々のピクセルではなく 2×2 ピクセルの quad を扱う理由を説明するのに適した箇所です。大きな理由は微分です。テクスチャサンプラは、ミップマップの選択とフィルタリングを行うために、テクスチャ座標のスクリーンスペース微分に依存しています（パート 4 で見たとおりです）。そしてシェーダーモデル 3.0 以降では、同じ仕組みが微分命令という形で、ピクセルシェーダーから直接使えます。

各 2x2 の quad で、偏微分がどう計算されるかを見てみましょう。たとえば uv です。

![uv の fwidth](https://pic2.zhimg.com/80/v2-0f2d0605965ab352aec8826d0eed02dd_1440w.webp)

ある値について、そのピクセルがどれだけ急に変わったかを開発者がつかみやすくするため、OpenGL / WebGL と WebGPU はどちらも次のメソッドを提供しています。ただし WebGL1 では `GL_OES_standard_derivatives` 拡張を有効にする必要があり、WebGL2 と WebGPU では不要です。

-   `dFdx` は、画面の水平方向に 1 ピクセル進む間に、パラメータ属性の値がどれだけ変わったかを計算します。
-   `dFdy` は、画面の垂直方向に 1 ピクセル進む間に、パラメータ属性の値がどれだけ変わったかを計算します。
-   `fwidth` は `abs(dFdx) + abs(dFdy)` を計算します。

したがって、1 ピクセルの中でパラメータがどれだけ変わるかを計算する方法は 2 つあります。両者に違いはあるのでしょうか。

```glsl
pixelSize = fwidth(dist);
/* or */
pixelSize = length(vec2(dFdx(dist), dFdy(dist)));
```

[AAA - Analytical Anti-Aliasing] は、`fwidth` のオーバーヘッドが `length` より小さいと指摘しています。対角方向にわずかなずれはありますが、今の場面ではほぼ無視できます。

> Fast LAA は対角方向にわずかな偏りがあり、円形がごくわずかにひし形に見え、特に小さいときは直交方向の曲率が少し鋭くなります。対角線上の縁が少しぼやけることもあります。

SDF の計算で得た距離を渡し、その変化量を計算して、透明度に反映します。

```glsl
float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

## ダーティフラグ {#dirty-flag}

これまでは、塗り色や円の中心などのスタイル属性を頂点配列へ書き込んでいたので、色を変えたいときも Buffer の中のデータを書き換え直す必要があります。下の例のように連続して変更する場合、プロパティを変更するたびにすぐに基盤の API を呼ぶと、不要なオーバーヘッドが大量に出ます。

```ts
circle.fill = 'blue';
circle.fill = 'yellow';
circle.cx = 500;
```

データの変更のような時間のかかる処理は後回しにし、レンダリングの前など適切なタイミングでまとめて処理したいと考えます。そこで、[Dirty Flag - Game Programming Patterns] にある「ダーティフラグ」という一般的な設計パターンを適用します。プロパティを変更するときは、ダーティフラグを立てるだけで、それ以外の時間のかかる処理は行いません。

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true;
  }
}
```

`render` メソッドでは、プロパティの変更を検出したときだけ、基盤のバッファを更新します。こうすると、レンダリングとレンダリングの間にプロパティの変更が何回あっても、バッファの更新は 1 回だけです。

```ts
if (this.renderDirtyFlag) {
    this.#instancedBuffer.setSubData(
        0,
        new Uint8Array(
            new Float32Array([
                this.#cx,
                this.#cy,
                this.#r,
                this.#r,
                this.#fillRGB.r / 255,
                this.#fillRGB.g / 255,
                this.#fillRGB.b / 255,
                this.#fillRGB.opacity,
            ]).buffer,
        ),
    );
}
```

もちろん、レンダリングが終わったら、ダーティフラグをリセットするのを忘れないでください。

```ts
this.renderDirtyFlag = false;
```

効果を試してみましょう。

```js eval code=false
cx2 = Inputs.range([50, 300], { label: 'cx', value: 100, step: 1 });
```

```js eval code=false
cy2 = Inputs.range([50, 300], { label: 'cy', value: 100, step: 1 });
```

```js eval code=false
r2 = Inputs.range([50, 300], { label: 'r', value: 100, step: 1 });
```

```js eval code=false
fill2 = Inputs.color({ label: 'fill', value: '#ff0000' });
```

```js eval code=false inspector=false
circle = (() => {
    const { Circle } = Lesson2;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    return circle;
})();
```

```js eval code=false inspector=false
(() => {
    circle.cx = cx2;
    circle.cy = cy2;
    circle.r = r2;
    circle.fill = fill2;
})();
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    canvas.appendChild(circle);

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
    return canvas.getDOM();
})();
```

この後のシーングラフの紹介でも、ダーティフラグを使います。

## さらに読む {#extended-reading}

-   [distfunctions]
-   [Leveraging Rust and the GPU to render user interfaces at 120 FPS]
-   [Sub-pixel Distance Transform - High quality font rendering for WebGPU]
-   [AAA - Analytical Anti-Aliasing]
-   [Learn Shader Programming with Rick and Morty]

[Node API appendChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[hsl]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
[drawing-rectangles]: https://zed.dev/blog/videogame#drawing-rectangles
[distfunctions]: https://iquilezles.org/articles/distfunctions/
[Leveraging Rust and the GPU to render user interfaces at 120 FPS]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clearColor
[clearValue]: https://www.w3.org/TR/webgpu/#dom-gpurenderpasscolorattachment-clearvalue
[Using fwidth for distance based anti-aliasing]: http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/
[What is fwidth and how does it work?]: https://computergraphics.stackexchange.com/a/63
[What are screen space derivatives and when would I use them?]: https://gamedev.stackexchange.com/questions/130888/what-are-screen-space-derivatives-and-when-would-i-use-them
[Smoothstep - thebookofshaders.com]: https://thebookofshaders.com/glossary/?search=smoothstep
[Smooth SDF Shape Edges]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[Sub-pixel Distance Transform - High quality font rendering for WebGPU]: https://acko.net/blog/subpixel-distance-transform/
[A trip through the Graphics Pipeline 2011, part 8]: https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
[Discarding fragments]: https://learnopengl.com/Advanced-OpenGL/Blending
[AAA - Analytical Anti-Aliasing]: https://blog.frost.kiwi/analytical-anti-aliasing
[Learn Shader Programming with Rick and Morty]: https://danielchasehooper.com/posts/code-animated-rick/
[oklch]: https://github.com/d3/d3-color/issues/87
[クリップ座標系]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#clip_space
