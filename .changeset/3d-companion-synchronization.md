---
'@infinite-canvas-tutorial/ecs': patch
---

Declare the component access required to create and synchronize mesh3d and extruded-rectangle companion entities. Keep their transforms and materials in sync after ordinary canvas movement, and mirror selection to existing mesh gizmos.

Preserve the gizmo's latest pose during consecutive drag frames while continuing to apply material changes. Clean up replaced extrusion companions without deleting the current mesh.
