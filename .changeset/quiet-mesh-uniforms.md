---
'@infinite-canvas-tutorial/ecs': patch
---

Cache 3D model and normal matrices by pose, and skip unchanged model uniform uploads. Refresh 3D layers from ECS membership and metadata changes rather than scanning every idle frame; retain stable entity references for later layer selection.
