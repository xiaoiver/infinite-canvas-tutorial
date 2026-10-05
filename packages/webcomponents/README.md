# @infinite-canvas-tutorial/webcomponents

Developing Web UIs with [Lit] and [Spectrum].

For more information, please refer to: [Lesson 7 - Web UI] which used [Shoelace] at that time.

## Getting Started

For now we provide these web components implementations based on [Spectrum]:

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

For more information, please refer to [API](#api) section.

### Use ECS

Please refer to [@infinite-canvas-tutorial/ecs].

## API

Just like [Figma API] and [Excalidraw API], we provide ours which is also friendly to MCP. [MCP: What It Is and Why It Matters]:

> Instead of only having a GUI or API that humans use, you get an AI interface “for free.” This idea has led to the concept of “MCP-first development”, where you build the MCP server for your app before or alongside the GUI.

### get/setAppState

```ts
api.getAppState();
api.setAppState({
    penbarSelected: Pen.HAND,
});
```

#### penbarVisible

#### penbarAll

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    DRAW_RECT = 'draw-rect',
    DRAW_ELLIPSE = 'draw-ellipse',
    DRAW_LINE = 'draw-line',
    DRAW_ROUGH_RECT = 'draw-rough-rect',
    IMAGE = 'image',
    TEXT = 'text',
    PENCIL = 'pencil',
    BRUSH = 'brush',
    VECTOR_NETWORK = 'vector-network',
}
```

#### penbarSelected

#### checkboardStyle

Set the checkboard style of grid, refer to [Lesson 5 - Grid].

```ts
api.setAppState({
    checkboardStyle: CheckboardStyle.GRID,
});
```

Valid values to take include:

```ts
enum CheckboardStyle {
    NONE = 'none',
    GRID = 'grid',
    DOTS = 'dots',
}
```

#### contextMenuVisible

#### contextBarVisible

#### topbarVisible

#### taskbarVisible

#### taskbarAll

#### taskbarSelected

### setCursor

Set current cursor style, the valid values are detailed: [cursor].

```ts
setCursor(cursor: string): void;
```

### updateNodes

```ts
updateNodes(nodes: SerializedNode[]): void;
```

### undo

### redo

### isUndoStackEmpty

### isRedoStackEmpty

### destroy

Delete canvas entity.

## Events

```ts
canvas.addEventListener(Event.READY, (e) => {
    // Get API.
    const api = e.detail;
});
```

-   READY
-   RESIZED
-   CAMERA_ZOOM_CHANGED
-   SCREENSHOT_REQUESTED
-   SCREENSHOT_DOWNLOADED

## Built-in plugin and systems

-   UI plugin
    -   InitCanvas System
    -   ZoomLevel System
    -   DownloadScreenshot System

## FAQ

### Registry conflicts

```plaintext
Failed to execute 'define' on 'CustomElementRegistry':
the name "sp-overlay" has already been used with this registry
```

<https://opensource.adobe.com/spectrum-web-components/registry-conflicts/>

[Lit]: https://lit.dev/
[Shoelace]: https://shoelace.style/
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Lesson 5 - Grid]: https://infinitecanvas.cc/guide/lesson-005
[Lesson 7 - Web UI]: https://infinitecanvas.cc/guide/lesson-007
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[MCP: What It Is and Why It Matters]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma API]: https://www.figma.com/developers/api
[Excalidraw API]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api
[cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor

### Insert and select as one edit

`updateAndSelectNodes(api, appState, nodes, options?)` inserts nodes, clears the
current highlights, and selects the first inserted node in one `api.edit()`.
The `appState` parameter is retained for compatibility; the edit uses the state
current at execution time. Input nodes are copied before queuing.

The returned `Promise<boolean>` resolves after the commit, with `false` for an
empty insertion, cancellation, or canvas destruction. It rejects on edit errors.
`options` accepts the core `CanvasEditOptions` (`signal` and `capture`). Completion
does not guarantee a rendered frame or rollback on failure.

Clipboard insertion and `createImageFromFile()` await this commit. The image
method retains its prepared-node return value; the helper's boolean result can
be used when callers need an explicit cancellation result. Pending insertions
cannot change a destroyed canvas or a replacement canvas.

### Asynchronous image edits

The Spectrum image toolbar prepares background removal, upscaling, and image
decomposition results before inserting them through one `api.edit()`. It creates
no placeholder node. Preparation failures and empty results leave no new nodes
or history entries, and reset the action's busy state. Edit errors also reset the
busy state, but retain the core API's no-rollback semantics. Multiple decomposed layers are
inserted in provider order with one undo entry. Decomposition uses the registered
`decomposeImage` capability rather than sample images.

Each request captures its source image, dimensions, placement, and canvas. A
selection change does not redirect the result or select the generated nodes.
At commit time, removed sources or changed source image contents cause the
result to be ignored. Canvas destruction cancels a queued edit and discards late
results; it does not guarantee cancellation of an underlying provider request.

Smart selection owns a session for the selected, editable source image. Only the
latest point request can publish a mask. Clearing points removes the preview;
changing the selection or source image, leaving editing, and toolbar or canvas
teardown end the session and discard late responses. Existing points are not
reused when starting a new session. Segmentation receives the source image URL
and accepts either a canvas or a URL mask. Previews are copied from provider
canvases, and removal receives another copy so preview changes cannot mutate its
input while the provider is preparing the result.

Mask removal inserts its completed result beside the original with one undo
entry, using the image and placement captured on click. It requires the smart
selection session to remain valid through the commit. Failures and empty results
retain the mask for retry; success clears only the submitted preview, preserving
any newer selection preview. These lifecycle guards discard results without
requiring providers to support cancellation. Existing point coordinate rules and
touch gestures are unchanged.

### Queued text and icon edits

The Spectrum text editor submits changed, nonblank text through one `api.edit()`.
Each command owns its source canvas, target ID, and input. Existing text is
updated from the current node so concurrent style changes are preserved; deleted
or replaced targets are skipped. Empty new drafts create no node. Empty existing
text fields retain their original contents, and whitespace in nonblank input is
preserved. Unchanged blur does not commit or consume unrelated pending changes.

Hiding the original text while the textarea is open changes only renderer
visibility. It cannot enter document snapshots or another action's undo history.
Closing the editor restores visibility from the live document. Disconnecting
discards an active draft and removes the double-click listener; reconnecting binds
it again. Blur processing allows the disconnect callback to run before deciding
whether to submit. Already queued edits retain their source canvas and are
cancelled when that canvas is destroyed. Edit failures are reported by the event
entry point; the core API still does not roll back partial mutations.

Icon-font property changes copy the control event's patch and target before
queuing. They apply to the latest matching icon node even if the panel has since
changed selection. Empty and unchanged patches, removed targets, and targets
whose type changed are skipped without a history entry.

### Queued transform properties

The Spectrum width, height, position, rotation, and aspect-ratio lock controls
submit through `api.edit()`. Each event captures its numeric input and source
canvas and node before queuing. The commit resolves the current node, so changing
selection cannot redirect it and queued lock toggles compose in order. Locked
resizing uses the dimensions and lock state current at commit time. Deleted or
type-replaced targets are skipped, and canvas destruction cancels pending edits.

Numeric controls preserve fractional values. Empty, invalid, and nonfinite
inputs, negative dimensions, and unusable locked aspect ratios are ignored before
writing. Controls resynchronize with the document after a rejected edit.
Unchanged values do not consume unrelated pending history changes.
Explicitly entering a flex container dimension still disables hugging on that
axis, even when the numeric value is unchanged. Each effective command forms one
undo entry; edit failures are observed without changing the core no-rollback
contract. Layout and corner-radius controls use the same queued-edit contract,
as described below; remaining property groups and vector commands are being
migrated separately.

### Queued layout and corner-radius properties

Container spacing and alignment, flex-item sizing and constraints, and rectangle
corner-radius controls capture their source canvas, node, and event value before
queuing. Side-specific padding and margin edits merge into the latest box at
commit time, preserving edits to the other sides. Existing one-, two-, and
four-value box representations remain supported.

Clearing an optional layout number removes its explicit value, while entering
zero keeps an explicit zero. Clearing one box side sets that side to zero;
selecting align-self Auto removes its override. Clearing a corner-radius input
retains the current radius. Invalid numeric values and picker choices are ignored.
Unchanged commands are cancelled before writing so unrelated pending changes do
not enter their history. Controls resynchronize after a failed edit.

Variable binding captures the selected key and requires a current numeric
variable. Detaching resolves the current node's binding against the variables
and theme at commit time, preserving a valid literal radius. Missing or
unresolvable references remain bound. Deleted and type-replaced nodes are skipped,
and canvas destruction cancels pending edits. Every effective command commits
once; the core API's no-rollback behavior remains unchanged.
