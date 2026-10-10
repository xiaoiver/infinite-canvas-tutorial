---
'@infinite-canvas-tutorial/ecs': patch
---

Avoid redundant 3D companion transform/material writes, repeated procedural geometry generation, and unchanged gizmo selection refreshes. Cancel active gizmo gestures when their camera/view or source/ancestor document pose changes, restoring the current document and ignoring stale releases while preserving unrelated edits.
