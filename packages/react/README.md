# @infinite-canvas-tutorial/react

React 18/19 bindings for Infinite Canvas. The first version wraps the existing
Spectrum Web Component and provides typed props, events, an imperative API, and
a shared ECS App lifecycle.

```sh
npm install @infinite-canvas-tutorial/react
```

```tsx
'use client';

import { useRef } from 'react';
import {
    InfiniteCanvas,
    type InfiniteCanvasHandle,
} from '@infinite-canvas-tutorial/react/spectrum';

export function Editor() {
    const canvas = useRef<InfiniteCanvasHandle>(null);

    return (
        <>
            <button onClick={() => canvas.current?.api?.undo()}>Undo</button>
            <InfiniteCanvas
                ref={canvas}
                style={{ width: '100%', height: 600 }}
                initialNodes={[
                    {
                        id: 'rect',
                        type: 'rect',
                        x: 50,
                        y: 50,
                        width: 100,
                        height: 80,
                        fill: '#ff8400',
                    },
                ]}
                onNodesChange={(nodes) => console.log(nodes)}
                fallback={<span>Loading canvas…</span>}
            />
        </>
    );
}
```

The root entry and `/spectrum` currently export the same component. Browser-only
dependencies and Custom Element registration are deferred until mount, so the
component can be rendered on the server. Give the container an explicit height.

## Props and API

| Prop                           | Behavior                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `initialNodes`                 | Copied once per canvas creation and inserted into ECS after `onReady` completes. Later changes to this prop do not replace user edits. |
| `initialAppState`              | Initial canvas state; later edits use `api.setAppState()`.                                                                             |
| `renderer`                     | `webgl` (default) or `webgpu`. Changing it recreates the canvas.                                                                       |
| `shaderCompilerPath`           | Override the WebGPU shader compiler URL. Changing it recreates the canvas.                                                             |
| `theme`                        | `light` or `dark`; updates both the Spectrum theme and canvas state.                                                                   |
| `locale`                       | Lit's shared locale. Canvases in the same page share localization.                                                                     |
| `runtime`                      | Shared runtime created with `createCanvasRuntime()`. Omit to use the default.                                                          |
| `initializationTimeout`        | Milliseconds to wait for the runtime and GPU-ready event. Defaults to `30000`; `0` disables it. Changing it recreates the canvas.      |
| `onReady(api, { signal })`     | Runs after GPU readiness. May return a Promise for preparation before initial nodes are inserted. Check the signal after each await.   |
| `onAPIChange(api)`             | Publishes the API and receives `null` on removal or initialization failure after readiness.                                            |
| `onChange(snapshot)`           | Committed snapshot containing `nodes` and `appState`.                                                                                  |
| `onNodesChange(nodes)`         | Committed node changes.                                                                                                                |
| `onAppStateChange(state)`      | Committed application state changes.                                                                                                   |
| `onSelectedNodesChange(nodes)` | Selection changes.                                                                                                                     |
| `onCameraZoomChange(zoom)`     | Camera zoom changes.                                                                                                                   |
| `onResize(size)`               | Canvas size changes.                                                                                                                   |
| `onError(error)`               | Reports runtime loading, readiness timeout, locale, and preparation failures.                                                          |
| `fallback` / `renderError`     | Loading and error content.                                                                                                             |

Standard `div` props apply to the outer container. The ref exposes live `api` and
`element` getters, both initially `null`. `element` is the actual Web Component;
use it for additional DOM events. React children are portaled into its light DOM
and can use existing named slots.

```tsx
<InfiniteCanvas>
    <span slot="penbar-item">Custom tool</span>
</InfiniteCanvas>
```

## Plugins and multiple canvases

Create one runtime outside React render and reuse it for every mounted canvas:

```tsx
import {
    createCanvasRuntime,
    InfiniteCanvas,
} from '@infinite-canvas-tutorial/react';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';

const runtime = createCanvasRuntime({
    plugins: [LassoPlugin],
    loadUI: () => import('@infinite-canvas-tutorial/lasso/spectrum'),
});

export function Compare() {
    return (
        <>
            <InfiniteCanvas runtime={runtime} style={{ height: 400 }} />
            <InfiniteCanvas runtime={runtime} style={{ height: 400 }} />
        </>
    );
}
```

Default engine plugins and `UIPlugin` are included. Plugins are startup
configuration; changing them requires releasing all canvases and creating a new
runtime. Concurrent distinct runtimes are rejected because the existing Web
Components use global initialization queues.

Each canvas owns its API, events, and subscriptions. Removing a canvas removes
its Web Component, which destroys its API. The App exits only after its last
lease is released, and a subsequent mount waits for that shutdown to finish.
StrictMode's immediate setup/cleanup/setup shares the pending startup.

## Async preparation and cancellation

```tsx
<InfiniteCanvas
    initialNodes={nodes}
    onReady={async (api, { signal }) => {
        const response = await fetch('/assets/config.json', { signal });
        const config = await response.json();
        if (signal.aborted) return;
        api.setAppState(config);
    }}
/>
```

Unmounting aborts the signal and removes subscriptions. The wrapper cannot stop
arbitrary work started by a callback, so pass the signal to cancellable tasks
and check it before touching the API after an await. Callbacks always use the
latest committed React props without recreating the canvas.

For framework-neutral subscriptions, the engine also exposes:

```ts
const unsubscribe = api.subscribe((snapshot, changes) => {
    if (changes.nodesChanged) save(snapshot.nodes);
});
unsubscribe();
```

Subscriptions coexist with legacy `onchange`, `onNodesChange`, and
`onAppStateChange` callbacks and are automatically removed on API destruction.

## Scope

This first version provides the component, runtime, and imperative integration.
Canvas providers and selector hooks are planned separately. Uploading,
persistence, collaboration, and application state libraries remain choices of
the host application.
