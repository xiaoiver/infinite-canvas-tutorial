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
    createTexImageSource: (
        canvas: HTMLCanvasElement | OffscreenCanvas,
    ) => TexImageSource;
    createImage: (src: string) => Promise<ImageType>;
    getWindow: () => typeof globalThis;
    getDocument: () => Document;
    getXMLSerializer: () => XMLSerializer | null;
    getDOMParser: () => DOMParser | null;
    splitGraphemes: (s: string) => string[];
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
}
```

The system uses `BrowserAdapter` by default. If you need to use other adapters, you can set them using the `DOMAdapter.set()` method.

[WebWorker Example]

```ts
import { DOMAdapter, WebWorkerAdapter } from '@infinite-canvas-tutorial/ecs';

DOMAdapter.set(WebWorkerAdapter);
```

Although we don't provide a built-in Node.js adapter, you can refer to the [NodeJSAdapter used in SSR unit tests] for implementation:

```ts
import { DOMAdapter } from '@infinite-canvas-tutorial/ecs';

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
-   In Node.js environment: uses [headless-gl] and [node-canvas]

## createTexImageSource

When implementing Gradient and Pattern, you need to convert the `<canvas>` into a TexImageSource before calling the WebGL API. In a browser environment, you can return it directly. For details, see: [Lesson 17 - Gradients and patterns]

In a Node.js environment, you can use `pngparse-sync` to convert `Image` objects from `node-canvas` into the image formats required by `headless-gl`:

```ts
import parsePNG from 'pngparse-sync';

export const NodeJSAdapter: Adapter = {
  createTexImageSource: (canvas) => {
    // convert Image in node-canvas to ImageData in headless-gl
    const buffer = canvas.toBuffer();
    const png = parsePNG(buffer);
    return png.data;
  },
```

## createImage

Create an image [ImageBitmap] based on the image `src`, using [loaders.gl] in the browser environment:

```ts
import { load } from '@loaders.gl/core';

export const BrowserAdapter: Adapter = {
    createImage: (src: string) => load(src, ImageLoader),
};
```

In a NodeJS environment, you can use [get-pixels] to load images via URL and pass them into [headless-gl]:

```ts
import getPixels from 'get-pixels';

export const NodeJSAdapter: Adapter = {
    createImage: (src: string) => loadImage(__dirname + '/canvas.png') as any,
};

export function loadImage(path: string) {
    // Load local image instead of fetching remote URL.
    // @see https://github.com/stackgl/headless-gl/pull/53/files#diff-55563b6c0b90b80aed19c83df1c51e80fd45d2fbdad6cc047ee86e98f65da3e9R83
    return new Promise((resolve, reject) => {
        getPixels(path, function (err, image) {
            if (err) {
                reject('Bad image path');
            } else {
                image.width = image.shape[0];
                image.height = image.shape[1];
                resolve(image);
            }
        });
    });
}
```

## getWindow

Returns `window` in the browser environment and `self` in WebWorkers:

```ts
getWindow: () => window,
getWindow: () => self,
```

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
[Lesson 17 - Gradients and patterns]: /guide/lesson-017
[ImageBitmap]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap
[loaders.gl]: https://github.com/visgl/loaders.gl
[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[get-pixels]: https://github.com/scijs/get-pixels
