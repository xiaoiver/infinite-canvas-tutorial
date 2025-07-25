---
outline: deep
description: '学习将画布内容导出为PNG、JPEG和SVG格式图片。实现图片在画布中的渲染，并扩展SVG能力以支持更多设计工具特性。'
---

# 课程 10 - 图片导入导出

图片导入导出在无限画布中是一个非常重要的功能，通过图片产物可以和其他工具打通。因此虽然目前我们的画布绘制能力还很有限，但不妨提前考虑和图片相关的问题。在这节课中你将学习到以下内容：

-   将画布内容导出成 PNG，JPEG 和 SVG 格式的图片
-   在画布中渲染图片
-   拓展 SVG 的能力，以 `stroke-alignment` 为例

## 将画布内容导出成图片 {#export-canvas-to-image}

首先我们来看如何将画布内容导出成图片。[Export from Figma] 一文介绍了在 Figma 中如何通过切片工具将画布内容导出成包括 PNG 在内的多种格式图片。

![export from figma](https://help.figma.com/hc/article_attachments/24423129974679)

一些基于 Canvas2D 实现的图表库也提供了保存内容到图片的功能，下图来自 Highcharts，可以看到也提供了多种格式图片的导出功能，点击后会立刻触发浏览器的下载行为：

<img alt="exporter in highcharts" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

我们希望实现如下导出功能：

-   支持多种图片格式：PNG，JPEG 和 SVG
-   支持指定裁剪区域
-   支持选择是否包含网格

为此我们为这个图片导出器设计如下的使用方式：

```ts
// 创建导出器
const exporter = new ImageExporter({
    canvas, // 传入画布
});

// 获取导出图片对应的 DataURL
const canvas = await exporter.toCanvas(); // HTMLCanvasElement
const dataURL = canvas.toDataURL(); // data:...

// 触发浏览器下载
exporter.downloadImage({
    dataURL,
    name: 'my-file',
});
```

但针对不同格式的图片略有差别，下面我们先介绍 PNG / JPEG 格式图片的导出方式。

### 导出 PNG / JPEG {#to-raster-image}

[HTMLCanvasElement.toDataURL()] 可以获取画布内容对应的图片 [DataURI]，通过 `type` 参数可以指定图片格式，支持 PNG / JPEG 和 WebP。

```js
var canvas = document.getElementById('canvas');
var dataURL = canvas.toDataURL(); // 默认为 PNG
console.log(dataURL);
// "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNby
// blAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC"
```

因此我们为图片导出器增加一个 `toCanvas` 方法。该方法用以将指定区域的画布内容绘制到额外的 HTMLCanvasElement 中，随后可以根据需要进一步加工，例如添加背景色、水印等。完整方法签名如下，值得注意的是该方法为异步，稍后我们会介绍原因：

```ts
toCanvas(options: Partial<CanvasOptions> = {}): Promise<HTMLCanvasElement>;

interface CanvasOptions {
  grid: boolean;
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

各配置项含义如下：

-   `grid` 是否包含网格
-   `clippingRegion` 画布裁剪区域，用矩形表示
-   `beforeDrawImage` 在绘制画布内容前调用，适合绘制背景颜色
-   `afterDrawImage` 在绘制画布内容后调用，适合绘制水印

完整的使用示例如下：

```ts
const canvas = await exporter.toCanvas({
    // 指定导出画布区域
    clippingRegion: new Rectangle(
        clippingRegionX,
        clippingRegionY,
        clippingRegionWidth,
        clippingRegionHeight,
    ),
    beforeDrawImage: (context) => {
        // 绘制背景色
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, clippingRegionWidth, clippingRegionHeight);
    },
    afterDrawImage: (context) => {
        // 绘制水印
        context.font = '24px Times New Roman';
        context.fillStyle = '#FFC82C';
        context.fillText('Watermark', 20, 20);
    },
});
```

我们在画布右上角放置了导出图片下拉菜单，如果对组件感兴趣可以参考：[使用 Lit 和 Shoelace 开发 Web UI]。

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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

        for (let i = 0; i < 100; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const circle = new Circle({
                cx: Math.random() * 600,
                cy: Math.random() * 400,
                r: Math.random() * 40,
                fill,
            });
            canvas.appendChild(circle);

            circle.addEventListener('pointerenter', () => {
                circle.fill = 'red';
            });
            circle.addEventListener('pointerleave', () => {
                circle.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

现在让我们来回答为何 `toCanvas` 方法要设计成异步。由于 WebGL / WebGPU 使用 [SwapChain] 双缓冲机制，在创建上下文时，[preserveDrawingBuffer] 的默认值为 `false`，因此需要确保调用 `toDataURL` 时渲染没有被清除（例如调用 `gl.clear()`），否则就会得到一张空白图片。我们在[插件系统]的 `endFrame` 钩子中添加如下逻辑，一旦接收到导出命令，就立刻在当前帧结束前保存画布内容，以防下一帧到来时被清空，这会导致该行为变成异步。

```ts
hooks.endFrame.tap(() => {
    this.#device.endFrame();

    // capture here since we don't preserve drawing buffer
    if (this.#enableCapture && this.#resolveCapturePromise) {
        const { type, encoderOptions } = this.#captureOptions;
        const dataURL = (
            this.#swapChain.getCanvas() as HTMLCanvasElement
        ).toDataURL(type, encoderOptions);
        this.#resolveCapturePromise(dataURL);
        this.#enableCapture = false;
        this.#captureOptions = undefined;
        this.#resolveCapturePromise = undefined;
    }
});
```

另外可以选择导出图片是否包含 [网格]。暂时我们没有使用到裁剪以及水印等后续加工相关的功能。由于实现类似 Figma 的“切片”功能需要配合框选交互，后续实现时会一同介绍。现在让我们回到另一种特殊格式的图片。

### 导出 SVG {#to-vector-image}

相比位图，矢量图的优势体现在：

-   无限缩放不失真。这意味着它们可以被无限放大或缩小而不会失去清晰度，非常适合需要多种分辨率的场合。
-   可编辑性。SVG 是文本文件，可以使用任何文本编辑器进行编辑，便于修改图形的属性和样式。
-   对于复杂图形具有更小的文件大小。

因此设计工具一定都会提供对于这种格式的转换支持。对于我们的无限画布，可以将问题转换成：**如何将场景图序列化**，包括其中每一个节点的绘制属性、变换等。至于序列化的格式，除了 JSON，由于我们的 2D 图形的绘制属性设计本身就大量参考 SVG 实现，因此导出成 SVG 就十分自然了。

有趣的是，在 Three.js 中也提供了 [toJSON] 对场景的当前状态（包括对象、变换、材质等）保存成 [JSON-Object-Scene-format-4]。甚至还包括一个 [SVGRenderer] 能在有限条件下（无复杂 shading、阴影）尽可能渲染 3D 图形。

#### 从图形到序列化节点 {#shape-to-serialized-node}

很多白板工具也都提供了自定义的图形序列化格式，例如：[JSON objects in tldraw] 和 [JSON schema in excalidraw]。

从场景图的根节点开始遍历，递归对子元素调用。对于 `transform` 这样拥有复杂结构值（`position/scale/rotation`）的属性需要进一步处理：

```ts
function serializeNode(node: Shape): SerializedNode {
    const [type, attributes] = typeofShape(node);
    const data: SerializedNode = {
        type,
        attributes,
    };
    data.attributes.transform = serializeTransform(node.transform);
    data.children = node.children.map(serializeNode);
    return data;
}
```

以下面的 Circle 为例，我们得到了它的序列化对象：

```js eval code=true
serializedCircle = call(() => {
    const { Circle, serializeNode } = Lesson10;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
    circle.transform.position.x = 100;
    return serializeNode(circle);
});
```

通过反序列化方法就可以将它导入画布，`deserializeNode` 根据序列化节点的 `type` 属性创建对应图形，为绘图属性赋值：

```js eval code=false inspector=false
canvas2 = (async () => {
    const { Canvas } = Lesson10;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

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

```js eval code=true
call(async () => {
    const { deserializeNode } = Lesson10;
    const circle = await deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

整个画布的序列化和反序列化方法只要对根节点应用即可，当然事件监听器是无法被序列化的：

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = (await deserializeNode(JSON.parse(json))) as Group;
```

#### 从序列化节点到 SVGElement {#serialized-node-to-svgelement}

此时将序列化后的节点转换为 [SVG Element] 就很容易了。我们增加如下工具方法：

```ts
export function toSVGElement(node: SerializedNode): SVGElement;
```

大部分属性例如 `fill / stroke / opacity` 都是 SVG 的同名属性，因此可以直接使用 [setAttribute] 进行赋值，但仍有一些特殊的属性需要特殊处理，例如：

-   `transform` 我们使用了 `@pixi/math` 中的 `Transform` 对象，需要它的 `position / rotation / scale` 转换成 `matrix()`
-   `transform-origin` 对应 `transform` 中的 `pivot` 属性
-   `innerShadow` 并不存在 SVG 同名属性，需要使用 filter 实现
-   `outerShadow` 同上

下面的例子展示了一个序列化后的圆转换成 `<circle>` 的效果，为了能在 HTML 页面中展示需要嵌入 [\<svg\>] 中，它的尺寸和画布保持一致：

```js eval code=true
call(() => {
    const { toSVGElement } = Lesson10;

    const $circle = toSVGElement(serializedCircle);
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttribute('width', '200');
    $svg.setAttribute('height', '200');
    $svg.appendChild($circle);

    return $svg;
});
```

#### 从 SVGElement 到序列化节点 {#svgelement-to-serialized-node}

很自然的，我们也需要一个从 SVGElement 到序列化节点的转换方法：

```ts
export function fromSVGElement(element: SVGElement): SerializedNode;
```

但需要注意这种转换并不完全可逆，例如后续我们会介绍到的 [StrokeAlignment 实现](#stroke-alignment-export-svg) 中，一个 Circle 对应了两个 `<circle>`。在 Figma 中也是如此，下图展示了导入一个此前导出的 Ellipse 效果，可以看出两个图形并不完全一致。

![import an exported ellipse in Figma](/import-exported-ellipse.png)

有趣的是，[@pixi-essentials/svg] 也试图将 SVG 元素转换成 Pixi.js 中的图形并绘制，详见 [Vector rendering of SVG content with PixiJS]。

#### SVG 中的场景图 {#scene-graph-in-svg}

还有一点需要注意，在我们的场景图中任意图形都可以添加子节点，但 SVG 中只有 `<g>` 才可以添加子元素，除此之外例如 `<circle>` 是无法拥有子元素的。解决办法也很简单，对于拥有子节点的非 Group 元素，生成 SVG 时在外面套一个 `<g>`，将原本应用在本身的 `transform` 应用在它上面。假设后续我们支持了渲染文本，一个拥有文本子节点的 Circle 对应的 SVG 如下：

```html
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

#### inner & outerShadow {#export-inner-outer-shadow}

参考 [Adding Shadows to SVG Icons With CSS and SVG Filters]，我们使用 [filter primitive] 实现内外阴影。以外阴影为例：

```ts
const $feDropShadow = createSVGElement('feDropShadow', doc);
$feDropShadow.setAttribute('dx', `${(dropShadowOffsetX || 0) / 2}`);
$feDropShadow.setAttribute('dy', `${(dropShadowOffsetY || 0) / 2}`);
$feDropShadow.setAttribute(
    'stdDeviation',
    `${(dropShadowBlurRadius || 0) / 4}`,
);
$feDropShadow.setAttribute('flood-color', dropShadowColor);
$filter.appendChild($feDropShadow);
```

内阴影要复杂一些，限于篇幅就不展开了。可以在下面的示例中下载 SVG 查看：

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson10;

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

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            innerShadowColor: 'black',
            innerShadowOffsetX: 10,
            innerShadowOffsetY: 10,
            innerShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

#### 导出作为填充的图片 {#export-image-as-fill-value}

虽然我们还没有介绍填充图片的实现，但如果直接将 `fill` 属性的 Image 值序列化将得到如下结果：

```html
<circle fill="[object ImageBitmap]" />
```

这显然是无法正常展示的，我们需要将 Image 对象序列化成 DataURL，只要将图片绘制到 `<canvas>` 中，就可以利用上一节我们介绍过的 `toDataURL` 方法。参考 [Convert ImageBitmap to Blob]，我首先尝试了 [ImageBitmapRenderingContext]，ImageBitmap 可以在不阻塞主线程的情况下异步解码图像，这有助于提高应用的性能和响应性。

```ts
async function imageBitmapToURL(bmp: ImageBitmap) {
    const canvas = document.createElement('canvas');
    // resize it to the size of our ImageBitmap
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    // get a bitmaprenderer context
    const ctx = canvas.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bmp);
    const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
    return canvas.toDataURL();
}
```

但很不幸我们得到了如下报错。原因是我们已经使用了这个 ImageBitmap 创建了纹理，就无法再将它的控制权转移给新的 `<canvas>` 了。

> [!CAUTION]
> The input ImageBitmap has been detached

因此我们只能使用常规的 `drawImage` 方式将图片绘制到 `<canvas>` 中。

#### 绘制网格 {#export-grid}

最后来看如何使用 SVG 实现网格。参考 [How to draw grid using HTML5 and canvas or SVG]，我们使用 `<pattern>` 平铺实现：对于直线网格使用一大一小两组；对于圆点网格分别在“砖块”的四个角上各放置一个圆形：

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(221,221,221,1)" stroke-width="1"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#small-grid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(221,221,221,1)" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>

<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <circle id="dot-tl" cx="0" cy="0" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-br" cx="20" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-bl" cx="0" cy="20" r="2" fill="rgba(221,221,221,1)" />
    <circle id="dot-tr" cx="20" cy="0" r="2" fill="rgba(221,221,221,1)" />
  </defs>
  <pattern id="dots-grid" patternUnits="userSpaceOnUse" width="20" height="20">
    <use xlink:href="#dot-tl" />
    <use xlink:href="#dot-tr" />
    <use xlink:href="#dot-bl" />
    <use xlink:href="#dot-br" />
  </pattern>
  <rect width="100%" height="100%" fill="url(#dots-grid)" />
</svg>

另一种有趣的实现通过 `<line>` 的 `stroke-dasharray` 实现，相比大量重复的 `<circle>` 使用更少的 SVG 元素，详见：[Dot Grid With pattern]。

最后在绘制网格逻辑处加入判断：非截图模式下保持不变，截图模式下仅当开启包含网格选项时才绘制：

```ts
hooks.beginFrame.tap(() => {
    if (
        !this.#enableCapture ||
        (this.#enableCapture && this.#captureOptions.grid)
    ) {
        this.#grid.render(this.#device, this.#renderPass, this.#uniformBuffer);
    }
});
```

#### 使用 viewBox 反映相机参数 {#use-viewbox}

我们可以将画布的宽高放置在 `<svg>` 元素上，但相机的变换参数例如平移 `x/y` 和 `zoom`（我们暂不支持相机 rotation 的导出）应该如何反映在生成的 SVG 元素上呢？

这里可以使用 [viewBox]：

```ts
const { x, y, rotation, zoom } = cameras[0].read(ComputedCamera);
$namespace.setAttribute(
    'viewBox',
    `${x} ${y} ${width / zoom} ${height / zoom}`,
);
```

#### 产物优化 {#svg-optimizer}

如果仔细观察目前的 SVG 产物，会发现其中存在一些冗余的属性，例如 `opacity="1"` 本身就是默认值，没有必要显式出现在产物中。事实上这也是一些 SVG 优化工具例如 [svgo] 使用的手段之一：

> SVG files, especially those exported from vector editors, usually contain a lot of redundant information. This includes editor metadata, comments, hidden elements, **default or suboptimal values**, and other stuff that can be safely removed or converted without impacting rendering.

因此我们需要维护一套默认属性值的映射表，如果属性值恰好等于默认值，就不需要调用 `setAttribute` 设置了：

```ts
const defaultValues = {
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fill: 'black',
    stroke: 'none',
};

Object.entries(rest).forEach(([key, value]) => {
    if (`${value}` !== '' && `${defaultValues[key]}` !== `${value}`) {
        element.setAttribute(camelToKebabCase(key), `${value}`);
    }
});
```

### 导出 PDF {#to-pdf}

现在像素和矢量图都有了，如果还想导出成 PDF 可以使用 [jsPDF]，它提供了添加图片的 API，限于篇幅这里就不介绍了。

下面让我们来看另一个话题，如何在画布中渲染一张图片。

## 在画布中渲染图片 {#render-image}

在 WebGL / WebGPU 中通常需要加载图片并将其作为纹理使用，由于加载不同类型的资源是一个复杂的异步过程，大部分渲染引擎都会提供一个资源加载器。通常还会支持除不同类型图片之外的其他数据类型，例如音频、JSON、glTF 等。下面是 [PIXI Assets] 的使用例子：

```ts
import { Sprite, Assets } from 'pixi.js';
// load the texture we need
const texture = await Assets.load('bunny.png');

// This creates a texture from a 'bunny.png' image
const bunny = new Sprite(texture);
```

那么如何实现一个资源加载器呢？

### 图片加载器 {#image-loader}

[loaders.gl] 针对不同类型的资源提供了一系列加载器，例如：

-   可视化应用中常用的 JSON、CSV、GeoJSON、地理信息瓦片等
-   3D 模型格式例如 glTF 等
-   各种压缩纹理格式，使用 [CompressedTextureLoader] 在 WebWorker 中进行加载解析

这些加载器为上层应用的开发提供了极大便利，我们可以直接使用 [ImageLoader]，它支持这些图片格式：PNG, JPEG, GIF, WEBP, AVIF, BMP, SVG。使用方式如下，这里也能看出 [loaders.gl] 的设计思路，`@loaders.gl/core` 保证了 API 调用方式的统一以及不同类型加载器的可扩展性：

```ts
import { ImageLoader } from '@loaders.gl/images';
import { load } from '@loaders.gl/core';

const image = await load(url, ImageLoader, options);
```

除了直接设置 `fill` 属性，在反序列化时也需要将 DataURL 还原成 Image 对象：

```ts
async function deserializeNode(data: SerializedNode) {
    // data:image/png:base64...
    if (fill && isString(fill) && isDataUrl(fill)) {
        shape.fill = (await load(fill, ImageLoader)) as ImageBitmap;
    }
}
```

### API 设计 {#image-api}

回到我们的 API 设计部分，我们当然可以仿照之前的 Circle / Ellipse / Rect 为图片新增一种图形，对应 SVG 的 [\<image\>]：

```ts
const image = new Image({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    src: 'data:image...',
});
```

但仔细想想 Image 应该拥有 Rect 的全部能力，例如描边、圆角、阴影等等。有趣的是在 Figma 中如果我们选择向画布中插入一张原尺寸 1920 \* 1920 的图片并导出成 SVG，会得到一个 `<rect>` 元素，它的结构如下（省略部分属性值），`fill` 属性引用了一个 [\<pattern\>]，间接使用了图片平铺填充：

```html
<svg>
    <rect width="500" height="500" fill="url(#pattern0_2442_3)" />
    <defs>
        <pattern id="pattern0_2442_3">
            <use xlink:href="#image0_2442_3"
            <!-- 0.000520833 = 1 / 1920 -->
            transform="matrix(0.000520833 0 0 0.000527058 0 -0.0059761)" />
        </pattern>
        <image
            id="image0_2442_3"
            width="1920"
            height="1920"
            xlink:href="data:image/png;base64,iVBO..."
        />
    </defs>
</svg>
```

这给了我们一点启发，图片没必要以图形的形式单独存在，只要其他图形的 `fill` 属性支持贴图就好了，这样 Circle / Rect 等都可以使用图片作为填充。试想我们需要实现一个带描边的圆形图标需求，按照原本的设计需要一个 Image 图形搭配类似 [\<clipPath\>] 才能实现，现在只需要在已有 Circle 图形上填充图片：

```ts
circle.fill = image;
circle.stroke = 'black';
```

### 实现 {#implementation}

因此第一步我们将 `fill` 支持的类型从颜色字符串扩展到更多纹理来源：

```ts
export interface IRenderable {
    fill: string; // [!code --]
    fill: string | TexImageSource; // [!code ++]
}

type TexImageSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | VideoFrame;
```

在顶点数据中需要一个字段表示是否使用了纹理，如果使用就对纹理进行采样，这里的 `SAMPLER_2D()` 并非标准 GLSL 语法，而是我们自定义的标记，用于在 Shader 编译阶段替换成 GLSL100 / GLSL300 / WGSL 的采样语法。另外，目前纹理是上传的图片，后续还可以支持使用 Canvas2D API 创建的渐变例如 [createLinearGradient]：

```glsl
// vert
out vec2 v_Uv;
v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;

// frag
in vec2 v_Uv;
uniform sampler2D u_Texture;

if (useFillImage) {
    fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
}
```

使用了 `uniform` 会打破我们之前的合批处理逻辑。[Inside PixiJS: Batch Rendering System] 一文介绍了 Pixi.js 的 BatchRenderer 实现逻辑，从下面运行时编译的 Shader 模版可以看出，最大可以同时支持一组 `%count%` 个采样器，每个实例通过顶点数据 `aTextureId` 在采样器组中进行选择。

```glsl
// Shader template in Pixi.js BatchRenderer
// vert
attribute int aTextureId;
varying int vTextureId;
vTextureId = aTextureId;

// frag
uniform sampler2D uSamplers[%count%];
varying int vTextureId;
```

简单起见，我们将合批逻辑简化为：

1. `fill` 取值为颜色字符串与 Image 的无法合批
2. `fill` 取值为不同 Image 的无法合批

因此下面的三个 Circle 会在同一批绘制。

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', async (e) => {
        const image = await Utils.loadImage(
            'https://infinitecanvas.cc/canvas.png',
        );

        const canvas = e.detail;

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: image,
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### 增加缓存 {#render-cache}

之前我们一直没有考虑类似 Program、Bindings、Sampler 等这些 GPU 对象的缓存问题。为此我们增加一个资源缓存管理器以实现复用，依据资源类型分别实现命中逻辑。以 Sampler 为例，当 `SamplerDescriptor` 中的属性完全一致时就会命中缓存，比较逻辑在 `samplerDescriptorEquals` 中。

```ts
import { samplerDescriptorEquals } from '@antv/g-device-api';

export class RenderCache {
    device: Device;
    private samplerCache = new HashMap<SamplerDescriptor, Sampler>(
        samplerDescriptorEquals,
        nullHashFunc,
    );

    createSampler(descriptor: SamplerDescriptor): Sampler {
        // 优先从缓存中取
        let sampler = this.samplerCache.get(descriptor);
        if (sampler === null) {
            // 未命中，创建并添加缓存
            sampler = this.device.createSampler(descriptor);
            this.samplerCache.add(descriptor, sampler);
        }
        return sampler;
    }
}
```

## 增强 SVG: Stroke alignment {#stroke-alignment}

最后我们来引入一个有趣的话题。我们可以实现目前 SVG 规范还不支持的特性。

先来感受下 SVG 中 `opacity` `stroke-opacity` 和 `fill-opacity` 的区别。下图左边的圆应用了 `opacity="0.5"`，右边应用了 `fill-opacity="0.5" stroke-opacity="0.5"`。可以看出 stroke 描边有一半在圆内，一半在圆外：

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

在 Figma 中对应的 Stroke 位置的取值为 `Center`，其他可选值包括 `Inside` 和 `Outside`，下图分别展示了这三种取值的效果。在 SVG 中名为 `stroke-alignment`，但目前停留在草案阶段，详见 [Specifying stroke alignment]。Pixi.js 也支持 [PIXI.LineStyle alignment]，虽然仅在 WebGL 模式下。

![Stroke align in Figma](/figma-stroke-align.png)

我们为所有图形增加 `strokeAlignment` 属性：

```ts
export interface IRenderable {
    strokeAlignment: 'center' | 'inner' | 'outer'; // [!code ++]
}
```

### 渲染部分实现 {#stroke-alignment-rendering}

在 Shader 部分的实现只需要区分这三种取值，按不同方式混合填充和描边色：

```glsl
if (strokeAlignment < 0.5) { // center
    d1 = distance + strokeWidth;
    d2 = distance + strokeWidth / 2.0;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 1.5) { // inner
    d1 = distance + strokeWidth;
    d2 = distance;
    color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
    color = mix_border_inside(strokeColor, color, d2);
} else if (strokeAlignment < 2.5) { // outer
    d2 = distance + strokeWidth;
    color = mix_border_inside(strokeColor, color, d2); // No need to use fillColor at all
}
```

下面是我们的实现效果，可以看出渲染效果和 Figma 一致：

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson10');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Circle } = Lesson10;

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

        const circle1 = new Circle({
            cx: 200,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'inner',
        });
        canvas.appendChild(circle1);

        const circle2 = new Circle({
            cx: 320,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
        });
        canvas.appendChild(circle2);

        const circle3 = new Circle({
            cx: 460,
            cy: 200,
            r: 50,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 20,
            strokeOpacity: 0.5,
            strokeAlignment: 'outer',
        });
        canvas.appendChild(circle3);
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

在计算渲染包围盒和拾取判定时，也需要考虑该属性。下面的函数反映了不同取值下，描边应该从图形本身向外延伸多少距离。

```ts
function strokeOffset(
    strokeAlignment: 'center' | 'inner' | 'outer',
    strokeWidth: number,
) {
    if (strokeAlignment === 'center') {
        return strokeWidth / 2;
    } else if (strokeAlignment === 'inner') {
        return 0;
    } else if (strokeAlignment === 'outer') {
        return strokeWidth;
    }
}
```

### 导出 SVG 部分实现 {#stroke-alignment-export-svg}

正如前文提到的那样，SVG 目前还不支持 `stroke-alignment`，因此目前只能通过 hack 手段模拟。如果图形比较简单，完全可以分两次绘制填充和描边。下面为 Figma 对 `stroke-alignment: 'inner'` 的导出结果，也采用了这种方式：

```html
<circle cx="200" cy="200" r="200" fill="#F67676" />
<circle
    cx="200"
    cy="200"
    r="160"
    stroke="black"
    stroke-opacity="0.5"
    stroke-width="100"
/>
```

<div style="display:flex;justify-content:center;align-items:center;">
    <svg width="100" height="100" viewBox="0 0 443 443" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="221.5" cy="221.5" r="221.5" fill="#F67676"/>
    <circle cx="221.5" cy="221.5" r="171.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
    <svg width="120" height="120" viewBox="0 0 643 643" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="321.5" cy="321.5" r="221.5" fill="#F67676"/>
    <circle cx="321.5" cy="321.5" r="271.5" stroke="black" stroke-opacity="0.5" stroke-width="100"/>
    </svg>
</div>

除此之外，Figma 官网文档在 [StrokeAlign in Figma widget] 一文中还给出了另一种思路，不需要创建两个同类元素。[How to simulate stroke-align (stroke-alignment) in SVG] 尝试了这一思路，放大描边宽度至原来的两倍，配合 clipPath 和 mask 将多余部分剔除掉：

> Inside and outside stroke are actually implemented by doubling the stroke weight and masking the stroke by the fill. This means inside-aligned stroke will never draw strokes outside the fill and outside-aligned stroke will never draw strokes inside the fill.

出于实现简单考虑，我们选择第一种方式，创建两个同类元素分别绘制填充和描边，可以在上面的示例中尝试导出 SVG。

随着画布功能的丰富，我们有必要引入测试来验证导入导出功能是否正常、渲染效果是否正确、UI 组件是否可交互。在下一节中我们将介绍它。

## 扩展阅读 {#extended-reading}

-   [Export from Figma]
-   [Specifying stroke alignment]
-   [How to simulate stroke-align (stroke-alignment) in SVG]
-   [Adding Shadows to SVG Icons With CSS and SVG Filters]
-   [Vector rendering of SVG content with PixiJS]

[Export from Figma]: https://help.figma.com/hc/en-us/articles/360040028114-Export-from-Figma#h_01GWB002EPWMFSXKAEC62GS605
[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL
[preserveDrawingBuffer]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#preservedrawingbuffer
[DataURI]: https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
[SwapChain]: /zh/guide/lesson-001#swapchain
[使用 Lit 和 Shoelace 开发 Web UI]: /zh/guide/lesson-007
[插件系统]: /zh/guide/lesson-001#plugin-based-architecture
[SVGRenderer]: https://threejs.org/docs/#examples/en/renderers/SVGRenderer
[toJSON]: https://threejs.org/docs/#api/en/core/Object3D.toJSON
[JSON-Object-Scene-format-4]: https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4
[网格]: /zh/guide/lesson-005
[SVG Element]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element
[\<svg\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg
[\<image\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image
[\<pattern\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/pattern
[\<clipPath\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/clipPath
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[jsPDF]: https://github.com/parallax/jsPDF
[loaders.gl]: https://github.com/visgl/loaders.gl
[ImageLoader]: https://loaders.gl/docs/modules/images/api-reference/image-loader
[CompressedTextureLoader]: https://loaders.gl/docs/modules/textures/api-reference/compressed-texture-loader
[PIXI Assets]: https://pixijs.download/release/docs/assets.html
[Specifying stroke alignment]: https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
[StrokeAlign in Figma widget]: https://www.figma.com/widget-docs/api/component-SVG/#strokealign
[createLinearGradient]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
[Inside PixiJS: Batch Rendering System]: https://medium.com/swlh/inside-pixijs-batch-rendering-system-fad1b466c420
[How to draw grid using HTML5 and canvas or SVG]: https://stackoverflow.com/questions/14208673/how-to-draw-grid-using-html5-and-canvas-or-svg
[Convert ImageBitmap to Blob]: https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
[ImageBitmapRenderingContext]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmapRenderingContext
[@pixi-essentials/svg]: https://github.com/ShukantPal/pixi-essentials/tree/master/packages/svg
[Vector rendering of SVG content with PixiJS]: https://medium.com/javascript-in-plain-english/vector-rendering-of-svg-content-with-pixijs-6f26c91f09ee
[PIXI.LineStyle alignment]: https://api.pixijs.io/@pixi/graphics/PIXI/LineStyle.html#alignment
[svgo]: https://github.com/svg/svgo
[Dot Grid With pattern]: https://www.smashingmagazine.com/2024/09/svg-coding-examples-recipes-writing-vectors-by-hand/#dot-grid-with-pattern
[Adding Shadows to SVG Icons With CSS and SVG Filters]: https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/
[filter primitive]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element#filter_primitive_elements
[JSON objects in tldraw]: https://tldraw.dev/docs/shapes#The-shape-object
[JSON schema in excalidraw]: https://docs.excalidraw.com/docs/codebase/json-schema
[viewBox]: https://developer.mozilla.org/zh-CN/docs/Web/SVG/Reference/Attribute/viewBox
