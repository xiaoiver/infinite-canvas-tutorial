---
'@infinite-canvas-tutorial/ecs': patch
---

Preserve pattern repetition, intrinsic tile dimensions and local coordinates in SVG exports. Embed decoded pattern images and await paint resources; direct callers of `exportFillGradientOrPattern` and `exportStrokeGradientOrPattern` must now await their promises. Keep text paint definitions intact. Export rough shapes with correct local geometry, independent node/fill/stroke opacity, and hachure fill weight.
