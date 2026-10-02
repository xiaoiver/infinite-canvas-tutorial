---
'@infinite-canvas-tutorial/ecs': minor
---

Add api.edit() for synchronous, canvas-owned edits with one history commit,
Promise completion, AbortSignal cancellation, destruction cleanup, and isolated
errors. Refresh design-variable bindings within the edit's write phase. Preserve
runAtNextTick timing, nested scheduling, and independent undo steps. React editing
actions now use this shared core interface.
