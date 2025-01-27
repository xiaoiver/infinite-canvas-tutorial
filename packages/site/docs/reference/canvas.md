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
    backgroundColor?: string;
    gridColor?: string;
}
```

## canvas

In the browser environment, pass in `HTMLCanvasElement`, in the WebWorker environment, pass in `OffscreenCanvas`, and in the Node.js environment, you can use `node-canvas`.

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
