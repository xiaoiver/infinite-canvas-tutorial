---
'@infinite-canvas-tutorial/ecs': patch
---

Cache 3D scene matrices and uniform uploads per canvas, and retain draw bindings
per mesh allocation. Refresh camera and lighting data independently, rebind changed
textures, retry failed uploads or allocations, and release bindings before their
buffers and textures. Share camera calculations with picking and gizmos.
