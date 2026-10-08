---
'@infinite-canvas-tutorial/webcomponents': patch
'@infinite-canvas-tutorial/ecs': patch
---

Queue crop controls within canvas-bound sessions, cancelling stale commands when
crop targets, tools, history, or component lifetimes change. Preserve image
proportions and center during scaling and image placement when changing aspect
under rotated or flipped clip transforms. Handle nested aspect events once and
keep each effective input as one undo entry.

Share the core crop-exit implementation and ignore missing or deleted targets.
Existing cancellation semantics continue to retain the current crop geometry.
