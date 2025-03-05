---
outline: deep
publish: false
---

See [Lesson 10 - Importing and Exporting Images] for more information.

```ts
import { ImageExporter } from '@infinite-canvas-tutorial/core';
const exporter = new ImageExporter({ canvas });
```

## constructor

-   Required parameter `canvas`, the [Canvas] instance.
-   Optional parameter `defaultFilename`, default value is `g`.

```ts
export interface ImageExporterOptions {
    canvas: Canvas;
    defaultFilename?: string;
}
```

## toCanvas

Returns an `HTMLCanvasElement`, which can be called [toDataURL] later.

```ts
const canvas = await exporter.toCanvas();
canvas.toDataURL(); // data:image/png;base64,...
```

The meaning of each configuration item is as follows:

-   `grid` Whether to include a grid
-   `beforeDrawImage` Called before drawing the content of the canvas, suitable for drawing the background color.
-   `afterDrawImage` Called after drawing the content of the canvas, suitable for drawing watermarks.

```ts
export interface CanvasOptions {
    grid: boolean;
    beforeDrawImage: (context: CanvasRenderingContext2D) => void;
    afterDrawImage: (context: CanvasRenderingContext2D) => void;
}
```

## toSVG

Generate an SVGElement. The `grid` parameter indicates whether to display the grid.

```ts
export interface SVGOptions {
    grid: boolean;
}
```

## toSVGDataURL

Generate an SVG's `dataURL`. The `grid` parameter indicates whether to display the grid.

```ts
export interface SVGOptions {
    grid: boolean;
}
```

## downloadImage

Triggers the browser's download behavior.

```ts
export interface DownloadImageOptions {
    dataURL: string;
    name?: string;
}
```

[Lesson 10 - Importing and Exporting Images]: /guide/lesson-010
[Canvas]: /reference/canvas
[toDataURL]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
