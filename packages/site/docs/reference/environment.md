---
outline: deep
publish: false
---

We want the canvas to run in different environments like browsers, Node.js, WebWorker, etc. Since different environments provide different functionalities, we referenced Pixi.js's implementation and provide an `Adapter` interface along with default `BrowserAdapter` and `WebWorkerAdapter` for developers to choose from.

```ts
export interface Adapter {
    createCanvas: (
        width?: number,
        height?: number,
    ) => HTMLCanvasElement | OffscreenCanvas;
    getDocument: () => Document;
    getXMLSerializer: () => XMLSerializer | null;
    getDOMParser: () => DOMParser | null;
    setCursor: (canvas: Canvas, cursor: Cursor) => void;
    splitGraphemes: (s: string) => string[];
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
}
```

The system uses `BrowserAdapter` by default. If you need to use other adapters, you can set them using the `DOMAdapter.set()` method.

[WebWorker Example]

```ts
import { DOMAdapter, WebWorkerAdapter } from '@infinite-canvas-tutorial/core';

DOMAdapter.set(WebWorkerAdapter);
```

Although we don't provide a built-in Node.js adapter, you can refer to the [NodeJSAdapter used in SSR unit tests] for implementation:

```ts
import { DOMAdapter } from '@infinite-canvas-tutorial/core';

const NodeJSAdapter: Adapter = {
    createCanvas: (width?: number, height?: number) =>
        getCanvas(width ?? 0, height ?? 0), // Use headless-gl and node-canvas
    getDocument: () => new JSDOM().window._document, // Use JSDOM
    //...
};
DOMAdapter.set(NodeJSAdapter);
```

Let's look at each method provided by the adapter in detail.

## createCanvas

As the name suggests, this method is used to create a `<canvas>`-like element. It's called when measuring text, determining if a point is within a path, and other operations.

```ts
createCanvas: (width?: number, height?: number) =>
    HTMLCanvasElement | OffscreenCanvas;
```

-   In browser environment: uses `document.createElement('canvas')`
-   In WebWorker environment: uses `OffscreenCanvas`
-   In Node.js environment: uses headless-gl and node-canvas

## getDocument

Gets the current `Document` object. Mainly used when exporting SVG with ImageExporter.

```ts
getDocument: () => Document;
```

-   In browser environment: uses `document`
-   In WebWorker environment: not available
-   In Node.js environment: uses `JSDOM`

## getXMLSerializer

Gets the current `XMLSerializer` object. Used when exporting SVG with ImageExporter.

```ts
getXMLSerializer: () => XMLSerializer | null;
```

In WebWorker and Node.js environments, you can use [@xmldom/xmldom]:

```ts
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
```

## getDOMParser

Gets the current `DOMParser` object. Used when parsing bitmap fonts in XML format. [Bitmap Font Example]

```ts
getDOMParser: () => DOMParser | null;
```

## setCursor

Sets the mouse cursor style for the canvas.

```ts
setCursor: (canvas: Canvas, cursor: Cursor) => void;
```

-   In browser environment: uses `$canvas.style.cursor`
-   In WebWorker and Node.js environments: not available

## splitGraphemes

Splits a string into individual characters, supporting compound characters.

```ts
splitGraphemes: (s: string) => string[];
```

-   In browser and WebWorker environments: uses [Intl.Segmenter]
-   In Node.js environment: can use [grapheme-splitter]

```ts
import GraphemeSplitter from 'grapheme-splitter';

splitGraphemes: (s: string) => {
    const splitter = new GraphemeSplitter();
    return splitter.splitGraphemes(s);
},
```

## requestAnimationFrame

Used for camera animations.

-   In browser and WebWorker environments: uses [requestAnimationFrame]
-   In Node.js environment: uses `setTimeout`

## cancelAnimationFrame

Used to cancel camera animations.

-   In browser and WebWorker environments: uses [cancelAnimationFrame]
-   In Node.js environment: uses `clearTimeout`

[WebWorker Example]: /example/webworker
[NodeJSAdapter used in SSR unit tests]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/utils.ts#L93-L105
[requestAnimationFrame]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
[cancelAnimationFrame]: https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame
[@xmldom/xmldom]: https://www.npmjs.com/package/@xmldom/xmldom
[Bitmap Font Example]: /example/bitmap-font
[Intl.Segmenter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
[grapheme-splitter]: https://github.com/orling/grapheme-splitter
