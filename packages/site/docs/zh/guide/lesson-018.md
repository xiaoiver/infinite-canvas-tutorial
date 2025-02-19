---
outline: deep
publish: false
---

<script setup>
import Gradient from '../../components/Gradient.vue';
</script>

# 课程 18 - 渐变和重复图案

在本节课中我们将介绍如何实现渐变和重复图案

## Gradient {#gradient}

### 使用 CanvasGradient 实现 {#canvas-gradient}

我们可以用 [CanvasGradient] API 创建各种渐变效果，随后以纹理的形式消费。下面我们将介绍命令式和声明式的两种实现。

#### 创建渐变纹理 {#create-gradient-texture}

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
texture.setImageData([ramp.data]);

// 3. 将纹理对象传给图形的 `fill` 属性
rect.fill = texture;
```

<Gradient />

但我们希望支持声明式语法，提升易用性的同时也便于序列化。

#### CSS 渐变语法 {#css-gradient-syntax}

参考 CSS 的渐变语法，我们可以使用 [gradient-parser] 解析得到结构化的结果：

```ts
rect.fill = 'linear-gradient(0deg, blue, green 40%, red)';
rect.fill = 'radial-gradient(circle at center, red 0, blue, green 100%)';
```

常见的渐变类型包括：

-   [linear-gradient]
-   [radial-gradient]
-   [repeating-linear-gradient]
-   [repeating-radial-gradient]
-   [conic-gradient]
-   [sweep-gradient] CanvasKit / Skia 中支持

### 使用 Mesh 实现 {#mesh-gradient}

以上基于 Canvas 和 SVG 实现的渐变表现力有限，无法展示复杂的效果。一些设计工具例如 Sketch / Figma 社区中有很多基于 Mesh 的实现，例如：

-   [Mesh gradients plugin for Sketch]
-   [Mesh Gradient plugin for Figma]
-   [Photo gradient plugin for Figma]

我们参考一些开源的实现，有的是在 Vertex Shader 中，我们选择后者：

-   [meshgradient]
-   [Mesh gradient generator]
-   [react-mesh-gradient]

#### Warping {#warping}

-   [Inigo Quilez's Domain Warping]
-   [Mike Bostock's Domain Warping]

### 导出成 SVG {#export-svg}

## Pattern {#pattern}

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
