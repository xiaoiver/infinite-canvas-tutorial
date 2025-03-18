# @infinite-canvas-tutorial/webcomponents

Developing Web UI with [Lit] and [Shoelace], maybe switch to [Web Awesome] in the future.

For more information, please refer to: [Lesson 7 - Web UI].

## Getting Started

Using web components in HTML:

```html
<ic-canvas zoom="1" renderer="webgpu"></ic-canvas>
```

Listening to [Events](#events) in JS:

```ts
import { Event, PreStartUp } from '@infinite-canvas-tutorial/webcomponents';

// Get container element.
const canvas = document.querySelector('ic-canvas');

// Waiting for the canvas to be ready...
canvas.addEventListener(Event.READY, (e) => {
    // Get app.
    const app = e.detail;

    // Append our initial system to app.
    app.addSystems(PreStartUp, StartUpSystem);
});
```

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

## How to write a custom system

```ts
import { System, Commands } from '@infinite-canvas-tutorial/ecs';

class StartUpSystem extends System {
    private readonly commands = new Commands(this);
}
```

[Lit]: https://lit.dev/
[Shoelace]: https://shoelace.style/
[Web Awesome]: https://www.kickstarter.com/projects/fontawesome/web-awesome
[Lesson 7 - Web UI]: https://infinitecanvas.cc/guide/lesson-007
