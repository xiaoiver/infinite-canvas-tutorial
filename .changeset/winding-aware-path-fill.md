---
'@infinite-canvas-tutorial/ecs': patch
---

Honor evenodd and compound-path winding rules with the default tessellation option. Resolve nested, reordered and overlapping contours through libtess, and avoid batching paths with different fill rules or tessellators. Keep the single-contour nonzero Earcut path and Rough paint's existing alpha accumulation.

Synchronize live tessellator edits, reset-to-default and undo/redo with the Path component.
