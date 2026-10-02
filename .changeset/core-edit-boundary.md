---
'@infinite-canvas-tutorial/ecs': minor
'@infinite-canvas-tutorial/webcomponents': patch
---

Add api.edit() for synchronous, canvas-owned edits with one history commit,
Promise completion, AbortSignal cancellation, destruction cleanup, and isolated
errors. Run edits and undo/redo in invocation order in a dedicated Edit stage,
before geometry, transforms, bounds, and rendering. Refresh design-variable
bindings within that write phase. Preserve late runAtNextTick timing, nested
scheduling, deletion cleanup, and independent undo steps. React editing actions
now use this shared core interface.

Order Web Components initialization and READY handlers before edits, consume
previous-frame output events before initialization, and read current input/camera
coordinates for comments. Use explicit phases to avoid inferred dependency cycles.

Prevent geometry/style refreshes from re-adding entities marked for deletion to
render batches. Destroy their cached drawcalls even when they are also culled,
so consecutive hierarchy undo/redo cannot render entities after deletion.
