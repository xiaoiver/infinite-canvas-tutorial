---
outline: deep
description: '实现上下文菜单和剪贴板'
---

<script setup>
import ZIndex from '../../components/ZIndex.vue';
</script>

# 课程 24 - 上下文菜单和剪贴板

在本节课中我们将介绍如何实现上下文菜单和剪贴板功能。

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

另外我们也可以用这个方法判断此时剪贴板是否为空，如果为空就禁用 `Paste` 菜单项。

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

而第一种需要记录鼠标最近一次的移动位置。

### 图片 {#image}

先来看复制非矢量图片的情况。

在粘贴图片时，Excalidraw 并不会对 SVG 类型的图片进行特殊处理。我们可以参考 Figma 的做法 [Convert SVG to frames]，将 SVG 元素转换成画布图形，并让其中的元素可编辑。

```ts
import { svgElementsToSerializedNodes } from '@infinite-canvas-tutorial/ecs';

if (data.text) {
    const string = data.text.trim();
    if (string.startsWith('<svg') && string.endsWith('</svg>')) {
        // Extract semantic groups inside comments
        const $container = document.createElement('div');
        $container.innerHTML = string;
        const $svg = $container.children[0] as SVGSVGElement;
        const nodes = svgElementsToSerializedNodes(
            Array.from($svg.children) as SVGElement[],
        );

        this.updateAndSelectNodes(nodes);
        return;
    }
}
```

### 纯文本 {#plain-text}

## 拖拽 {#drag-n-drop}

除了通过复制的方式导入，还可以通过拖拽放置。

## 扩展阅读 {#extended-reading}

-   [Interact with the clipboard]

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
