---
'@infinite-canvas-tutorial/ecs': patch
---

Share the 3D gizmo's CSS-pixel projection between rendering, picking, and pointer gestures. Keep handles at a stable size across canvas aspect ratios, zoom, object depth, and standard perspective or orthographic cameras. Match linked Z translation and depth-plane dragging to the displayed handles, and invert the linked projection for local rotation rings.

Pick overlapping parts of a gizmo in their visible draw order and prioritize gizmo presses over 2D node reselection. Preserve the gesture's initial projection throughout its preview and retain existing cancellation and undo/redo behavior.
