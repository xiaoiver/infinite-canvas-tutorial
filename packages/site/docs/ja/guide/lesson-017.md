---
outline: deep
description: 'CanvasGradient API でグラデーションとパターンを実装し、ノイズ効果を含むシェーダーでメッシュグラデーションを作り、グラデーション編集パネルを構築します。CSS グラデーション構文と繰り返しパターンに対応します。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第17課 - グラデーションとパターン',
          },
      ]
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
import Pattern from '../../components/Pattern.vue';
import Voronoi from '../../components/Voronoi.vue';
import FractalBrownianMotion from '../../components/FractalBrownianMotion.vue';
import DomainWarping from '../../components/DomainWarping.vue';
</script>

# 第 17 課 - グラデーションとパターン {#lesson-17-gradient-and-pattern}

この課では、グラデーションと繰り返しパターンの実装方法を見ていきます。

-   CanvasGradient でグラデーションを実装する
    -   命令的。Device API でテクスチャを作ります
    -   宣言的。CSS グラデーション構文に対応します。`linear-gradient`、`radial-gradient`、`conic-gradient`
    -   Shoelace でグラデーション設定パネルを実装します
-   シェーダーでメッシュグラデーションを実装する
    -   乱数のシミュレーション
    -   バリューノイズとグラデーションノイズ
    -   Voronoi、FBM、ドメインワーピング
-   SVG の書き出し
-   CanvasPattern で繰り返しパターンを実装する

## CanvasGradient を使う {#canvas-gradient}

[CanvasGradient] API でさまざまなグラデーション効果を作り、それをテクスチャとして消費できます。命令的な実装と宣言的な実装の両方を紹介します。

### 命令的にグラデーションテクスチャを作る {#create-gradient-texture}

線形グラデーションを例にすると、`<canvas>` を作ってコンテキストを得たあと、[createLinearGradient] にはグラデーションの方向を定める始点と終点が必要です。それから複数のカラーストップを追加し、`<canvas>` に描いて、テクスチャを作るソースとして使います。

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

[Device] API でテクスチャオブジェクトを作り、最後に図形の `fill` プロパティへ渡すと描画が完了します。

```ts
// 0. Create gradient data
const ramp = generateColorRamp({
    colors: [
        '#FF4818',
        '#F7B74A',
        '#FFF598',
        '#91EABC',
        '#2EA9A1',
        '#206C7C',
    ].reverse(),
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
});

// 1. Get canvas device
const device = canvas.getDevice();

// 2. Create texture object
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // Pass the previously created <canvas> data to texture

// 3. Pass the texture object to the shape's `fill` property
rect.fill = { texture };
```

<Gradient />

使いやすさを高め、シリアライズしやすくするため、宣言的な構文をサポートしたいと考えています。

### 宣言的な CSS グラデーション構文 {#css-gradient-syntax}

CSS のグラデーション構文に従い、[gradient-parser] で構造化された結果を得たあと、[createLinearGradient] などの API を呼び出すのに使えます。

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

ECS では、グラデーション関数名と、方向、形状、サイズ、位置のキーワードは大文字と小文字を区別しません。判定は関数名を確認するので、`linear` や `radial` を含む画像 URL はグラデーションとして扱いません。`top center` や `bottom center` のような二語の位置は、垂直軸の意味を保ちます。円形の放射グラデーションは、境界の外にある中心にも対応します。`closest-side` は最も近い辺までの距離を使い、その距離は非負のままです。

パーサーは円形の放射グラデーションに対応しています。楕円と繰り返しグラデーションは、まだ描画しません。円錐の文字列は現在、既定の角度と既存の `circle at …` 位置構文を使います。CSS の `from … at …` 構文は実装していません。構造化された `ConicGradient.angle` の値は度単位で、通常の塗りとフィルター入力で向きが一致します。

パース結果は次のとおりです。

```js eval code=false
linearGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient('linear-gradient(0deg, blue, green 40%, red)');
});
```

```js eval code=false
radialGradient = call(() => {
    const { parseGradient } = Core;
    return parseGradient(
        'radial-gradient(circle at center, red, blue, green 100%)',
    );
});
```

一般的なグラデーションの種類はいくつかあり、現在は最初の三つをサポートしています。

-   [linear-gradient] CSS と Canvas が対応しています
-   [radial-gradient] CSS と Canvas が対応しています
-   [conic-gradient] CSS と Canvas が対応しています
-   [repeating-linear-gradient] CSS が対応しています。Canvas でも工夫して実装できます。[How to make a repeating CanvasGradient] を参照してください
-   [repeating-radial-gradient] CSS が対応しています
-   [sweep-gradient] CanvasKit / Skia で対応しています

<DeclarativeGradient />

さらに、複数のグラデーションを重ねることもサポートしています。たとえば次のとおりです。

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### グラデーション編集パネル {#gradient-editor}

Figma のグラデーション編集パネルにヒントを得て、同様のエディタを実装しました。上の例で図形を選択すると、編集パネルを開けます。

![Figma のグラデーションパネル](/figma-gradient-panel.png)

## 塗りとストロークへのグラデーション適用 {#applying-gradients-to-fill-and-stroke}

塗りグラデーションは `SDF` や `Mesh` のようなドローコールが消費し、ストロークグラデーションは `SmoothPolyline` が消費します。グラデーションをテクスチャへラスタライズしたあと残る問題は、頂点シェーダーで UV をどう計算するかです。

メッシュの塗りでは、頂点シェーダーが **`u_FillUVRect`**（`minX`、`minY`、`1/width`、`1/height`）を使い、**ローカルなジオメトリ座標** をテクスチャ空間へ写します。

ストロークの頂点シェーダーには、モデル行列のあと **ワールド空間** にある **`pos`** がすでにあります。ストロークリボン上へ広げた点です。**`ComputedBounds.geometryBounds`** と揃えるには、**ローカル空間** へ戻してから `min` を引き、範囲の逆数を掛けます。

`local = inverse(model) * vec3(pos, 1.0)`、続いて `v_StrokeUv = (local.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw`。

**WebGPU** パスでは、GLSL を **naga** 経由で WGSL へ落とすとき **`inverse(mat3)` はサポートされない** ので、実装では手書きの **`inverseMat3`**（余因子行列 / 行列式）を、組み込みの `inverse` の代わりに使います。

## メッシュでグラデーションを実装する {#mesh-gradient}

ECS のメッシュグラデーションパーサーは、明示的な点の位置を保持します。任意の type、warp、time の制御は、シリアライズしてから再びパースできます。点の数が可変のモードでは、`points(10)` が 10 番目のシェーダースロットを残します。固定メッシュモード（`gtype(2)`）は、引き続き 3×3 グリッドを使います。パックしたユニフォームデータは、アライメント用のパディングを含めて、96-float のバッファの中の 92 個の float を使います。

Canvas と SVG に基づいて実装したグラデーションは表現力が限られ、複雑な効果を表示できません。Sketch / Figma のようなデザインツールのコミュニティには、Mesh に基づく実装がたくさんあります。たとえば次のとおりです。

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]
-   [Noise & Texture plugin for Figma]

いくつかのオープンソース実装を参考にしました。頂点シェーダーで実装したものも、フラグメントシェーダーで実装したものもあります。私たちは後者を選びました。

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

WebGL1 の GLSL100 構文との互換性のため、`switch` の使用は避ける必要があります。そうしないと、次のようなエラーになります。

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

また、`for` ループでは Uniform を `index` の終了条件に使えません。

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

そのため、Three.js のチャンクが光源を扱う方法と同様に、定数 `MAX_POINTS` だけでループの反復回数を制限できます。

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

ここからシェーダーの詳細に入ります。詳しくは [The Book of Shaders - Generative Design] を参照してください。

### 乱数 {#random}

ノイズ効果を実装するには乱数関数が必要です。しかし GLSL には組み込みの `random` 関数がないので、この振る舞いをシミュレートする必要があります。シミュレーションなので、同じ `random(x)` に対しては常に同じ戻り値を得ます。したがって疑似乱数です。

0 から 1 の値を返す `random` 関数が欲しければ、`y = fract(sin(x)*1.0);` を使えます。小数部だけを残します。

![y = fract(sin(x)*1.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand1.png)

この関数を観察すると、周期を極端に短くすれば、同じ x に対応する値を近似的な乱数（疑似乱数）とみなせます。具体的には係数を大きくします。たとえば `y = fract(sin(x)*10.0);` です。

![y = fract(sin(x)*10.0)](https://xiaoiver.github.io/assets/img/resized/480/tbs-rand2.png)

さらに 100000 まで大きくすると、`sin` の波形はもう区別できません。改めて明確にしておくと、JS の `Math.random()` とは違い、この方法は決定的な乱数であり、その実体はハッシュ関数です。

`random` 関数を 2D の場面に適用する必要があります。入力は単一の `x` から `xy` 座標へ変わります。2D ベクトルを一つの値へ写す必要があります。The Book of Shaders は組み込み関数 `dot` で特定のベクトルを掛けますが、その理由は説明していません。

```glsl
float random (vec2 st) {
    return fract(sin(
        dot(st.xy,vec2(12.9898,78.233)))*
        43758.5453123);
}
```

オンラインで検索したあと、この回答を見つけました。[What's the origin of this GLSL rand() one-liner?]。もともとはある論文に由来し、三つのマジックナンバーを選んだ理由の説明はない、とされています。いずれにせよ生成される効果はよく、白黒テレビの砂嵐に似ています。上の例で `NoiseRatio` を大きくすると、この効果を見られます。

### バリューノイズ {#value-noise}

定義した `random` 関数と `floor` を使うと、階段状の関数が得られます。

```glsl
float i = floor(x);
y = random(i);
```

![階段](https://xiaoiver.github.io/assets/img/webgl/tbs-noise1.png)

隣接する「階段」の間を補間したいなら、線形関数か、滑らかな補間関数 `smoothstep` を使えます。

```glsl
float i = floor(x);
float f = fract(x);
y = mix(rand(i), rand(i + 1.0), f);
// y = mix(rand(i), rand(i + 1.0), smoothstep(0.,1.,f));
```

![smoothstep](https://xiaoiver.github.io/assets/img/webgl/tbs-noise2.png)

一次元では `i+1` を選び、二次元では隣接する 4 点を選べます。対応する混合関数も変更する必要があります。原文の混合関数は展開した形なので少し理解しにくいですが、`mix` の呼び出しが 2 回少ないという利点があります。

```glsl
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;

    // It's actually the expanded form below
    return mix( mix( a, b , u.x),
                mix( c, d, u.x), u.y);
}
```

上のノイズ生成法は乱数値の間を補間するので、「バリューノイズ」と呼ばれます。注意深く見ると、この方法は明らかなブロック状の跡がある結果を生みます。下の例の左側がそれです。

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/lsf3WH?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

### グラデーションノイズ {#gradient-noise}

> 1985 年、Ken Perlin は Gradient Noise と呼ばれる別のノイズアルゴリズムを開発しました。Ken は、固定された値の代わりにランダムなグラデーション（勾配、グラデーション）を挿入する方法を解決しました。これらのグラデーション値は二次元の乱数関数から得られ、その関数は単一の値（float 形式）ではなく方向（vec2 形式のベクトル）を返します。

具体的なアルゴリズムは次のとおりで、バリューノイズとの最大の違いは、`dot` で四つの方向を補間する点です。

```glsl
float noise( in vec2 st ) {
    vec2 i = floor(st);
    vec2 f = fract(st);

 vec2 u = smoothstep(0., 1., f);

    return mix( mix( dot( random( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}
```

> Ken Perlin にとって、このアルゴリズムの成功はまったく十分ではありませんでした。もっと良くできると感じていました。2001 年の Siggraph で、彼は「simplex noise」を示しました。

具体的な実装は [2d-snoise-clear] にあり、3D 版もあります。

### ボロノイノイズ {#voronoi-noise}

「パターンを描く」節で、空間を小さな格子領域へ分ける方法をすでに学びました。各格子にランダムな特徴点を生成でき、ある格子の中のフラグメントについては、隣接する 8 個の格子の中の特徴点までの最小距離だけを計算すればよいので、計算量は大きく減ります。これが Steven Worley の論文の主な考えです。

ランダムな特徴点には、以前学んだ `random` メソッドを使います。決定的な乱数なので、各格子の中の特徴点は固定されます。

```glsl
// Divide the grid
vec2 i_st = floor(st);
vec2 f_st = fract(st);
float m_dist = 1.;
// 8 directions
for (int y= -1; y <= 1; y++) {
    for (int x= -1; x <= 1; x++) {
        // Current adjacent grid
        vec2 neighbor = vec2(float(x),float(y));
        // Feature point in adjacent grid
        vec2 point = random2(i_st + neighbor);
        // Distance from fragment to feature point
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        // Save the minimum value
        m_dist = min(m_dist, dist);
    }
}
color += m_dist;
```

<Voronoi />

この考えに基づく voronoi ノイズの実装は [lygia/generative] で見られます。

### fBM {#fbm}

[Inigo Quilez's fBM] を参照してください。`noise` にはバリューノイズやグラデーションノイズを使えます。

> 周波数が上がり振幅が下がるノイズ波を単純に足し合わせる、標準的な fBM（Fractional Brownian Motion、フラクタルブラウン運動）を使います。

原文は `gain = 0.5` を使う理由も詳しく説明しており、これは `H = 1` に対応します。`H` は曲線の「自己相似性」を表し、プロシージャル生成で雲、山、海のような自然の形をシミュレートするのに使います。

$$ G=2^{-H} $$

```glsl
const int octaves = 6;
float lacunarity = 2.0;
float gain = 0.5;

float amplitude = 0.5;
float frequency = 1.;

for (int i = 0; i < octaves; i++) {
 y += amplitude * noise(frequency*x);
 frequency *= lacunarity;
 amplitude *= gain;
}
```

<FractalBrownianMotion />

[Inigo Quilez's Domain Warping] と [Mike Bostock's Domain Warping] を参照してください。`fbm` を再帰的に呼び出します。

```glsl
f(p) = fbm( p )
f(p) = fbm( p + fbm( p ) )
f(p) = fbm( p + fbm( p + fbm( p )) )
```

<DomainWarping />

## パターンの実装 {#pattern}

Canvas API の [createPattern] でパターンを作れ、次の構文に対応します。

```ts
export interface Pattern {
    image: string | CanvasImageSource;
    repetition?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
    transform?: string;
}

rect.fill = {
    image,
    repetition: 'repeat',
};
```

文字列の `transform` は `mat3` へパースしてから、[setTransform] に渡す必要があります。

<Pattern />

## グラデーションを SVG に書き出す {#export-gradient-to-svg}

### 線形グラデーション {#linear-gradient}

SVG は [linearGradient] と [radialGradient] を提供しますが、サポートする属性は [CanvasGradient] とかなり異なります。

### 円錐グラデーション {#conic-gradient}

[SVG angular gradient] を参照すると、近似的な実装ができます。[CSS conic-gradient() polyfill] のアプローチは、Canvas で描画して dataURL として書き出し、`<image>` で参照することです。

### 複数グラデーションの重ね合わせ {#multiple-gradient-overlay}

複数のグラデーションを重ねる場合、Canvas API では `fillStyle` を複数回設定して重ねられます。宣言的な SVG では、複数の `<feBlend>` で同じ結果を得られます。

## さらに読む {#extended-reading}

-   [A flowing WebGL gradient, deconstructed]
-   [Static Mesh Gradient]

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[Noise & Texture plugin for Figma]: https://www.figma.com/community/plugin/1138854718618193875
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's fBM]: https://iquilezles.org/articles/fbm/
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
[createPattern]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern
[setTransform]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasPattern/setTransform
[What's the origin of this GLSL rand() one-liner?]: https://stackoverflow.com/questions/12964279/whats-the-origin-of-this-glsl-rand-one-liner
[The Book of Shaders - Generative Design]: https://thebookofshaders.com/10/
[2d-snoise-clear]: https://thebookofshaders.com/edit.php#11/2d-snoise-clear.frag
[lygia/generative]: https://lygia.xyz/generative
[A flowing WebGL gradient, deconstructed]: https://alexharri.com/blog/webgl-gradients
[Static Mesh Gradient]: https://shaders.paper.design/static-mesh-gradient
