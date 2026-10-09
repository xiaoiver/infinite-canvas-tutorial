---
'@infinite-canvas-tutorial/ecs': patch
---

Preserve subpixel pointer coordinates throughout move, resize, and rotate gestures. Fractional coordinates from camera, parent, and CSS transforms no longer shift snapping thresholds or fixed anchors through integer truncation.

Restore omitted camera properties when navigating to a partial landmark, including zooming around a viewport anchor. Partial landmarks now use the same explicit camera snapshot as `createLandmark`.
