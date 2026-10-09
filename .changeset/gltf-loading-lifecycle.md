---
'@infinite-canvas-tutorial/ecs': patch
---

Include the scene in glTF mesh cache keys and evict failed loads so they can be retried without clearing the cache. Invalidated requests cannot evict newer loads.

Preserve imported glTF colors and textures across ECS synchronization, edits, undo/redo, and reload, while keeping document material overrides independent. Ignore obsolete failure callbacks after switching models. Declare the ECS component access needed to detect live model entities. Automatically retry transient model failures with exponential backoff capped at 30 seconds instead of downloading on every frame.
