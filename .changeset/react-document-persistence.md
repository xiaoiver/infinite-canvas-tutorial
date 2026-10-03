---
'@infinite-canvas-tutorial/ecs': minor
---

Queue native .ic document imports in the Edit phase and return Promise<boolean>
after a single commit. Validate node types, IDs, and hierarchy before mutation,
copy queued inputs, support AbortSignal cancellation, and restore ECS selection.
Imports no longer wait for a separate post-deletion task. Keep recordHistory:
false imports outside undo history. Add React examples for browser-local saves
and native document file import/export.
