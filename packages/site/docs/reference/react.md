---
outline: deep
---

<script setup>
import ReactCanvasExample from '../components/ReactCanvasExample.vue';
</script>

# React

`@infinite-canvas-tutorial/react` provides React 18/19 bindings for the existing
Spectrum canvas, including typed events, scoped hooks, API access, and a shared App lifecycle.

```sh
npm install @infinite-canvas-tutorial/react
```

::: info First release
The first npm release is being prepared. The playground uses the workspace
build; registry installation becomes available after publication.
:::

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
                    { id: 'rect', zIndex: 0, type: 'rect', x: 50, y: 50, width: 100, height: 80, fills: [{ type: 'solid', value: '#ff8400' }] },
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

## Interactive example

Try adding a rectangle, changing its color, zooming, and undoing or redoing an
edit. Drag a shape to see the selection update. Canvas A and Canvas B use
separate Providers and share one runtime; editing one leaves the other's
history and zoom unchanged.

<ReactCanvasExample locale="en" />

Hide the second canvas to try removing one while the other remains usable.
**Reset demo** recreates both canvases and clears their edits and history.
The example runs in an isolated frame so it can coexist with the documentation
site's other canvas examples. Changes are local to this demo and are not saved.

<a href="/example/react-playground" target="_blank" rel="noopener">Open the example in its own page</a>.

## Provider and selector hooks

Use one `CanvasProvider` per canvas to share its API with sibling controls and
slot children. `InfiniteCanvas` attaches automatically to the nearest Provider;
the Provider is optional for ref/callback integration.

```tsx
'use client';

import {
    CanvasProvider,
    InfiniteCanvas,
    useCanvasAPI,
    useCanvasSelector,
} from '@infinite-canvas-tutorial/react';

function Toolbar() {
    const api = useCanvasAPI();
    const canUndo = useCanvasSelector((state) => state.canUndo);
    const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
    return (
        <div>
            <button disabled={!canUndo} onClick={() => api?.undo()}>Undo</button>
            <span>{Math.round(zoom * 100)}%</span>
        </div>
    );
}

export function Editor() {
    return (
        <CanvasProvider>
            <InfiniteCanvas style={{ height: 600 }} />
            <Toolbar />
        </CanvasProvider>
    );
}
```

`useCanvasAPI()` returns `null` during SSR, before readiness, and after removal
or failure. Its consumers update only when the API changes. Both hooks require
a Provider; mounting two canvases in the same Provider reports an error. For
multiple canvases, give each its own Provider and share the runtime.

`useCanvasSelector(selector, isEqual?)` selects from `CanvasState`: `api`,
`appState`, `nodes`, `canUndo`, and `canRedo`. The server/empty state has `api` and
`appState` set to `null`, an empty node array, and both history flags `false`.
Selectors must be pure and treat state as read-only. By default, selected values
are compared with `Object.is`; only changed selections trigger a store-driven
render. When returning objects or arrays, pass an equality function:

```tsx
const history = useCanvasSelector(
    (state) => ({ undo: state.canUndo, redo: state.canRedo }),
    (a, b) => a.undo === b.undo && a.redo === b.redo,
);
```

Nodes and application state update on committed API changes (`api.record()`).
Initial scenes and `api.record('NEVER')` also notify subscribers without adding
undo entries. `initialNodes` updates selectors and node callbacks after
preparation; no extra `record()` is needed.
Camera and selection events also refresh application state immediately. History
availability updates on edits, undo, redo, and `clearHistory()` without polling.
Uncommitted direct API writes become visible on the next commit/event. API
availability marks GPU readiness and may precede async `onReady` completion.

## Initialization and API

- `initialNodes` is copied once per canvas creation and inserted into ECS after
  async `onReady` completes, without an undo entry. Later prop changes do not overwrite user edits;
  use `api.updateNodes()` for updates.
- `initialAppState` seeds canvas state; subsequent edits use `api.setAppState()`.
- The ref exposes live `api` and `element` getters, initially `null`. The element
  is the actual Web Component, suitable for additional DOM events.
- `onAPIChange(api)` publishes the API and receives `null` on removal.
- `theme` updates Spectrum and the canvas. Lit localization is global, so canvases
  in the same page share the `locale`.
- Changing `renderer`, `shaderCompilerPath`, or `initializationTimeout` recreates
  the canvas.

## Framework starters

Copy the [Vite or Next.js starter](https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/examples)
for a minimal Provider, initial scene, reactive shape counter, and undo/redo
toolbar. The Next.js example uses a Client Component editor within a Server
Component page, including an SSR loading fallback. The package verification
builds these examples from real tarballs before publication.

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
