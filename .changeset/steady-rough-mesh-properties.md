---
'@infinite-canvas-tutorial/ecs': patch
---

Recompute rough geometry after parameter changes, honor preserved vertices, and restore usable defaults when rough options are cleared. Store fill dash patterns as arrays and use automatic spacing for dashed and zigzag-line fills.

Keep mesh geometry, transforms, materials, and lights consistent across edits, property removal, undo/redo, and document reload. Share 3D wire conversion between loading and editing so replaced materials and cleared properties no longer retain stale values.
