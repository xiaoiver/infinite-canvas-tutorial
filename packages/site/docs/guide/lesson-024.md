---
outline: deep
description: 'Implementing context menu and clipboard functionality. Adjust z-index with bring forward and send back.  Writes and reads clipboard content, supports pasting serialized graphics, non-vector images, SVG and plain text. Drag-and-drop import of image files from file systems and pages.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lesson 24 - Context menu and clipboard',
          },
      ]
---

<script setup>
import ZIndex from '../components/ZIndex.vue';
import DragNDropImage from '../components/DragNDropImage.vue';
</script>

# Lesson 24 - Context menu and clipboard

In this lesson, we will introduce the following contents:

-   How to implement context menu
-   Adjust z-index with bring forward and send back
-   Writes and reads clipboard content, supports pasting serialized graphics, non-vector images, SVG and plain text
-   Drag-and-drop import of image files from file systems and pages

<img src="/context-menu.png" alt="context menu" style="max-width: 300px;"/>

## Implementing Context Menu {#context-menu}

Context menus are typically triggered by right-click or long-press interactions. Browsers implement default menu content by default, for example, triggering on `<canvas>` will show "Save as" and other options.
Therefore, the first step is to listen for the [contextmenu] event and prevent the browser's default behavior, reference: [radix - Context Menu].

```ts
private handleContextMenu = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // ...show Overlay
};

this.api.element.addEventListener('contextmenu', this.handleContextMenu);
```

Next, we need to display the menu UI component at the specified position. In [Lesson 18 - Implementing UI with Spectrum], we use the imperative API of Overlay, combined with [Using a virtual trigger]:

```ts
import { html, render } from '@spectrum-web-components/base';
import { VirtualTrigger, openOverlay } from '@spectrum-web-components/overlay';

private handleContextMenu = async (event: MouseEvent) => {
    // ...prevent browser default behavior

    // Trigger at current position
    const trigger = event.target as LitElement;
    const virtualTrigger = new VirtualTrigger(event.clientX, event.clientY);

    // Render Lit template
    const fragment = document.createDocumentFragment();
    render(this.contextMenuTemplate(), fragment);

    // Show Overlay
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

In the example below, after invoking the context menu on a selected shape, you can adjust the `z-index`. Alternatively, you can use keyboard shortcuts. In Figma, these are <kbd>[</kbd> and <kbd>]</kbd>. Here, I've referenced Photoshop Web and used <kbd>⌘[</kbd> and <kbd>⌘]</kbd>.

<ZIndex />

## Writing to Clipboard {#clipboard-write-text}

Our goal is to write a serialized list of shapes to the clipboard. Users can trigger this behavior in two ways: through the [copy] event (such as <kbd>Ctrl+C</kbd>); through the context menu. Let's first look at the first case, listening for the [copy] event. The [passive] option here can inform the browser that we might call `preventDefault` in the event handler:

```ts
document.addEventListener('copy', this.handleCopy, { passive: false });
```

At this point, we need to ensure the canvas is in the currently active state through `activeElement`, then disable the browser's default behavior and prevent event bubbling:

```ts
private handleCopy = (event: ClipboardEvent) => {
    const { layersSelected } = this.appState;
    if (
        document.activeElement !== this.api.element ||
        layersSelected.length === 0
    ) {
        return;
    }

    this.executeCopy(event); // Pass ClipboardEvent

    event.preventDefault();
    event.stopPropagation();
};
```

In scenarios triggered through the context menu, there is no [ClipboardEvent]. Referencing the implementation of [excalidraw clipboard] and [actionClipboard], try browser APIs from newest to oldest:

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

## Reading from Clipboard {#clipboard-read}

The implementation of reading from the clipboard determines which common file types we support. From MIME types, this includes: images and text. Text can contain serialized shapes, SVG, URLs, or even mermaid syntax, among others. We'll start with the simplest case, accepting serialized shape list text from the previous section.

```ts
document.addEventListener('paste', this.handlePaste, { passive: false });
```

Like writing to the clipboard, first try the [read] method, which only works under HTTPS and theoretically supports all types of data, not limited to plain text. Almost all modern browsers support this method, though they have limitations on data types, typically including text, HTML, and images. If this method is not supported, fall back to [readText]

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

Alternatively, we can use this method to determine if the clipboard is empty at the moment, and disable the `Paste` menu item if it is empty. The last thing to note is that the read clipboard method needs to be focused on the document, if the focus is on the browser address bar or developer tools when triggered, the following error will be reported. So you can use `document.hasFocus()` to determine the success before reading:

> [!CAUTION]
> Uncaught (in promise) NotAllowedError: Failed to execute 'read' on 'Clipboard': Document is not focused

### Deserializing Shapes {#deserialize}

After deserialization, we only need to regenerate the `id`:

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

However, the copied shapes will overlap this way. We can adopt the following two strategies:

1. Create following the mouse position, which requires recording the mouse's most recent movement position
2. Add an offset to the original shape position

The second is simpler:

```ts
const nodes = data.elements.map((node) => {
    node.id = uuidv4();
    node.x += 10; // [!code ++]
    node.y += 10; // [!code ++]
    return node;
});
```

And the first one needs to record the position of the context menu when it is triggered or the most recent mouse movement:

```ts
private handleContextMenu = async (event: MouseEvent) => {
    this.lastContextMenuPosition = { x: event.clientX, y: event.clientY }; // [!code ++]
}
private handlePointerMove = (event: PointerEvent) => {
    this.lastPointerMovePosition = { x: event.clientX, y: event.clientY }; // [!code ++]
};
```

We've already covered [Lesson 6 - Coordinates], converting Client coordinates to the Canvas coordinate system:

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

### Non-vector image {#non-vector-image}

Let's look at copying non-vector images first. As we've seen before in [Lesson 10 - Render image], using `@loaders.gl` you can load an image file from the clipboard, then get the original width and height and `dataURL`, then go through a series of adjustments to get the final width and height, and then finally create a rectangle and set its `fill` to the `dataURL`:

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

Why can't we just use the width and height of the original image? The width and height of the created rectangle is in the world coordinate system and it should be affected by the canvas size, the current camera zoom level and the original image size.Excalidraw uses a heuristic algorithm:

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

When pasting images, Excalidraw does not perform special processing on SVG-type images, which results in the loss of the possibility to continue editing their internal elements.

Figma can convert SVG elements to canvas graphics and make the elements editable, see [Convert SVG to frames]. We covered this in [Lesson 10 - SVGElement to Serialized Node], but before that you need to use `DOMParser` to convert a string to an SVGElement:

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

Of course you can also use the `innerHTML` approach, but it's not recommended for complex SVGs (you may lose namespace):

```ts
const container = document.createElement('div');
container.innerHTML = svgString.trim();
const svgElement = container.firstChild;
```

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

## Drag and drop to import images {#drag-n-drop}

Many file upload components support dragging and dropping files from a file manager or other location to a specified zone to complete the upload, such as [react-dropzone]. Excalidraw also supports [handleAppOnDrop], which makes it very easy to drag and drop images, export products, and even videos into the canvas to complete the import:

```tsx
<div onDrop={this.handleAppOnDrop} />
```

In order for the `drop` event to fire properly on `<canvas>`, we also need to listen for `dragover` and disable the browser's default behavior, see: [HTML5/Canvas onDrop event isn't firing?] and [Prevent the browser's default drag behavior].

```ts
this.api.element.addEventListener('dragover', this.handleDragOver);
this.api.element.addEventListener('drop', this.handleDrop);
```

Then we can try to read the files dragged from the file system from [files]:

```ts
private handleDrop = async (event: DragEvent) => {
    for (const file of Array.from(event.dataTransfer.files)) {}
}
```

We can also support text and images dragged from the page, the text can be read directly from the `dataTransfer`. For images, refer to [Dragging Images], it is recommended to write the image URL into `dataTransfer`. In the following example we do this in the `dragstart` of the image:

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

In the following example, you can drag and drop the image on the right side or the text in this page into the canvas directly.

<DragNDropImage />

## Uploading from the file system {#upload-from-filesystem}

Of course, there's also the most traditional way to upload from the filesystem: the `<input type="file">` that front-ends are most familiar with. Here we take a page from Excalidraw's [filesystem] implementation and use [browser-fs-access] to try to use the more imperative [File System API], which is automatically downgraded if the browser doesn't support it.

```ts
if (pen === Pen.IMAGE) {
    try {
        const file = await fileOpen({
            extensions: ['jpg', 'png', 'svg'],
            description: 'Image to upload',
        });
        if (file) {
            createImage(this.api, this.appState, file);
            this.api.setPen(Pen.SELECT);
            this.api.record();
        }
    } catch (e) {
        // User cancels upload and returns to selection mode
        this.api.setPen(Pen.SELECT);
    }
}
```

You can experience this feature by clicking the “Image” button in the left toolbar.

## Extended Reading {#extended-reading}

-   [Interact with the clipboard]
-   [Prevent the browser's default drag behavior]

[contextmenu]: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
[radix - Context Menu]: https://www.radix-ui.com/primitives/docs/components/context-menu
[Lesson 18 - Implementing UI with Spectrum]: /guide/lesson-018
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
[Lesson 6 - Coordinates]: /guide/lesson-006#coordinates
[Lesson 10 - Render image]: /guide/lesson-010#render-image
[Lesson 10 - SVGElement to Serialized Node]: /guide/lesson-010#svgelement-to-serialized-node
[react-dropzone]: https://github.com/react-dropzone/react-dropzone
[handleAppOnDrop]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L1560C9-L1560C38
[HTML5/Canvas onDrop event isn't firing?]: https://stackoverflow.com/questions/7699987/html5-canvas-ondrop-event-isnt-firing
[files]: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
[Dragging Images]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#dragging_images
[Prevent the browser's default drag behavior]: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop#prevent_the_browsers_default_drag_behavior
[filesystem]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
[browser-fs-access]: https://www.npmjs.com/package/browser-fs-access
[File System API]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
