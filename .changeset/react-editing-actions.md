---
'@infinite-canvas-tutorial/react': minor
---

Add useCanvasActions for scoped, stable editing commands. Schedule synchronous edits at ECS frame boundaries, read current state in functional updates, and commit compound edits once. Cancel pending work when its canvas is removed, route retained actions to the current canvas, and refresh non-history view state for React selectors. Provide node upserts, application-state patches, ID-based selection, undo, redo, and history clearing; update the bilingual playground and framework starters to use these hooks.
