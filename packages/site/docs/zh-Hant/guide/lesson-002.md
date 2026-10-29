---
outline: deep
description: '學習如何將圖形加入畫布，並使用 SDF（Signed Distance Field，有號距離場）繪製圓形。涵蓋反鋸齒技術，以及用於效能最佳化的髒旗標設計模式。'
head:
    - ['meta', { property: 'og:title', content: '第 2 課 - 繪製圓形' }]
---
# 第 2 課 - 繪製圓形 {#lesson-2-draw-a-circle}

在這一課中，你將學到下列內容：

-   將圖形加入畫布
-   使用 SDF 繪製圓形
-   反鋸齒
-   髒旗標設計模式

啟動專案時，你會看到畫布上畫了一個圓，可以修改寬高，或切換 WebGL / WebGPU 渲染器。

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

## 將圖形加入畫布 {#adding-shapes-to-canvas}

上一課我們建立了一塊空白畫布，接下來會往上面加入各種圖形。這樣的 API 要怎麼設計？身為前端開發者，你可能會想用熟悉的 [Node API appendChild] 來繪製：

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

先暫時建立一個圖形基底類別，Circle、Ellipse、Rect 等都會繼承它：

```ts
export abstract class Shape {}
```

用一個陣列在畫布中儲存圖形清單：

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

在畫布的 render 方法中走訪圖形清單，並呼叫 render 鉤子：

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

在渲染外掛中，每一幀開始前會建立一個 `RenderPass`，它封裝在硬體抽象層裡。WebGL 沒有這個概念，但在 WebGPU 中，[beginRenderPass] 會傳回 [GPURenderPassEncoder]，用來記錄一系列命令，包括 `draw` 命令，稍後在 `render` 鉤子中會看到。建立 `RenderPass` 時我們提供下列參數：

-   `colorAttachment`
-   `colorResolveTo`
-   `colorClearColor`。這在 WebGL 中以 [gl.clearColor] 命令實作；在 WebGPU 中則以 [clearValue] 屬性宣告。這裡我們把它設為白色。

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

對應建立過程，每一幀結束時要提交 `RenderPass`。在 WebGPU 中同樣很容易找到對應的 [submit] 方法。當然，原生 API 提交的是已編碼的命令緩衝區，硬體抽象層簡化了這些概念。

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

最後來到 `render` 鉤子。每個圖形負責實作繪製自己的邏輯，外掛則負責傳入所需的 GPU 物件，例如 Device 與 `RenderPass`。

```ts
hooks.render.tap((shape) => {});
```

## 繪製圓形 {#draw-a-circle}

首先要定義圓的基本屬性。熟悉 SVG [circle] 的人會知道，可以根據圓心 `cx/cy` 與半徑 `r` 定義圓的幾何，並使用通用的繪製屬性 `fill` 與 `stroke` 滿足基本需求。

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

### 畫布座標 {#canvas-coordinates}

既然談到 `cx/cy` 圓心這類位置屬性，就必須先弄清楚我們使用的畫布座標系。在 Canvas 與 SVG 中，座標系原點都在左上角，X 軸正向 👉，Y 軸正向 👇。然而 WebGL 使用的 [裁剪座標系] 遵循 OpenGL 規範，原點在視埠中心，X 軸指向 👉，Y 軸指向 👆，Z 軸指向螢幕內側。下方這個長寬比為 2 的立方體，也稱為正規化裝置座標（normalized device coordinates，NDC）：

![裁剪空間](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

然而 WebGPU 遵循 Metal 規範，與 WebGL 的差異在於 Y 軸正向朝 👇，Z 軸正向朝外。Z 軸的裁剪範圍也不同：WebGL 是 `[-1, 1]`，WebGPU 是 `[0, 1]`：

![WebGL 與 WebGPU 的 Z 裁剪空間範圍](/clip-space-z-range.png)

我們的硬體抽象層試著抹平 WebGL 與 WebGPU 的差異，但在座標系上選擇對齊 Canvas / SVG。我們認為這更符合白板使用者的習慣。

![畫布預設格線](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

因此，如果畫布寬高是 200，用下面的方式加入的 `Circle` 會出現在畫布中央：

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

下一個問題是，如何把螢幕座標系中的 `cx/cy` 轉換成渲染管線使用的 NDC。我們會把畫布的寬高作為 Uniform 傳入，把圓的位置作為 Attribute 傳入。位置除以寬高會得到 `[0, 1]` 範圍的值，乘以二再減一，就轉換成 `[-1, 1]`，也就是 NDC 下的值域。最後把 Y 軸向下翻轉：

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

### 處理顏色值 {#processing-color-values}

與 Canvas 或 SVG 不同，字串形式的顏色值不能直接用在 WebGL 或 WebGPU 中。不過 [d3-color] 可以把它轉換成 `{ r, g, b, opacity }` 格式，之後就能直接作為 `vec4` 傳入 `attribute`，或加以壓縮。最後，我們目前只支援 RGB 空間的顏色值，這表示 [hsl] 與 [oklch] 無法使用：

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

樣式問題解決之後，讓我們回到幾何。三角形網格是 3D 渲染中常見的幾何表示，Three.js 的 [CircleGeometry] 會從圓心把圓拆成三角形，以程序化方式產生幾何。顯然三角形越多，圓就越平滑；如果只有兩個三角形，它會退化成正方形。為了得到平滑的圓，需要更多頂點，圓的數量一增加，GPU 記憶體就會顯著上升。

![Three.js 中的圓形幾何](/circle-geometry.png)

### SDF {#sdf}

使用一種稱為有號距離函數（Signed Distance Functions，SDF）的方法，只需要四個頂點。下圖視覺化了 SDF 的概念，來自新興編輯器 Zed 的實作文章 [drawing-rectangles]。平面上半徑 100 的圓，圓上的距離為 0，圓內為負值，圓外為正值：

![SDF 圓形](/sdf.svg)

> 原文使用 Lottie 動畫展示有向距離場的定義，以及底層圖形若干公式的推導。在 Zed 的 GPUI 中，同樣使用 SDF 繪製底層圖形，以獲得更好的效能。

通常我們在頂點著色器中建立座標系。

```glsl
layout(location = 0) in vec2 a_FragCoord;
out vec2 v_FragCoord;
void main() {
  v_FragCoord = a_FragCoord;
}
```

有了距離資訊，就可以在片段著色器中使用不同圖形的 SDF 公式，帶入目前像素的座標，判斷該點是否在圖形內部。如果在外部，可以直接丟棄，否則著色。GLSL 程式碼如下。有些效果不在意部分透明度，而是想依照紋理的顏色值，要嘛顯示、要嘛完全不顯示，請見 [丟棄片段]。

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

除了使用更少的頂點，SDF 還有下列優點：

-   容易做反鋸齒。下一小節會介紹。
-   容易組合。交集與差集運算可以組合起來，完成複雜圖形。
-   容易實現一些看起來複雜的效果。例如描邊、圓角、陰影。當然，實作這些效果時，我們會介紹這個方法的一些限制。

[distfunctions] 也有 SDF 的解釋與詳細推導。這個方法可以繪製各種常見的 2D 甚至 3D 形狀，之後我們會繼續用它繪製矩形與文字。

讓我們回到圖形基底類別，加上一個接收繪製所需參數的方法：

```ts{2}
export abstract class Shape {
  abstract render(device: Device, renderPass: RenderPass): void;
}
```

在外掛的 `render` 鉤子中呼叫，並傳入所需參數：

```ts
hooks.render.tap((shape) => {
    shape.render(this.#device, this.#renderPass);
});
```

在 `Circle` 的 `render` 方法中建立與 clip space 一致的單位座標系，包含四個頂點，透過 `indexBuffer` 索引陣列拆成兩個三角形（V0 -> V1 -> V2 與 V0 -> V2 -> V3）：

<img alt="單位圓" src="/unit-circle.png" width="300" />

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

這四個頂點可以共用相同的樣式屬性，例如圓心、半徑、填色等。這能縮小頂點陣列記憶體的大小：

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

接著指定頂點陣列應該如何配置，並透過 `shaderLocation` 與著色器關聯。

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

SDF 也可以用來繪製橢圓、矩形、文字等，但我們現在先不繼續加入其他圖形，而是先專注另一個問題。

## 反鋸齒 {#antialiasing}

如果仔細看，或把畫面放大，會發現邊緣明顯有鋸齒。畢竟在片段著色器中，我們對每個像素點採用粗暴的判斷：要嘛著色，要嘛丟棄，中間沒有過渡。

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

下面我們參考文章 [平滑 SDF 圖形邊緣]，使用幾種不同做法並比較結果。

### Smoothstep {#smoothstep}

首先想到的是，可以用 GLSL / WGSL 的內建函式 `smoothstep` 做平滑。相對於 `step` 函式，它會在指定的值域產生平滑後的值，效果類似緩動函式 `ease-in/out`。你可以在 [Smoothstep - thebookofshaders.com] 修改參數，視覺化它的形狀。例如下圖中，x 大於 `0` 時 y 為 1，x 小於 `-0.5` 時 y 為 0，中間的區域被平滑：

<img alt="smoothstep 曲線" src="/smoothstep.png" width="300" />

上一節算出的 SDF 距離是負值。我們取一個較小的固定值 `0.01`，讓邊緣較小範圍內的距離可以被平滑，處理後的值可以當作透明度。

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);

outputColor = v_FillColor;
outputColor.a *= alpha;
```

效果如下：

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

這個方法的問題是，它會讓圓的半徑稍微變大，畢竟多出了百分之一。另外放大之後（相機相關功能稍後再談），邊緣也不夠銳利。

### 固定值相除 {#divide-fixed}

GLSL 沒有 `saturate` 函式，可以用 `clamp` 實作：

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

### 螢幕空間導數 {#screen-space-derivatives}

[使用 fwidth 進行基於距離的反鋸齒] 說明了如何用 `fwidth` 做基於距離的反鋸齒。什麼是 `fwidth`？

[什麼是螢幕空間導數，什麼時候會用到？] 與 [什麼是 fwidth，它如何運作？] 詳細說明了這個方法的概念與計算。簡而言之，片段著色器一次處理一個 2x2 的 quad，而不是單一個像素點。GPU 這樣做的理由，見 [2011 圖形管線之旅，第 8 部分]：

> 另外，這裡正好說明為什麼我們處理的是 2×2 像素的 quad，而不是個別像素。主要原因是導數。紋理取樣器依賴紋理座標的螢幕空間導數來選擇 mip-map 並進行過濾（如同我們在第 4 部分看到的）；從 shader model 3.0 起，同一套機制也能以導數指令的形式，直接提供給像素著色器使用。

下面看看每個 2x2 quad 中偏導數是如何計算的，例如對 uv：

![uv 的 fwidth](https://pic2.zhimg.com/80/v2-0f2d0605965ab352aec8826d0eed02dd_1440w.webp)

為了讓開發者更容易感受某個值在像素之間變化得有多劇烈，OpenGL / WebGL 與 WebGPU 都提供下列方法。但 WebGL1 需要啟用 `GL_OES_standard_derivatives` 擴充功能，WebGL2 與 WebGPU 則不需要：

-   `dFdx` 計算某個參數屬性的值，在螢幕水平方向跨越一個像素時改變了多少。
-   `dFdy` 計算某個參數屬性的值，在螢幕垂直方向跨越一個像素時改變了多少。
-   `fwidth` 計算 `abs(dFdx) + abs(dFdy)`

因此，我們有兩種方式計算一個參數在一個像素內改變了多少。它們之間有差別嗎？

```glsl
pixelSize = fwidth(dist);
/* or */
pixelSize = length(vec2(dFdx(dist), dFdy(dist)));
```

[AAA - 解析式反鋸齒] 指出，與 `length` 相比，`fwidth` 的額外開銷更小。雖然對角線方向有輕微偏差，但在我們的情境中幾乎可以忽略。

> Fast LAA 在對角線方向有輕微偏差，使圓形看起來非常輕微地偏菱形，並在正交方向有稍銳利的曲率，尤其是圖形很小的時候。有時對角線上的邊緣也會稍微模糊。

我們傳入 SDF 計算得到的距離，並算出它改變了多少，反映到透明度上。

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

## 髒旗標 {#dirty-flag}

先前我們把填色、圓心等樣式屬性寫進頂點陣列，因此想修改顏色時，也必須重新修改 Buffer 裡的資料。對下面這種連續修改的情境，如果每次修改屬性都立刻呼叫底層 API，會造成大量不必要的額外開銷。

```ts
circle.fill = 'blue';
circle.fill = 'yellow';
circle.cx = 500;
```

我們希望把修改資料這類耗時工作延後，並在適當時機合併，例如渲染之前。這時可以套用一種稱為「髒旗標」的常見設計模式：[髒旗標 - Game Programming Patterns]。修改屬性時，我們只設定髒旗標，不執行其他耗時操作：

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true;
  }
}
```

在 `render` 方法中，只有偵測到屬性修改時才更新底層緩衝區。這樣無論兩次渲染之間屬性被修改多少次，緩衝區都只更新一次：

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

當然，渲染完成後別忘了重設髒旗標：

```ts
this.renderDirtyFlag = false;
```

試試看效果：

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

後續介紹場景圖時，我們也會套用髒旗標。

## 延伸閱讀 {#extended-reading}

-   [distfunctions]
-   [運用 Rust 與 GPU 以 120 FPS 渲染使用者介面]
-   [次像素距離變換：適用於 WebGPU 的高品質字型渲染]
-   [AAA - 解析式反鋸齒]
-   [跟著 Rick and Morty 學習著色器程式設計]

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
[運用 Rust 與 GPU 以 120 FPS 渲染使用者介面]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clearColor
[clearValue]: https://www.w3.org/TR/webgpu/#dom-gpurenderpasscolorattachment-clearvalue
[使用 fwidth 進行基於距離的反鋸齒]: http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/
[什麼是 fwidth，它如何運作？]: https://computergraphics.stackexchange.com/a/63
[什麼是螢幕空間導數，什麼時候會用到？]: https://gamedev.stackexchange.com/questions/130888/what-are-screen-space-derivatives-and-when-would-i-use-them
[Smoothstep - thebookofshaders.com]: https://thebookofshaders.com/glossary/?search=smoothstep
[平滑 SDF 圖形邊緣]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[次像素距離變換：適用於 WebGPU 的高品質字型渲染]: https://acko.net/blog/subpixel-distance-transform/
[2011 圖形管線之旅，第 8 部分]: https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
[丟棄片段]: https://learnopengl.com/Advanced-OpenGL/Blending
[AAA - 解析式反鋸齒]: https://blog.frost.kiwi/analytical-anti-aliasing
[跟著 Rick and Morty 學習著色器程式設計]: https://danielchasehooper.com/posts/code-animated-rick/
[oklch]: https://github.com/d3/d3-color/issues/87
[裁剪座標系]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#clip_space
[髒旗標 - Game Programming Patterns]: https://gameprogrammingpatterns.com/dirty-flag.html
