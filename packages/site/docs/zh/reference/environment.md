---
outline: deep
publish: false
---

我们希望画布可以在不同的环境中运行，比如浏览器、Node.js、WebWorker 等。不同的环境提供的能力也不同，因此我们参考 Pixi.js 的实现，提供了 `Adapter` 接口以及默认的 `BrowserAdapter` 和 `WebWorkerAdapter`，供使用者选择。

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

默认使用 `BrowserAdapter`，如果需要使用其他适配器，可以调用 `DOMAdapter.set()` 方法设置。

[WebWorker 示例]

```ts
import { DOMAdapter, WebWorkerAdapter } from '@infinite-canvas-tutorial/ecs';

DOMAdapter.set(WebWorkerAdapter);
```

我们未提供内置的 Node.js 适配器，但完全可以参考 [SSR 单元测试中使用的 NodeJSAdapter]

```ts
import { DOMAdapter } from '@infinite-canvas-tutorial/ecs';

const NodeJSAdapter: Adapter = {
    createCanvas: (width?: number, height?: number) =>
        getCanvas(width ?? 0, height ?? 0), // 使用 headless-gl 和 node-canvas
    getDocument: () => new JSDOM().window._document, // 使用 JSDOM
    //...
};
DOMAdapter.set(NodeJSAdapter);
```

下面我们介绍适配器中提供的方法。

## createCanvas

顾名思义，就是用来创建一个类 `<canvas>` 的元素。在度量文本、判断点是否在 Path 内时，都会调用这个方法并获取上下文。

```ts
createCanvas: (width?: number, height?: number) =>
    HTMLCanvasElement | OffscreenCanvas;
```

在浏览器环境中使用 `document.createElement('canvas')` 创建，在 WebWorker 环境中使用 `OffscreenCanvas` 创建，在 Node.js 环境中使用 [headless-gl] 和 [node-canvas] 创建。

## createTexImageSource

在实现 Gradient 和 Pattern 时，需要将 `<canvas>` 转换成 TexImageSource 后调用 WebGL API，在浏览器环境中直接返回即可。详见：[课程 17 - 渐变和重复图案]

在 NodeJS 环境可以使用 [pngparse-sync] 将 [node-canvas] 中的 Image 转换成 [headless-gl] 需要的图片格式：

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

根据图片 `src` 创建图片 [ImageBitmap]，在浏览器环境使用 [loaders.gl]：

```ts
import { load } from '@loaders.gl/core';

export const BrowserAdapter: Adapter = {
    createImage: (src: string) => load(src, ImageLoader),
};
```

在 NodeJS 环境可以使用 [get-pixels] 通过 URL 加载图片，传入 [headless-gl] 中：

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

在浏览器环境返回 `window`，在 WebWorker 中返回 `self`：

```ts
getWindow: () => window,
getWindow: () => self,
```

## getDocument

获取当前的 `Document` 对象。在使用 ImageExporter 导出成 SVG 时会使用到。

```ts
getDocument: () => Document;
```

在浏览器环境中使用 `document`，在 WebWorker 环境中无法使用，在 Node.js 环境中使用 `JSDOM`。

## getXMLSerializer

获取当前的 `XMLSerializer` 对象。在使用 ImageExporter 导出成 SVG 时会使用到。

```ts
getXMLSerializer: () => XMLSerializer | null;
```

在 WebWorker 和 Node.js 中可以使用 [@xmldom/xmldom]

```ts
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
```

## getDOMParser

获取当前的 `DOMParser` 对象。在解析 XML 格式的 Bitmap Font 时会使用到。[Bitmap Font 示例]

```ts
getDOMParser: () => DOMParser | null;
```

## splitGraphemes

将字符串分割成单个字符，考虑复合字符。在浏览器和 WebWorker 中使用 [Intl.Segmenter]

```ts
splitGraphemes: (s: string) => string[];
```

在 Node.js 中可以使用 [grapheme-splitter]。

```ts
import GraphemeSplitter from 'grapheme-splitter';

splitGraphemes: (s: string) => {
    const splitter = new GraphemeSplitter();
    return splitter.splitGraphemes(s);
},
```

## requestAnimationFrame

执行相机动画时会使用到。在浏览器环境和 WebWorker 中使用 [requestAnimationFrame]，在 Node.js 环境中使用 `setTimeout`。

## cancelAnimationFrame

取消相机动画时会使用到。在浏览器环境和 WebWorker 中使用 [cancelAnimationFrame]，在 Node.js 环境中使用 `clearTimeout`。

[WebWorker 示例]: /zh/example/webworker
[SSR 单元测试中使用的 NodeJSAdapter]: https://github.com/xiaoiver/infinite-canvas-tutorial/blob/master/__tests__/utils.ts#L93-L105
[requestAnimationFrame]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
[cancelAnimationFrame]: https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame
[@xmldom/xmldom]: https://www.npmjs.com/package/@xmldom/xmldom
[Bitmap Font 示例]: /zh/example/bitmap-font
[Intl.Segmenter]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
[grapheme-splitter]: https://github.com/orling/grapheme-splitter
[课程 17 - 渐变和重复图案]: /zh/guide/lesson-017
[ImageBitmap]: https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap
[loaders.gl]: https://github.com/visgl/loaders.gl
[node-canvas]: https://github.com/Automattic/node-canvas
[headless-gl]: https://github.com/stackgl/headless-gl
[pngparse-sync]: https://github.com/mikolalysenko/pngparse-sync
[get-pixels]: https://github.com/scijs/get-pixels
