---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/webcomponents': patch
---

Queue layer selection and Escape in event order with independent undo steps, skipping unchanged and stale commands without recording pending edits. Keep Escape scoped to its canvas, clean up shortcut listeners on API replacement or destruction, and preserve selected ECS components when redoing additive selections.
