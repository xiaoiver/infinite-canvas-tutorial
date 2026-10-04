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
`appState`, `nodes`, `canUndo`, `canRedo`, `status`, and `error`. The server/empty state has `api` and
`appState` set to `null`, an empty node array, and both history flags `false`.
Selectors must be pure and treat state as read-only. By default, selected values
are compared with `Object.is`; only changed selections trigger a store-driven
render. When returning newly created objects or arrays, pass an equality function:

```tsx
const history = useCanvasSelector(
    (state) => ({ undo: state.canUndo, redo: state.canRedo }),
    (a, b) => a.undo === b.undo && a.redo === b.redo,
);
```

`nodes` contains store-owned copies, isolated from the API's mutable document.
Unchanged nodes retain their references across commits; the array also retains
its reference when its content and order stay the same. You can return a node
directly without a custom equality function:

```tsx
const rect = useCanvasSelector((state) =>
    state.nodes.find((node) => node.id === 'rect'),
);
```

Nodes and application state update on committed API changes (`api.record()`).
This includes initial scenes and `api.record('NEVER')` updates, which notify
subscribers without adding an undo entry. `initialNodes` is published to hooks
and node callbacks after preparation, with no extra `record()` needed.
Camera and selection events also refresh application state immediately. History
availability updates on edits, undo, redo, and `clearHistory()` without polling.
After direct node writes, use `api.edit()` or `api.record()` to publish the
document change; camera/selection events only refresh application state. API
availability marks GPU readiness and may precede async `onReady` completion.

## Initialization status

`useCanvasStatus()` returns `{ status, error }` from the nearest Provider. It is
available from both package entries. Status is `idle` during SSR, with no mounted
canvas, or after the API is destroyed; `loading` while the runtime/GPU, async
`onReady`, or the initial scene commit is pending; `ready` after initialization
completes; and `error` after a lifecycle failure. `error` is an `Error` or `null`.
The returned object stays stable through unrelated document/view/history changes.

```tsx
const { status, error } = useCanvasStatus();
const ready = status === 'ready';
```

Use `ready` to enable editing, saving, and importing controls. `useCanvasAPI()`
continues to expose the API at GPU readiness so `onReady` can prepare it; a non-null
API alone does not mean the initial scene is ready. Startup failures clear the
API and retain the error until removal or recreation. A later locale-update
failure reports `error` while retaining the usable API. Each Provider owns its
status; stale async completions cannot change a recreated canvas's status.

## Node, selection, and history hooks

These hooks require a `CanvasProvider` and are available from both package entries:

| Hook                   | Result                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `useCanvasNode(id?)`   | A read-only node copy, or `null` for an absent/deleted ID. Accepts `null` or `undefined` for an empty selection. |
| `useCanvasSelection()` | Read-only node copies in selection order, excluding missing/deleted IDs.                                         |
| `useCanvasHistory()`   | `{ canUndo, canRedo }`; use `useCanvasActions()` for navigation.                                                 |

During SSR, before readiness, and after removal, they return `null`, `[]`, and
`{ canUndo: false, canRedo: false }` respectively. References stay stable while
the selected content is unchanged, including through camera and unrelated node
updates. These hooks share the store-owned node copies, so each committed
change is copied once rather than once per consumer. They also detect committed
in-place `api.updateNode()` changes; treat the copies and their nested values
as read-only, and use actions or the API to edit the canvas. For individual
scalar values, continue using `useCanvasSelector`.

```tsx
import {
    useCanvasActions,
    useCanvasHistory,
    useCanvasNode,
    useCanvasSelection,
} from '@infinite-canvas-tutorial/react';

function Properties({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const selected = useCanvasSelection();
    const node = useCanvasNode(selected[0]?.id);
    const { canUndo } = useCanvasHistory();
    return (
        <div>
            <output>{node?.width ?? 'Select a shape'}</output>
            <button disabled={!canUndo} onClick={actions.undo}>
                Undo
            </button>
            <button
                disabled={selected.length === 0}
                onClick={() => {
                    void actions
                        .deleteNodes(selected.map((node) => node.id))
                        .catch(onError);
                }}
            >
                Delete selected
            </button>
        </div>
    );
}
```

## Saving and importing documents

The playground and both framework starters include **Save locally**, **Load saved**,
**Export .ic**, and **Import .ic** controls. Saving is explicit; it stores one
native document per canvas in this browser's `localStorage`. Resetting or
reloading the demo keeps that save, but does not load it automatically. Use
**Load saved** to restore it. Storage is scoped to the site's origin and browser;
export a file to move a document elsewhere. Storage and file errors appear beside
the controls.

These controls belong to the host application. The starters' `document-controls.tsx`
shows the complete implementation, including cancellation when its canvas is
removed. It only accesses browser APIs from event handlers, so it can be imported
by a Next.js Client Component during SSR.

Use the native `.ic` format when saving nodes, design variables, themes, selection,
and camera/UI state together. `replaceDocument` only replaces nodes. Read the
latest document in a queued edit, then import outside that edit:

```tsx
// In an event handler, with useCanvasAPI() and useCanvasActions().
await actions.edit(
    (api) => {
        localStorage.setItem(
            'my-canvas:v1',
            JSON.stringify(api.exportIcDocument()),
        );
    },
    { capture: 'NEVER' },
);

const raw = localStorage.getItem('my-canvas:v1');
if (api && raw !== null) {
    await api.importIcDocument(raw, { signal: controller.signal });
}
```

`api.importIcDocument` accepts a native document object or its JSON string. It
validates the format, version, node IDs/types, hierarchy, and selection/view fields
before mutation, copies the input before queueing, and commits once in the Edit
phase. It returns `Promise<boolean>`: `true` after commit, or `false` on cancellation
or canvas destruction. Invalid input throws before queueing; execution failures
reject the Promise. Catch both in the event handler. Read files with `await file.text()`
before importing, and abort pending reads/imports when their owning canvas is removed.

Imports create one undo entry for nodes, variables, selection, and filter. Camera,
theme, and other UI settings follow the existing non-undoable state rules.
`{ recordHistory: false }` imports without adding an undo entry; call
`clearHistory()` separately to discard earlier history. Saves and exports use
`capture: 'NEVER'`. Existing edits are not rolled back if an arbitrary runtime
mutation fails.

## Editing actions

`useCanvasActions()` returns stable commands for the nearest Provider. Action-only
consumers do not subscribe to scene changes. Retained commands use the current
canvas after recreation. Use `useCanvasStatus` for completed initialization
and `useCanvasSelector` for document or application state.

```tsx
import {
    useCanvasActions,
    useCanvasStatus,
} from '@infinite-canvas-tutorial/react';

function EnlargeButton({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const { status } = useCanvasStatus();
    const ready = status === 'ready';
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

| Command                                     | Behavior                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateNodes(nodesOrUpdater, options?)`     | Upserts by ID, preserving omitted nodes. Supplied arrays are copied before queueing; an updater reads the latest nodes at execution. Return new nodes without mutating the input.           |
| `deleteNodes(ids, options?)`                | Deletes IDs and descendants, clearing their selection; missing IDs are ignored.                                                                                                             |
| `replaceDocument(nodesOrUpdater, options?)` | Replaces the full document, deleting omitted IDs; validates the complete hierarchy before applying. Arrays are copied before queueing; updaters read the latest nodes. Undoable by default. |
| `setAppState(patchOrUpdater, options?)`     | Merges a patch using API semantics. An updater reads the latest state. View settings also refresh selectors when they do not participate in history.                                        |
| `selectNodes(ids, options?)`                | Resolves IDs at execution, ignoring missing/deleted nodes. `preserveSelection: true` extends the selection. Pass `[]` to clear it.                                                          |
| `edit(callback, options?)`                  | Runs synchronous API mutations before derived data/rendering, then calls `record()` once.                                                                                                   |
| `undo()`, `redo()`, `clearHistory()`        | Use the current canvas history. Undo/redo queue their work; clearHistory runs immediately.                                                                                                  |

The six editing commands return `Promise<boolean>`: `true` after a successful
commit, or `false` if no canvas is available or the owning canvas is removed
before execution. Failures reject the Promise; handle them in the calling
component. History commands return `false` when no API is attached. Actions use
the same GPU-ready API availability as `useCanvasAPI()`.

To load a remote or saved document without adding an undo entry, use
`replaceDocument(nodes, { capture: 'NEVER' })`. Pass `[]` to clear the document.
Call `clearHistory()` separately if existing history should be removed.
Replacement preserves camera settings; later `initialNodes` prop changes do not
replace the document.

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

The editing actions delegate to the shared ECS `api.edit()` interface. Edits and
undo/redo run in invocation order before geometry, transforms, bounds, and
rendering, so those systems see the changes in the same frame. Calls to
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

After async `onReady` completes, `initialNodes` is applied through
`api.edit()` with `capture: 'NEVER'`, before derived data and rendering in its
commit frame. The loading fallback clears after that commit. Unmounting or
recreating the canvas cancels a pending initial edit.

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
