# @infinite-canvas-tutorial/webcomponents

Developing Web UIs with [Lit] and [Spectrum].

For more information, please refer to: [Lesson 7 - Web UI] which used [Shoelace] at that time.

## Getting Started

For now we provide these web components implementations based on [Spectrum]:

```js
import '@infinite-canvas-tutorial/webcomponents/spectrum';
```

Using web components in HTML:

```html
<ic-spectrum-canvas></ic-spectrum-canvas>
```

### Use API (a more recommended way)

Listening to [Events](#events) in JS:

```ts
import { Event } from '@infinite-canvas-tutorial/webcomponents';

// Get container element.
const canvas = document.querySelector<HTMLElement>('ic-spectrum-canvas')!;

// Waiting for the canvas to be ready...
canvas.addEventListener(Event.READY, (e) => {
    // Get API.
    const api = e.detail;

    // Append initial nodes to canvas.
    api.updateNodes(nodes);

    // Set cursor style.
    api.setCursor('grabbing');
});
```

For more information, please refer to [API](#api) section.

### Use ECS

Please refer to [@infinite-canvas-tutorial/ecs].

## API

Just like [Figma API] and [Excalidraw API], we provide ours which is also friendly to MCP. [MCP: What It Is and Why It Matters]:

> Instead of only having a GUI or API that humans use, you get an AI interface “for free.” This idea has led to the concept of “MCP-first development”, where you build the MCP server for your app before or alongside the GUI.

### get/setAppState

```ts
api.getAppState();
api.setAppState({
    penbarSelected: Pen.HAND,
});
```

#### penbarVisible

#### penbarAll

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    DRAW_RECT = 'draw-rect',
    DRAW_ELLIPSE = 'draw-ellipse',
    DRAW_LINE = 'draw-line',
    DRAW_ROUGH_RECT = 'draw-rough-rect',
    IMAGE = 'image',
    TEXT = 'text',
    PENCIL = 'pencil',
    BRUSH = 'brush',
    VECTOR_NETWORK = 'vector-network',
}
```

#### penbarSelected

#### checkboardStyle

Set the checkboard style of grid, refer to [Lesson 5 - Grid].

```ts
api.setAppState({
    checkboardStyle: CheckboardStyle.GRID,
});
```

Valid values to take include:

```ts
enum CheckboardStyle {
    NONE = 'none',
    GRID = 'grid',
    DOTS = 'dots',
}
```

#### contextMenuVisible

#### contextBarVisible

#### topbarVisible

#### taskbarVisible

#### taskbarAll

#### taskbarSelected

### setCursor

Set current cursor style, the valid values are detailed: [cursor].

```ts
setCursor(cursor: string): void;
```

### updateNodes

```ts
updateNodes(nodes: SerializedNode[]): void;
```

### undo

### redo

### isUndoStackEmpty

### isRedoStackEmpty

### destroy

Delete canvas entity.

## Events

```ts
canvas.addEventListener(Event.READY, (e) => {
    // Get API.
    const api = e.detail;
});
```

-   READY
-   RESIZED
-   ZOOM_CHANGED
-   SCREENSHOT_REQUESTED
-   SCREENSHOT_DOWNLOADED

## Built-in plugin and systems

-   UI plugin
    -   InitCanvas System
    -   ZoomLevel System
    -   DownloadScreenshot System

## FAQ

### Registry conflicts

```plaintext
Failed to execute 'define' on 'CustomElementRegistry':
the name "sp-overlay" has already been used with this registry
```

<https://opensource.adobe.com/spectrum-web-components/registry-conflicts/>

[Lit]: https://lit.dev/
[Shoelace]: https://shoelace.style/
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Lesson 5 - Grid]: https://infinitecanvas.cc/guide/lesson-005
[Lesson 7 - Web UI]: https://infinitecanvas.cc/guide/lesson-007
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma API]: https://www.figma.com/developers/api
[Excalidraw API]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api
[cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
