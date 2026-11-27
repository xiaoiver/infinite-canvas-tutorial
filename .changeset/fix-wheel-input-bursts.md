---
'@infinite-canvas-tutorial/ecs': patch
---

Preserve ordered wheel and pinch samples received before an engine frame instead of keeping only the last delta. Compose 2D navigation against the current transform so mixed pivots, pan/zoom modes and zoom-limit reversals remain correct.
