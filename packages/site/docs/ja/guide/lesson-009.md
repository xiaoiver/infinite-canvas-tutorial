---
outline: deep
description: '楕円と角丸矩形の SDF 表現を導出します。図形にドロップシャドウとインナーシャドウを追加し、複雑な形状について点が内側にあるかを判定する方法を学びます。'
head:
    - ['meta', { property: 'og:title', content: '第9課 - 楕円と矩形を描く' }]
---

# 第 9 課 - 楕円と矩形を描く {#lesson-9-drawing-ellipse-and-rectangle}

この課では、次の内容を学びます。

-   楕円と角丸矩形の SDF 表現を導出する
-   角丸矩形とその他の SDF にドロップシャドウとインナーシャドウを追加する
-   任意の点が楕円または角丸矩形の内側にあるかを判定する

[第 2 課][第2課] では SDF で円を描きました。これを楕円と矩形へ広げるのは簡単です。[2D distance functions] には、2D 図形の SDF の式がさらに載っています。

```glsl
float sdf_ellipse(vec2 p, vec2 r) {}
float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {}
```

シェーダーでは `shape` 変数でこの 3 つの図形を区別するので、同じシェーダー一式で描けます。

```glsl
if (shape < 0.5) {
  outerDistance = sdf_circle(v_FragCoord, 1.0);
  innerDistance = sdf_circle(v_FragCoord, r.x);
} else if (shape < 1.5) {
  outerDistance = sdf_ellipse(v_FragCoord, vec2(wh, 1.0));
  innerDistance = sdf_ellipse(v_FragCoord, r);
} else if (shape < 2.5) {
  outerDistance = sdf_rounded_box(v_FragCoord, vec2(wh, 1.0), 0.0);
  innerDistance = sdf_rounded_box(v_FragCoord, r, 0.0);
}
```

次に、SDF がどのように導かれるかを見ていきます。

## 矩形 {#rect}

[The SDF of a Box] と [Leveraging Rust and the GPU to render user interfaces at 120 FPS] では、導出の過程が動画とアニメーションで示されています。

矩形の対称性を使い、中心を原点に置くと、任意の点から矩形の辺までの距離の問題を `abs()` 関数で第 1 象限の問題に移せます。ここで `p` は任意の点の座標、`b` は矩形の右上の頂点の座標で、中心が原点と一致するので `[width / 2, height / 2]` です。`q` は、その点から右上の頂点へ向かうベクトルです。

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
}
```

![abs 関数を適用した矩形の SDF](/rect-sdf-abs.png)

続いて、点が矩形の外側にある場合を考えます。矩形の右上の頂点から外側へ伸ばすと、4 つの象限に分けられます。下の図の第 1 象限では、距離は `q` ベクトルの長さ `length(q)` です。点が第 2 象限に入ると `q.x` が負なので距離は `q.y` になり、同様に第 4 象限に入ると距離は `q.x` です。

![矩形の SDF](/rect-sdf-dist.png)

原著者は `length(max(q, 0.0))` を使って、この 3 つの場合をうまく一つにまとめました。`max()` で負の成分を消し、シェーダー内の分岐判定をできるだけ減らします。続いて、点が矩形の内側にある場合、つまり上の図の第 3 象限を考えます。このとき `q` の 2 つの成分はどちらも負で、`max(q.x, q.y)` によって、より近い距離の絶対値を得られます。一番外側の `min()` は、点が内側にある場合を先の 3 つの場合と一つにまとめます。これも分岐判定を減らすためです。完全な SDF は次のとおりです。

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
```

ここまでで矩形を描けます。[SVG \<rect\>] を参考に、次のプロパティを追加します。

```js
const rect = new Rect({
    x,
    y,
    width,
    height,
    fill,
});
```

### 角を丸くする {#rounded-rect}

下の図は [Rounding Corners in SDFs] からのものです。等高線で可視化した距離場を見ると、矩形そのものがすでに丸みを帯びていることがわかります。矩形の右上付近の点を例にすると、距離が等しい点は 1 つではなく、右上の頂点を中心とする円の上に並んでいます。

![角丸矩形の SDF](/rect-sdf-rounded.png)

実際、矩形だけでなく、SDF で表されるすべての図形を「丸めた」版に変換できます。下の図は [2D distance functions] からのものです。

```glsl
float opRound( in vec2 p, in float r ) {
  return sdShape(p) - r;
}
```

![さらに丸めた図形](/shapes-sdf-rounded.png)

したがって、角丸矩形の完全な SDF 表現は次のとおりです。

```glsl
float sdf_rounded_box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
```

Figma の命名に合わせて `cornerRadius` を使いますが、SDF だけでは `smoothing` の効果は出せません。詳しくは [Adjust corner radius and smoothing] と [Desperately seeking squircles] を参照してください。さらに、角ごとに異なる半径をサポートすることもできます。[Zed Blade WGSL] を参照してください。これは Zed が [blade] レンダラーを基に書いたシェーダーで、WGSL の構文を使っています。

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

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

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 10,
            });
            // rect.x = Math.random() * 1000;
            // rect.y = Math.random() * 1000;
            rect.width = Math.random() * 40;
            rect.height = Math.random() * 40;
            canvas.appendChild(rect);

            rect.addEventListener('pointerenter', () => {
                rect.fill = 'red';
            });
            rect.addEventListener('pointerleave', () => {
                rect.fill = fill;
            });
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### ドロップシャドウを追加する {#drop-shadow}

影といえば、CSS の [box-shadow] と `filter: drop-shadow()` を聞いたことがあるかもしれません。下の図は [Drop-Shadow: The Underrated CSS Filter] からのもので、両者の違いを直感的に示しています。

![box-shadow と drop-shadow の比較](https://css-irl.info/drop-shadow-01.jpg)

後者のほうが一般的によく使われ、[tailwindcss - Drop Shadow] がその例です。そこで矩形に次のプロパティを追加します。

```ts
rect.dropShadowColor = 'black';
rect.dropShadowOffsetX = 10;
rect.dropShadowOffsetY = 10;
rect.dropShadowBlurRadius = 5;
```

![Figma のドロップシャドウ](/figma-drop-shadow.png)

次に、WebGL / WebGPU で 2D 図形の影を描きます。一般的な方法はポストプロセスでガウスぼかしを使うことで、Pixi.js の [DropShadowFilter] がその例です。2D のガウスぼかしは、水平方向と垂直方向の 2 つの 1D 効果に分解できますが、畳み込み演算では依然として隣接ピクセルをサンプリングする必要があります。サンプル数は畳み込みカーネルの大きさに依存します。

Figma の CTO、Evan Wallace は、[Fast Rounded Rectangle Shadows] でより速い近似法を紹介しました。テクスチャのサンプリングは不要で、[Leveraging Rust and the GPU to render user interfaces at 120 FPS] でもより詳しく説明されています。ガウス関数とステップ関数の畳み込みはガウス関数の積分に等しく、その結果は誤差関数 [Error function]（erf とも呼ばれます）になります。したがって、ぼかした矩形を作ることは、角の半径は考えずに各次元を別々にぼかしてから、2 つの結果の交差を取ることに相当します。

ガウス関数は次のとおりです。

$$ f(x) = \frac{\exp(-x^2 / (2 \sigma^2))}{(\sigma \sqrt{2 \pi})} $$

誤差関数はガウス関数の積分で、正規分布の累積分布関数を表すために使います。

$$ ∫f(x)dx=F(x) $$

$$ F(x) = \frac{(1 + erf(\frac{x}{\sigma \sqrt2}))}{2} $$

誤差関数のよく使われる近似は [Abramowitz and Stegun. Handbook of Mathematical Functions.] に由来します。

$$ erf(x) ≈ \frac{x}{1 + ax^2 + bx^4 + cx^6 + dx^8 + ex^{10}} $$

多項式の各項の係数は次のとおりです。

$$
\displaylines{
a =0.278393, \\
b =0.230389, \\
c =0.000972, \\
d =0.078108, \\
e =2.03380×10^{−4}
}
$$

次の実装は [Zed Blade WGSL] からのもので、これを GLSL で書き直しました。[Blurred rounded rectangles] も、erf の別バージョンを示しています。

```glsl
vec2 erf(vec2 x) {
  vec2 s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  x *= x;
  return s - s / (x * x);
}
```

ひとまず角の丸みは置いておき、最終的な影のマスク値を計算します。ここで影の境界は `integral_x` と `integral_y` の差で決まります。`integral_x.x - integral_x.y` は x 軸上の影の幅を計算し、`integral_y.x - integral_y.y` は y 軸上の影の高さを計算します。この 2 つの値を掛けると、最終的な影のマスク値になります。

```glsl
// Return the mask for the shadow of a box from lower to upper
float rect_shadow(vec2 pixel_position, vec2 origin, vec2 size, float sigma) {
  vec2 bottom_right = origin + size;
  vec2 x_distance = vec2(pixel_position.x - origin.x, pixel_position.x - bottom_right.x);
  vec2 y_distance = vec2(pixel_position.y - origin.y, pixel_position.y - bottom_right.y);
  vec2 integral_x = 0.5 + 0.5 * erf(x_distance * (sqrt(0.5) / sigma));
  vec2 integral_y = 0.5 + 0.5 * erf(y_distance * (sqrt(0.5) / sigma));
  return (integral_x.x - integral_x.y) * (integral_y.x - integral_y.y);
}
```

しかし、上のような閉じた形の解は、角丸矩形とガウス関数の 2 次元畳み込みには存在しません。角丸矩形の式が分離可能ではないからです。Evan Wallace の近似が巧妙なのは、一方の軸に沿って閉じた形の厳密な畳み込みを行い、その後、反対の軸に沿ってガウス関数を有限回だけ手動でずらしながら計算する点にあります。

```glsl
float blur_along_x(float x, float y, float sigma, float corner, vec2 half_size) {
  float delta = min(half_size.y - corner - abs(y), 0.);
  float curved =
  half_size.x - corner + sqrt(max(0., corner * corner - delta * delta));
  vec2 integral =
  0.5 + 0.5 * erf((x + vec2(-curved, curved)) * (sqrt(0.5) / sigma));
  return integral.y - integral.x;
}
```

```glsl
// The signal is only non-zero in a limited range, so don't waste samples
float low = center_to_point.y - half_size.y;
float high = center_to_point.y + half_size.y;
float start = clamp(-3. * blur_radius, low, high);
float end = clamp(3. * blur_radius, low, high);

// Accumulate samples (we can get away with surprisingly few samples)
float step = (end - start) / 4.;
float y = start + step * 0.5;

for (int i = 0; i < 4; i++) {
  alpha += blur_along_x(center_to_point.x, center_to_point.y - y, blur_radius,
                        cornerRadius, half_size) *
          gaussian(y, blur_radius) * step;
  y += step;
}
```

実装では、矩形ごとに影を個別に描く必要があり、前にまとめたバッチの効果が崩れます。描画順を厳密に守らなければならず、再描画の前に毎回並べ替える必要さえあるからです。次のコードは [Fast Rounded Rectangle Shadows] からのものです。描く前に、あらかじめ決めた深度ですべての矩形をソートし、影と本体を順に描きます。

```ts
render() {
  boxes.sort(function(a, b) {
    return a.depth - b.depth;
  });
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].callback(); // Draw shadow first and then the rectangle itself.
  }
}
```

例として、次の 2 つの矩形は次の順で描きます。緑の矩形の影、緑の矩形、赤の矩形の影、赤の矩形です。以前の考え方どおり、2 つの影と 2 つの矩形本体をそれぞれ別々の 2 つのバッチにまとめて描くと、赤の矩形の影を緑の矩形の上に落とすことができません。そのため使うときには、影のある矩形に `batchable = false` を設定する必要があります。

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 100,
            y: 100,
            fill: 'red',
            batchable: false,
            cornerRadius: 50,
            dropShadowColor: 'black',
            dropShadowBlurRadius: 10,
        });
        rect2.width = 400;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

もう一つ注意する点は、影のぼかし半径があるため、矩形を元のサイズから一回り外側へ広げる必要があることです。ここでは `3 * dropShadowBlurRadius` にしています。

```glsl
float margin = 3.0 * dropShadow.z;
origin += dropShadow.xy;
v_Origin = origin;
v_Size = size;

origin -= margin;
size += 2.0 * margin;
vec2 center = origin + size / 2.0;
v_Point = center + a_FragCoord * (size / 2.0);
```

最後に、影は `RenderBounds` の計算にも影響します。そうしないと、矩形の本体はビューポートの外にあっても影はビューポートの中にあるときに、矩形が誤ってカリングされます。

```ts
this.renderBounds.addBounds(
    new AABB(
        x + dropShadowOffsetX - dropShadowBlurRadius,
        y + dropShadowOffsetY - dropShadowBlurRadius,
        x + dropShadowOffsetX + width + dropShadowBlurRadius,
        y + dropShadowOffsetY + height + dropShadowBlurRadius,
    ),
);
```

この方法を基に、興味深い効果も作れます。[Shape Lens Blur Effect with SDFs and WebGL] を参照してください。

明らかに、上の方法は角丸矩形にしか使えません。円、楕円、その他の SDF 表現にも使える、より一般的な方法はあるでしょうか。Shadertoy に [Drop shadow of rounded rect] という例があります。興味深いことに、この例を基にして、外側の影と内側の影の両方を実装した別の例もあります。以下ではインナーシャドウの実装に焦点を当てます。

### インナーシャドウを追加する {#inner-shadow}

下の画像は Figma のインナーシャドウで、Button のような UI コンポーネントによく使われます。

![Figma のインナーシャドウ](/figma-inner-shadow.png)

次の属性を追加します。

```ts
rect.innerShadowColor = 'black';
rect.innerShadowOffsetX = 10;
rect.innerShadowOffsetY = 10;
rect.innerShadowBlurRadius = 5;
```

Shadertoy の例 [Inner shadow of rounded rect] を参考に、現在の 3 つの図形それぞれへ、同じように影を描くロジックを追加します。ここでは滑らかにするために `sigmoid` を使います。

```glsl
float make_shadow(vec2 pos, vec2 halfSize, float cornerRd, float blurRd, float distMul, float shape) {
  float distance;
  if (shape < 0.5) {
    distance = sdf_circle(pos, halfSize.x);
  } else if (shape < 1.5) {
    distance = sdf_ellipse(pos, halfSize);
  } else if (shape < 2.5) {
    distance = sdf_rounded_box(pos, halfSize, cornerRd + blurRd);
  }
  float dist = sigmoid(distMul * distance / blurRd);
  return clamp(dist, 0.0, 1.0);
}
```

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        for (let i = 0; i < 10; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;

            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 50,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            rect.width = 200;
            rect.height = 100;
            canvas.appendChild(rect);

            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: 100,
                fill,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(circle);

            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: 100,
                ry: 50,
                fill,
                innerShadowColor: 'blue',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(ellipse);
        }
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## 楕円 {#ellipse}

任意の点から円までの最近距離を求めるのとは違い、楕円を解析的に厳密に扱う方法ははるかに複雑です。[Distance to an ellipse] は 2 つの方法を示しています。四次方程式とニュートン法です。

### 四次方程式 {#quartic-equation}

楕円は $q(\omega) = \{ a⋅cos \omega, b⋅sin \omega \}$ で表します。任意の点 $p$ から楕円上の点までの距離の二乗は次のとおりです。

$$ s^2(\omega) = \left| q(\omega) - p \right|^2 $$

展開すると次のとおりです。

$$ a^2cos^2\omega + b^2sin^2\omega + x^2 + y^2 - 2(axcos \omega - bysin \omega) $$

$\omega$ で微分すると次のとおりです。

$$ −2a^2sin\omega ⋅cos\omega + 2b^2cos\omega ⋅sin\omega + 2axsin\omega − 2bycos\omega $$

最近点では導関数が 0 です。$\lambda=cos\omega$ を代入すると、次が得られます。

$$ \sqrt{1-\lambda^{2}}\left(\left(b^{2}-a^{2}\right) \lambda+a x\right)=b y \lambda $$

これは $\lambda$ についての 1 変数の四次方程式で、各項の係数は次のとおりです。

$$
\displaylines{
  a_4=\left(b^{2}-a^{2}\right)^{2} \\
  a_3=2 a x\left(b^{2}-a^{2}\right) \\
  a_2=\left(a^{2} x^{2}+b^{2} y^{2}\right)-\left(b^{2}-a^{2}\right)^{2} \\
  a_1=-2 a x\left(b^{2}-a^{2}\right) \\
  a_0=-a^{2} x^{2}
}
$$

四次の項の係数を 1 にして [Monic Polynomial] を得るため、上の各係数を $a_4$ で割ります。楕円なので、0 で割ることは心配しなくてよいです。同時に $m n$ の置き換えを使います。

$$ m=x \frac{a}{b^{2}-a^{2}} \quad n=y \frac{b}{b^{2}-a^{2}} $$

こうして、係数が次のような [Quartic Equation] になります。

$$
\displaylines{
  a_4=1\\
  a_3=2m \\
  a_2=m^2 + n^2  - 1 \\
  a_1=-2m \\
  a_0=-m^2
}
$$

最高次の係数が 1 なので、[Resolvent Cubic] を使って、三次方程式 [Cubic Formula] を解く問題に変換できます。

$$
\displaylines{
f(x)=x^4+a_3x^3+a_2x^2+a_1x+a_0 \\
g(x)=x^3+b_2x^2+b_1x+b_0
}
$$

係数の対応は次のとおりです。

$$
b_2 = -a_2 \quad
b_1 = a_1a_3-4a_0 \quad
b_0 = 4a_0a_2-a_1^2-a_0a_3^2
$$

代入すると次のとおりです。

$$
b_2 = -(m^2+n^2-1) \quad
b_1 = 0 \quad
b_0 = -4m^2n^2
$$

[Cubic Formula] を解くときは、二次の項の係数を消そうとします。$z=x-1/3k_2$ と置けばできます。このとき標準形は $x^3+px=q$ になり、ここで

$$
p = (3k_1-k_2^2)/3 \quad
q = (9k_1k_2-27k_0-2k_2^3)/27
$$

$b_0 b_1 b_2$ を代入すると次のとおりです。

$$
\displaylines{
p = -(m^2+n^2-1)^2/3 \\
q = 4m^2n^2+2(m^2+n^2-1)^3/27
}
$$

上の式をさらに簡単にするため、次のように置きます。

$$
\displaylines{
Q = (\frac{m^2+n^2-1}{3})^2 \\
R = 2m^2n^2 + (\frac{m^2+n^2-1}{3})^3
}
$$

標準形は $x^3 - 3Qx + 2R = 0$ になります。

この方法は計算コストが大きく、[Distance to an ellipse] に示された ShaderToy の例は、以下で紹介する 2 つの方法より FPS がずっと低くなります。

### ニュートン法 {#newton-method}

任意の点 $p$ から、楕円上の最近点 $q$ へ向かうベクトルは、点 $q$ における楕円の接線と垂直でなければなりません。

$$ <p-q(\omega), q'(\omega)> = 0 $$

このうち、導関数は次のとおりです。

$$ q'(\omega) = (-a⋅sin \omega, b⋅cos \omega) $$

代入すると次のとおりです。

$$
\displaylines{
  f(\omega) = -a⋅sin \omega ⋅(x-a⋅cos \omega) + b⋅cos \omega ⋅(y-b⋅sin \omega) = 0 \\
  f'(\omega) = -<p-u,v> - <v,v> \\

  u = ( a⋅cos \omega, b⋅sin \omega ) \\
  v = (-a⋅sin \omega, b⋅cos \omega )
}
$$

[Newton's method] は、実数と複素数の範囲で方程式を近似的に解く方法です。

$$x_{n+1} =x_n-{\frac {f(x_n)}{f'(x_n)}} $$

代入すると次のとおりです。

$$\omega_{n+1} = \omega_n + {\frac {<p-u,v>}{<p-u,u> + <v,v>}} $$

[Distance to an ellipse] の原著者は、5 回の反復で非常によい結果を得ています。

```glsl
for (int i=0; i<5; i++) {
  vec2 cs = vec2(cos(w),sin(w));
  vec2 u = ab*vec2( cs.x,cs.y);
  vec2 v = ab*vec2(-cs.y,cs.x);
  w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
}
```

以下で必要なのは $\omega_0$ を求めることだけです。やはり対称性を使い、点が第 1 象限にある場合だけを考え、まず点が楕円の内側にあるかを判定します。楕円の方程式へ代入すればわかります。

```glsl
bool s = dot(p/ab,p/ab)>1.0;
```

楕円の外側なら、円へ引き伸ばせます。次の小節で説明する手法でもこれを使います。このとき $\omega_0 = atan(y / x)$ となり、逆方向に引き戻して楕円へ戻すと $\omega_0 = atan(a⋅y / b⋅x)$ です。

楕円の内側なら、半長軸に対応する $0$ か、短軸に対応する $\pi/2$ を開始点に選びます。

```glsl
float w = s ? atan(p.y*ab.x, p.x*ab.y) :
  ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.5707963 : 0.0);
```

前に一変数の四次方程式を解く方法と比べると、この方法のコストはより小さくなります。それでも、反復回数が固定された for ループが含まれ、GLSL をコンパイルするときにそのループは展開されます。[Loop performance in a shader] を参照してください。
最後に、コストが最も小さい近似推定の方法を紹介します。

### 円へ引き伸ばす近似法 {#stretch-approximately-method}

[Ellipsoid SDF] は、単位円へ引き伸ばしてから楕円へ戻すこの方法を説明しています。戻すとき、引き伸ばしの係数はどう選べばよいでしょうか。点が X 軸上にあれば係数は `r.x`、Y 軸上にあれば `r.y` です。まずこの 2 つのうち小さい方を選びます。

```glsl
float sdf_ellipse_V1( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  return (k1-1.0)*min(r.x,r.y);
}
```

実際にレンダリングすると、この方法は長軸のところで問題が目立ち、うまく沿いません。

![楕円の縁のアーティファクト](/ellipse-approximate-v1.png)

原著者が改良版を示しています。

```glsl
float sdf_ellipse_V3( in vec3 p, in vec3 r )
{
  float k1 = length(p/r);
  return length(p)*(1.0-1.0/k1);
}
```

しかし実際にレンダリングすると、この方法は縁に明らかなギザギザが出ます。

![楕円の縁のアーティファクト](/ellipse-approximate-v3.png)

最終的に著者は勾配を考慮する項を加え、私たちもこの方法を使います。

```glsl
float sdf_ellipse_V2( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  float k2 = length(p/(r*r));
  return k1*(k1-1.0)/k2;
}
```

結果はずっと良くなっていることがわかります。

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Ellipse } = Lesson9;

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

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: Math.random() * 20,
                ry: Math.random() * 20,
                fill,
            });
            canvas.appendChild(ellipse);
            ellipse.addEventListener('pointerenter', () => {
                ellipse.fill = 'red';
            });
            ellipse.addEventListener('pointerleave', () => {
                ellipse.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## ピッキング {#picking}

現在のピッキングプラグインは [幾何学的手法][Geometric method] を使うので、楕円と角丸矩形には判定方法を別々に実装する必要があります。後で、より一般的な、色で符号化する GPU ベースのピッキング方法を紹介します。上の 2 つの例では、任意の図形の上にマウスを乗せてピッキングの効果を確かめられます。

### 楕円 {#picking-ellipse}

楕円のピッキング判定はより単純です。たとえば既定では、塗りの領域とストロークの領域の両方を考慮します。

```ts
function isPointInEllipse(
    x: number,
    y: number,
    h: number,
    k: number,
    a: number,
    b: number,
) {
    const dx = x - h;
    const dy = y - k;

    const squaredDistance = (dx * dx) / (a * a) + (dy * dy) / (b * b);

    // Inside ellipse
    return squaredDistance <= 1;
}
```

### 角丸矩形 {#picking-rounded-rect}

角の丸みを考慮しなければ、これも非常に単純です。

```ts
function isPointInRoundedRectangle(
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
) {
    // Determine if a point is inside the corners of a rectangle.
    function isInsideCorner(
        x: number,
        y: number,
        cornerX: number,
        cornerY: number,
        r: number,
    ) {
        const distance = Math.sqrt(
            Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2),
        );
        return distance <= r;
    }

    // Determine if a point is inside a rounded rectangle
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        // Points inside the rectangle
        if (
            isInsideCorner(x, y, x1 + r, y1 + r, r) || // top-left
            isInsideCorner(x, y, x2 - r, y1 + r, r) || // top-right
            isInsideCorner(x, y, x2 - r, y2 - r, r) || // bottom-right
            isInsideCorner(x, y, x1 + r, y2 - r, r) // bottom-left
        ) {
            return true; // Points inside the corner
        }
        return !(
            x <= x1 + r ||
            x >= x2 - r || // The point is on the non-circular boundary of the rectangle
            y <= y1 + r ||
            y >= y2 - r
        );
    }
    return false; // Points outside the rectangle
}
```

## さらに読む {#extended-reading}

-   [Distance to an ellipse]
-   [Distance from a Point to an Ellipse, an Ellipsoid, or a
    Hyperellipsoid]
-   [Fast Rounded Rectangle Shadows]
-   [Blurred rounded rectangles]
-   [Desperately seeking squircles]

[第2課]: /ja/guide/lesson-002
[2D distance functions]: https://iquilezles.org/articles/distfunctions2d/
[Distance to an ellipse]: https://iquilezles.org/articles/ellipsedist/
[Ellipsoid SDF]: https://iquilezles.org/articles/ellipsoids/
[The SDF of a Box]: https://www.youtube.com/watch?v=62-pRVZuS5c&t=18s&ab_channel=InigoQuilez
[Rounding Corners in SDFs]: https://www.youtube.com/watch?v=s5NGeUV2EyU&t=110s
[Leveraging Rust and the GPU to render user interfaces at 120 FPS]: https://zed.dev/blog/videogame
[Blurred rounded rectangles]: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
[Shape Lens Blur Effect with SDFs and WebGL]: https://tympanus.net/codrops/2024/06/12/shape-lens-blur-effect-with-sdfs-and-webgl/
[Quartic Equation]: https://mathworld.wolfram.com/QuarticEquation.html
[Cubic Formula]: https://mathworld.wolfram.com/CubicFormula.html
[Monic Polynomial]: https://mathworld.wolfram.com/MonicPolynomial.html
[Resolvent Cubic]: https://mathworld.wolfram.com/ResolventCubic.html
[Newton's method]: https://en.wikipedia.org/wiki/Newton%27s_method
[Distance from a Point to an Ellipse, an Ellipsoid, or a Hyperellipsoid]: https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf
[Loop performance in a shader]: https://computergraphics.stackexchange.com/questions/2153/loop-performance-in-a-shader
[SVG \<rect\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[Adjust corner radius and smoothing]: https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing
[Fast Rounded Rectangle Shadows]: https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[Error function]: https://en.wikipedia.org/wiki/Error_function
[Geometric method]: /ja/guide/lesson-006#geometric-method
[Abramowitz and Stegun. Handbook of Mathematical Functions.]: https://personal.math.ubc.ca/~cbm/aands/page_299.htm
[box-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
[Zed Blade WGSL]: https://github.com/zed-industries/zed/blob/main/crates/gpui/src/platform/blade/shaders.wgsl
[blade]: https://github.com/kvark/blade
[Drop-Shadow: The Underrated CSS Filter]: https://css-irl.info/drop-shadow-the-underrated-css-filter/
[tailwindcss - Drop Shadow]: https://tailwindcss.com/docs/drop-shadow
[Drop shadow of rounded rect]: https://www.shadertoy.com/view/NtVSW1
[Inner shadow of rounded rect]: https://www.shadertoy.com/view/mssGzn
[Desperately seeking squircles]: https://www.figma.com/blog/desperately-seeking-squircles/
