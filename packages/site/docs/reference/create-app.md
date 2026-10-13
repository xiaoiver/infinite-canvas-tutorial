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

## ECS capacity {#ecs-capacity}

An App's ECS World reserves storage based on its entity capacity during startup.
For bounded scenes, set a smaller budget before starting the App:

```ts
const app = new App({
    maxEntities: 16_384,
    maxLimboComponents: 16_384,
}).addPlugins(...DefaultPlugins, UIPlugin);
await app.run();
```

| Option               | Default                  | Meaning                                                                               |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `maxEntities`        | `4_194_304`              | Maximum ECS entities across all canvases in this App; an integer from 1 to 4,194,304. |
| `maxLimboComponents` | The chosen `maxEntities` | Capacity for removed components awaiting ECS reclamation; a positive safe integer.    |

These are fixed capacity limits, not initial sizes that grow automatically. Entity
counts include internal canvases, cameras, transformer handles, paint layers and
plugin entities, so leave headroom beyond the number of document shapes. Bulk
removal may require a larger `maxLimboComponents` budget because an entity can
have multiple components. Invalid values throw a `RangeError` at construction;
exceeding a configured capacity later produces a Becsy capacity error.

Options are copied at construction. To change them, exit the App and create a new
one. Calling `new App()` preserves the existing defaults. Smaller budgets reduce
ECS allocation; they do not change GPU texture or geometry memory, or allow
concurrent Apps sharing component types in the same JavaScript environment.

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
-   `shader-compiler-path` Overrides the GLSL-to-WGSL compiler URL. The default empty value loads the matching WASM bundled with `@infinite-canvas-tutorial/device-api`. For more details, see [Lesson 1 - Hardware abstraction layers].
-   `theme` Theme. Options are `'dark' | 'light'`, default is `'light'`
-   `app-state` Application state in JSON string format, which can control initialization parameters such as camera
-   `nodes` List of shapes in JSON string format

### Bundling the WebGPU shader compiler {#shader-compiler}

`ic-spectrum-canvas` and the React bindings load the matching compiler bundled with `@infinite-canvas-tutorial/device-api` when WebGPU initializes. WebGL and SSR imports do not fetch or initialize it. Vite and webpack production builds emit the WASM as an application asset, so the default no longer depends on UNPKG.

For Vite development, exclude the device package from dependency prebundling so the compiler URL stays relative to its module. The React Vite starter already includes this configuration:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
    optimizeDeps: { exclude: ['@infinite-canvas-tutorial/device-api'] },
});
```

You can still override the compiler URL, including an explicit `?url` import. Set the attribute before connecting the canvas:

```ts
import compilerUrl from '@infinite-canvas-tutorial/device-api/shader-compiler.wasm?url';

const canvas = document.createElement('ic-spectrum-canvas');
canvas.style.height = '400px';
canvas.setAttribute('renderer', 'webgpu');
canvas.setAttribute('shader-compiler-path', compilerUrl);
document.body.append(canvas);
```

The older lesson components and `ic-canvas` still use the upstream CDN URL pinned to `1.6.13`. Its WASM is byte-for-byte identical to the bundled file checked on October 13, 2026; switching to the bundled asset does not upgrade the compiler. See the [security note in Lesson 1](/guide/lesson-001) before installing the upstream npm package.

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
