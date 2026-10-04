---
'@infinite-canvas-tutorial/ecs': patch
---

Resolve selection and transformer handles at pointer-down instead of relying on
hover. Give touch resize handles a 44px viewport target, keep rotation outside
that target, and preserve the finger offset so padded hits do not jump on drag.
