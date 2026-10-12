---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/filter': patch
---

Compose multiple fills before running their raster filter chain, preserving lower layers, blend modes and opacity. Release superseded Mesh fill textures and removed filter chains, and avoid destroying render-target textures twice.
