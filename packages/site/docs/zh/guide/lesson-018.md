---
outline: deep
publish: false
---

<script setup>
import Gradient from '../../components/Gradient.vue';
import MeshGradient from '../../components/MeshGradient.vue';
import DeclarativeGradient from '../../components/DeclarativeGradient.vue';
</script>

# 课程 18 - 渐变和重复图案

在本节课中我们将介绍如何实现渐变和重复图案

## 使用 CanvasGradient 实现渐变 {#canvas-gradient}

我们可以用 [CanvasGradient] API 创建各种渐变效果，随后以纹理的形式消费。下面我们将介绍命令式和声明式的两种实现。

### 命令式创建渐变纹理 {#create-gradient-texture}

以线性渐变为例，创建 `<canvas>` 并得到上下文后，使用 [createLinearGradient] 时需要传入起点和终点，两者定义了渐变的方向。随后添加多个色标，绘制到 `<canvas>` 上，后续作为创建纹理的来源：

```ts
const gradient = ctx.createLinearGradient(0, 0, 1, 0); // x1, y1, x2, y2

gradient.addColorStop(0, 'red');
gradient.addColorStop(1, 'blue');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 1);
```

通过 [Device] API 创建纹理对象，最后将它传给图形的 `fill` 属性完成绘制。

```ts
// 0. 创建渐变数据
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

// 1. 获取画布设备
const device = canvas.getDevice();

// 2. 创建纹理对象
const texture = device.createTexture({
    format: Format.U8_RGBA_NORM,
    width: ramp.width,
    height: ramp.height,
    usage: TextureUsage.SAMPLED,
});
texture.setImageData([ramp.data]); // 将之前创建的 <canvas> 数据传给纹理

// 3. 将纹理对象传给图形的 `fill` 属性
rect.fill = texture;
```

<Gradient />

但我们希望支持声明式语法，提升易用性的同时也便于序列化。

### 声明式 CSS 渐变语法 {#css-gradient-syntax}

参考 CSS 的渐变语法，我们可以使用 [gradient-parser] 解析得到结构化的结果，后续用来调用 [createLinearGradient] 等 API：

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red, blue, green 100%)';
```

解析结果如下：

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

常见的渐变类型有以下几种，我们暂时支持前三种：

-   [linear-gradient] CSS 和 Canvas 支持
-   [radial-gradient] CSS 和 Canvas 支持
-   [conic-gradient] CSS 和 Canvas 支持
-   [repeating-linear-gradient] CSS 支持，使用 Canvas 也可以 hack 实现，详见 [How to make a repeating CanvasGradient]
-   [repeating-radial-gradient] CSS 支持
-   [sweep-gradient] CanvasKit / Skia 中支持

<DeclarativeGradient />

另外我们支持叠加多个渐变，例如：

```ts
rect.fill = `linear-gradient(217deg, rgba(255,0,0,.8), rgba(255,0,0,0) 70.71%),
    linear-gradient(127deg, rgba(0,255,0,.8), rgba(0,255,0,0) 70.71%),
    linear-gradient(336deg, rgba(0,0,255,.8), rgba(0,0,255,0) 70.71%)`;
```

### 渐变编辑面板 {#gradient-editor}

参考 Figma 的渐变编辑面板，我们也实现了一套类似的编辑器，你可以在上面的例子中选中图形后触发编辑面板。

![Figma gradient panel](/figma-gradient-panel.png)

## 使用 Mesh 实现渐变 {#mesh-gradient}

以上基于 Canvas 和 SVG 实现的渐变表现力有限，无法展示复杂的效果。一些设计工具例如 Sketch / Figma 社区中有很多基于 Mesh 的实现，例如：

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]

我们参考一些开源的实现，有的是在 Vertex Shader 中实现，有的是在 Fragment Shader 中实现，我们选择后者：

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

<MeshGradient />

由于需要兼顾 WebGL1 的 GLSL100 语法，需要避免使用 `switch`，否则会得到类似的报错：

> [!CAUTION]
> ERROR: 0:78: 'switch' : Illegal use of reserved word

另外在 `for` 循环中也无法将 Uniform 当作 `index` 的终止条件：

> [!CAUTION]
> ERROR: 0:87: 'i' : Loop index cannot be compared with non-constant expression

因此我们只能使用类似 Three.js chunks 中处理光源的代码，用常量 `MAX_POINTS` 来限制循环次数：

```glsl
#define MAX_POINTS 10

for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
        // ...
    }
}
```

### Warping {#warping}

-   [Inigo Quilez's Domain Warping]
-   [Mike Bostock's Domain Warping]

## 导出渐变成 SVG {#export-gradient-to-svg}

### 线性渐变 {#linear-gradient}

SVG 提供了 [linearGradient] 和 [radialGradient]，但支持的属性和 [CanvasGradient] 很不一样。以前者为例：

```ts
function computeLinearGradient(
    min: [number, number],
    width: number,
    height: number,
    angle: number,
) {
    const rad = DEG_TO_RAD * angle;
    const rx = 0;
    const ry = 0;
    const rcx = rx + width / 2;
    const rcy = ry + height / 2;
    // get the length of gradient line
    // @see https://observablehq.com/@danburzo/css-gradient-line
    const length =
        Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
    const x1 = min[0] + rcx - (Math.cos(rad) * length) / 2;
    const y1 = min[1] + rcy - (Math.sin(rad) * length) / 2;
    const x2 = min[0] + rcx + (Math.cos(rad) * length) / 2;
    const y2 = min[1] + rcy + (Math.sin(rad) * length) / 2;

    return { x1, y1, x2, y2 };
}
```

### 圆锥渐变 {#conic-gradient}

参考 [SVG angular gradient] 可以近似实现这种效果。而 [CSS conic-gradient() polyfill] 的思路是使用 Canvas 渲染后导出 dataURL，再用 `<image>` 引用。

### 多个渐变叠加 {#multiple-gradient-overlay}

对于多个渐变叠加的情况，在 Canvas API 可以多次设置 `fillStyle` 叠加绘制。而在声明式的 SVG 中，可以使用多个 `<feBlend>` 实现。

## 实现重复图案 {#pattern}

<https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createPattern#%E5%8F%82%E6%95%B0>

[CanvasImageSource](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasImageSource) supports following data types:

-   [HTMLImageElement](https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLImageElement)
-   [HTMLVideoElement](https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLVideoElement)
-   [HTMLCanvasElement](https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement)
-   [CanvasRenderingContext2D](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D),
-   [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap),
-   [ImageData](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageData),
-   [Blob](https://developer.mozilla.org/zh-CN/docs/Web/API/Blob).

```js
circle.style.fill = {
    image: [],
    repetition: 'repeat',
};
```

Pattern in ECharts: <https://echarts.apache.org/en/option.html#color>

```js
{
  image: imageDom, // supported as HTMLImageElement, HTMLCanvasElement, but not path string of SVG
  repeat: 'repeat' // whether to tile, can be 'repeat-x', 'repeat-y', 'no-repeat'
}
```

[CanvasGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
[Device]: /zh/reference/canvas#getdevice
[linear-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/linear-gradient
[radial-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/radial-gradient
[repeating-linear-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/repeating-linear-gradient
[repeating-radial-gradient]: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/repeating-radial-gradient
[conic-gradient]: https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient/conic-gradient
[sweep-gradient]: https://stackoverflow.com/questions/44912075/sweep-gradient-what-it-is-and-its-examples
[gradient-parser]: https://github.com/rafaelcaricio/gradient-parser
[Mesh gradients plugin for Sketch]: https://www.meshgradients.com/
[Mesh Gradient plugin for Figma]: https://www.figma.com/community/plugin/958202093377483021/mesh-gradient
[Photo gradient plugin for Figma]: https://www.figma.com/community/plugin/1438020299097238961/photo-gradient
[meshgradient]: https://meshgradient.com/
[Mesh gradient generator]: https://kevingrajeda.github.io/meshGradient/
[react-mesh-gradient]: https://github.com/JohnnyLeek1/React-Mesh-Gradient
[Inigo Quilez's Domain Warping]: https://iquilezles.org/articles/warp/
[Mike Bostock's Domain Warping]: https://observablehq.com/@mbostock/domain-warping
[linearGradient]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/linearGradient
[radialGradient]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/radialGradient
[createLinearGradient]: https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[SVG angular gradient]: https://stackoverflow.com/questions/2465405/svg-angular-gradient
[How to make a repeating CanvasGradient]: https://stackoverflow.com/questions/56398519/how-to-make-a-repeating-canvasgradient
[CSS conic-gradient() polyfill]: https://projects.verou.me/conic-gradient/
