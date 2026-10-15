---
'@infinite-canvas-tutorial/ecs': patch
---

Add a standalone geometry generator for extruding flattened, closed Path contours. Resolve filled boundaries with libtess before generating caps and sidewalls, and reject empty or non-manifold volumes with an explicit reason.
