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
The React package has not been published to npm. The playground uses the
workspace build; registry installation becomes available after publication.
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

Give the container an explicit height. Browser dependencies and Custom Element
registration are deferred until client mount, including in Next.js Client
Components. The root entry and `/spectrum` currently export the same component.

## Interactive example

Try adding a rectangle, changing its color or width, deleting selected shapes,
and undoing or redoing an edit. **Restore sample** replaces the full document
and can also be undone. Select a shape to see its width update. Canvas A and Canvas B use
separate Providers and share one runtime; editing one leaves the other's
history and zoom unchanged. Use **Fit all shapes** to center the scene in the
viewport without adding an undo entry. Drag the rectangle button onto the canvas
to place a shape at the pointer, or click/tap it to add at the current view center.
Insertion and selection can be undone together.

<ReactCanvasExample locale="en" />

Hide the second canvas to try removing one while the other remains usable.
**Reset demo** recreates both canvases and clears their edits and history.
The example runs in an isolated frame so it can coexist with the documentation
site's other canvas examples. Use **Save locally** to keep a document in this
browser, or **Export .ic** to download it. **Reset demo** keeps saved documents;
**Load saved** restores them. Each canvas uses a separate storage key.

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
Initial scenes and `api.record('NEVER')` also notify subscribers without adding
undo entries. `initialNodes` updates selectors and node callbacks after
preparation; no extra `record()` is needed.
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

## Keyboard shortcuts

`useCanvasShortcuts(options?)` returns stable props to spread onto a focusable
container inside `CanvasProvider`. Enclose both the canvas and its React controls
in that container. Each DOM scope handles keys only from within itself; keyboard
focus on a toolbar button works as well as focus on the canvas.

```tsx
import { useState } from 'react';
import {
    CanvasProvider,
    InfiniteCanvas,
    useCanvasShortcuts,
} from '@infinite-canvas-tutorial/react';

function EditorSurface() {
    const [error, setError] = useState<Error | null>(null);
    const shortcuts = useCanvasShortcuts({ onError: setError });
    return (
        <section {...shortcuts} aria-label="Canvas editor">
            <InfiniteCanvas style={{ height: 400 }} />
            {error && <p role="alert">{error.message}</p>}
        </section>
    );
}

export function Editor() {
    return <CanvasProvider><EditorSurface /></CanvasProvider>;
}
```

| Key | Action |
| --- | --- |
| Ctrl/⌘+Z | Undo |
| Ctrl/⌘+Shift+Z, Ctrl+Y | Redo |
| Ctrl/⌘+A | Select all undeleted nodes without adding an undo entry |
| Delete, Backspace | Delete the current selection as one undoable edit |

Keep all returned props on the same element, including `onKeyDownCapture` and
`data-canvas-shortcuts`. Capture prevents the Web Component from processing the
same command twice. The default `tabIndex` is `0`; it can be overridden. No global
keyboard listener is installed. Nested scopes own their keys, and portals outside
the DOM container are excluded.

The hook waits for `status === 'ready'`, follows canvas recreation, and reads the
current API at key time. It ignores inputs, textareas, selects, editable ancestors,
textbox/combobox roles, IME composition, repeat events, and already-prevented events.
Open Shadow DOM inputs are detected through the event's composed path. Add
`data-canvas-shortcuts-ignore` to a custom editor or a closed shadow host to opt
its subtree out. Selection and deletion resolve the latest scene in the ECS edit
stage, so consecutive queued keys compose.

`enabled: false` pauses this hook; it does not disable the Web Component's own
shortcuts. `onError` receives editing errors while the owning canvas remains
attached; without it, errors are logged to `console.error`. Existing clipboard,
arrow-key, and other native canvas behavior remain available.

## Camera controls

`useCanvasCamera()` returns a read-only `{ x, y, zoom, rotation }` snapshot for
its Provider. Rotation is in radians. Its reference stays stable during
unrelated document updates; pan, zoom, and rotation-only changes update it.
SSR, an empty Provider, and a removed canvas return `{ x: 0, y: 0, zoom: 1, rotation: 0 }`.

```tsx
import {
    useCanvasActions,
    useCanvasCamera,
    useCanvasStatus,
} from '@infinite-canvas-tutorial/react';

function ViewControls() {
    const { zoom } = useCanvasCamera();
    const actions = useCanvasActions();
    const { status } = useCanvasStatus();
    return (
        <div>
            <output aria-label="Zoom">{Math.round(zoom * 100)}%</output>
            <button disabled={status !== 'ready'} onClick={() => actions.zoomTo(1)}>
                Reset zoom
            </button>
            <button disabled={status !== 'ready'} onClick={() => actions.fitToScreen()}>
                Fit all shapes
            </button>
        </div>
    );
}
```

Both actions return `false` without an attached API and `true` when forwarded.
This boolean reports dispatch, not animation completion. They animate for 300 ms
with `ease` by default; `CanvasCameraAnimationOptions` accepts `duration`,
`easing`, `onframe`, and `onfinish`. Pass `{ duration: 0 }` for an immediate change.
`zoomTo` zooms around the viewport center and throws `RangeError` for a non-finite
or non-positive zoom when an API is attached. `fitToScreen` fits scene bounds at
the current rotation, excludes editor handles, and does nothing for an empty
scene. Camera actions leave document undo history unchanged. Retained actions
always target the current canvas in their Provider.

For event-driven work, `useCanvasEvent('ic-camera-changed', listener)` receives
the complete `{ x, y, zoom, rotation }` in `event.detail`. The existing zoom and
position events remain available.

## Coordinate conversion

`useCanvasCoordinates()` returns stable conversion functions for the nearest
`CanvasProvider`. Both package entries also export `CanvasCoordinates` and the
read-only `{ x: number; y: number }` type `CanvasPoint`.

| Method                    | Input                                    | Output                             |
| ------------------------- | ---------------------------------------- | ---------------------------------- |
| `clientToCanvas(point)`   | Browser client coordinates (`clientX/Y`) | Canvas world coordinates           |
| `canvasToClient(point)`   | Canvas world coordinates                 | Browser client coordinates         |
| `viewportToCanvas(point)` | Local drawing viewport coordinates       | Canvas world coordinates           |
| `canvasToViewport(point)` | Canvas world coordinates                 | Local drawing viewport coordinates |

Client and viewport coordinates use CSS pixels. The viewport origin is the
actual drawing canvas, excluding the editor's toolbar. Do not multiply by
`devicePixelRatio` or pass page/element-offset coordinates as client coordinates.
Conversions account for camera pan, zoom, and rotation; client conversions also
read the current canvas bounds, including scrolling and positive, axis-aligned
CSS scaling. Rotated, skewed, perspective-transformed, or flipped DOM containers
are not supported.

```tsx
import type { PointerEvent } from 'react';
import { useCanvasCoordinates } from '@infinite-canvas-tutorial/react';

// Inside a component rendered under CanvasProvider:
const coordinates = useCanvasCoordinates();
const onPointerMove = (event: PointerEvent) => {
    const point = coordinates.clientToCanvas({
        x: event.clientX,
        y: event.clientY,
    });
    if (point) console.log('Canvas position', point.x, point.y);
};
```

Attach `onPointerMove` to `InfiniteCanvas` or its container. Conversion reads the
latest API and geometry when called; retained functions follow a recreated
canvas in the same Provider. Every method returns `null` during SSR, before API
availability, or after removal. Use `useCanvasStatus().status === 'ready'` to
enable editing controls because API availability can precede scene preparation.
Inputs are not mutated, and conversion does not create history entries.

This hook does not subscribe to camera or layout changes. Call it from events;
for a reactive overlay, use `useCanvasCamera()` to update on view changes and
also track relevant scrolling/resizing in your layout. Client output can position
a `position: fixed` overlay; convert to its containing block for other layouts.

The interactive example uses `clientToCanvas` to center a new rectangle on the
drop position and commits insertion plus selection in one `actions.edit` call.
It handles its custom drag type in `onDragOverCapture` / `onDropCapture`, before
the editor's native file-drop handler. Clicking or tapping the palette button
adds at the current view center, so touch and keyboard users can also add shapes.

## Canvas event subscriptions

`useCanvasEvent(name, listener, options?)` subscribes directly to the current
canvas element in the nearest `CanvasProvider`. Both package entries provide it.
The event name infers the payload: for example, `ic-point-drawn` has numeric
`detail.x/y`, and `ic-screenshot-downloaded` has `detail.svg/dataURL`. Native DOM
events such as `pointerdown` are supported too.

```tsx
import { useState } from 'react';
import {
    useCanvasEvent,
    useCanvasStatus,
} from '@infinite-canvas-tutorial/react';

function Coordinates() {
    const { status } = useCanvasStatus();
    const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
    useCanvasEvent(
        'ic-point-drawn',
        ({ detail: { x, y } }) => {
            setPoint({ x, y });
        },
        { enabled: status === 'ready' },
    );
    return <output>{point ? `x: ${point.x}, y: ${point.y}` : ''}</output>;
}
```

Activate the point tool with
`actions.setAppState({ penbarSelected: Pen.DRAW_POINT }, { capture: 'NEVER' })`
(`Pen` comes from `@infinite-canvas-tutorial/ecs`). Click or tap the canvas to get
canvas coordinates, accounting for camera zoom and position. The documentation
playground includes this flow in its **Pick coordinates** button and returns to
the selection tool after picking.

The hook starts listening after the GPU-ready API attaches, then follows canvas
recreation. Use `onReady` or `useCanvasStatus()` for initialization; the initial
`ic-ready` event occurs before this subscription is installed. Listeners are
removed when the subscriber unmounts or the API is destroyed, and detached
canvases cannot deliver events to a replacement canvas's controls.

`options.enabled` defaults to `true`; set it to `false` to pause listening. The
other options are native `capture`, `passive`, `once`, and `signal`. Aborting the
signal removes the listener; pass a new signal to listen again. Callback changes
use the latest committed callback without rebinding. A new options object with
the same values also keeps the subscription, so rerenders do not rearm a `once`
listener. Changing the event, option values, or canvas creates a new subscription.

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

## Initialization and API

-   `initialNodes` is copied once per canvas creation and inserted into ECS after
    async `onReady` completes, through `api.edit()` with `capture: 'NEVER'`.
    Transforms, bounds, and rendering see the initial scene in its commit frame.
    The loading fallback clears after the commit; removal or recreation cancels
    pending initialization. Later prop changes do not overwrite user edits;
    use `api.updateNodes()` for updates.
-   `initialAppState` seeds canvas state; subsequent edits use `api.setAppState()`.
-   The ref exposes live `api` and `element` getters, initially `null`. The element
    is the actual Web Component, suitable for additional DOM events.
-   `onAPIChange(api)` publishes the API and receives `null` on removal.
-   `theme` updates Spectrum and the canvas. Lit localization is global, so canvases
    in the same page share the `locale`.
-   Changing `renderer`, `shaderCompilerPath`, or `initializationTimeout` recreates
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
import {
    InfiniteCanvas,
    createCanvasRuntime,
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
