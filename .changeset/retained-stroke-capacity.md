---
'@infinite-canvas-tutorial/core': patch
'@infinite-canvas-tutorial/ecs': patch
---

Retain bounded dynamic stroke buffer capacity across geometry updates, while preserving active instance counts and complete current uploads. Round new capacity to 16 segment rows, shrink below half capacity and release storage with its page.
