---
'@infinite-canvas-tutorial/core': patch
'@infinite-canvas-tutorial/ecs': patch
---

Share immutable stroke-page vertex/index buffers within each device, release them after the final page retires, and keep writable buffers owned through upload failures.
