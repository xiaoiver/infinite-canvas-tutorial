---
'@infinite-canvas-tutorial/ecs': patch
---

Recognize gradient functions and orientation keywords case-insensitively without mistaking image URLs for gradients. Preserve vertical positions in `top center` and `bottom center`, and keep radial side distances nonnegative when the center is outside the bounds.

Convert conic gradient angles from degrees to radians consistently for ordinary fills and filter inputs. Preserve an explicit tenth mesh-gradient control point in modes with a variable point count.
