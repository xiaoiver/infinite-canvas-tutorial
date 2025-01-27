---
outline: deep
publish: false
---

[课程 10 - 导入和导出图片]

```ts
import { ImageExporter } from '@infinite-canvas-tutorial/core';
const exporter = new ImageExporter({ canvas });
```

## constructor

-   必传参数 `canvas`，传入已创建的[画布]。
-   可选参数 `defaultFilename`，默认值为 `g`。

```ts
export interface ImageExporterOptions {
    canvas: Canvas;
    defaultFilename?: string;
}
```

## toCanvas

返回一个 `HTMLCanvasElement`，随后可以调用 [toDataURL] 方法。

```ts
const canvas = await exporter.toCanvas();
canvas.toDataURL(); // data:image/png;base64,...
```

参数如下：

-   `grid` 是否包含网格
-   `beforeDrawImage` 在绘制画布内容前调用，适合绘制背景颜色
-   `afterDrawImage` 在绘制画布内容后调用，适合绘制水印

```ts
export interface CanvasOptions {
    grid: boolean;
    beforeDrawImage: (context: CanvasRenderingContext2D) => void;
    afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

## toSVG

生成 SVGElement。参数 `grid` 表示是否显示网格。

```ts
export interface SVGOptions {
    grid: boolean;
}
```

## toSVGDataURL

生成 SVG 的 `dataURL`。参数 `grid` 表示是否显示网格。

```ts
export interface SVGOptions {
    grid: boolean;
}
```

## downloadImage

触发浏览器的下载行为，只能在浏览器环境下运行。

-   必传参数 `dataURL`，传入图片的 `dataURL`。
-   可选参数 `name`，默认值为 `canvas`。

```ts
export interface DownloadImageOptions {
    dataURL: string;
    name?: string;
}
```

[课程 10 - 导入和导出图片]: /zh/guide/lesson-010
[画布]: /zh/reference/canvas
[toDataURL]: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL
