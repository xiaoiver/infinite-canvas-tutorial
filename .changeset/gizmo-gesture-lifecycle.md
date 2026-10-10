---
'@infinite-canvas-tutorial/ecs': patch
---

Separate 3D gizmo gesture math, pointer rays, and per-canvas preview sessions. Commit declarative mesh transforms once on release, include the release position, and restore previews on cancellation, Escape, or tool changes. Preserve independent gestures across canvases and handle a complete gesture delivered within one frame.

Convert companion centers through parent transforms, compose rotations around local gizmo axes, and support front-facing orthographic translation constraints. Resolve held ECS entity references by identity when looking up their document nodes. Share the 2D transformer suppression rule between rendering and picking to avoid reading absent anchors when a 3D gizmo is active.
