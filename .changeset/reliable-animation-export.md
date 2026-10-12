---
'@infinite-canvas-tutorial/ecs': patch
---

Release recording tracks and temporary canvases after GIF/WebM exports, including failures. Abort pending recording work on errors, reject empty or partial output and changing frame sizes, and wait for presentation before reading GIF frames. Preserve source canvases so failed exports can be retried.
