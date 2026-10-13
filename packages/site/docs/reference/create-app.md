---
outline: deep
---
First, create a global App with the default plugin set. For more details, see: [Lesson 18 - Refactor with ECS]

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';

const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
app.run();
```

Then you can create one or more canvases. Here we use UI components implemented based on WebComponents.

React projects can use the [React bindings](/reference/react) to manage the runtime, canvas lifecycle, and events.

## Using WebComponents {#use-webcomponents}

First, import the component library:

```ts
import '@infinite-canvas-tutorial/webcomponents';
```

Declare the component in HTML:

```html
<ic-spectrum-canvas
    id="canvas"
    style="width: 100%; height: 100%;"
    app-state='{"topbarVisible":true, "cameraZoom": 1}'
    renderer="webgl"
></ic-spectrum-canvas>
```

The following parameters can be passed via HTML attributes:

-   `renderer` Renderer. Options are `'webgl' | 'webgpu'`, default is `'webgl'`
-   `shader-compiler-path` Used to transpile GLSL to WGSL. For more details, see [Lesson 1 - Hardware abstraction layers]. Default value is `'https://unpkg.com/@antv/g-device-api@1.6.13/dist/pkg/glsl_wgsl_compiler_bg.wasm'`
-   `theme` Theme. Options are `'dark' | 'light'`, default is `'light'`
-   `app-state` Application state in JSON string format, which can control initialization parameters such as camera
-   `nodes` List of shapes in JSON string format

### Bundling the WebGPU shader compiler {#shader-compiler}

For ECS projects using Vite, prefer the WASM exported by `@infinite-canvas-tutorial/device-api` so the compiler stays with its JavaScript bindings. The `?url` import lets Vite serve the file with your application instead of fetching it from UNPKG at runtime. Set the attribute before connecting the canvas:

```ts
import compilerUrl from '@infinite-canvas-tutorial/device-api/shader-compiler.wasm?url';

const canvas = document.createElement('ic-spectrum-canvas');
canvas.style.height = '400px';
canvas.setAttribute('renderer', 'webgpu');
canvas.setAttribute('shader-compiler-path', compilerUrl);
document.body.append(canvas);
```

The default CDN URL remains explicitly pinned to `1.6.13`. Its WASM is byte-for-byte identical to the previous `1.6.8` artifact and the bundled file checked on October 13, 2026; changing this URL does not upgrade the compiler. See the [security note in Lesson 1](/guide/lesson-001) before installing the upstream npm package.

## Getting the API {#use-api}

By listening to the canvas initialization event `Event.READY`, you can get the API instance from the event object, and then call the various methods mentioned above:

```ts
import { Event } from '@infinite-canvas-tutorial/webcomponents';

const canvas = document.querySelector<HTMLElement>('#canvas')!;
canvas.addEventListener(Event.READY, async (e) => {
    const api = e.detail;
});
```

## Canvas events {#canvas-events}

The following are custom events triggered on canvas DOM nodes, which can be accessed via the event object `e.detail`.

### Event.READY

Triggered when the canvas initialization is complete. `ExtendedAPI` can be obtained.

### Event.RESIZED

Triggered when the canvas resizes. You can retrieve the current canvas dimensions: `{ width: number; height: number }`

### Event.CAMERA_ZOOM_CHANGED

Triggered when the canvas camera's zoom level changes. The current zoom level can be retrieved: `{ zoom: number }`

### Event.SCREENSHOT_DOWNLOADED

Triggered when the image export request completes. You can retrieve the export result: `{ dataURL: string; svg: string }`

### Event.NODES_UPDATED

### Event.NODE_DELETED

### Event.SELECTED_NODES_CHANGED

### Event.TRANSFORMABLE_STATUS_CHANGED

### Event.COMMENT_ADDED

Let's see how it's implemented internally.

## Internal Implementation {#implementation}

In the InitCanvas System, we use Lit's context functionality:

```ts
const stateManagement = new LitStateManagement(appStateProvider, nodesProvider);
const api = new ExtendedAPI(stateManagement, this.commands, container);
```

[Lesson 18 - Refactor with ECS]: /guide/lesson-018
[Lesson 1 - Hardware abstraction layers]: /guide/lesson-001#hardware-abstraction-layers
