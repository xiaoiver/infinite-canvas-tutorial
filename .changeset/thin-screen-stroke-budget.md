---
'@infinite-canvas-tutorial/core': patch
'@infinite-canvas-tutorial/ecs': patch
---

Reduce redundant curve subdivisions in opt-in screen StrokeBatch pages for simple open Bézier strokes no wider than one physical pixel, using the existing centerline, join and endpoint error budgets. Keep default full drawcalls, exports, source geometry and interaction bounds unchanged. Compound, closed and unproved curves keep their original sampling.
