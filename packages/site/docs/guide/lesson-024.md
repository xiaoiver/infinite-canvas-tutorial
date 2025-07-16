---
outline: deep
description: 'Implementing context menu and clipboard functionality'
---

<script setup>
import ZIndex from '../components/ZIndex.vue';
</script>

# Lesson 24 - Context Menu and Clipboard

In this lesson, we will introduce how to implement context menu and clipboard functionality.

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

Alternatively, we can use this method to determine if the clipboard is empty at the moment, and disable the `Paste` menu item if it is empty.

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

### Images {#image}

Let's look at copying non-vector images first.

Excalidraw doesn't do anything special with SVG type images when pasting them. We can refer to Figma's approach [Convert SVG to frames] to convert SVG elements to canvas graphics and make the elements in them editable.

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

### Plain Text {#plain-text}

## Drag n drop {#drag-n-drop}

In addition to importing by copying, you can also place by drag-n-drop.

## Extended Reading {#extended-reading}

-   [Interact with the clipboard]

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
