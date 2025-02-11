---
outline: deep
publish: false
---

Import the `Canvas` class from `@infinite-canvas-tutorial/core`.

```ts
import { Canvas } from '@infinite-canvas-tutorial/core';
const canvas = new Canvas({});
```

## constructor

```ts
export interface CanvasConfig {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    renderer?: 'webgl' | 'webgpu';
    shaderCompilerPath?: string;
    devicePixelRatio?: number;
    theme?: Theme;
    themeColors?: {
        [Theme.LIGHT]: {
            background: string;
            grid: string;
        };
        [Theme.DARK]: {
            background: string;
            grid: string;
        };
    };
    checkboardStyle?: CheckboardStyle;
    mode?: CanvasMode;
}
```

### canvas

Pass in `HTMLCanvasElement` in the browser environment, `OffscreenCanvas` in the WebWorker environment, and `node-canvas` in the Node.js environment.

### renderer

Set the renderer, optional values are `webgl` and `webgpu`, default value is `webgl`.

### shaderCompilerPath

Set the WebGPU shader compiler path, default value is `https://unpkg.com/@antv/g-device-api@1.6.8/dist/pkg/glsl_wgsl_compiler_bg.wasm`.

### devicePixelRatio

Set the device pixel ratio, default value is `window.devicePixelRatio`.

### theme

Set the theme, optional values are `Theme.LIGHT` and `Theme.DARK`, default value is `Theme.LIGHT`.

### themeColors

Set the theme colors, default value is

```js
{
    [Theme.LIGHT]: {
        background: '#fbfbfb',
        grid: '#dedede',
    },
    [Theme.DARK]: {
        background: '#121212',
        grid: '#242424',
    },
}
```

### checkboardStyle

Set the grid style, optional values are `CheckboardStyle.NONE`、`CheckboardStyle.GRID` and `CheckboardStyle.DOTS`, default value is `CheckboardStyle.GRID`.

### mode

Set the canvas mode, optional values are `CanvasMode.HAND` and `CanvasMode.SELECT`, default value is `CanvasMode.HAND`.

### plugins

内置插件的配置。

#### dragndrop

-   `overlap` How drops are checked for.
    -   `pointer` – the pointer must be over the dropzone (default)
    -   `center` – the draggable element’s center must be over the dropzone
-   `dragstartTimeThreshold` `number` Threshold for triggering `dragstart` event in milliseconds.
-   `dragstartDistanceThreshold` `number` Threshold for triggering `dragstart` event in pixels.

#### selector

-   `selectionBrushSortMode` How to sort selected shapes.
    -   `directional` – Sort by direction
    -   `behavior` – Sort by behavior
-   `selectionBrushStyle` Style of the selection brush. Any style except [d] that can be applied to a [Path].

## render

Creates an animation loop for rendering the canvas.

```ts
const animate = () => {
    canvas.render();
    requestAnimationFrame(animate);
};
animate();
```

## resize

Resizes the canvas.

```ts
canvas.resize(100, 200);
```

## destroy

Destroys the canvas.

```ts
canvas.destroy();
```

## appendChild

Adds an element to the canvas. Similar to [Node.appendChild]

```ts
canvas.appendChild(circle);
```

## removeChild

Removes an element from the canvas. Similar to [Node.removeChild]

```ts
canvas.removeChild(circle);
```

## elementsFromPoint

Gets all shapes at the specified point in world coordinates. Method signature as follows, reference: [Document.elementsFromPoint]

```ts
elementsFromPoint(x: number, y: number): Shape[]
```

## elementFromPoint

Gets the topmost shape at the specified point in world coordinates. Method signature as follows, reference: [Document.elementFromPoint]

```ts
elementFromPoint(x: number, y: number): Shape
```

## client2Viewport

Converts a point from client coordinates to viewport coordinates.

```ts
client2Viewport({ x, y }: IPointData): IPointData
```

## viewport2Client

Converts a point from viewport coordinates to client coordinates.

```ts
viewport2Client({ x, y }: IPointData): IPointData
```

## zoomIn

Zooms in the canvas using the camera.

```ts
canvas.zoomIn();
```

## zoomOut

Zooms out the canvas using the camera.

```ts
canvas.zoomOut();
```

## checkboardStyle

Gets or sets the canvas grid style, default value is `CheckboardStyle.GRID`.

```ts
export enum CheckboardStyle {
    NONE,
    GRID,
    DOTS,
}

canvas.checkboardStyle = CheckboardStyle.DOTS;
```

## theme

Gets or sets the canvas theme, default value is `Theme.LIGHT`.

```ts
canvas.theme = Theme.DARK;
```

## getDOM

Gets the created Canvas DOM element. The returned DOM element varies depending on the environment.

```ts
const canvas = new Canvas({
    canvas: document.createElement('canvas'),
});
const dom = canvas.getDOM(); // returns HTMLCanvasElement
```

## getDPR

Gets the device pixel ratio of the canvas.

```ts
const dpr = canvas.getDPR(); // 2
```

## toDataURL

Returns a DataURL of the exported canvas image, reference: [HTMLCanvasElement.toDataURL].

```ts
const dataURL = await canvas.toDataURL();
```

Parameters:

```ts
export interface DataURLOptions {
    /**
     * The default type is image/png.
     */
    type: DataURLType;
    /**
     * The image quality between 0 and 1 for image/jpeg and image/webp.
     */
    encoderOptions: number;
    /**
     * Whether to draw grid on the image.
     */
    grid: boolean;
}
```

[Node.appendChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[Node.removeChild]: https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
[HTMLCanvasElement.toDataURL]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
[Document.elementsFromPoint]: https://developer.mozilla.org/zh-CN/docs/Web/API/Document/elementsFromPoint
[Document.elementFromPoint]: https://developer.mozilla.org/zh-CN/docs/Web/API/Document/elementFromPoint
[Path]: /reference/path
[d]: /reference/path#d
