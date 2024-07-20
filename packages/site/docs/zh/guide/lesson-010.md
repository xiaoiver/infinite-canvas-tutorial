---
outline: deep
---

# 课程 10 - 图片导入导出

图片导入导出在无限画布中是一个非常重要的功能，通过图片产物可以和其他工具打通。因此虽然目前我们的画布绘制能力还很有限，但不妨提前考虑和图片相关的问题。在这节课中你将学习到以下内容：

-   将画布内容导出成 PNG，JPEG 和 SVG 格式的图片，并支持 PDF
-   导入图片到画布中
-   拓展 SVG 的能力，以 stroke 为例

## 导出图片 {#export-image}

首先我们来看如何将画布内容导出成图片。[Export from Figma] 一文介绍了在 Figma 中如何通过切片工具将画布内容导出成包括 PNG 在内的多种格式图片。

![export from figma](https://help.figma.com/hc/article_attachments/24423129974679)

一些基于 Canvas2D 实现的图表库也提供了保存内容到图片的功能，下图来自 Highcharts，可以看到也提供了多种格式图片的导出功能，点击后会立刻触发浏览器的下载行为：

<img alt="exporter in highcharts" src="https://user-images.githubusercontent.com/3608471/174998577-df1c54e9-d981-4d82-a4aa-7f0bedfb11a1.png" width="300" />

我们希望实现如下导出功能：

-   支持多种图片格式：PNG，JPEG 和 SVG
-   支持指定裁剪区域

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
  clippingRegion: Rectangle;
  beforeDrawImage: (context: CanvasRenderingContext2D) => void;
  afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

各配置项含义如下：

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
call(() => {
    const { deserializeNode } = Lesson10;
    const circle = deserializeNode(serializedCircle);
    canvas2.root.appendChild(circle);
    return canvas2.getDOM();
});
```

整个画布的序列化和反序列化方法只要对根节点应用即可，当然事件监听器是无法被序列化的：

```ts
const json = JSON.stringify(serializeNode(canvas.root)); // {}
canvas.root = deserializeNode(JSON.parse(json)) as Group;
```

此时将序列化后的节点转换为 [SVG Element] 就很容易了，大部分属性例如 `fill / stroke / opacity` 都是 SVG 的同名属性，因此可以直接使用 [setAttribute] 进行赋值，但仍有一些特殊的属性需要特殊处理，例如：

-   `transform` 需要将对象中的 `position / rotation / scale` 转换成 `matrix()`
-   `transform-origin` 对应 `transform` 中的 `pivot` 属性
-   `innerShadow` 并不存在 SVG 同名属性，需要使用 filter 实现。可参考 [Creating inner shadow in svg]

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

最后还有一点需要注意，在我们的场景图中任意图形都可以添加子节点，但 SVG 中只有 `<g>` 才可以添加子元素，`<circle>` 是无法拥有子元素的。解决办法也很简单，对于拥有子节点的非 Group 元素，生成 SVG 时在外面套一个 `<g>`，将原本应用在本身的 `transform` 应用在它上面。假设后续我们支持了渲染文本，一个拥有文本子节点的 Circle 对应的 SVG 如下：

```svg
<g transform="matrix(1,0,0,0,1,0)">
    <circle cx="100" cy="100" r="100" fill="red" />
    <text />
</g>
```

### 导出 PDF {#to-pdf}

## 渲染图片

## Enhanced SVG: Stroke alignment

最后我们来引入一个有趣的话题。

`opacity` `stroke-opacity` 和 `fill-opacity` 的区别：

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

[How to simulate stroke-align (stroke-alignment) in SVG]

Figma 中的 Stroke 取值包括 `Center / Inside / Outside`

![Stroke center in Figma](/figma-stroke-center.png)

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
[setAttribute]: https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
[Creating inner shadow in svg]: https://stackoverflow.com/questions/69799051/creating-inner-shadow-in-svg
[jsPDF]: https://github.com/parallax/jsPDF
