---
outline: deep
description: '推導橢圓與圓角矩形的 SDF 表示。學習為圖形加入投影與內陰影，並為複雜幾何實作點是否在圖形內的判斷。'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: '第 9 課 - 繪製橢圓與矩形',
          },
      ]
---
# 第 9 課 - 繪製橢圓與矩形 {#lesson-9-drawing-ellipse-and-rectangle}

在本課中，你將學到以下內容：

-   推導橢圓與圓角矩形的 SDF 表示
-   為圓角矩形與其他 SDF 加入投影與內陰影
-   判斷任意點是否在橢圓或圓角矩形內部

在 [第 2 課] 中，我們用 SDF 繪製圓形，這很容易擴展到橢圓與矩形。[二維距離函式] 提供了更多二維圖形的 SDF 表達式：

```glsl
float sdf_ellipse(vec2 p, vec2 r) {}
float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {}
```

在著色器中，用 `shape` 變數區分這三種圖形，因此可以用同一套著色器把它們畫出來：

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

接下來看看 SDF 是如何推導的。

## 矩形 {#rect}

[方盒的 SDF] 與 [運用 Rust 與 GPU 以 120 FPS 渲染使用者介面] 以影片與動畫示範了推導過程。

基於矩形的對稱性，把矩形中心放在原點後，可以用 `abs()` 把任意點到矩形邊緣的距離問題變換到第一象限。其中 `p` 是任意點的座標，`b` 是矩形右上角的座標；由於中心與原點重合，它是 `[width / 2, height / 2]`，`q` 表示從該點指向右上角的向量：

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
}
```

![矩形 SDF 的 abs 函式](/rect-sdf-abs.png)

接著考慮點在矩形外部的情況。從矩形右上角向外延伸，可以分成四個象限。在下圖的第一象限中，距離是 `q` 向量的長度 `length(q)`。如果點落在第二象限，因為 `q.x` 為負，距離是 `q.y`；同理，落在第四象限時，距離是 `q.x`。

![矩形 SDF](/rect-sdf-dist.png)

原作者巧妙地用 `length(max(q, 0.0))` 統一了這三種情況，利用 `max()` 消掉負分量，盡可能減少著色器中的分支判斷。再考慮點在矩形內部的情況，也就是上圖的第三象限。此時 `q` 的兩個分量都是負的，`max(q.x, q.y)` 可以得到較近那段距離的絕對值，最外層的 `min()` 則把點在內部的情況與前面三種統一起來，目的同樣是減少分支判斷。完整的 SDF 如下：

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
```

至此我們可以繪製矩形，並參考 [SVG \<rect\>] 加入下列屬性：

```js
const rect = new Rect({
    x,
    y,
    width,
    height,
    fill,
});
```

### 加入圓角 {#rounded-rect}

下圖來自 [在 SDF 中做圓角]。如果觀察用等高線視覺化的距離場，會發現矩形本身的角落就是圓的。以矩形右上角附近的點為例，等距的點不止一個，它們正好分佈在以右上角為圓心的圓上。

![圓角矩形 SDF](/rect-sdf-rounded.png)

事實上不只是矩形，所有用 SDF 表示的圖形都可以變成「圓角」版本。下圖來自 [二維距離函式]：

```glsl
float opRound( in vec2 p, in float r ) {
  return sdShape(p) - r;
}
```

![更多圓角圖形](/shapes-sdf-rounded.png)

因此圓角矩形的完整 SDF 表示如下：

```glsl
float sdf_rounded_box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
```

參考 Figma 的命名，我們使用 `cornerRadius`，但單靠 SDF 無法實現 `smoothing` 效果，詳見 [調整圓角半徑與平滑] 與 [拼命尋找超橢圓]。此外也可以為每個角支援不同的圓角半徑，參考 [Zed Blade WGSL]，這是 Zed 基於 [blade] 渲染器撰寫的著色器，使用 WGSL 語法。

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

### 加入投影 {#drop-shadow}

說到陰影，你可能聽過 CSS 中的 [box-shadow] 與 `filter: drop-shadow()`。下圖來自文章 [Drop-Shadow：被低估的 CSS 濾鏡]，直覺地展示了兩者的差異：

![比較 box-shadow 與 drop-shadow](https://css-irl.info/drop-shadow-01.jpg)

後者通常更常用，例如 [tailwindcss - 投影]。因此我們為矩形加入下列屬性：

```ts
rect.dropShadowColor = 'black';
rect.dropShadowOffsetX = 10;
rect.dropShadowOffsetY = 10;
rect.dropShadowBlurRadius = 5;
```

![Figma 中的投影](/figma-drop-shadow.png)

接下來我們會用 WebGL / WebGPU 為 2D 圖形繪製陰影。常見做法是在後處理中使用高斯模糊，例如 Pixi.js 的 [DropShadowFilter]。二維高斯模糊可以分解成水平與垂直兩個一維效果，但捲積運算仍然需要對相鄰像素取樣（取決於捲積核的大小）。

Figma 的 CTO Evan Wallace 在文章 [快速圓角矩形陰影] 中介紹了一種更快的近似方法，不需要對紋理取樣；文章 [運用 Rust 與 GPU 以 120 FPS 渲染使用者介面] 也做了更詳細的介紹。高斯函數與階躍函數的捲積等價於高斯函數的積分，結果就是誤差函數 [誤差函數]（也稱為 erf）。因此，產生一個模糊矩形，等於分別模糊每個維度，再取兩個結果的交集，而且先不考慮圓角半徑。

高斯函數：

$$ f(x) = \frac{\exp(-x^2 / (2 \sigma^2))}{(\sigma \sqrt{2 \pi})} $$

誤差函數是高斯函數的積分，用來描述常態分配的累積分配函數。

$$ ∫f(x)dx=F(x) $$

$$ F(x) = \frac{(1 + erf(\frac{x}{\sigma \sqrt2}))}{2} $$

一個常見的誤差函數近似來自 [Abramowitz 與 Stegun《數學函數手冊》]。

$$ erf(x) ≈ \frac{x}{1 + ax^2 + bx^4 + cx^6 + dx^8 + ex^{10}} $$

其中多項式各項的係數為：

$$
\displaylines{
a =0.278393, \\
b =0.230389, \\
c =0.000972, \\
d =0.078108, \\
e =2.03380×10^{−4}
}
$$

下列實作來自 [Zed Blade WGSL]，我們把它改寫成 GLSL。[模糊的圓角矩形] 也給出了另一個版本的 erf。

```glsl
vec2 erf(vec2 x) {
  vec2 s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  x *= x;
  return s - s / (x * x);
}
```

先不管圓角，計算最終的陰影遮罩值。這裡陰影的邊界由 `integral_x` 與 `integral_y` 的差值決定。`integral_x.x - integral_x.y` 計算 x 軸上的陰影寬度，`integral_y.x - integral_y.y` 計算 y 軸上的陰影高度。把這兩個值相乘，就得到最終的陰影遮罩值。

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

然而，上面這種閉式解並不存在於圓角矩形與高斯函數的二維捲積，因為圓角矩形的公式不可分離。Evan Wallace 這個近似的巧妙之處，在於沿一個軸做閉式、精確的捲積，再沿另一個軸把高斯函數手動滑動有限次數：

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

在實作中，每個矩形的陰影都需要單獨繪製，這會打破先前合併批次的效果。原因是我們必須嚴格遵守繪製順序，甚至在每次重繪前重新排序。下列程式碼來自這篇文章：[快速圓角矩形陰影]。繪製之前，需要依預先設定的深度對所有矩形排序，再依序繪製陰影與本體：

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

舉例來說，下面兩個矩形的繪製順序是：綠色矩形的陰影、綠色矩形、紅色矩形的陰影、紅色矩形。如果沿用先前的想法，把兩個陰影與兩個矩形本體各自合併成兩個批次來畫，就無法讓紅色矩形的陰影投射在綠色矩形上。因此使用時，需要為帶有陰影的矩形設定 `batchable = false`。

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

還有一點需要注意：由於陰影的模糊半徑，矩形需要從原始尺寸向外擴出一圈，這裡設為 `3 * dropShadowBlurRadius`。

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

最後，陰影也會影響 `RenderBounds` 的計算，否則當矩形本體在視埠外、但陰影在視埠內時，矩形會被錯誤剔除：

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

基於這個做法，也可以實現一些有趣的效果，見：[使用 SDF 與 WebGL 的形狀鏡頭模糊效果]。

顯然上述方法只適用於圓角矩形。那麼對於圓、橢圓以及其他 SDF 表示，有沒有更通用的方法？Shader toy 上有一個範例：[圓角矩形的投影]。有趣的是，還有另一個基於此範例的例子，可以同時實作外陰影與內陰影。下面我們聚焦在內陰影的實作。

### 加入內陰影 {#inner-shadow}

下圖是 Figma 的內陰影效果，常用於按鈕這類 UI 元件。

![Figma 中的內陰影](/figma-inner-shadow.png)

讓我們加入下列屬性：

```ts
rect.innerShadowColor = 'black';
rect.innerShadowOffsetX = 10;
rect.innerShadowOffsetY = 10;
rect.innerShadowBlurRadius = 5;
```

參考 Shader toy 上的範例：[圓角矩形的內陰影]，我們同樣為目前三種圖形各自加入陰影繪製邏輯。這裡使用 `sigmoid` 來做平滑：

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

## 橢圓 {#ellipse}

與求任意點到圓的最近距離不同，精確分析橢圓的方法複雜得多。[到橢圓的距離] 給出了兩種方法：四次方程式與牛頓法。

### 四次方程式 {#quartic-equation}

橢圓用 $q(\omega) = \{ a⋅cos \omega, b⋅sin \omega \}$ 表示，任意點 $p$ 到橢圓上一點的距離平方為：

$$ s^2(\omega) = \left| q(\omega) - p \right|^2 $$

展開：

$$ a^2cos^2\omega + b^2sin^2\omega + x^2 + y^2 - 2(axcos \omega - bysin \omega) $$

對 $\omega$ 求導：

$$ −2a^2sin\omega ⋅cos\omega + 2b^2cos\omega ⋅sin\omega + 2axsin\omega − 2bycos\omega $$

最近點的導數為 0。代入 $\lambda=cos\omega$ 可得：

$$ \sqrt{1-\lambda^{2}}\left(\left(b^{2}-a^{2}\right) \lambda+a x\right)=b y \lambda $$

這是關於 $\lambda$ 的一元四次方程式，各項係數為：

$$
\displaylines{
  a_4=\left(b^{2}-a^{2}\right)^{2} \\
  a_3=2 a x\left(b^{2}-a^{2}\right) \\
  a_2=\left(a^{2} x^{2}+b^{2} y^{2}\right)-\left(b^{2}-a^{2}\right)^{2} \\
  a_1=-2 a x\left(b^{2}-a^{2}\right) \\
  a_0=-a^{2} x^{2}
}
$$

為了把四次項的係數化為 1，得到 [首一多項式]，將上面每個係數都除以 $a_4$。因為這是橢圓，不必擔心除以 0。同時使用 $m n$ 代換：

$$ m=x \frac{a}{b^{2}-a^{2}} \quad n=y \frac{b}{b^{2}-a^{2}} $$

這樣就得到 [四次方程式]，係數如下：

$$
\displaylines{
  a_4=1\\
  a_3=2m \\
  a_2=m^2 + n^2  - 1 \\
  a_1=-2m \\
  a_0=-m^2
}
$$

由於最高次項係數是 1，這可以轉化為求解三次方程式 [三次公式] 的問題，使用 [預解三次方程式]：

$$
\displaylines{
f(x)=x^4+a_3x^3+a_2x^2+a_1x+a_0 \\
g(x)=x^3+b_2x^2+b_1x+b_0
}
$$

其中係數的對應關係為：

$$
b_2 = -a_2 \quad
b_1 = a_1a_3-4a_0 \quad
b_0 = 4a_0a_2-a_1^2-a_0a_3^2
$$

代入後得到：

$$
b_2 = -(m^2+n^2-1) \quad
b_1 = 0 \quad
b_0 = -4m^2n^2
$$

求解 [三次公式] 時，要設法消去二次項係數，可以令 $z=x-1/3k_2$。這樣得到標準形式：$x^3+px=q$，其中：

$$
p = (3k_1-k_2^2)/3 \quad
q = (9k_1k_2-27k_0-2k_2^3)/27
$$

代入 $b_0 b_1 b_2$ 得到：

$$
\displaylines{
p = -(m^2+n^2-1)^2/3 \\
q = 4m^2n^2+2(m^2+n^2-1)^3/27
}
$$

繼續化簡上面的方程式，令：

$$
\displaylines{
Q = (\frac{m^2+n^2-1}{3})^2 \\
R = 2m^2n^2 + (\frac{m^2+n^2-1}{3})^3
}
$$

標準形式變成：$x^3 - 3Qx + 2R = 0$

這個方法計算量很大。[到橢圓的距離] 中寫在 ShaderToy 上的範例，FPS 遠低於下面要介紹的兩種方法。

### 牛頓法 {#newton-method}

任意點 $p$ 到橢圓上最近點 $q$ 所形成的向量，必須垂直於橢圓在 $q$ 點的切線。

$$ <p-q(\omega), q'(\omega)> = 0 $$

其中：

$$ q'(\omega) = (-a⋅sin \omega, b⋅cos \omega) $$

代入得到：

$$
\displaylines{
  f(\omega) = -a⋅sin \omega ⋅(x-a⋅cos \omega) + b⋅cos \omega ⋅(y-b⋅sin \omega) = 0 \\
  f'(\omega) = -<p-u,v> - <v,v> \\

  u = ( a⋅cos \omega, b⋅sin \omega ) \\
  v = (-a⋅sin \omega, b⋅cos \omega )
}
$$

[牛頓法] 是在實數與複數域上近似求解方程式的方法。

$$x_{n+1} =x_n-{\frac {f(x_n)}{f'(x_n)}} $$

代入得到：

$$\omega_{n+1} = \omega_n + {\frac {<p-u,v>}{<p-u,u> + <v,v>}} $$

[到橢圓的距離] 的原作者使用 5 次迭代，就得到了非常好的結果：

```glsl
for (int i=0; i<5; i++) {
  vec2 cs = vec2(cos(w),sin(w));
  vec2 u = ab*vec2( cs.x,cs.y);
  vec2 v = ab*vec2(-cs.y,cs.x);
  w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
}
```

接下來只需要求出 $\omega_0$。仍然利用對稱性，只考慮點在第一象限的情況，先判斷點是否在橢圓內部，並代入橢圓方程式：

```glsl
bool s = dot(p/ab,p/ab)>1.0;
```

如果在橢圓外部，可以把它拉伸成圓（下一小節會再用到這個方法），其中 $\omega_0 = atan(y / x)$，再反向拉伸回橢圓：$\omega_0 = atan(a⋅y / b⋅x)$

如果在橢圓內部，選擇長半軸方向的 $0$，或短軸的 $\pi/2$ 作為起點：

```glsl
float w = s ? atan(p.y*ab.x, p.x*ab.y) :
  ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.5707963 : 0.0);
```

與先前求解一元四次方程式的方法相比，這個方法的開銷更小。不過它仍然包含固定迭代次數的 for 迴圈，編譯 GLSL 時會被展開，見：[著色器中的迴圈效能]。
最後，我們會介紹一種開銷極小的近似估計方法。

### 拉伸近似法 {#stretch-approximately-method}

[橢球 SDF] 描述了先拉伸成單位圓、再恢復成橢圓的方法。但恢復時要如何選擇拉伸係數？如果點在 X 軸上，係數是 `r.x`；在 Y 軸上則是 `r.y`，並且先取兩者中較小的那個：

```glsl
float sdf_ellipse_V1( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  return (k1-1.0)*min(r.x,r.y);
}
```

實際渲染會發現，這個做法在長軸上有明顯問題，貼合得不好：

![橢圓邊緣的瑕疵](/ellipse-approximate-v1.png)

原作者給出了一個改進版本：

```glsl
float sdf_ellipse_V3( in vec3 p, in vec3 r )
{
  float k1 = length(p/r);
  return length(p)*(1.0-1.0/k1);
}
```

然而實際渲染會發現，這個做法在邊緣有明顯鋸齒：

![橢圓邊緣的瑕疵](/ellipse-approximate-v3.png)

最後作者加入了對梯度的考量，我們也採用這個版本：

```glsl
float sdf_ellipse_V2( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  float k2 = length(p/(r*r));
  return k1*(k1-1.0)/k2;
}
```

可以看到結果好很多。

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

## 拾取 {#picking}

目前我們的拾取外掛使用 [幾何方法]，因此需要分別為橢圓與圓角矩形實作判斷方法。稍後會介紹更通用、以顏色編碼、基於 GPU 的拾取方法。在上面兩個範例中，可以把滑鼠移到任意圖形上，體驗拾取效果。

### 橢圓 {#picking-ellipse}

橢圓的拾取判斷更簡單。例如，預設會把填色與描邊區域都考慮進去：

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

### 圓角矩形 {#picking-rounded-rect}

如果不考慮圓角，其實也非常簡單。

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

## 延伸閱讀 {#extended-reading}

-   [到橢圓的距離]
-   [點到橢圓、橢球或超橢球的距離]
-   [快速圓角矩形陰影]
-   [模糊的圓角矩形]
-   [拼命尋找超橢圓]

[第 2 課]: /zh-Hant/guide/lesson-002
[二維距離函式]: https://iquilezles.org/articles/distfunctions2d/
[到橢圓的距離]: https://iquilezles.org/articles/ellipsedist/
[橢球 SDF]: https://iquilezles.org/articles/ellipsoids/
[方盒的 SDF]: https://www.youtube.com/watch?v=62-pRVZuS5c&t=18s&ab_channel=InigoQuilez
[在 SDF 中做圓角]: https://www.youtube.com/watch?v=s5NGeUV2EyU&t=110s
[運用 Rust 與 GPU 以 120 FPS 渲染使用者介面]: https://zed.dev/blog/videogame
[模糊的圓角矩形]: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
[使用 SDF 與 WebGL 的形狀鏡頭模糊效果]: https://tympanus.net/codrops/2024/06/12/shape-lens-blur-effect-with-sdfs-and-webgl/
[四次方程式]: https://mathworld.wolfram.com/QuarticEquation.html
[三次公式]: https://mathworld.wolfram.com/CubicFormula.html
[首一多項式]: https://mathworld.wolfram.com/MonicPolynomial.html
[預解三次方程式]: https://mathworld.wolfram.com/ResolventCubic.html
[牛頓法]: https://en.wikipedia.org/wiki/Newton%27s_method
[點到橢圓、橢球或超橢球的距離]: https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf
[著色器中的迴圈效能]: https://computergraphics.stackexchange.com/questions/2153/loop-performance-in-a-shader
[SVG \<rect\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[調整圓角半徑與平滑]: https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing
[快速圓角矩形陰影]: https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[誤差函數]: https://en.wikipedia.org/wiki/Error_function
[幾何方法]: /zh-Hant/guide/lesson-006#geometric-method
[Abramowitz 與 Stegun《數學函數手冊》]: https://personal.math.ubc.ca/~cbm/aands/page_299.htm
[box-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
[Zed Blade WGSL]: https://github.com/zed-industries/zed/blob/main/crates/gpui/src/platform/blade/shaders.wgsl
[blade]: https://github.com/kvark/blade
[Drop-Shadow：被低估的 CSS 濾鏡]: https://css-irl.info/drop-shadow-the-underrated-css-filter/
[tailwindcss - 投影]: https://tailwindcss.com/docs/drop-shadow
[圓角矩形的投影]: https://www.shadertoy.com/view/NtVSW1
[圓角矩形的內陰影]: https://www.shadertoy.com/view/mssGzn
[拼命尋找超橢圓]: https://www.figma.com/blog/desperately-seeking-squircles/
