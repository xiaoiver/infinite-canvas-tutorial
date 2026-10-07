---
'@infinite-canvas-tutorial/ecs': patch
---

Keep resize size labels outside flipped bounds with a consistent screen-space gap, accounting for existing reflections, nonuniform scale, and shape/camera rotation. Include the OBB scale in displayed dimensions. Center line labels along the projected line and reset their transform origin when reusing a rectangle label.
