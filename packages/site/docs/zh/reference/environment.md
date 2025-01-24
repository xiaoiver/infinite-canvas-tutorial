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
    getDocument: () => Document;
    getXMLSerializer: () => XMLSerializer | null;
    getDOMParser: () => DOMParser | null;
    setCursor: (canvas: Canvas, cursor: Cursor) => void;
    splitGraphemes: (s: string) => string[];
    requestAnimationFrame: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
}
```

默认使用 `BrowserAdapter`，如果需要使用其他适配器，可以调用 `DOMAdapter.set()` 方法设置。

[WebWorker 示例]

```ts
import { DOMAdapter, WebWorkerAdapter } from '@infinite-canvas-tutorial/core';

DOMAdapter.set(WebWorkerAdapter);
```

我们未提供内置的 Node.js 适配器，但完全可以参考 [SSR 单元测试中使用的 NodeJSAdapter]

```ts
import { DOMAdapter } from '@infinite-canvas-tutorial/core';

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

在浏览器环境中使用 `document.createElement('canvas')` 创建，在 WebWorker 环境中使用 `OffscreenCanvas` 创建，在 Node.js 环境中使用 headless-gl 和 node-canvas 创建。

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

## setCursor

设置画布的鼠标样式。在浏览器环境中使用 `$canvas.style.cursor` 设置，在 WebWorker 和 Node.js 中无法设置。

```ts
setCursor: (canvas: Canvas, cursor: Cursor) => void;
```

## splitGraphemes

将字符串分割成单个字符，考虑复合字符。在浏览器和 WebWorker 中使用 [Intl.Segmenter]，在 Node.js 中可以使用 [grapheme-splitter]。

```ts
splitGraphemes: (s: string) => string[];
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
