---
'@infinite-canvas-tutorial/ecs': patch
---

Separate gizmo GPU resources from ECS selection and camera handling. Keep uniform
buffers distinct for each selected object and handle, reuse shared geometry, and
release owned buffers and bindings before their canvas GPU resources. Rebuild
resources when the device, render cache, or resource scope changes, and clean up
partial allocations without destroying borrowed pipelines.

Resolve the 3D renderer by canvas and attach gizmos within their owning World, so
a failed concurrent App initialization cannot replace an active renderer.
