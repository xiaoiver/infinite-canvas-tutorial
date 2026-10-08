---
'@infinite-canvas-tutorial/lasso': patch
---

Fix lasso selection crashing on locked-component access. Commit selection after release in the canvas edit phase, hit-test transformed rectangles, polylines and ellipses in world space, and discard taps and cancelled gestures. Preserve mask drawing and clean up trails when their canvas is destroyed.
