---
"@infinite-canvas-tutorial/webcomponents": patch
"@infinite-canvas-tutorial/ecs": patch
---

Queue effect parameters, rows, gradient colors and layer blend modes through `api.edit()`. Preserve consecutive edits and independent undo, cancel stale targets, and restore controls after failure. Initialize the background before compositing a bottommost blended node so rendering and queued edits keep running.
