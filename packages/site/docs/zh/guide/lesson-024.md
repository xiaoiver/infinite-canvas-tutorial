---
outline: deep
description: '实现上下文菜单和剪贴板，通过上移下移调整图形次序，支持写入并读取剪贴板内容，支持粘贴序列化图形、非矢量图片、SVG 和纯文本，从文件系统和页面中拖拽导入图片文件'
head:
    - [
          'meta',
          { property: 'og:title', content: '课程 24 - 上下文菜单和剪贴板' },
      ]
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
import DragNDropImage from '../../components/DragNDropImage.vue';
</script>

# 课程 24 - 上下文菜单和剪贴板

在本节课中我们将介绍：

-   如何使用 Spectrum 实现上下文菜单
-   通过上移下移调整图形次序
-   写入并读取剪贴板内容，支持粘贴序列化图形、非矢量图片、SVG 和纯文本
-   从文件系统和页面中拖拽导入图片文件

<img src="/context-menu.png" alt="context menu" style="max-width: 300px;"/>

## 实现上下文菜单 {#context-menu}

上下文菜单通常由右键或者长按交互触发。浏览器默认实现了菜单内容，例如在 `<canvas>` 上触发会展示 “Save as” 等等。
因此第一步我们要监听 [contextmenu] 事件并阻止浏览器默认行为，参考：[radix - Context Menu]。

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...展示 Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

接下来我们需要在指定位置展示菜单 UI 组件。[课程 18 - 基于 Spectrum 实现 UI]，我们使用 Overlay 的命令式 API，配合 [Using a virtual trigger]：

```ts
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';

private handleContextMenu = async (event: MouseEvent) => {
    // ...阻止浏览器默认行为

    // 在当前位置触发
    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(event.clientX, event.clientY);

    // 渲染 Lit 模版
    const fragment = document.createDocumentFragment();
    render(this.contextMenuTemplate(), fragment);

    // 展示 Overlay
    const popover = fragment.querySelector('sp-popover') as HTMLElement;
    const overlay = await openOverlay(popover, {
        trigger: virtualTrigger,
        placement: 'right-start',
        offset: 0,
        notImmediatelyClosable: true,
        type: 'auto',
    });
    trigger.insertAdjacentElement('afterend', overlay);
    this.renderRoot.appendChild(overlay);
}
```

在下面的例子中，在选中图形上唤起上下文菜单后可以调整 `z-index`。或者使用快捷键，在 Figma 中是 <kbd>[</kbd> 和 <kbd>]</kbd>。这里我参考了 Photoshop Web，使用 <kbd>⌘[</kbd> 和 <kbd>⌘]</kbd>。

<ZIndex />

## 写入剪贴板 {#clipboard-write-text}

我们的目标是向剪贴板中写入序列化后的图形列表。用户可以通过两种方式触发这一行为：通过 [copy] 事件触发（例如 <kbd>Ctrl+C</kbd>）；通过上下文菜单触发。我们先来看第一种情况，监听 [copy] 事件，这里的 [passive] 可以告知浏览器我们在事件处理中有可能调用 `preventDefault`：

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

此时需要通过 `activeElement` 确保画布处于当前激活态，然后禁用浏览器默认行为并阻止事件冒泡：

```ts
private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
        document.activeElement !== this.api.element ||
        layersSelected.length === 0
    ) {
        return;
    }

    this.executeCopy(event); // 传递 ClipboardEvent

    event.preventDefault();
    event.stopPropagation();
};
```

在通过上下文菜单触发的场景下，并不存在 [ClipboardEvent]。参考 [excalidraw clipboard] 和 [actionClipboard] 的实现从新到旧依次尝试浏览器的 API：

```ts
export async function copyTextToClipboard(
    text: string,
    clipboardEvent?: ClipboardEvent,
) {
    // 1.
    await navigator.clipboard.writeText(text);
    // 2.
    if (clipboardEvent) {
        clipboardEvent.clipboardData?.setData(MIME_TYPES.text, text);
    }
    // 3.
    document.execCommand('copy');
}
```

## 读取剪贴板 {#clipboard-read}

读取剪贴板的实现决定了我们支持哪些常见类型的文件，从 MIME 类型上包括：图片、文本。而文本又可能包含序列化图形、SVG、URL、甚至是 mermaid 语法等等。我们先从最简单的情况开始，接收上一节中序列化后的图形列表文本。

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

和写入剪贴板一样，先尝试 [read] 方法，该方法仅在 HTTPS 下生效，理论上支持所有类型数据，不局限于纯文本，几乎所有现代浏览器都支持了该方法，只是在数据类型上有所限制，通常包括文本、HTML 和图片。如果不支持该方法就降级到 [readText]

```ts
export const readSystemClipboard = async () => {
    const types: { [key in AllowedPasteMimeTypes]?: string | File } = {};
    // 1.
    const clipboardItems = await navigator.clipboard?.read();
    // 2.
    const readText = await navigator.clipboard?.readText();
    if (readText) {
        return { [MIME_TYPES.text]: readText };
    }
};
```

另外我们也可以用这个方法判断此时剪贴板是否为空，如果为空就禁用 `Paste` 菜单项。最后需要注意的是读取剪贴板方法需要聚焦在文档上，如果触发时焦点在浏览器地址栏、开发者工具时，就会报以下错误。因此可以使用 `document.hasFocus()` 判断成功后再读取：

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### 反序列化图形 {#deserialize}

反序列化后，我们只需要重新生成 `id`：

```ts
if (data.elements) {
    const nodes = data.elements.map((node) => {
        node.id = uuidv4();
        return node;
    });

    this.api.runAtNextTick(() => {
        this.api.updateNodes(nodes);
        this.api.record();
    });
}
```

但这样复制后的图形会重叠在一起，我们可以采用以下两种策略：

1. 跟随鼠标位置创建
2. 在原有图形位置上增加一个偏移量

第二种比较简单：

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

而第一种需要记录上下文菜单触发时或鼠标最近一次的移动位置：

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

我们已经介绍过：[课程 6 - 坐标系转换]，将 Client 坐标转换到 Canvas 坐标系下：

```ts
if (position) {
    const { x, y } = api.viewport2Canvas(api.client2Viewport(position)); // [!code ++]
    node.x = x; // [!code ++]
    node.y = y; // [!code ++]
} else {
    node.x += 10;
    node.y += 10;
}
```

### 非矢量图片 {#non-vector-image}

先来看复制非矢量图片的情况。之前我们介绍过：[课程 10 - 在画布中渲染图片]，使用 `@loaders.gl` 可以加载剪贴板中的图片文件，然后得到原始宽高和 `dataURL`，经过一系列调整计算得到最终的宽高，最后创建一个矩形将其 `fill` 设置为 `dataURL`：

```ts
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

async function createImage(api: ExtendedAPI, appState: AppState, file: File) {
    const [image, dataURL] = await Promise.all([
        load(file, ImageLoader),
        getDataURL(file),
    ]);

    // 省略计算宽高

    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'rect',
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            width,
            height,
            fill: dataURL,
        },
    ]);
}
```

为什么不能直接使用原始图片的宽高呢？创建的矩形宽高是在世界坐标系下的，它应该受画布尺寸、当前相机缩放等级和原始图片尺寸影响。Excalidraw 使用了一种启发式的算法：

```ts
// Heuristic to calculate the size of the image.
// @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L10059
const minHeight = Math.max(canvas.height - 120, 160);
// max 65% of canvas height, clamped to <300px, vh - 120px>
const maxHeight = Math.min(
    minHeight,
    Math.floor(canvas.height * 0.5) / canvas.zoom,
);
const height = Math.min(image.height, maxHeight);
const width = height * (image.width / image.height);
```

### SVG {#svg}

在粘贴图片时，Excalidraw 并不会对 SVG 类型的图片进行特殊处理，这导致丧失了继续编辑其内部元素的可能。

Figma 可以将 SVG 元素转换成画布图形，并让其中的元素可编辑，详见：[Convert SVG to frames]。在 [课程 10 - 从 SVGElement 到序列化节点] 中我们介绍过这一方法，在此之前需要使用 `DOMParser` 将字符串转换成 SVGElement：

```ts
import {
    DOMAdapter,
    svgElementsToSerializedNodes,
} from '@infinite-canvas-tutorial/ecs';

if (data.text) {
    const string = data.text.trim();
    if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        const doc = DOMAdapter.get()
            .getDOMParser()
            .parseFromString(string, 'image/svg+xml');
        const $svg = doc.documentElement;
        const nodes = svgElementsToSerializedNodes(
            Array.from($svg.children) as SVGElement[],
        );

        this.updateAndSelectNodes(nodes);
        return;
    }
}
```

当然你也可以使用 `innerHTML` 的方式，但不推荐用于复杂 SVG（可能会失去命名空间）：

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

### 纯文本 {#plain-text}

最后一种情况也是最简单的，如果此时剪贴板中的内容是纯文本，我们就创建对应的 `text`。值得一提的是在 Excalidraw 中会使用当前用户设置的字体、颜色等属性：

```ts
function createText(
    api: ExtendedAPI,
    appState: AppState,
    text: string,
    position?: { x: number; y: number },
) {
    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'text',
            anchorX: position?.x ?? 0,
            anchorY: position?.y ?? 0,
            content: text,
            fontSize: 16,
            fontFamily: 'system-ui',
            fill: 'black',
        },
    ]);
}
```

## 拖拽导入图片 {#drag-n-drop}

很多文件上传组件都支持从文件管理器等位置拖拽文件到指定区域完成上传，例如 [react-dropzone]。Excalidraw 也支持 [handleAppOnDrop]，可以很方便地将图片、导出产物、甚至是视频拖入画布中完成导入：

```tsx
<div onDrop={this.handleAppOnDrop} />
```

为了让 `drop` 事件能在 `<canvas>` 上正常触发，我们还需要监听 `dragover` 并禁止浏览器默认行为，详见：[HTML5/Canvas onDrop event isn't firing?] 和 [Prevent the browser's default drag behavior]

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

然后我们就可以从 [files] 尝试读取从文件系统拖拽来的文件了：

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

另外我们也可以支持从页面中拖拽而来的文本和图片，文本可以直接从 `dataTransfer` 中读取。而对于图片，参考 [Dragging Images]，推荐将图片 URL 写入 `dataTransfer` 中。在下面的例子里我们在图片的 `dragstart` 中完成这一步：

```ts
const text = event.dataTransfer.getData('text/plain');
if (text) {
    createText(this.api, this.appState, text, canvasPosition);
}

img.addEventListener('dragstart', (ev) => {
    const dt = ev.dataTransfer;
    dt?.setData('text/uri-list', img.src);
    dt?.setData('text/plain', img.src);
});
```

可以在下面的例子中将页面中的文字或者右侧的图片直接拖拽进画布：

<DragNDropImage />

## 从文件系统上传 {#upload-from-filesystem}

当然还有最传统的从文件系统上传方式：前端最熟悉的 `<input type="file">`。这里我们参考 Excalidraw 的 [filesystem] 实现，使用 [browser-fs-access] 尝试使用更命令式的 [File System API]，如果浏览器不支持会自动降级。

```ts
if (pen === Pen.IMAGE) {
    try {
        const file = await fileOpen({
            extensions: ['jpg', 'png', 'svg'],
            description: 'Image to upload',
        });
        if (file) {
            createImage(this.api, this.appState, file);
            this.api.setAppState({ penbarSelected: Pen.SELECT });
            this.api.record();
        }
    } catch (e) {
        // 用户取消上传，退回选择模式
        this.api.setAppState({ penbarSelected: Pen.SELECT });
    }
}
```

可以点击左侧工具栏中的 “图片” 按钮体验这一功能。

## 导出选中图形 {#export-selected-shapes}

除了 [课程 10 - 将画布内容导出成图片]，更常用的导出功能是针对选中图形进行。我们继续使用 [File System API]，将选中图形导出成 SVG 和 PNG 格式的图片，并保存到本地。

### 导出 SVG {#export-selected-shapes-to-svg}

和导出整个画布不同，我们需要计算选中图形的包围盒，通过 `viewBox` 将 SVG 的 viewport 调整到合适的大小，确保选中的图形都被默认包含在视口内。

```ts
import { serializeNodesToSVGElements } from '@infinite-canvas-tutorial/ecs';
import { fileSave } from './filesystem';

// 1. Calculate bounds of SVG
const bounds = api.getBounds(nodes);
const width = bounds.maxX - bounds.minX;
const height = bounds.maxY - bounds.minY;
const $svg = createSVGElement('svg');
$svg.setAttribute('width', `${width}`);
$svg.setAttribute('height', `${height}`);
$svg.setAttribute(
    'viewBox',
    `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${
        height + padding * 2 // add padding with viewBox
    }`,
);

// 2. SerializedNodes -> SVGElement[]
serializeNodesToSVGElements(nodes).forEach((element) => {
    $svg.appendChild(element);
});

// 3. Create blob and save to filesystem
fileSave(
    new Blob([toSVG($svg)], {
        type: MIME_TYPES.svg,
    }),
);
```

### 导出 PNG {#export-selected-shapes-to-png}

导出非矢量图我们仍使用 [HTMLCanvasElement.toDataURL()]，但需要绘制在临时的 `<canvas>` 中。

### 内嵌场景信息 {#embed-scene-metadata}

除了图形信息，还可以将场景信息也嵌入到导出产物中，下图来自 Excalidraw

![Export image in excalidraw](/export-image-in-excalidraw.png)

```ts
// https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/index.ts#L176-L178
encodePngMetadata({
    blob,
    metadata: serializeAsJSON(elements, appState, files, 'local'),
});
```

## 扩展阅读 {#extended-reading}

-   [Interact with the clipboard]
-   [Prevent the browser's default drag behavior]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - Context Menu]: https://www.radix-ui.com/primitives/docs/components/context-menu
[课程 18 - 基于 Spectrum 实现 UI]: /zh/guide/lesson-018
[Using a virtual trigger]: https://opensource.adobe.com/spectrum-web-components/components/imperative-api/#using-a-virtual-trigger
[copy]: https://developer.mozilla.org/en-US/docs/Web/API/Element/copy_event
[Interact with the clipboard]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard
[excalidraw clipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts
[actionClipboard]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionClipboard.tsx#L62
[ClipboardEvent]: https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent
[passive]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive
[read]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read
[readText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText
[Convert SVG to frames]: https://forum.figma.com/ask-the-community-7/convert-svg-to-frames-18578
[课程 6 - 坐标系转换]: /zh/guide/lesson-006#coordinates
[课程 10 - 在画布中渲染图片]: /zh/guide/lesson-010#render-image
[课程 10 - 从 SVGElement 到序列化节点]: /zh/guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[HTML5/Canvas onDrop event isn't firing?]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[Dragging Images]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[Prevent the browser's default drag behavior]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
[课程 10 - 将画布内容导出成图片]: /zh/guide/lesson-010#export-canvas-to-image
[HTMLCanvasElement.toDataURL()]: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toDataURL
