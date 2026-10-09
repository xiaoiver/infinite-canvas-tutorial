---
'@infinite-canvas-tutorial/ecs': patch
---

Keep pointer event callbacks attached to a stable ECS entity handle. Release selection input and transformer state when a gesture is cancelled or its tool changes, retaining the last transform as one undoable operation while preserving vector-edit rollback. Exclude hidden shapes from click and marquee selection.
