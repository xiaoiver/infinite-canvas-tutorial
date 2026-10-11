---
'@infinite-canvas-tutorial/ecs': patch
---

Reuse 3D mesh GPU buffers during pose and material edits. Track geometry changes after companion synchronization, preserve pending uploads across skipped draws, and isolate buffers and scene uniforms by canvas. Release resources before their device, reclaim removed or moved meshes, and roll back failed allocations for retry.
