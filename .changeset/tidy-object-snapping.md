---
'@infinite-canvas-tutorial/ecs': patch
---

Compute object snapping from unsnapped pointer displacement to prevent sticky dragging, independently of pixel-grid snapping and with a zoom-independent screen-pixel radius. Add edge, corner and endpoint resize snapping with aspect, centered and rotated constraints; exclude moving descendants and hidden references. Prioritize precise edge resize hits over nearby rotation rings on small shapes.
