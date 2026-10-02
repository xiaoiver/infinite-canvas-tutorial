# @infinite-canvas-tutorial/react

React 18/19 bindings for Infinite Canvas. The bindings wrap the existing
Spectrum Web Component and provide typed props, events, an imperative API,
a shared ECS App lifecycle, and scoped selector hooks.

```sh
npm install @infinite-canvas-tutorial/react
```

The React package is developed in the workspace and has not been published to npm.
The documentation playground uses the workspace build; registry installation
becomes available after publication.
Copyable [Vite and Next.js starters](https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/examples) are checked against
packed packages by `pnpm test:react:package`.

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
                        zIndex: 0,
                        type: 'rect',
                        x: 50,
                        y: 50,
                        width: 100,
                        height: 80,
                        fills: [{ type: 'solid', value: '#ff8400' }],
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
            <button disabled={!canUndo} onClick={() => api?.undo()}>
                Undo
            </button>
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
or failure. Its consumers update only when the API changes. All canvas hooks require
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
This includes initial scenes and `api.record('NEVER')` updates, which notify
subscribers without adding an undo entry. `initialNodes` is published to hooks
and node callbacks after preparation, with no extra `record()` needed.
Camera and selection events also refresh application state immediately. History
availability updates on edits, undo, redo, and `clearHistory()` without polling.
Uncommitted direct API writes become visible on the next commit/event. API
availability marks GPU readiness and may precede async `onReady` completion.

## Editing actions

`useCanvasActions()` returns stable commands for the nearest Provider. Action-only
consumers do not subscribe to scene changes. Retained commands use the current
canvas after recreation. Use `useCanvasSelector` to render readiness or state.

```tsx
import {
    useCanvasActions,
    useCanvasSelector,
} from '@infinite-canvas-tutorial/react';

function EnlargeButton({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const ready = useCanvasSelector((state) => state.api !== null);
    const enlarge = () =>
        actions.updateNodes((nodes) =>
            nodes
                .filter((node) => node.type === 'rect')
                .map((node) => ({
                    ...node,
                    width: (node.width ?? 100) + 20,
                })),
        );
    return (
        <button
            disabled={!ready}
            onClick={() => {
                void enlarge().catch(onError);
            }}
        >
            Enlarge rectangles
        </button>
    );
}
```

| Command                                 | Behavior                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateNodes(nodesOrUpdater, options?)` | Upserts by ID, preserving omitted nodes. Supplied arrays are copied before queueing; an updater reads the latest nodes at execution. Return new nodes without mutating the input. |
| `setAppState(patchOrUpdater, options?)` | Merges a patch using API semantics. An updater reads the latest state. View settings also refresh selectors when they do not participate in history.                              |
| `selectNodes(ids, options?)`            | Resolves IDs at execution, ignoring missing/deleted nodes. `preserveSelection: true` extends the selection. Pass `[]` to clear it.                                                |
| `edit(callback, options?)`              | Runs synchronous API mutations at an ECS frame boundary, then calls `record()` once.                                                                                              |
| `undo()`, `redo()`, `clearHistory()`    | Use the current canvas history. Undo/redo queue their work; clearHistory runs immediately.                                                                                        |

The first four commands return `Promise<boolean>`: `true` after a successful
commit, or `false` if no canvas is available or the owning canvas is removed
before execution. Failures reject the Promise; handle them in the calling
component. History commands return `false` when no API is attached. Actions use
the same GPU-ready API availability as `useCanvasAPI()`.

Each editing command commits independently. To group changes into one undo entry,
use `edit` in an event handler:

```tsx
await actions.edit((api) => {
    const node = api.getNodes().find((node) => node.type === 'rect');
    if (!node) return;
    api.updateNodes([{ ...node, width: (node.width ?? 100) + 20 }]);
    api.selectNodes([api.getNodeById(node.id)!]);
});
```

The editing actions delegate to the shared ECS `api.edit()` interface. Calls to
`record()` made synchronously inside an edit join its single commit. Await network
or other asynchronous work before calling `edit`; its callback must be synchronous.
It does not roll back mutations if a callback fails. Set
`{ capture: 'NEVER' }` to notify selectors without adding an undo entry; the
default is `'IMMEDIATELY'`.

Pass `{ signal: controller.signal }` to cancel queued work. Cancellation, canvas
destruction, and Provider ownership changes settle `false` without waiting for
another frame. Nested edits and `undo`/`redo` are separate queued operations;
invoke history navigation separately from an edit. A successful Promise indicates
a committed edit, not a rendered frame.

## Props and API

| Prop                           | Behavior                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialNodes`                 | Copied once per canvas creation and inserted into ECS after `onReady` completes, without an undo entry. Later prop changes do not replace user edits. |
| `initialAppState`              | Initial canvas state; later edits use `api.setAppState()`.                                                                                            |
| `renderer`                     | `webgl` (default) or `webgpu`. Changing it recreates the canvas.                                                                                      |
| `shaderCompilerPath`           | Override the WebGPU shader compiler URL. Changing it recreates the canvas.                                                                            |
| `theme`                        | `light` or `dark`; updates both the Spectrum theme and canvas state.                                                                                  |
| `locale`                       | Lit's shared locale. Canvases in the same page share localization.                                                                                    |
| `runtime`                      | Shared runtime created with `createCanvasRuntime()`. Omit to use the default.                                                                         |
| `initializationTimeout`        | Milliseconds to wait for the runtime and GPU-ready event. Defaults to `30000`; `0` disables it. Changing it recreates the canvas.                     |
| `onReady(api, { signal })`     | Runs after GPU readiness. May return a Promise for preparation before initial nodes are inserted. Check the signal after each await.                  |
| `onAPIChange(api)`             | Publishes the API and receives `null` on removal or initialization failure after readiness.                                                           |
| `onChange(snapshot)`           | Committed snapshot containing `nodes` and `appState`.                                                                                                 |
| `onNodesChange(nodes)`         | Committed node changes.                                                                                                                               |
| `onAppStateChange(state)`      | Committed application state changes.                                                                                                                  |
| `onSelectedNodesChange(nodes)` | Selection changes.                                                                                                                                    |
| `onCameraZoomChange(zoom)`     | Camera zoom changes.                                                                                                                                  |
| `onResize(size)`               | Canvas size changes.                                                                                                                                  |
| `onError(error)`               | Reports runtime loading, readiness timeout, locale, and preparation failures.                                                                         |
| `fallback` / `renderError`     | Loading and error content.                                                                                                                            |

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
Independent subscriptions also receive initialization and non-undoable commits;
legacy callbacks retain their local-edit/history behavior for collaboration.

## Scope

The bindings provide the component, runtime, Provider, selectors, and imperative integration. Uploading,
persistence, collaboration, and application state libraries remain choices of
the host application.
