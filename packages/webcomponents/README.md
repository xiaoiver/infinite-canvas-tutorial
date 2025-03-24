# @infinite-canvas-tutorial/webcomponents

Developing Web UI with [Lit], [Shoelace] and [Spectrum], maybe use [Web Awesome] in the future.

For more information, please refer to: [Lesson 7 - Web UI].

## Getting Started

For now we provide these web components implementations:

-   Spectrum
-   Shoelace

Take Spectrum as example:

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

### Use ECS

Please refer to [@infinite-canvas-tutorial/ecs].

## API

### setCursor

```ts
setCursor(cursor: string): void;
```

### updateNodes

```ts
updateNodes(nodes: SerializedNode[]): void;
```

### destroy

Delete canvas entity.

## Events

-   READY
-   RESIZED
-   ZOOM_IN
-   ZOOM_OUT
-   ZOOM_CHANGED
-   SCREENSHOT_REQUESTED
-   SCREENSHOT_DOWNLOADED
-   PEN_CHANGED

## Built-in plugin and systems

-   UI plugin
    -   ZoomLevel System
    -   DownloadScreenshot System

[Lit]: https://lit.dev/
[Shoelace]: https://shoelace.style/
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Lesson 7 - Web UI]: https://infinitecanvas.cc/guide/lesson-007
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
