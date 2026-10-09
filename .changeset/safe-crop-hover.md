---
'@infinite-canvas-tutorial/ecs': patch
---

Finish active crop sessions when switching tools, restoring clipping and lock
state. Safely exit crop when its mask or content is missing or deleted.

Restore mouse and pen hover after pointer cancellation without resuming the
cancelled drag.
