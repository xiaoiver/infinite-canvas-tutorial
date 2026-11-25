---
'@infinite-canvas-tutorial/ecs': patch
---

Add coalesced `API.setCameraView` navigation in the safe early write phase without recording document history. Preserve ordering across edits and cancel pending navigation when a canvas is destroyed.
