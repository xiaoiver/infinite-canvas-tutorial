---
outline: deep
---

# React

`@infinite-canvas-tutorial/react` provides React 18/19 bindings for the existing
Spectrum canvas, including typed events, API access, and a shared App lifecycle.

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
                    { id: 'rect', type: 'rect', x: 50, y: 50, width: 100, height: 80, fill: '#ff8400' },
                ]}
                onNodesChange={(nodes) => console.log(nodes)}
                fallback={<span>Loading canvas…</span>}
            />
        </>
    );
}
```

Give the container an explicit height. Browser dependencies and Custom Element
registration are deferred until client mount, including in Next.js Client
Components. The root entry and `/spectrum` currently export the same component.

## Initialization and API

- `initialNodes` is copied once per canvas creation and inserted into ECS after
  async `onReady` completes. Later prop changes do not overwrite user edits;
  use `api.updateNodes()` for updates.
- `initialAppState` seeds canvas state; subsequent edits use `api.setAppState()`.
- The ref exposes live `api` and `element` getters, initially `null`. The element
  is the actual Web Component, suitable for additional DOM events.
- `onAPIChange(api)` publishes the API and receives `null` on removal.
- `theme` updates Spectrum and the canvas. Lit localization is global, so canvases
  in the same page share the `locale`.
- Changing `renderer`, `shaderCompilerPath`, or `initializationTimeout` recreates
  the canvas.

## Events and loading

Typed callbacks include `onChange`, `onNodesChange`, `onAppStateChange`,
`onSelectedNodesChange`, `onCameraZoomChange`, and `onResize`. Updating callbacks
does not recreate the canvas.

Use `fallback` for loading content and `renderError` for custom errors. `onError`
reports runtime loading, readiness timeout, locale, and async preparation
failures. `initializationTimeout` defaults to 30000 milliseconds; `0` disables
the runtime/GPU readiness timeout.

## Plugins and multiple canvases

Create a shared runtime outside component render:

```tsx
import { InfiniteCanvas, createCanvasRuntime } from '@infinite-canvas-tutorial/react';
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

`DefaultPlugins` and `UIPlugin` are included. Plugin configuration is fixed at
startup; release all canvases before replacing the runtime. Concurrent distinct
runtimes are rejected because the Web Components use global initialization queues.

Each canvas owns its API and subscriptions. The App exits after its last canvas
is removed. StrictMode's immediate setup/cleanup/setup shares pending startup.
React children are mounted in the Web Component's light DOM and support its
named slots.

## Async preparation

`onReady(api, { signal })` may return a Promise. Pass the signal to cancellable
tasks and check it after awaits before using the API:

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

Uploading, persistence, and collaboration belong to the host application.
Providers and selector hooks are planned as subsequent additions.
