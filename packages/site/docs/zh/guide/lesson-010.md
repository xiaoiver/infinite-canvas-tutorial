---
outline: deep
---

# 课程 10 - 图片导入导出

图片导入导出在无限画布中是一个非常重要的功能，通过图片产物可以和其他工具打通。因此虽然目前我们的画布绘制能力还很有限，但不妨提前考虑和图片相关的问题。在这节课中你将学习到以下内容：

-   将画布内容导出成 PNG，JPEG 和 SVG 格式的图片
-   拓展 SVG 的能力，以 stroke 为例
-   导入图片

## 导出图片

首先我们来看如何将画布内容导出成图片。[Export from Figma] 一文介绍了在 Figma 中如何通过切片工具将画布内容导出成包括 PNG 在内的多种格式图片。

![export from figma](https://help.figma.com/hc/article_attachments/24423129974679)

一些图表库也提供了保存内容到图片的功能，下图来自 Highcharts，可以看到也提供了多种格式图片的导出功能，点击后会立刻触发浏览器的下载行为：

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

### 导出 PNG / JPEG

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
    const { Canvas, Rect } = Lesson10;

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

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

现在让我们来回答为何 `toCanvas` 方法要设计成异步。由于 WebGL / WebGPU 使用 [SwapChain] 双缓冲机制，在创建上下文时，[preserveDrawingBuffer] 的默认值为 `false`，因此需要确保调用 `toDataURL` 时渲染没有被清除（例如调用 `gl.clear()`），否则就会得到一张空白图片。我们在 `endFrame` 钩子中添加如下逻辑，一旦接收到导出命令，就立刻在当前帧结束前保存画布内容，以防下一帧到来时被清空，这会导致该行为变成异步。

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

### 导出 SVG

有时我们想导出矢量图。

### 导出 PDF

## Enhanced SVG: Stroke alignment

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
