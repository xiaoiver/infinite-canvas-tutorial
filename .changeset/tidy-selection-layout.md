---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/webcomponents': patch
---

Preserve dimensions, rotation, reflection and local geometry when aligning or distributing shapes. Deduplicate selection IDs, move selected subtrees once, and skip invalid bounds and singular parent transforms. Calculate spacing from the complete selection extent.

Queue properties-panel layout actions through the canvas edit API, retaining the accepted canvas and node IDs. Unchanged or invalidated layouts do not create an extra undo entry.
