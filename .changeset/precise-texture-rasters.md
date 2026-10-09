---
'@infinite-canvas-tutorial/ecs': patch
---

Separate pattern cache entries by image identity, preserve fractional gradient
parameters and units in cache/export keys, and composite transparent linear
gradient layers over their backdrop. Failed pattern creation stays transparent.
Bound each paint cache to 256 entries with least-recently-used eviction.

Make SVG raster upgrades safe across reset, disposal and out-of-order completion.
Keep shared SVG rasters uncropped and preserve their intrinsic dimensions so
cover, contain, none and scale-down fills remain independent across shapes.
