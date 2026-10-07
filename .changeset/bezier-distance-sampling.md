---
'@infinite-canvas-tutorial/ecs': patch
---

Fix cubic and quadratic Bézier `getPointAt()` to sample by arc length, consistently with `getTangentAt()`, instead of treating a distance fraction as a curve parameter.
