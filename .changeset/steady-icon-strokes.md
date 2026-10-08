---
'@infinite-canvas-tutorial/ecs': patch
---

Fix icon resize crashes by granting the selection system write access to stroke
layers rebuilt on the icon's child shapes during resizing.

Recompute ordering keys for the whole subtree when an icon/group root changes
z-order, and preserve the order of siblings with equal z-index values. This
prevents stale ordering keys from breaking resize undo/redo.
