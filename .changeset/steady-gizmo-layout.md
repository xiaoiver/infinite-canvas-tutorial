---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/yoga': patch
---

Cancel 3D gizmo previews when computed source or ancestor layout changes. Preserve newer layout coordinates on cancellation and restore the computed starting position on Escape. Avoid duplicate companion-to-source writes during pointer previews, and declare Yoga's Mesh3DNode write access.
